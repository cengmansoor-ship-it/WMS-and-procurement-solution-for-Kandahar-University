import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { OnlineTimeService } from './onlineTime.service';

export interface ItemData {
  item_code: string;
  name_ps: string;
  name_fa: string;
  description?: string;
  category_id: number;
  unit_id: number;
  warehouse_id: number;
  minimum_stock?: number;
  unit_price?: number;
  supplier_source?: string;
  bab_id?: number | null;
  fasl_id?: number | null;
}

export interface StockData {
  item_id: number;
  quantity: number;
  source_type?: string;
  notes?: string;
  unit_price?: number;
  supplier_name?: string;
  document_reference?: string;
  receiver_name?: string;
  receiver_id_no?: string;
  faculty_id?: number;
  department_id?: number;
  person_id?: number;
  linked_request_id?: number;
  fs5_reference?: string;
  academic_level?: string;
  assignment_qr_payload?: object;
}

export interface BulkImportRow {
  name: string;
  typeOrSpecification: string;
  category: string;
  unit: string;
  warehouse: string;
  initialQuantity: number;
  minimumStock: number;
  bab?: string;
  fasl?: string;
  itemCode?: string;
  unitPrice?: number;
  totalPrice?: number;
  company?: string;
  supplier?: string;
  notes?: string;
}

export interface BulkImportResult {
  imported: number;
  duplicates: number;
  invalid: number;
  generatedCodes: number;
  errors: Array<{ row: number; reason: string }>;
  importedItems: Array<{ id: number; tracking_code: string; name: string }>;
}

export class InventoryService {

  static async runBarcodeMigrations() {
    const connection = await db.getConnection();
    try {
      const alterations = [
        `ALTER TABLE items ADD COLUMN tracking_code VARCHAR(100)`,
        `ALTER TABLE items ADD COLUMN barcode_generated_at TIMESTAMP NULL`,
        `ALTER TABLE items ADD COLUMN barcode_print_count INT NOT NULL DEFAULT 0`,
        `ALTER TABLE items ADD COLUMN unit_price DECIMAL(15,2) NOT NULL DEFAULT 0`,
        `ALTER TABLE items ADD COLUMN supplier_source VARCHAR(500) NOT NULL DEFAULT ''`,
        `ALTER TABLE items ADD COLUMN bab_id INT DEFAULT NULL`,
        `ALTER TABLE items ADD COLUMN fasl_id INT DEFAULT NULL`,
      ];
      for (const sql of alterations) {
        try {
          await connection.query(sql);
        } catch (e: any) {
          if (!e.message.includes('Duplicate column')) throw e;
        }
      }
      try {
        await connection.query(`ALTER TABLE items ADD UNIQUE INDEX uq_tracking_code (tracking_code)`);
      } catch (_) {}

      await connection.query(`
        UPDATE items
        SET tracking_code = CONCAT('KDR-WMS-', YEAR(created_at), '-', LPAD(id, 6, '0')),
            barcode_generated_at = NOW()
        WHERE tracking_code IS NULL OR tracking_code = ''
      `);
      console.log('[WMS] Barcode migrations complete.');
    } finally {
      connection.release();
    }
  }

  static generateTrackingCode(id: number): string {
    const year = new Date().getFullYear();
    return `KDR-WMS-${year}-${String(id).padStart(6, '0')}`;
  }

  static normalizeText(text: string | null | undefined): string {
    if (!text) return '';
    return String(text).trim().replace(/\s+/g, ' ').toLowerCase();
  }

