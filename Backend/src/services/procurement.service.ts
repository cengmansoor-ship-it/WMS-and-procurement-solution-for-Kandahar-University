import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';

export class ProcurementService {
  static async getCases() {
    const [rows] = await db.query(`
      SELECT p.*, r.tracking_id as request_tracking_id
      FROM procurement_cases p
      LEFT JOIN requests r ON p.request_id = r.id
      WHERE p.is_deleted = FALSE
      ORDER BY p.created_at DESC
    `);
    return rows;
  }

  static async getCaseById(id: number) {
    const [cases] = await db.query<RowDataPacket[]>(`
      SELECT p.*, r.tracking_id as request_tracking_id
      FROM procurement_cases p
      LEFT JOIN requests r ON p.request_id = r.id
      WHERE p.id = ? AND p.is_deleted = FALSE
    `, [id]);

    if (cases.length === 0) return null;

    const [offers] = await db.query<RowDataPacket[]>(`
      SELECT o.*, v.name as vendor_name, v.phone as vendor_phone, v.address as vendor_address
      FROM vendor_offers o
      LEFT JOIN vendors v ON o.vendor_id = v.id
      WHERE o.procurement_case_id = ?
    `, [id]);

    const offersWithItems = offers.map((o: any) => {
      let details: any = {};
      try { details = typeof o.details_json === 'string' ? JSON.parse(o.details_json) : (o.details_json || {}); } catch {}
      // Offer item prices must come only from the Prices / Offers entry.
      // Never manufacture per-item prices from the original request totals.
      const items = Array.isArray(details.items) ? details.items : [];
      return { ...o, items };
    });

    const [po] = await db.query<RowDataPacket[]>(`
      SELECT po.*, v.name as vendor_name
      FROM purchase_orders po
      LEFT JOIN vendors v ON po.vendor_id = v.id
      WHERE po.procurement_case_id = ? AND po.is_deleted = FALSE
    `, [id]);

    return { ...cases[0], offers: offersWithItems, purchase_order: po[0] || null };
  }

