import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { InventoryService } from './inventory.service';
import { OnlineTimeService } from './onlineTime.service';

export class ReceivingService {
  private static async routeToDeliveryForms(
    connection: any,
    requestId: number,
    userId: number | null,
    actorName = '',
    actorRole = ''
  ) {
    await connection.query(`
      UPDATE requests
      SET status = 'DeliveryFormsRequested',
          progress_percent = 82,
          current_stage = 'DeliveryFormsRequested',
          assigned_role = 'REQUESTER'
      WHERE id = ?
    `, [requestId]);

    // Receiving and its mandatory delivery-form transition are one transaction,
    // so a dropped browser/network call cannot bypass Proposal + FS-5.
    await connection.query(`
      INSERT INTO request_pipeline
        (request_id, status, stage_label, progress, action_by, action_by_name, action_by_role,
         assigned_role, next_action, comment, work_complete)
      SELECT ?, 'DeliveryFormsRequested',
             'اجناس ګدام ته داخل شول - د تسلیمۍ فورمونه غوښتل شوي',
             82, ?, ?, ?, 'REQUESTER',
             'د تسلیمۍ لپاره پیشنهاد او ف.س-۵ جوړ او واستوئ',
             'تدارکاتي اجناس ګدام ته داخل شول؛ د تسلیمۍ فورمونه باید غوښتونکی جوړ کړي.',
             0
      WHERE NOT EXISTS (
        SELECT 1 FROM request_pipeline
        WHERE request_id = ?
          AND status IN ('FS5Required', 'DeliveryFormsRequested')
      )
    `, [
      requestId,
      userId?.toString() ?? '',
      actorName,
      actorRole,
      requestId,
    ]);
  }