  static async getItems(filters: any) {
    let query = `
      SELECT i.*,
        c.name_ps as category_name,
        u.name_ps as unit_name,
        w.name_ps as warehouse_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.is_deleted = FALSE
    `;
    const params: any[] = [];

    if (filters.search) {
      query += ` AND (i.name_ps LIKE ? OR i.name_fa LIKE ? OR i.item_code LIKE ? OR i.tracking_code LIKE ?)`;
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.category_id) {
      query += ` AND i.category_id = ?`;
      params.push(filters.category_id);
    }
    if (filters.warehouse_id) {
      query += ` AND i.warehouse_id = ?`;
      params.push(filters.warehouse_id);
    }
    if (filters.lowStock === 'true') {
      query += ` AND i.current_stock <= i.minimum_stock`;
    }

    query += ` ORDER BY i.created_at DESC`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getItemById(id: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT i.*,
        c.name_ps as category_name,
        u.name_ps as unit_name,
        w.name_ps as warehouse_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.id = ? AND i.is_deleted = FALSE
    `, [id]);
    return rows[0];
  }

  static async getItemByBarcode(code: string) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT i.*,
        c.name_ps as category_name,
        u.name_ps as unit_name,
        w.name_ps as warehouse_name
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE (i.tracking_code = ? OR i.item_code = ?)
        AND i.is_deleted = FALSE
      LIMIT 1
    `, [code, code]);
    if (!rows[0]) return null;

    const item = rows[0];

    const [transactions] = await db.query<RowDataPacket[]>(`
      SELECT t.*, i.name_ps as item_name
      FROM stock_transactions t
      LEFT JOIN items i ON t.item_id = i.id
      WHERE t.item_id = ?
      ORDER BY t.created_at DESC
      LIMIT 50
    `, [item.id]);

    const [auditLogs] = await db.query<RowDataPacket[]>(`
      SELECT * FROM audit_logs
      WHERE entity_type = 'ITEM' AND entity_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `, [item.id]);

    return { item, transactions, auditLogs };
  }

