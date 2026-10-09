import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { InventoryService } from './inventory.service';
import { RequestService } from './request.service';
import { OnlineTimeService } from './onlineTime.service';

export class DeliveryService {
  static async getDeliveries() {
    const [rows] = await db.query(`
      SELECT d.*, r.tracking_id as request_tracking_id, p.full_name as delivered_to_name
      FROM deliveries d
      LEFT JOIN requests r ON d.request_id = r.id
      LEFT JOIN people p ON d.delivered_to_person_id = p.id
      WHERE d.is_deleted = FALSE
      ORDER BY d.created_at DESC
    `);
    return rows;
  }

  static async getDeliveryById(id: number) {
    const [deliveries] = await db.query<RowDataPacket[]>(`
      SELECT d.*, r.tracking_id as request_tracking_id, p.full_name as delivered_to_name
      FROM deliveries d
      LEFT JOIN requests r ON d.request_id = r.id
      LEFT JOIN people p ON d.delivered_to_person_id = p.id
      WHERE d.id = ? AND d.is_deleted = FALSE
    `, [id]);

    if (deliveries.length === 0) return null;

    const [items] = await db.query<RowDataPacket[]>(`
      SELECT di.*, i.name_ps as item_name, u.name_ps as unit_name
      FROM delivery_items di
      LEFT JOIN items i ON di.item_id = i.id
      LEFT JOIN units u ON di.unit_id = u.id
      WHERE di.delivery_id = ?
    `, [id]);

    return { ...deliveries[0], items };
  }

