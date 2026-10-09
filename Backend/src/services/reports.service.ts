import { RowDataPacket } from 'mysql2';
import db from '../config/db';

export class ReportsService {

  static async getInventorySummary() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS total_items,
        SUM(current_stock) AS total_stock_units,
        SUM(current_stock <= minimum_stock AND current_stock > 0) AS low_stock_count,
        SUM(current_stock = 0) AS out_of_stock_count,
        COUNT(DISTINCT category_id) AS total_categories,
        COUNT(DISTINCT warehouse_id) AS total_warehouses
      FROM items WHERE is_deleted = FALSE
    `);
    return rows[0];
  }

  static async getStockMovement(filters: any = {}) {
    let query = `
      SELECT t.*, i.name_ps AS item_name, i.item_code
      FROM stock_transactions t
      LEFT JOIN items i ON t.item_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.from_date) {
      query += ` AND t.created_at >= ?`;
      params.push(filters.from_date);
    }
    if (filters.to_date) {
      query += ` AND t.created_at <= ?`;
      params.push(filters.to_date);
    }
    if (filters.item_id) {
      query += ` AND t.item_id = ?`;
      params.push(filters.item_id);
    }
    if (filters.transaction_type) {
      if (filters.transaction_type === 'RETURN') {
        query += ` AND t.source_type = 'RETURN_TO_SUPPLIER'`;
      } else {
        query += ` AND t.transaction_type = ?`;
        params.push(filters.transaction_type);
      }
    }

    query += ` ORDER BY t.created_at DESC LIMIT 500`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getRequestSummary() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS total_requests,
        SUM(status IN ('PENDING','PendingReview','Submitted','ReviewReturned','Draft','ReturnedToSuperAdmin')) AS pending_count,
        SUM(status IN ('CONFIRMED','ConfirmedByRequestConfirmer','ApprovedBySuperAdmin')) AS confirmed_count,
        SUM(status IN ('SENT_TO_PROCUREMENT','StockNotAvailable','StockAvailable','ProcurementPending','TenderCreated','OffersReceived','ComparisonCreated','WinnerSelected','PurchaseOrderCreated')) AS procurement_count,
        SUM(status IN ('READY_FOR_DELIVERY','ReceiptReportCreated','ReceivedToInventory','FS5Created')) AS ready_count,
        SUM(status IN ('DELIVERED','Delivered')) AS delivered_count,
        SUM(status IN ('COMPLETED','Completed')) AS completed_count,
        SUM(status IN ('REJECTED','RejectedByRequestConfirmer','RejectedBySuperAdmin','RejectedByAdmin')) AS rejected_count,
        SUM(request_level = 'URGENT') AS urgent_count,
        SUM(request_level = 'NORMAL') AS normal_count,
        SUM(request_level = 'LOW') AS low_count
      FROM requests WHERE is_deleted = FALSE
    `);
    return rows[0];
  }

  static async getProcurementSummary() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS total_cases,
        SUM(p.status = 'OPEN') AS open_count,
        SUM(p.status = 'WINNER_SELECTED') AS winner_selected_count,
        SUM(p.status = 'PO_CREATED') AS po_created_count,
        COALESCE(SUM(po.total_amount), 0) AS total_po_amount
      FROM procurement_cases p
      LEFT JOIN purchase_orders po ON po.procurement_case_id = p.id AND po.is_deleted = FALSE
      WHERE p.is_deleted = FALSE
    `);
    return rows[0];
  }

  static async getReceivingDeliverySummary() {
    const [[receiving]] = await db.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS total_receiving_records,
        SUM(ri.quantity_received) AS total_units_received
      FROM receiving_records rr
      LEFT JOIN receiving_items ri ON ri.receiving_record_id = rr.id
      WHERE rr.is_deleted = FALSE
    `);
    const [[delivery]] = await db.query<RowDataPacket[]>(`
      SELECT COUNT(*) AS total_deliveries,
        SUM(di.quantity) AS total_units_delivered
      FROM deliveries d
      LEFT JOIN delivery_items di ON di.delivery_id = d.id
      WHERE d.is_deleted = FALSE
    `);
    return { ...receiving, ...delivery };
  }

  static async getInventoryReport(filters: any = {}) {
    let query = `
      SELECT i.*,
        c.name_ps AS category_name,
        u.name_ps AS unit_name,
        w.name_ps AS warehouse_name,
        (SELECT COALESCE(SUM(t.quantity),0) FROM stock_transactions t WHERE t.item_id = i.id AND t.transaction_type='IN') AS total_in,
        (SELECT COALESCE(SUM(t.quantity),0) FROM stock_transactions t
          WHERE t.item_id = i.id AND t.transaction_type='OUT'
            AND COALESCE(t.source_type, '') <> 'RETURN_TO_SUPPLIER') AS total_out,
        (SELECT COALESCE(SUM(sr.quantity),0) FROM stock_returns sr WHERE sr.item_id = i.id) AS total_returned
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN warehouses w ON i.warehouse_id = w.id
      WHERE i.is_deleted = FALSE
    `;
    const params: any[] = [];
    if (filters.category_id) {
      query += ` AND i.category_id = ?`;
      params.push(filters.category_id);
    }
    if (filters.warehouse_id) {
      query += ` AND i.warehouse_id = ?`;
      params.push(filters.warehouse_id);
    }
    if (filters.low_stock === 'true') {
      query += ` AND i.current_stock <= i.minimum_stock`;
    }
    query += ` ORDER BY i.name_ps ASC`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getRequestReport(filters: any = {}) {
    let query = `
      SELECT r.*,
        f.name_ps AS faculty_name,
        d.name_ps AS department_name,
        p.full_name AS person_name
      FROM requests r
      LEFT JOIN faculties f ON r.faculty_id = f.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN people p ON r.person_id = p.id
      WHERE r.is_deleted = FALSE
    `;
    const params: any[] = [];
    if (filters.status) {
      query += ` AND r.status = ?`;
      params.push(filters.status);
    }
    if (filters.faculty_id) {
      query += ` AND r.faculty_id = ?`;
      params.push(filters.faculty_id);
    }
    if (filters.from_date) {
      query += ` AND r.created_at >= ?`;
      params.push(filters.from_date);
    }
    if (filters.to_date) {
      query += ` AND r.created_at <= ?`;
      params.push(filters.to_date);
    }
    query += ` ORDER BY r.created_at DESC`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getProcurementReport() {
    const [rows] = await db.query(`
      SELECT p.*,
        r.tracking_id AS request_tracking_id,
        po.po_number, po.total_amount,
        v.name AS vendor_name
      FROM procurement_cases p
      LEFT JOIN requests r ON p.request_id = r.id
      LEFT JOIN purchase_orders po ON po.procurement_case_id = p.id AND po.is_deleted = FALSE
      LEFT JOIN vendors v ON po.vendor_id = v.id
      WHERE p.is_deleted = FALSE
      ORDER BY p.created_at DESC
    `);
    return rows;
  }

  static async getReceivingDeliveryReport() {
    const [receiving] = await db.query(`
      SELECT rr.*, po.po_number, r.tracking_id AS request_tracking_id
      FROM receiving_records rr
      LEFT JOIN purchase_orders po ON rr.purchase_order_id = po.id
      LEFT JOIN requests r ON rr.request_id = r.id
      WHERE rr.is_deleted = FALSE
      ORDER BY rr.created_at DESC
    `);
    const [delivery] = await db.query(`
      SELECT d.*, r.tracking_id AS request_tracking_id, p.full_name AS person_name
      FROM deliveries d
      LEFT JOIN requests r ON d.request_id = r.id
      LEFT JOIN people p ON d.delivered_to_person_id = p.id
      WHERE d.is_deleted = FALSE
      ORDER BY d.created_at DESC
    `);
    return { receiving, delivery };
  }

  static async getFacultyReport() {
    const [rows] = await db.query(`
      SELECT f.*,
        COUNT(DISTINCT r.id) AS total_requests,
        SUM(r.status = 'DELIVERED' OR r.status = 'COMPLETED') AS delivered_requests,
        COUNT(DISTINCT ia.id) AS total_assignments
      FROM faculties f
      LEFT JOIN requests r ON r.faculty_id = f.id AND r.is_deleted = FALSE
      LEFT JOIN item_assignments ia ON ia.faculty_id = f.id AND ia.is_deleted = FALSE
      WHERE f.is_deleted = FALSE
      GROUP BY f.id
      ORDER BY f.name_ps ASC
    `);
    return rows;
  }

  static async getDepartmentReport() {
    const [rows] = await db.query(`
      SELECT d.*, f.name_ps AS faculty_name,
        COUNT(DISTINCT r.id) AS total_requests,
        SUM(r.status = 'DELIVERED' OR r.status = 'COMPLETED') AS delivered_requests
      FROM departments d
      LEFT JOIN faculties f ON d.faculty_id = f.id
      LEFT JOIN requests r ON r.department_id = d.id AND r.is_deleted = FALSE
      WHERE d.is_deleted = FALSE
      GROUP BY d.id
      ORDER BY d.name_ps ASC
    `);
    return rows;
  }

  static async getPersonAssignmentReport(filters: any = {}) {
    let query = `
      SELECT ia.*,
        i.name_ps AS item_name, i.item_code,
        p.full_name AS person_name,
        d.name_ps AS department_name,
        f.name_ps AS faculty_name,
        u.name_ps AS unit_name
      FROM item_assignments ia
      LEFT JOIN items i ON ia.item_id = i.id
      LEFT JOIN people p ON ia.person_id = p.id
      LEFT JOIN departments d ON ia.department_id = d.id
      LEFT JOIN faculties f ON ia.faculty_id = f.id
      LEFT JOIN units u ON i.unit_id = u.id
      WHERE ia.is_deleted = FALSE
    `;
    const params: any[] = [];
    if (filters.person_id) {
      query += ` AND ia.person_id = ?`;
      params.push(filters.person_id);
    }
    if (filters.faculty_id) {
      query += ` AND ia.faculty_id = ?`;
      params.push(filters.faculty_id);
    }
    if (filters.department_id) {
      query += ` AND ia.department_id = ?`;
      params.push(filters.department_id);
    }
    query += ` ORDER BY ia.assigned_at DESC`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getAuditActivityReport(filters: any = {}) {
    let query = `
      SELECT al.*, u.name AS user_name, u.email AS user_email, r.name AS user_role
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (filters.entity_type) {
      query += ` AND al.entity_type = ?`;
      params.push(filters.entity_type);
    }
    if (filters.action) {
      query += ` AND al.action = ?`;
      params.push(filters.action);
    }
    if (filters.from_date) {
      query += ` AND al.created_at >= ?`;
      params.push(filters.from_date);
    }
    if (filters.to_date) {
      query += ` AND al.created_at <= ?`;
      params.push(filters.to_date);
    }
    query += ` ORDER BY al.created_at DESC LIMIT 500`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getAnnualNeeds() {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT i.id, i.item_code, i.name_ps, i.name_fa,
        i.current_stock, i.minimum_stock,
        c.name_ps AS category_name,
        u.name_ps AS unit_name,
        COALESCE(SUM(CASE WHEN t.transaction_type='OUT' AND COALESCE(t.source_type, '') <> 'RETURN_TO_SUPPLIER' AND t.created_at >= ? THEN t.quantity ELSE 0 END), 0) AS annual_consumption,
        COALESCE(SUM(CASE WHEN t.transaction_type='OUT' AND COALESCE(t.source_type, '') <> 'RETURN_TO_SUPPLIER' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) THEN t.quantity ELSE 0 END), 0) AS six_month_consumption,
        COALESCE(SUM(CASE WHEN t.transaction_type='OUT' AND COALESCE(t.source_type, '') <> 'RETURN_TO_SUPPLIER' AND t.created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH) THEN t.quantity ELSE 0 END), 0) AS three_month_consumption
      FROM items i
      LEFT JOIN categories c ON i.category_id = c.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN stock_transactions t ON t.item_id = i.id
      WHERE i.is_deleted = FALSE
      GROUP BY i.id
      ORDER BY annual_consumption DESC
    `, [oneYearAgo]);

    return rows.map((row: any) => {
      const gap = Math.max(0, (row.annual_consumption || 0) - (row.current_stock || 0));
      let priority = 'کافي';
      if (row.current_stock === 0) priority = 'بیړني';
      else if (row.current_stock <= row.minimum_stock) priority = 'لوړه';
      else if (gap > 0) priority = 'منځنۍ';

      return {
        ...row,
        gap,
        recommended_purchase: Math.max(0, gap),
        priority
      };
    });
  }

  static async getTraceabilityData(filters: any = {}) {
    let query = `
      SELECT ia.*,
        i.name_ps AS item_name, i.item_code,
        p.full_name AS person_name, p.position,
        d.name_ps AS department_name, d.department_type,
        f.name_ps AS faculty_name,
        r.tracking_id AS request_tracking_id,
        del.fs5_number
      FROM item_assignments ia
      LEFT JOIN items i ON ia.item_id = i.id
      LEFT JOIN people p ON ia.person_id = p.id
      LEFT JOIN departments d ON ia.department_id = d.id
      LEFT JOIN faculties f ON ia.faculty_id = f.id
      LEFT JOIN deliveries del ON del.id = ia.source_id AND ia.source_type = 'DELIVERY'
      LEFT JOIN requests r ON del.request_id = r.id
      WHERE ia.is_deleted = FALSE
    `;
    const params: any[] = [];
    if (filters.person_id) { query += ` AND ia.person_id = ?`; params.push(filters.person_id); }
    if (filters.department_id) { query += ` AND ia.department_id = ?`; params.push(filters.department_id); }
    if (filters.faculty_id) { query += ` AND ia.faculty_id = ?`; params.push(filters.faculty_id); }
    if (filters.item_id) { query += ` AND ia.item_id = ?`; params.push(filters.item_id); }
    query += ` ORDER BY ia.assigned_at DESC`;
    const [rows] = await db.query(query, params);
    return rows;
  }
}