  static async createFromRequest(requestId: number, reason: string, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [reqs] = await connection.query<RowDataPacket[]>(`SELECT id FROM requests WHERE id = ? AND is_deleted = FALSE`, [requestId]);
      if (reqs.length === 0) throw new Error('request_not_found');

      const [existing] = await connection.query<RowDataPacket[]>(`SELECT id FROM procurement_cases WHERE request_id = ? AND is_deleted = FALSE`, [requestId]);
      if (existing.length > 0) throw new Error('case_exists');

      const [result] = await connection.query<ResultSetHeader>(`
        INSERT INTO procurement_cases (request_id, reason)
        VALUES (?, ?)
      `, [requestId, reason]);

      const caseId = result.insertId;

      await connection.query(`UPDATE requests SET status = 'SENT_TO_PROCUREMENT', progress_percent = 40 WHERE id = ?`, [requestId]);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `, [userId, 'CREATE', 'PROCUREMENT_CASE', caseId]);

      await connection.commit();
      return caseId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async resolveVendorId(data: any): Promise<number> {
    if (data.vendor_id && !isNaN(Number(data.vendor_id))) return Number(data.vendor_id);
    if (data.vendor_name) {
      const normalizedPhone = String(data.vendor_phone || '').replace(/\D/g, '');
      if (!/^07\d{8}$/.test(normalizedPhone)) {
        throw new Error('invalid_vendor_phone');
      }
      const [existing] = await db.query<RowDataPacket[]>(
        `SELECT id FROM vendors WHERE name = ? AND is_deleted = FALSE LIMIT 1`, [data.vendor_name]
      );
      if ((existing as RowDataPacket[]).length > 0) {
        const vendorId = (existing as RowDataPacket[])[0].id;
        await db.query(`UPDATE vendors SET phone = ?, address = COALESCE(NULLIF(?, ''), address) WHERE id = ?`,
          [normalizedPhone, data.vendor_address || '', vendorId]);
        return vendorId;
      }
      const [created] = await db.query<ResultSetHeader>(
        `INSERT INTO vendors (name, phone, address) VALUES (?, ?, ?)`,
        [data.vendor_name, normalizedPhone, data.vendor_address || null]
      );
      return created.insertId;
    }
    throw new Error('vendor_id or vendor_name required');
  }

  static async addVendorOffer(caseId: number, data: any, userId: number | null) {
    const [caseRows] = await db.query<RowDataPacket[]>(`
      SELECT p.request_id,
        EXISTS(
          SELECT 1
          FROM official_form_instances f
          WHERE f.request_id = p.request_id
            AND f.form_type = 'Tender'
            AND f.is_deleted = FALSE
        ) AS tender_saved
      FROM procurement_cases p
      WHERE p.id = ? AND p.is_deleted = FALSE
      LIMIT 1
    `, [caseId]);
    if (caseRows.length === 0) throw new Error('case_not_found');
    if (!Boolean(caseRows[0].tender_saved)) throw new Error('tender_required');

    const vendorId = await ProcurementService.resolveVendorId(data);
    const rawItems = Array.isArray(data?.details?.items) ? data.details.items : [];
    if (rawItems.length === 0) throw new Error('invalid_offer_items');

    const items = rawItems.map((item: any) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price ?? item.unitPrice);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error('invalid_offer_items');
      }
      return {
        item_id: item.item_id ?? item.itemId ?? '',
        item_name: item.item_name ?? item.itemName ?? '',
        specifications: item.specifications ?? '',
        quantity,
        unit: item.unit ?? '',
        unit_price: unitPrice,
        total_price: quantity * unitPrice,
      };
    });

    const totalPrice = items.reduce((sum: number, item: any) => sum + item.total_price, 0);
    const details = {
      ...(data.details || {}),
      items,
    };
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO vendor_offers (procurement_case_id, vendor_id, total_price, currency, details_json)
      VALUES (?, ?, ?, ?, ?)
    `, [caseId, vendorId, totalPrice, data.currency || 'AFN', JSON.stringify(details)]);

    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, 'ADD_OFFER', 'PROCUREMENT_CASE', caseId, JSON.stringify(data)]);

    const [offerCountRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS offer_count FROM vendor_offers WHERE procurement_case_id = ?`,
      [caseId],
    );
    const offerCount = Number(offerCountRows[0]?.offer_count || 0);
    if (offerCount >= 3) {
      await db.query(`
        UPDATE procurement_cases
        SET status = 'OFFERS_RECEIVED'
        WHERE id = ?
          AND status IN ('OPEN', 'TENDER_CREATED', 'OFFERS_RECEIVED')
      `, [caseId]);
      await db.query(`
        UPDATE requests
        SET status = 'OffersReceived',
            progress_percent = GREATEST(progress_percent, 45),
            current_stage = 'OffersReceived',
            assigned_role = 'PROCUREMENT_DIRECTOR'
        WHERE id = ?
      `, [caseRows[0].request_id]);
    } else {
      await db.query(`
        UPDATE procurement_cases
        SET status = 'TENDER_CREATED'
        WHERE id = ? AND status = 'OPEN'
      `, [caseId]);
    }

    return result.insertId;
  }

  static async selectWinner(caseId: number, offerId: number, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [offers] = await connection.query<RowDataPacket[]>(`SELECT id FROM vendor_offers WHERE procurement_case_id = ?`, [caseId]);
      if (offers.length < 3) throw new Error('need_three_offers');

      const offerExists = offers.some(o => o.id === offerId);
      if (!offerExists) throw new Error('offer_not_found');

      const [comparisonForms] = await connection.query<RowDataPacket[]>(`
        SELECT f.id
        FROM official_form_instances f
        JOIN procurement_cases p ON p.request_id = f.request_id
        WHERE p.id = ?
          AND f.form_type = 'Comparison'
          AND f.is_deleted = FALSE
        LIMIT 1
      `, [caseId]);
      if (comparisonForms.length === 0) throw new Error('comparison_required');

      await connection.query(`UPDATE vendor_offers SET is_winner = FALSE WHERE procurement_case_id = ?`, [caseId]);
      await connection.query(`UPDATE vendor_offers SET is_winner = TRUE WHERE id = ?`, [offerId]);
      
      await connection.query(`UPDATE procurement_cases SET status = 'WINNER_SELECTED' WHERE id = ?`, [caseId]);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'SELECT_WINNER', 'PROCUREMENT_CASE', caseId, JSON.stringify({ winner_offer_id: offerId })]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async createPurchaseOrder(caseId: number, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [winners] = await connection.query<RowDataPacket[]>(`
        SELECT vendor_id, total_price FROM vendor_offers 
        WHERE procurement_case_id = ? AND is_winner = TRUE
      `, [caseId]);
      if (winners.length === 0) throw new Error('no_winner_selected');

      const [purchaseOrderForms] = await connection.query<RowDataPacket[]>(`
        SELECT f.id
        FROM official_form_instances f
        JOIN procurement_cases p ON p.request_id = f.request_id
        WHERE p.id = ?
          AND f.form_type = 'PurchaseOrder'
          AND f.is_deleted = FALSE
        LIMIT 1
      `, [caseId]);
      if (purchaseOrderForms.length === 0) throw new Error('purchase_order_form_required');

      const winner = winners[0];

      const [existingPo] = await connection.query<RowDataPacket[]>(`
        SELECT id FROM purchase_orders
        WHERE procurement_case_id = ? AND is_deleted = FALSE
        ORDER BY id DESC
        LIMIT 1
      `, [caseId]);
      if (existingPo.length > 0) {
        await connection.query(`UPDATE procurement_cases SET status = 'PO_CREATED' WHERE id = ?`, [caseId]);
        await connection.commit();
        return existingPo[0].id;
      }

      const poNumber = 'PO-' + Date.now();

      const [result] = await connection.query<ResultSetHeader>(`
        INSERT INTO purchase_orders (procurement_case_id, vendor_id, po_number, total_amount)
        VALUES (?, ?, ?, ?)
      `, [caseId, winner.vendor_id, poNumber, winner.total_price]);

      await connection.query(`UPDATE procurement_cases SET status = 'PO_CREATED' WHERE id = ?`, [caseId]);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'CREATE', 'PURCHASE_ORDER', result.insertId, JSON.stringify({ po_number: poNumber })]);

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