  static async createFromRequest(requestId: number, data: any, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [reqs] = await db.query<RowDataPacket[]>(`SELECT id, person_id FROM requests WHERE id = ? AND is_deleted = FALSE`, [requestId]);
      if (reqs.length === 0) throw new Error('request_not_found');

      const personId = data.delivered_to_person_id || reqs[0].person_id || null;

      const [result] = await connection.query<ResultSetHeader>(`
        INSERT INTO deliveries (request_id, delivered_to_person_id, delivered_by, fs5_number, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [requestId, personId, userId, data.fs5_number || null, data.notes || '']);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `, [userId, 'CREATE', 'DELIVERY', result.insertId]);

      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async addDeliveryItems(deliveryId: number, items: any[], userId: number | null) {
    const trustedCreatedAt = await OnlineTimeService.getTrustedNow();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [deliveries] = await connection.query<RowDataPacket[]>(`
        SELECT request_id, delivered_to_person_id FROM deliveries WHERE id = ?
      `, [deliveryId]);
      if (deliveries.length === 0) throw new Error('delivery_not_found');
      
      const reqId = deliveries[0].request_id;
      const personId = deliveries[0].delivered_to_person_id;

      let deptId = null;
      let facId = null;

      if (personId) {
        const [persons] = await connection.query<RowDataPacket[]>(`
          SELECT p.department_id, d.faculty_id FROM people p 
          LEFT JOIN departments d ON p.department_id = d.id 
          WHERE p.id = ?
        `, [personId]);
        if (persons.length > 0) {
          deptId = persons[0].department_id;
          facId = persons[0].faculty_id;
        }
      }

      // Fetch FS5 number and request tracking_id for traceability linking
      const [deliveryMeta] = await connection.query<RowDataPacket[]>(
        `SELECT d.fs5_number, r.tracking_id FROM deliveries d LEFT JOIN requests r ON d.request_id = r.id WHERE d.id = ?`,
        [deliveryId]
      );
      const fs5Ref = deliveryMeta[0]?.fs5_number || null;
      const trackingId = deliveryMeta[0]?.tracking_id || null;

      for (const item of items) {
        const qty = Number(item.quantity);
        if (!qty || qty <= 0) continue;

        const resolvedItemId = await InventoryService.resolveItemId({
          item_id: item.item_id,
          checklist_id: item.checklist_id,
          item_name: item.item_name,
        });

        const [stockRows] = await connection.query<RowDataPacket[]>(`SELECT current_stock FROM items WHERE id = ? FOR UPDATE`, [resolvedItemId]);
        if (stockRows.length === 0) throw new Error(`item_not_found: ${resolvedItemId}`);
        
        const prevStock = Number(stockRows[0].current_stock);
        if (prevStock < qty) throw new Error(`insufficient_stock_for_item: ${resolvedItemId}`);

        const newStock = prevStock - qty;

        // Add to delivery items
        await connection.query(`
          INSERT INTO delivery_items (delivery_id, item_id, quantity, unit_id, notes)
          VALUES (?, ?, ?, ?, ?)
        `, [deliveryId, resolvedItemId, qty, item.unit_id || null, item.notes || '']);

        // Update Stock
        await connection.query(`UPDATE items SET current_stock = ? WHERE id = ?`, [newStock, resolvedItemId]);

        // Stock Transaction OUT
        await connection.query(`
          INSERT INTO stock_transactions (item_id, transaction_type, quantity, previous_stock, new_stock, source_type, reference_id, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [resolvedItemId, 'OUT', qty, prevStock, newStock, 'DELIVERY_FS5', deliveryId.toString(), userId, trustedCreatedAt]);

        // Item Assignment — includes traceability fields (tracking_id, delivery_id, fs5_reference, assigned_by)
        await connection.query(`
          INSERT INTO item_assignments
            (item_id, person_id, department_id, faculty_id, quantity, source_type, source_id,
             tracking_id, delivery_id, fs5_reference, assigned_by, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          resolvedItemId, personId, deptId, facId,
          qty, 'DELIVERY', deliveryId,
          trackingId, deliveryId, fs5Ref,
          userId,
          `FS5 تسلیمي — د غوښتنې شمیره: ${trackingId || '-'}`
        ]);
      }

      if (reqId) {
        await connection.query(`UPDATE requests SET status = 'DELIVERED', progress_percent = 100 WHERE id = ?`, [reqId]);
      }

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
        VALUES (?, ?, ?, ?)
      `, [userId, 'ADD_ITEMS', 'DELIVERY', deliveryId]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Final delivery: match items by NAME, deduct warehouse stock, assign to person, mark delivered.
   * Works for both MySQL requests and local/demo requests (request_id optional).
   */
  static async finalizeItems(
    data: {
      request_id?: number | null;
      requester_name?: string | null;
      receiver_person_id?: number | null;
      receiver_name?: string | null;
      items: Array<{ item_name: string; quantity: number; checklist_id?: number | null }>;
      notes?: string;
    },
    userId: number | null
  ) {
    const requestId = data.request_id && !isNaN(Number(data.request_id)) ? Number(data.request_id) : null;
    // For a request delivery, the database requester→person link is
    // authoritative. A frontend user id must never be mistaken for a person id.
    let personId = requestId
      ? null
      : (data.receiver_person_id ? Number(data.receiver_person_id) : null);

    if (requestId) {
      const [reqs] = await db.query<RowDataPacket[]>(
        `SELECT r.id, r.status, r.person_id, r.requester_name_text,
                u.person_id AS requester_person_id
         FROM requests r
         LEFT JOIN users u ON u.id = r.requester_id
         WHERE r.id = ? AND r.is_deleted = FALSE`,
        [requestId]
      );
      if (reqs.length === 0) throw new Error('request_not_found');
      if (['DELIVERED', 'Delivered'].includes(reqs[0].status)) {
        return { already_delivered: true };
      }
      personId = reqs[0].person_id || reqs[0].requester_person_id || null;
      if (!personId && reqs[0].requester_name_text) {
        personId = await InventoryService.findPersonIdByName(reqs[0].requester_name_text);
      }
    } else {
      if (!personId && data.receiver_name) {
        personId = await InventoryService.findPersonIdByName(data.receiver_name);
      }
      if (!personId && data.requester_name) {
        personId = await InventoryService.findPersonIdByName(data.requester_name);
      }
    }

    if (!data.items?.length) throw new Error('no_request_items');
    if (!personId) throw new Error('recipient_person_not_found');

    let deliveryId: number;
    if (requestId) {
      const [deliveries] = await db.query<RowDataPacket[]>(
        `SELECT id FROM deliveries WHERE request_id = ? AND is_deleted = FALSE ORDER BY created_at DESC LIMIT 1`,
        [requestId]
      );
      if (deliveries.length === 0) {
        deliveryId = await this.createFromRequest(requestId, {
          delivered_to_person_id: personId,
          notes: data.notes || 'نهایي سپارنه',
        }, userId);
      } else {
        deliveryId = deliveries[0].id;
        if (personId) {
          await db.query(`UPDATE deliveries SET delivered_to_person_id = ? WHERE id = ?`, [personId, deliveryId]);
        }
      }
    } else {
      const [result] = await db.query<ResultSetHeader>(`
        INSERT INTO deliveries (request_id, delivered_to_person_id, delivered_by, notes)
        VALUES (?, ?, ?, ?)
      `, [null, personId, userId, data.notes || 'نهایي سپارنه (محلي غوښتنه)']);
      deliveryId = result.insertId;
    }

    const [existingItems] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM delivery_items WHERE delivery_id = ?`,
      [deliveryId]
    );
    if (Number(existingItems[0]?.cnt) > 0) {
      if (requestId) {
        await RequestService.updateStatus(requestId, 'Delivered', userId, {
          stageLabelOverride: 'اجناس غوښتونکي ته وسپارل شول',
          actionByRole: 'WAREHOUSE_DIRECTOR',
          comment: 'نهایي سپارنه بشپړه شوه؛ موجودي کمه او اجناس د غوښتونکي په نوم ثبت شول.',
        });
      }
      return { success: true, delivery_id: deliveryId, already_processed: true };
    }

    const apiItems = data.items.map((i) => ({
      item_name: i.item_name,
      checklist_id: i.checklist_id ?? null,
      quantity: Number(i.quantity),
      item_id: null,
    }));

    await this.addDeliveryItems(deliveryId, apiItems, userId);

    if (requestId) {
      await RequestService.updateStatus(requestId, 'Delivered', userId, {
        stageLabelOverride: 'اجناس غوښتونکي ته وسپارل شول',
        actionByRole: 'WAREHOUSE_DIRECTOR',
        comment: 'نهایي سپارنه بشپړه شوه؛ موجودي کمه او اجناس د غوښتونکي په نوم ثبت شول.',
      });
    }

    return { success: true, delivery_id: deliveryId, person_id: personId };
  }

  /**
   * Final delivery step: resolve request line items to inventory IDs, deduct stock, mark DELIVERED.
   */
  static async finalizeFromRequest(requestId: number, userId: number | null) {
    const [reqItems] = await db.query<RowDataPacket[]>(
      `SELECT item_name, quantity, item_id FROM request_items WHERE request_id = ?`,
      [requestId]
    );
    if (reqItems.length === 0) throw new Error('no_request_items');

    const [reqs] = await db.query<RowDataPacket[]>(
      `SELECT requester_name_text, person_id FROM requests WHERE id = ?`,
      [requestId]
    );

    return this.finalizeItems({
      request_id: requestId,
      requester_name: reqs[0]?.requester_name_text,
      receiver_person_id: reqs[0]?.person_id,
      receiver_name: reqs[0]?.requester_name_text,
      items: reqItems.map((ri) => ({
        item_name: ri.item_name,
        quantity: Number(ri.quantity),
        checklist_id: ri.item_id,
      })),
      notes: 'نهایي سپارنه',
    }, userId);
  }
}
