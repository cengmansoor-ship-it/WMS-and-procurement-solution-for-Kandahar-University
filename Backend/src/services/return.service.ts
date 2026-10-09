import { ResultSetHeader, RowDataPacket } from "mysql2";
import db from "../config/db";
import { OnlineTimeService } from "./onlineTime.service";

export interface CreateReturnData {
  original_transaction_id: number;
  quantity: number;
  returned_to: string;
  return_reference?: string;
  reason: string;
  condition_status?: string;
  notes?: string;
  returned_by_name?: string;
}

export class ReturnService {
  static async runMigrations() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS stock_returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        return_number VARCHAR(50) NOT NULL UNIQUE,
        original_transaction_id INT NOT NULL,
        stock_transaction_id INT NOT NULL,
        item_id INT NOT NULL,
        quantity INT NOT NULL,
        previous_stock INT NOT NULL,
        new_stock INT NOT NULL,
        supplier_name VARCHAR(300) NULL,
        returned_to VARCHAR(300) NOT NULL,
        return_reference VARCHAR(200) NULL,
        reason TEXT NOT NULL,
        condition_status VARCHAR(80) NULL,
        notes TEXT NULL,
        returned_by_name VARCHAR(200) NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_return_original_tx (original_transaction_id),
        INDEX idx_return_item (item_id),
        INDEX idx_return_created_at (created_at),
        CONSTRAINT fk_return_original_tx
          FOREIGN KEY (original_transaction_id) REFERENCES stock_transactions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_return_stock_tx
          FOREIGN KEY (stock_transaction_id) REFERENCES stock_transactions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_return_item
          FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT,
        CONSTRAINT fk_return_user
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);
  }

  static async getEligibleStockIn(search = "") {
    const params: any[] = [];
    let searchSql = "";
    if (search.trim()) {
      searchSql = `
        AND (
          i.name_ps LIKE ? OR i.name_fa LIKE ? OR i.item_code LIKE ?
          OR COALESCE(t.supplier_name, '') LIKE ?
          OR COALESCE(t.document_reference, '') LIKE ?
        )
      `;
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q, q);
    }

    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        t.id AS original_transaction_id,
        t.item_id,
        i.item_code,
        i.name_ps AS item_name,
        i.name_fa AS item_name_fa,
        i.current_stock,
        u.name_ps AS unit_name,
        t.quantity AS received_quantity,
        COALESCE(SUM(sr.quantity), 0) AS returned_quantity,
        GREATEST(t.quantity - COALESCE(SUM(sr.quantity), 0), 0) AS receipt_remaining,
        LEAST(
          GREATEST(t.quantity - COALESCE(SUM(sr.quantity), 0), 0),
          GREATEST(i.current_stock, 0)
        ) AS returnable_quantity,
        t.supplier_name,
        t.document_reference,
        t.source_type,
        t.notes,
        t.created_at
      FROM stock_transactions t
      INNER JOIN items i ON i.id = t.item_id AND i.is_deleted = FALSE
      LEFT JOIN units u ON u.id = i.unit_id
      LEFT JOIN stock_returns sr ON sr.original_transaction_id = t.id
      WHERE t.transaction_type = 'IN'
        ${searchSql}
      GROUP BY
        t.id, t.item_id, i.item_code, i.name_ps, i.name_fa, i.current_stock,
        u.name_ps, t.quantity, t.supplier_name, t.document_reference,
        t.source_type, t.notes, t.created_at
      HAVING receipt_remaining > 0 AND returnable_quantity > 0
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 500
    `, params);
    return rows;
  }

  static async createReturn(data: CreateReturnData, userId: number | null = null) {
    const originalTransactionId = Number(data.original_transaction_id);
    const quantity = Number(data.quantity);
    if (!Number.isInteger(originalTransactionId) || originalTransactionId <= 0) {
      throw new Error("invalid_original_transaction");
    }
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("invalid_quantity");
    if (!String(data.returned_to || "").trim()) throw new Error("returned_to_required");
    if (!String(data.reason || "").trim()) throw new Error("return_reason_required");
    const trustedCreatedAt = await OnlineTimeService.getTrustedNow();

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [originalRows] = await connection.query<RowDataPacket[]>(`
        SELECT
          t.id, t.item_id, t.quantity, t.supplier_name, t.document_reference,
          i.current_stock, i.name_ps AS item_name
        FROM stock_transactions t
        INNER JOIN items i ON i.id = t.item_id AND i.is_deleted = FALSE
        WHERE t.id = ? AND t.transaction_type = 'IN'
        FOR UPDATE
      `, [originalTransactionId]);
      if (originalRows.length === 0) throw new Error("stock_in_not_found");
      const original = originalRows[0];

      const [returnedRows] = await connection.query<RowDataPacket[]>(`
        SELECT COALESCE(SUM(quantity), 0) AS returned_quantity
        FROM stock_returns
        WHERE original_transaction_id = ?
      `, [originalTransactionId]);
      const alreadyReturned = Number(returnedRows[0]?.returned_quantity || 0);
      const receiptRemaining = Number(original.quantity) - alreadyReturned;
      if (quantity > receiptRemaining) throw new Error("return_exceeds_receipt");

      const previousStock = Number(original.current_stock || 0);
      if (quantity > previousStock) throw new Error("insufficient_stock");
      const newStock = previousStock - quantity;

      await connection.query(
        `UPDATE items SET current_stock = ? WHERE id = ?`,
        [newStock, original.item_id],
      );

      const returnNotes = [
        `اصلي داخل معامله: ${originalTransactionId}`,
        `واپس اخیستونکی: ${String(data.returned_to).trim()}`,
        `د واپسي دلیل: ${String(data.reason).trim()}`,
        data.return_reference ? `د واپسي مرجع: ${String(data.return_reference).trim()}` : "",
        data.notes ? String(data.notes).trim() : "",
      ].filter(Boolean).join(" | ");

      const [stockTx] = await connection.query<ResultSetHeader>(`
        INSERT INTO stock_transactions
          (item_id, transaction_type, quantity, previous_stock, new_stock,
           source_type, reference_id, notes, created_by, supplier_name, document_reference, created_at)
        VALUES (?, 'OUT', ?, ?, ?, 'RETURN_TO_SUPPLIER', ?, ?, ?, ?, ?, ?)
      `, [
        original.item_id,
        quantity,
        previousStock,
        newStock,
        String(originalTransactionId),
        returnNotes,
        userId,
        original.supplier_name || null,
        data.return_reference || original.document_reference || null,
        trustedCreatedAt,
      ]);

      const temporaryNumber = `PENDING-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const [returnResult] = await connection.query<ResultSetHeader>(`
        INSERT INTO stock_returns
          (return_number, original_transaction_id, stock_transaction_id, item_id,
           quantity, previous_stock, new_stock, supplier_name, returned_to,
           return_reference, reason, condition_status, notes, returned_by_name, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        temporaryNumber,
        originalTransactionId,
        stockTx.insertId,
        original.item_id,
        quantity,
        previousStock,
        newStock,
        original.supplier_name || null,
        String(data.returned_to).trim(),
        data.return_reference ? String(data.return_reference).trim() : null,
        String(data.reason).trim(),
        data.condition_status || null,
        data.notes ? String(data.notes).trim() : null,
        data.returned_by_name ? String(data.returned_by_name).trim() : null,
        userId,
        trustedCreatedAt,
      ]);

      const year = new Date().getUTCFullYear();
      const returnNumber = `KDR-RET-${year}-${String(returnResult.insertId).padStart(6, "0")}`;
      await connection.query(
        `UPDATE stock_returns SET return_number = ? WHERE id = ?`,
        [returnNumber, returnResult.insertId],
      );

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, 'STOCK_RETURN', 'STOCK_RETURN', ?, ?)
      `, [
        userId,
        String(returnResult.insertId),
        JSON.stringify({
          return_number: returnNumber,
          original_transaction_id: originalTransactionId,
          stock_transaction_id: stockTx.insertId,
          item_id: original.item_id,
          quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          returned_to: String(data.returned_to).trim(),
        }),
      ]);

      await connection.commit();
      return {
        id: returnResult.insertId,
        return_number: returnNumber,
        stock_transaction_id: stockTx.insertId,
        item_id: original.item_id,
        item_name: original.item_name,
        quantity,
        previous_stock: previousStock,
        new_stock: newStock,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getReturns(filters: any = {}) {
    let query = `
      SELECT
        sr.*,
        i.item_code,
        i.name_ps AS item_name,
        i.name_fa AS item_name_fa,
        u.name_ps AS unit_name,
        original.document_reference AS original_document_reference,
        original.created_at AS original_received_at,
        creator.name AS created_by_name
      FROM stock_returns sr
      INNER JOIN items i ON i.id = sr.item_id
      LEFT JOIN units u ON u.id = i.unit_id
      LEFT JOIN stock_transactions original ON original.id = sr.original_transaction_id
      LEFT JOIN users creator ON creator.id = sr.created_by
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filters.item_id) {
      query += ` AND sr.item_id = ?`;
      params.push(Number(filters.item_id));
    }
    if (filters.from_date) {
      query += ` AND sr.created_at >= ?`;
      params.push(String(filters.from_date));
    }
    if (filters.to_date) {
      query += ` AND sr.created_at < DATE_ADD(?, INTERVAL 1 DAY)`;
      params.push(String(filters.to_date));
    }
    if (filters.search) {
      const q = `%${String(filters.search).trim()}%`;
      query += ` AND (
        sr.return_number LIKE ? OR i.item_code LIKE ? OR i.name_ps LIKE ?
        OR i.name_fa LIKE ? OR sr.returned_to LIKE ? OR sr.return_reference LIKE ?
      )`;
      params.push(q, q, q, q, q, q);
    }
    query += ` ORDER BY sr.created_at DESC, sr.id DESC LIMIT 1000`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getReturnSummary() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS total_returns,
        COALESCE(SUM(quantity), 0) AS total_quantity,
        COUNT(DISTINCT item_id) AS distinct_items,
        MAX(created_at) AS last_return_at
      FROM stock_returns
    `);
    return rows[0];
  }
}