  private static async ensureInventoryItemForReceiving(
    connection: any,
    item: any,
    userId: number | null
  ): Promise<number> {
    const itemName = item.item_name || item.name || item.itemName || 'جنس جدید';
    const itemCode = item.item_code || item.code || `RCV-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const categoryId = Number(item.category_id || item.categoryId || 1);
    const unitId = Number(item.unit_id || item.unitId || 1);
    const warehouseId = Number(item.warehouse_id || item.warehouseId || 1);

    const [result] = (await connection.query(`
      INSERT INTO items (item_code, name_ps, name_fa, description, category_id, unit_id, warehouse_id,
        minimum_stock, unit_price, supplier_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      itemCode,
      itemName,
      itemName,
      item.notes || item.description || item.specifications || '',
      categoryId,
      unitId,
      warehouseId,
      0,
      Number(item.unit_price || item.unitPrice || 0),
      item.supplier_source || item.supplierSource || '',
    ])) as [ResultSetHeader, any];

    const newItemId = result.insertId;
    const trackingCode = `RCV-${newItemId}`;

    await connection.query(
      `UPDATE items SET tracking_code = ?, barcode_generated_at = NOW() WHERE id = ?`,
      [trackingCode, newItemId]
    );

    await connection.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, 'CREATE', 'ITEM', newItemId, JSON.stringify({ source: 'receiving', name: itemName, tracking_code: trackingCode })]);

    return newItemId;
  }

  static async getRecords() {
    const [rows] = await db.query(`
      SELECT rr.*, po.po_number, r.tracking_id as request_tracking_id
      FROM receiving_records rr
      LEFT JOIN purchase_orders po ON rr.purchase_order_id = po.id
      LEFT JOIN requests r ON rr.request_id = r.id
      WHERE rr.is_deleted = FALSE
      ORDER BY rr.created_at DESC
    `);
    return rows;
  }

  static async getRecordById(id: number) {
    const [records] = await db.query<RowDataPacket[]>(`
      SELECT rr.*, po.po_number, r.tracking_id as request_tracking_id
      FROM receiving_records rr
      LEFT JOIN purchase_orders po ON rr.purchase_order_id = po.id
      LEFT JOIN requests r ON rr.request_id = r.id
      WHERE rr.id = ? AND rr.is_deleted = FALSE
    `, [id]);

    if (records.length === 0) return null;

    const [items] = await db.query<RowDataPacket[]>(`
      SELECT ri.*, i.name_ps as item_name, u.name_ps as unit_name
      FROM receiving_items ri
      LEFT JOIN items i ON ri.item_id = i.id
      LEFT JOIN units u ON ri.unit_id = u.id
      WHERE ri.receiving_record_id = ?
    `, [id]);

    return { ...records[0], items };
  }

  static async createFromRequest(
    requestIdOrTracking: string | number,
    notes: string,
    userId: number | null,
    actorName = '',
    actorRole = ''
  ) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      let numericId: number;
      if (typeof requestIdOrTracking === 'number' || /^\d+$/.test(String(requestIdOrTracking))) {
        numericId = Number(requestIdOrTracking);
      } else {
        const [trackRows] = await db.query<RowDataPacket[]>('SELECT id FROM requests WHERE tracking_id = ? AND is_deleted = FALSE', [String(requestIdOrTracking)]);
        if (trackRows.length > 0) {
          numericId = trackRows[0].id;
        } else {
          throw new Error('request_not_found');
        }
      }

      const [reqs] = await db.query<RowDataPacket[]>(`SELECT id FROM requests WHERE id = ? AND is_deleted = FALSE`, [numericId]);
      if (reqs.length === 0) throw new Error('request_not_found');

      const [poRows] = await db.query<RowDataPacket[]>(`
        SELECT po.id FROM purchase_orders po
        JOIN procurement_cases pc ON po.procurement_case_id = pc.id
        WHERE pc.request_id = ? AND po.is_deleted = FALSE
        ORDER BY po.created_at DESC LIMIT 1
      `, [numericId]);

      const purchaseOrderId = poRows.length > 0 ? poRows[0].id : null;

      const [result] = await connection.query<ResultSetHeader>(`
        INSERT INTO receiving_records (purchase_order_id, request_id, received_by, notes)
        VALUES (?, ?, ?, ?)
      `, [purchaseOrderId, numericId, userId, notes]);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `, [userId, 'CREATE', 'RECEIVING_RECORD', result.insertId]);

      await this.routeToDeliveryForms(connection, numericId, userId, actorName, actorRole);

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async createFromPurchaseOrder(
    purchaseOrderId: number,
    notes: string,
    userId: number | null,
    actorName = '',
    actorRole = ''
  ) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [pos] = await db.query<RowDataPacket[]>(`
        SELECT procurement_case_id FROM purchase_orders WHERE id = ? AND is_deleted = FALSE
      `, [purchaseOrderId]);
      
      if (pos.length === 0) throw new Error('po_not_found');

      const procCaseId = pos[0].procurement_case_id;

      const [cases] = await db.query<RowDataPacket[]>(`SELECT request_id FROM procurement_cases WHERE id = ?`, [procCaseId]);
      const requestId = cases[0]?.request_id || null;

      const [result] = await connection.query<ResultSetHeader>(`
        INSERT INTO receiving_records (purchase_order_id, request_id, received_by, notes)
        VALUES (?, ?, ?, ?)
      `, [purchaseOrderId, requestId, userId, notes]);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `, [userId, 'CREATE', 'RECEIVING_RECORD', result.insertId]);

      if (requestId) {
        await this.routeToDeliveryForms(connection, requestId, userId, actorName, actorRole);
      }

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async addReceivingItems(recordId: number, items: any[], userId: number | null) {
    const trustedCreatedAt = await OnlineTimeService.getTrustedNow();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const item of items) {
        const quantity = Number(item.quantity_received || item.quantity || 0);
        if (!quantity || quantity <= 0) continue;

        let resolvedItemId: number;
        try {
          resolvedItemId = await InventoryService.resolveItemId({
            item_id: item.item_id,
            checklist_id: item.checklist_id,
            item_name: item.item_name,
          });
        } catch {
          resolvedItemId = await this.ensureInventoryItemForReceiving(connection, item, userId);
        }

        // Add to receiving items
        await connection.query(`
          INSERT INTO receiving_items (receiving_record_id, item_id, quantity_received, unit_id, notes)
          VALUES (?, ?, ?, ?, ?)
        `, [recordId, resolvedItemId, quantity, item.unit_id || null, item.notes || '']);

        // Update Stock
        const [stockRows] = await connection.query<RowDataPacket[]>(`SELECT current_stock FROM items WHERE id = ? FOR UPDATE`, [resolvedItemId]);
        if (stockRows.length > 0) {
          const prevStock = Number(stockRows[0].current_stock || 0);
          const newStock = prevStock + quantity;

          await connection.query(`UPDATE items SET current_stock = ? WHERE id = ?`, [newStock, resolvedItemId]);

          await connection.query(`
            INSERT INTO stock_transactions (item_id, transaction_type, quantity, previous_stock, new_stock, source_type, reference_id, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [resolvedItemId, 'IN', quantity, prevStock, newStock, 'RECEIVING', recordId.toString(), userId, trustedCreatedAt]);
        }
      }

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `, [userId, 'ADD_ITEMS', 'RECEIVING_RECORD', recordId]);

      await connection.query(`
        UPDATE requests r
        JOIN receiving_records rr ON rr.request_id = r.id
        SET r.status = 'DeliveryFormsRequested',
            r.progress_percent = 82,
            r.current_stage = 'REQUESTER',
            r.assigned_role = 'REQUESTER'
        WHERE rr.id = ?
      `, [recordId]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