  static async regenerateBarcode(id: number, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const trackingCode = InventoryService.generateTrackingCode(id);
      await connection.query(
        `UPDATE items SET tracking_code = ?, barcode_generated_at = NOW() WHERE id = ?`,
        [trackingCode, id]
      );
      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'BARCODE_REGENERATE', 'ITEM', id, JSON.stringify({ tracking_code: trackingCode })]);
      await connection.commit();
      return trackingCode;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async logBarcodePrint(id: number, userId: number | null) {
    await db.query(
      `UPDATE items SET barcode_print_count = barcode_print_count + 1 WHERE id = ?`,
      [id]
    );
    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, 'BARCODE_PRINT', 'ITEM', id, JSON.stringify({ printed_at: new Date().toISOString() })]);
  }

  static async createItem(data: ItemData, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [existing] = await connection.query<RowDataPacket[]>(
        `SELECT id FROM items WHERE item_code = ?`, [data.item_code]
      );
      if (existing.length > 0) {
        throw new Error('item_code_exists');
      }

      const [result] = await connection.query<ResultSetHeader>(`
        INSERT INTO items (item_code, name_ps, name_fa, description, category_id, unit_id, warehouse_id,
          minimum_stock, unit_price, supplier_source, bab_id, fasl_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.item_code, data.name_ps, data.name_fa, data.description || '',
        data.category_id, data.unit_id, data.warehouse_id, data.minimum_stock || 0,
        data.unit_price || 0, data.supplier_source || '',
        data.bab_id || null, data.fasl_id || null
      ]);

      const newItemId = result.insertId;
      const trackingCode = InventoryService.generateTrackingCode(newItemId);

      await connection.query(
        `UPDATE items SET tracking_code = ?, barcode_generated_at = NOW() WHERE id = ?`,
        [trackingCode, newItemId]
      );

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'CREATE', 'ITEM', newItemId, JSON.stringify({ ...data, tracking_code: trackingCode })]);

      await connection.commit();
      return { id: newItemId, tracking_code: trackingCode };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async bulkImport(rows: BulkImportRow[], userId: number | null): Promise<BulkImportResult> {
    const result: BulkImportResult = {
      imported: 0,
      duplicates: 0,
      invalid: 0,
      generatedCodes: 0,
      errors: [],
      importedItems: [],
    };

    const [categoriesRaw] = await db.query<RowDataPacket[]>(`SELECT id, name_ps, name_fa FROM categories WHERE is_deleted = FALSE`);
    const [unitsRaw] = await db.query<RowDataPacket[]>(`SELECT id, name_ps, name_fa FROM units WHERE is_deleted = FALSE`);
    const [warehousesRaw] = await db.query<RowDataPacket[]>(`SELECT id, name_ps, name_fa FROM warehouses WHERE is_deleted = FALSE`);

    const categories = categoriesRaw as RowDataPacket[];
    const units = unitsRaw as RowDataPacket[];
    const warehouses = warehousesRaw as RowDataPacket[];

    const [existingItemsRaw] = await db.query<RowDataPacket[]>(
      `SELECT name_ps, description, category_id, unit_id, warehouse_id FROM items WHERE is_deleted = FALSE`
    );
    const existingItems: any[] = existingItemsRaw as any[];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      const nameNorm = InventoryService.normalizeText(row.name);
      const specNorm = InventoryService.normalizeText(row.typeOrSpecification);
      const catNorm  = InventoryService.normalizeText(row.category);
      const unitNorm = InventoryService.normalizeText(row.unit);
      const whNorm   = InventoryService.normalizeText(row.warehouse);

      if (!nameNorm) { result.invalid++; result.errors.push({ row: rowNum, reason: 'د جنس نوم اړین دی.' }); continue; }
      if (!specNorm) { result.invalid++; result.errors.push({ row: rowNum, reason: 'مشخصات اړین دی.' }); continue; }
      if (!catNorm)  { result.invalid++; result.errors.push({ row: rowNum, reason: 'کټګوري اړینه ده.' }); continue; }
      if (!unitNorm) { result.invalid++; result.errors.push({ row: rowNum, reason: 'واحد اړین دی.' }); continue; }
      if (!whNorm)   { result.invalid++; result.errors.push({ row: rowNum, reason: 'ګدام اړین دی.' }); continue; }

      const qty = Number(row.initialQuantity);
      const minStock = Number(row.minimumStock);
      const unitPrice = row.unitPrice !== undefined ? Number(row.unitPrice) : 0;

      if (isNaN(qty) || qty < 0) { result.invalid++; result.errors.push({ row: rowNum, reason: 'ابتدایي مقدار باید عدد وي او له صفر کم نه وي.' }); continue; }
      if (isNaN(minStock) || minStock < 0) { result.invalid++; result.errors.push({ row: rowNum, reason: 'کمترین حد باید عدد وي او له صفر کم نه وي.' }); continue; }
      if (isNaN(unitPrice) || unitPrice < 0) { result.invalid++; result.errors.push({ row: rowNum, reason: 'قیمت باید عدد وي او له صفر کم نه وي.' }); continue; }

      const catMatch = categories.find(c =>
        InventoryService.normalizeText(c.name_ps) === catNorm ||
        InventoryService.normalizeText(c.name_fa) === catNorm
      );
      if (!catMatch) {
        result.invalid++;
        result.errors.push({ row: rowNum, reason: `کټګوري "${row.category}" ونه موندل شوه.` });
        continue;
      }

      const unitMatch = units.find(u =>
        InventoryService.normalizeText(u.name_ps) === unitNorm ||
        InventoryService.normalizeText(u.name_fa) === unitNorm
      );
      if (!unitMatch) {
        result.invalid++;
        result.errors.push({ row: rowNum, reason: `واحد "${row.unit}" ونه موندل شو.` });
        continue;
      }

      const whMatch = warehouses.find(w =>
        InventoryService.normalizeText(w.name_ps) === whNorm ||
        InventoryService.normalizeText(w.name_fa) === whNorm
      );
      if (!whMatch) {
        result.invalid++;
        result.errors.push({ row: rowNum, reason: `ګدام "${row.warehouse}" ونه موندل شو.` });
        continue;
      }

      const isDuplicate = (existingItems as RowDataPacket[]).some(existing => {
        return (
          InventoryService.normalizeText(existing.name_ps) === nameNorm &&
          InventoryService.normalizeText(existing.description) === specNorm &&
          existing.category_id === catMatch.id &&
          existing.unit_id === unitMatch.id &&
          existing.warehouse_id === whMatch.id
        );
      });

      if (isDuplicate) {
        result.duplicates++;
        result.errors.push({ row: rowNum, reason: `جنس "${row.name}" مخکې شتون لري (تکراري جنس).` });
        continue;
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const itemCode = row.itemCode?.trim() || `BULK-${Date.now()}-${rowNum}`;
        const [existingCode] = await connection.query<RowDataPacket[]>(
          `SELECT id FROM items WHERE item_code = ?`, [itemCode]
        );
        const finalCode = existingCode.length > 0 ? `BULK-${Date.now()}-${rowNum}` : itemCode;

        const [insertResult] = await connection.query<ResultSetHeader>(`
          INSERT INTO items (item_code, name_ps, name_fa, description, category_id, unit_id, warehouse_id,
            minimum_stock, unit_price, supplier_source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          finalCode, row.name, row.name,
          row.typeOrSpecification || '',
          catMatch.id, unitMatch.id, whMatch.id,
          minStock, unitPrice,
          row.supplier || row.company || ''
        ]);

        const newId = insertResult.insertId;
        const trackingCode = InventoryService.generateTrackingCode(newId);

        await connection.query(
          `UPDATE items SET tracking_code = ?, barcode_generated_at = NOW() WHERE id = ?`,
          [trackingCode, newId]
        );

        if (qty > 0) {
          await connection.query<ResultSetHeader>(`
            INSERT INTO stock_transactions (item_id, transaction_type, quantity, previous_stock, new_stock, source_type, notes, created_by)
            VALUES (?, 'IN', ?, 0, ?, 'INITIAL', ?, ?)
          `, [newId, qty, qty, 'د جنس لومړنۍ ثبت / ثبت اولیه جنس', userId]);

          await connection.query(`UPDATE items SET current_stock = ? WHERE id = ?`, [qty, newId]);
        }

        await connection.query(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
          VALUES (?, 'BULK_IMPORT', 'ITEM', ?, ?)
        `, [userId, newId, JSON.stringify({ name: row.name, tracking_code: trackingCode })]);

        await connection.commit();

        result.importedItems.push({ id: newId, tracking_code: trackingCode, name: row.name });
        result.imported++;
        result.generatedCodes++;

        existingItems.push({
          name_ps: row.name,
          description: row.typeOrSpecification || '',
          category_id: catMatch.id,
          unit_id: unitMatch.id,
          warehouse_id: whMatch.id,
        });
      } catch (err: any) {
        await connection.rollback();
        result.invalid++;
        result.errors.push({ row: rowNum, reason: err.message || 'نامعلومه خطا.' });
      } finally {
        connection.release();
      }
    }

    return result;
  }

  static async updateItem(id: number, data: Partial<ItemData>, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [oldItems] = await connection.query<RowDataPacket[]>(`SELECT * FROM items WHERE id = ? AND is_deleted = FALSE`, [id]);
      if (oldItems.length === 0) throw new Error('not_found');

      const oldItem = oldItems[0];
      const updateFields: string[] = [];
      const params: any[] = [];

      const allowedFields = ['name_ps', 'name_fa', 'description', 'category_id', 'unit_id', 'warehouse_id', 'minimum_stock', 'unit_price', 'supplier_source', 'bab_id', 'fasl_id'];

      for (const [key, value] of Object.entries(data)) {
        if (allowedFields.includes(key) && value !== undefined) {
          updateFields.push(`${key} = ?`);
          params.push(value);
        }
      }

      if (updateFields.length > 0) {
        params.push(id);
        await connection.query(`UPDATE items SET ${updateFields.join(', ')} WHERE id = ?`, params);

        await connection.query(`
          INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [userId, 'UPDATE', 'ITEM', id, JSON.stringify(oldItem), JSON.stringify(data)]);
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteItem(id: number, userId: number | null, deleteReason?: string) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.query<ResultSetHeader>(
        `UPDATE items SET is_deleted = TRUE, deleted_at = NOW(), deleted_by_name = ?, delete_reason = ? WHERE id = ?`,
        [userId, deleteReason || null, id]
      );
      if (result.affectedRows === 0) throw new Error('not_found');

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'DELETE', 'ITEM', id, deleteReason || null]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async stockIn(data: StockData, userId: number | null) {
    if (data.quantity <= 0) throw new Error('invalid_quantity');
    const trustedCreatedAt = await OnlineTimeService.getTrustedNow();

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [items] = await connection.query<RowDataPacket[]>(`SELECT current_stock FROM items WHERE id = ? AND is_deleted = FALSE FOR UPDATE`, [data.item_id]);
      if (items.length === 0) throw new Error('not_found');

      const prevStock = items[0].current_stock;
      const newStock = prevStock + data.quantity;

      await connection.query(`UPDATE items SET current_stock = ? WHERE id = ?`, [newStock, data.item_id]);

      const [txResult] = await connection.query<ResultSetHeader>(`
        INSERT INTO stock_transactions
          (item_id, transaction_type, quantity, previous_stock, new_stock, source_type, notes, created_by,
           supplier_name, document_reference, unit_price, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [data.item_id, 'IN', data.quantity, prevStock, newStock, data.source_type ?? null, data.notes ?? null, userId,
          data.supplier_name ?? null, data.document_reference ?? null, data.unit_price ?? null, trustedCreatedAt]);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'STOCK_IN', 'TRANSACTION', txResult.insertId, JSON.stringify({ item_id: data.item_id, quantity: data.quantity })]);

      await connection.commit();
      return { previous_stock: prevStock, new_stock: newStock };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async stockOut(data: StockData, userId: number | null) {
    if (data.quantity <= 0) throw new Error('invalid_quantity');
    const trustedCreatedAt = await OnlineTimeService.getTrustedNow();

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [items] = await connection.query<RowDataPacket[]>(`SELECT current_stock FROM items WHERE id = ? AND is_deleted = FALSE FOR UPDATE`, [data.item_id]);
      if (items.length === 0) throw new Error('not_found');

      const prevStock = items[0].current_stock;
      if (prevStock < data.quantity) throw new Error('insufficient_stock');

      const newStock = prevStock - data.quantity;

      await connection.query(`UPDATE items SET current_stock = ? WHERE id = ?`, [newStock, data.item_id]);

      const qrPayload = data.assignment_qr_payload ? JSON.stringify(data.assignment_qr_payload) : null;
      const [txResult] = await connection.query<ResultSetHeader>(`
        INSERT INTO stock_transactions
          (item_id, transaction_type, quantity, previous_stock, new_stock, source_type, notes, created_by,
           unit_price, receiver_name, receiver_id_no, faculty_id, department_id, person_id,
           linked_request_id, fs5_reference, academic_level, assignment_qr_payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [data.item_id, 'OUT', data.quantity, prevStock, newStock, data.source_type ?? null, data.notes ?? null, userId,
          data.unit_price ?? null, data.receiver_name ?? null, data.receiver_id_no ?? null,
          data.faculty_id ?? null, data.department_id ?? null, data.person_id ?? null,
          data.linked_request_id ?? null, data.fs5_reference ?? null, data.academic_level ?? null, qrPayload, trustedCreatedAt]);

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'STOCK_OUT', 'TRANSACTION', txResult.insertId, JSON.stringify({ item_id: data.item_id, quantity: data.quantity })]);

      await connection.commit();
      return { previous_stock: prevStock, new_stock: newStock, transaction_id: txResult.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getTransactions(filters: any) {
    let query = `
      SELECT t.*, i.name_ps as item_name, u.name_ps as unit_name, creator.name as created_by_name
      FROM stock_transactions t
      LEFT JOIN items i ON t.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.item_id) {
      query += ` AND t.item_id = ?`;
      params.push(filters.item_id);
    }
    if (filters.transaction_type) {
      query += ` AND t.transaction_type = ?`;
      params.push(filters.transaction_type);
    }

    query += ` ORDER BY t.created_at DESC LIMIT 100`;

    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getCategories() {
    const [rows] = await db.query(`SELECT * FROM categories WHERE is_deleted = FALSE ORDER BY name_ps ASC`);
    return rows;
  }

  static async createCategory(name_ps: string, name_fa: string, description?: string) {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO categories (name_ps, name_fa, description) VALUES (?, ?, ?)`,
      [name_ps, name_fa, description || null]
    );
    const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM categories WHERE id = ?`, [result.insertId]);
    return rows[0];
  }

  static async getUnits() {
    const [rows] = await db.query(`SELECT * FROM units WHERE is_deleted = FALSE ORDER BY name_ps ASC`);
    return rows;
  }

  static async createUnit(name_ps: string, name_fa: string, symbol?: string) {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO units (name_ps, name_fa, symbol) VALUES (?, ?, ?)`,
      [name_ps, name_fa, symbol || null]
    );
    const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM units WHERE id = ?`, [result.insertId]);
    return rows[0];
  }

  static async getWarehouses() {
    const [rows] = await db.query(`SELECT * FROM warehouses WHERE is_deleted = FALSE ORDER BY name_ps ASC`);
    return rows;
  }

  /**
   * Maps checklist IDs / item names to warehouse inventory item IDs.
   * Checklist and inventory are separate tables — requests often carry checklist IDs.
   */
  static async findItemIdByName(name: string): Promise<number | null> {
    const norm = this.normalizeText(name);
    if (!norm) return null;

    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, name_ps, name_fa FROM items WHERE is_deleted = FALSE`
    );
    for (const row of rows) {
      if (this.normalizeText(row.name_ps) === norm || this.normalizeText(row.name_fa) === norm) {
        return row.id;
      }
    }

    const trimmed = String(name).trim();
    const [likeRows] = await db.query<RowDataPacket[]>(
      `SELECT id FROM items WHERE is_deleted = FALSE AND (name_ps LIKE ? OR name_fa LIKE ?) LIMIT 1`,
      [`%${trimmed}%`, `%${trimmed}%`]
    );
    return likeRows.length > 0 ? likeRows[0].id : null;
  }

  static async resolveItemId(opts: {
    item_id?: number | null;
    checklist_id?: number | null;
    item_name?: string | null;
  }): Promise<number> {
    // Primary link: item NAME (checklist ↔ warehouse inventory)
    if (opts.item_name) {
      const byName = await this.findItemIdByName(opts.item_name);
      if (byName) return byName;
    }

    const checklistId = opts.checklist_id != null ? Number(opts.checklist_id) : NaN;
    if (!isNaN(checklistId) && checklistId > 0) {
      const [clRows] = await db.query<RowDataPacket[]>(
        `SELECT item_name, item_code FROM checklist_items WHERE id = ? AND is_active = TRUE`,
        [checklistId]
      );
      if (clRows.length > 0) {
        const cl = clRows[0];
        if (cl.item_code) {
          const [byCode] = await db.query<RowDataPacket[]>(
            `SELECT id FROM items WHERE item_code = ? AND is_deleted = FALSE LIMIT 1`,
            [cl.item_code]
          );
          if (byCode.length > 0) return byCode[0].id;
        }
        const byClName = await this.findItemIdByName(cl.item_name);
        if (byClName) return byClName;
      }
    }

    const rawId = opts.item_id != null ? Number(opts.item_id) : NaN;
    if (!isNaN(rawId) && rawId > 0) {
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT id, name_ps, name_fa FROM items WHERE id = ? AND is_deleted = FALSE`,
        [rawId]
      );
      if (rows.length > 0) {
        if (opts.item_name) {
          const norm = this.normalizeText(opts.item_name);
          const itemNorm = this.normalizeText(rows[0].name_ps) || this.normalizeText(rows[0].name_fa);
          if (itemNorm && norm && itemNorm !== norm) {
            throw new Error(`item_not_found_in_inventory: ${opts.item_name}`);
          }
        }
        return rows[0].id;
      }
    }

    throw new Error(`item_not_found_in_inventory: ${opts.item_name || opts.checklist_id || opts.item_id}`);
  }

  static async findPersonIdByName(name: string | null | undefined): Promise<number | null> {
    const norm = this.normalizeText(name);
    if (!norm) return null;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, full_name FROM people WHERE is_deleted = FALSE`
    );
    for (const row of rows) {
      if (this.normalizeText(row.full_name) === norm) return row.id;
    }
    // Never use a partial name for final ownership: a near match can register
    // an item against the wrong person in Traceability.
    return null;
  }
}
