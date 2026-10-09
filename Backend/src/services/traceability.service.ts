import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { runColumnMigration } from '../utils/migrationHelper';

export class TraceabilityService {

  static async runMigrations() {
    const cols = [
      { table: 'faculties',        col: 'level',         def: `VARCHAR(20) DEFAULT NULL` },
      { table: 'item_assignments', col: 'notes',         def: `TEXT` },
      { table: 'item_assignments', col: 'assigned_by',   def: `INT DEFAULT NULL` },
      { table: 'item_assignments', col: 'unit_id',       def: `INT DEFAULT NULL` },
      { table: 'item_assignments', col: 'tracking_id',   def: `VARCHAR(100) DEFAULT NULL` },
      { table: 'item_assignments', col: 'delivery_id',   def: `INT DEFAULT NULL` },
      { table: 'item_assignments', col: 'fs5_reference', def: `VARCHAR(100) DEFAULT NULL` },
    ];
    for (const c of cols) {
      try {
        await runColumnMigration(c.table, c.col, c.def, 'Traceability');
      } catch (_) {}
    }
  }

  static async getSummary() {
    const [admin] = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(DISTINCT d.id) as total_departments,
        COUNT(DISTINCT p.id) as total_persons,
        COUNT(DISTINCT ia.item_id) as total_items,
        COALESCE(SUM(ia.quantity), 0) as total_quantity,
        MAX(ia.assigned_at) as last_assignment_date
      FROM departments d
      LEFT JOIN people p ON p.department_id = d.id AND p.is_deleted = FALSE
      LEFT JOIN item_assignments ia ON (ia.department_id = d.id OR ia.person_id = p.id) AND ia.is_deleted = FALSE
      WHERE d.department_type = 'ADMIN' AND d.is_deleted = FALSE
    `);
    const [faculty] = await db.query<RowDataPacket[]>(`
      SELECT
        COUNT(DISTINCT d.id) as total_departments,
        COUNT(DISTINCT f.id) as total_faculties,
        COUNT(DISTINCT p.id) as total_persons,
        COUNT(DISTINCT ia.item_id) as total_items,
        COALESCE(SUM(ia.quantity), 0) as total_quantity,
        MAX(ia.assigned_at) as last_assignment_date
      FROM faculties f
      LEFT JOIN departments d ON d.faculty_id = f.id AND d.is_deleted = FALSE AND d.department_type = 'FACULTY'
      LEFT JOIN people p ON (
        (p.department_id = d.id) OR (p.faculty_id = f.id AND p.department_id IS NULL)
      ) AND p.is_deleted = FALSE
      LEFT JOIN item_assignments ia ON (ia.department_id = d.id OR ia.person_id = p.id OR ia.faculty_id = f.id) AND ia.is_deleted = FALSE
      WHERE f.is_deleted = FALSE AND f.level IN ('Bachelor', 'Master', 'PhD')
    `);
    return { admin: (admin as any)[0], faculty: (faculty as any)[0] };
  }

  static async getAdminDepartments() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        d.id, d.name_ps, d.name_fa,
        COUNT(DISTINCT p.id) as person_count,
        COUNT(DISTINCT ia.item_id) as item_count,
        COALESCE(SUM(ia.quantity), 0) as total_quantity,
        MAX(ia.assigned_at) as last_assignment_date
      FROM departments d
      LEFT JOIN people p ON p.department_id = d.id AND p.is_deleted = FALSE
      LEFT JOIN item_assignments ia ON (ia.department_id = d.id OR ia.person_id IN (SELECT id FROM people WHERE department_id = d.id AND is_deleted = FALSE)) AND ia.is_deleted = FALSE
      WHERE d.department_type = 'ADMIN' AND d.is_deleted = FALSE
      GROUP BY d.id, d.name_ps, d.name_fa
      ORDER BY d.name_ps
    `);
    return rows;
  }

  static async getFacultyLevels() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        f.level,
        COUNT(DISTINCT f.id) as faculty_count,
        COUNT(DISTINCT d.id) as department_count,
        COUNT(DISTINCT p.id) as person_count,
        COUNT(DISTINCT ia.item_id) as item_count,
        COALESCE(SUM(ia.quantity), 0) as total_quantity
      FROM faculties f
      LEFT JOIN departments d ON d.faculty_id = f.id AND d.is_deleted = FALSE
      LEFT JOIN people p ON (
        (p.department_id = d.id) OR (p.faculty_id = f.id AND p.department_id IS NULL)
      ) AND p.is_deleted = FALSE
      LEFT JOIN item_assignments ia ON (ia.faculty_id = f.id OR ia.department_id = d.id OR ia.person_id = p.id) AND ia.is_deleted = FALSE
      WHERE f.is_deleted = FALSE AND f.level IN ('Bachelor', 'Master', 'PhD')
      GROUP BY f.level
      ORDER BY FIELD(f.level, 'Bachelor', 'Master', 'PhD')
    `);
    const levels = ['Bachelor', 'Master', 'PhD'];
    const result: any[] = [...rows];
    const existingLevels = rows.map((r: any) => r.level);
    for (const lv of levels) {
      if (!existingLevels.includes(lv)) {
        result.push({ level: lv, faculty_count: 0, department_count: 0, person_count: 0, item_count: 0, total_quantity: 0 });
      }
    }
    return result;
  }

  static async getDepartmentsByLevel(level: string) {
    let whereLevel = level === 'General' ? `f.level IS NULL` : `f.level = ?`;
    const params: any[] = level === 'General' ? [] : [level];
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        f.id as faculty_id, f.name_ps as faculty_name_ps, f.name_fa as faculty_name_fa, f.level,
        d.id as department_id, d.name_ps as dept_name_ps, d.name_fa as dept_name_fa,
        COUNT(DISTINCT p.id) as person_count,
        COUNT(DISTINCT ia.item_id) as item_count,
        COALESCE(SUM(ia.quantity), 0) as total_quantity,
        (SELECT COUNT(DISTINCT fp.id) FROM people fp
         WHERE (
           fp.department_id IN (SELECT id FROM departments WHERE faculty_id = f.id AND is_deleted = FALSE)
           OR (fp.faculty_id = f.id AND fp.department_id IS NULL)
         ) AND fp.is_deleted = FALSE) as faculty_total_persons
      FROM faculties f
      LEFT JOIN departments d ON d.faculty_id = f.id AND d.is_deleted = FALSE AND d.department_type = 'FACULTY'
      LEFT JOIN people p ON (
        (d.id IS NOT NULL AND p.department_id = d.id) OR
        (d.id IS NULL AND p.faculty_id = f.id AND p.department_id IS NULL)
      ) AND p.is_deleted = FALSE
      LEFT JOIN item_assignments ia ON (ia.department_id = d.id OR ia.person_id = p.id OR ia.faculty_id = f.id) AND ia.is_deleted = FALSE
      WHERE f.is_deleted = FALSE AND ${whereLevel}
      GROUP BY f.id, f.name_ps, f.name_fa, f.level, d.id, d.name_ps, d.name_fa
      ORDER BY f.name_ps, d.name_ps
    `, params);
    return rows;
  }

  static async getPersonsByFaculty(facultyId: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        p.id, p.full_name, p.position, p.phone, p.email, p.photo,
        d.name_ps as dept_name_ps, d.name_fa as dept_name_fa,
        f.name_ps as faculty_name_ps, f.name_fa as faculty_name_fa, f.level,
        COUNT(DISTINCT ia.item_id) as item_count,
        COALESCE(SUM(ia.quantity), 0) as total_quantity,
        MAX(ia.assigned_at) as latest_assignment_date
      FROM people p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON COALESCE(d.faculty_id, p.faculty_id) = f.id
      LEFT JOIN item_assignments ia ON ia.person_id = p.id AND ia.is_deleted = FALSE
      WHERE COALESCE(d.faculty_id, p.faculty_id) = ? AND p.is_deleted = FALSE
      GROUP BY p.id, p.full_name, p.position, p.phone, p.email,
               d.name_ps, d.name_fa, f.name_ps, f.name_fa, f.level
      ORDER BY p.full_name
    `, [facultyId]);
    return rows;
  }

  static async getPersonsByDepartment(departmentId: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        p.id, p.full_name, p.position, p.phone, p.email, p.photo,
        COALESCE(d.name_ps, fd.name_ps) as dept_name_ps,
        COALESCE(d.name_fa, fd.name_fa) as dept_name_fa,
        COALESCE(f.name_ps, f2.name_ps) as faculty_name_ps,
        COALESCE(f.name_fa, f2.name_fa) as faculty_name_fa,
        COALESCE(f.level, f2.level) as level,
        COUNT(DISTINCT ia.item_id) as item_count,
        COALESCE(SUM(ia.quantity), 0) as total_quantity,
        MAX(ia.assigned_at) as latest_assignment_date
      FROM people p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      LEFT JOIN departments fd ON fd.id = ?
      LEFT JOIN faculties f2 ON p.faculty_id = f2.id
      LEFT JOIN item_assignments ia ON ia.person_id = p.id AND ia.is_deleted = FALSE
      WHERE p.is_deleted = FALSE
        AND (
          p.department_id = ?
          OR (p.department_id IS NULL AND p.faculty_id = (SELECT faculty_id FROM departments WHERE id = ? LIMIT 1))
        )
      GROUP BY p.id, p.full_name, p.position, p.phone, p.email,
               d.name_ps, d.name_fa, fd.name_ps, fd.name_fa,
               f.name_ps, f.name_fa, f.level, f2.name_ps, f2.name_fa, f2.level
      ORDER BY p.full_name
    `, [departmentId, departmentId, departmentId]);
    return rows;
  }

  static async getPersonLedger(personId: number) {
    const [assignRows] = await db.query<RowDataPacket[]>(`
      SELECT
        ia.id, ia.quantity, ia.assigned_at, ia.source_type, ia.status,
        ia.notes, ia.tracking_id, ia.delivery_id, ia.fs5_reference,
        i.item_code, i.name_ps as item_name_ps, i.name_fa as item_name_fa,
        i.description as item_description,
        u.name_ps as unit_name_ps, u.name_fa as unit_name_fa,
        p.full_name as person_name,
        d.name_ps as dept_name_ps, d.name_fa as dept_name_fa,
        f.name_ps as faculty_name_ps, f.name_fa as faculty_name_fa,
        r.tracking_id as request_tracking_id,
        dl.fs5_number as delivery_fs5,
        ab.name as assigned_by_name
      FROM item_assignments ia
      LEFT JOIN items i ON ia.item_id = i.id
      LEFT JOIN units u ON (ia.unit_id = u.id OR i.unit_id = u.id)
      LEFT JOIN people p ON ia.person_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      LEFT JOIN requests r ON ia.tracking_id = r.tracking_id
      LEFT JOIN deliveries dl ON ia.delivery_id = dl.id
      LEFT JOIN users ab ON ia.assigned_by = ab.id
      WHERE ia.person_id = ? AND ia.is_deleted = FALSE
      ORDER BY ia.assigned_at DESC
    `, [personId]);

    // Also fetch requests linked to this person (pending and completed)
    const [reqRows] = await db.query<RowDataPacket[]>(`
      SELECT
        CONCAT('req_', ri.id) as id,
        ri.quantity,
        r.created_at as assigned_at,
        'request' as source_type,
        r.status,
        r.notes,
        r.tracking_id,
        NULL as delivery_id,
        NULL as fs5_reference,
        i.item_code,
        COALESCE(i.name_ps, ri.item_name) as item_name_ps,
        COALESCE(i.name_fa, ri.item_name) as item_name_fa,
        NULL as item_description,
        u.name_ps as unit_name_ps,
        u.name_fa as unit_name_fa,
        p.full_name as person_name,
        d.name_ps as dept_name_ps,
        d.name_fa as dept_name_fa,
        f.name_ps as faculty_name_ps,
        f.name_fa as faculty_name_fa,
        r.tracking_id as request_tracking_id,
        NULL as delivery_fs5,
        ru.name as assigned_by_name
      FROM requests r
      JOIN people p ON r.person_id = p.id
      JOIN request_items ri ON ri.request_id = r.id
      LEFT JOIN items i ON ri.item_id = i.id
      LEFT JOIN units u ON (ri.unit_id = u.id OR i.unit_id = u.id)
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      LEFT JOIN users ru ON r.requester_id = ru.id
      WHERE r.person_id = ? AND r.is_deleted = FALSE
      ORDER BY r.created_at DESC
    `, [personId]);

    // Merge: assignments first, then requests not already covered by an assignment
    const assignTrackingIds = new Set(
      (assignRows as any[]).map((r: any) => r.request_tracking_id).filter(Boolean)
    );
    const filteredReqRows = (reqRows as any[]).filter(
      (r: any) => !assignTrackingIds.has(r.tracking_id)
    );

    const combined = [...(assignRows as any[]), ...filteredReqRows];
    combined.sort((a: any, b: any) => new Date(b.assigned_at).getTime() - new Date(a.assigned_at).getTime());
    return combined;
  }

  static async searchAssignments(term: string) {
    const query = term.trim();
    if (!query) return [];
    const like = `%${query}%`;
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        ia.id, ia.quantity, ia.assigned_at, ia.source_type, ia.status,
        ia.notes, ia.tracking_id, ia.delivery_id, ia.fs5_reference,
        i.item_code, i.name_ps AS item_name_ps, i.name_fa AS item_name_fa,
        u.name_ps AS unit_name_ps, u.name_fa AS unit_name_fa,
        p.id AS person_id, p.full_name AS person_name, p.position,
        d.name_ps AS dept_name_ps, d.name_fa AS dept_name_fa,
        f.name_ps AS faculty_name_ps, f.name_fa AS faculty_name_fa,
        r.id AS request_id, r.tracking_id AS request_tracking_id
      FROM item_assignments ia
      LEFT JOIN items i ON ia.item_id = i.id
      LEFT JOIN units u ON (ia.unit_id = u.id OR i.unit_id = u.id)
      LEFT JOIN people p ON ia.person_id = p.id
      LEFT JOIN departments d ON COALESCE(ia.department_id, p.department_id) = d.id
      LEFT JOIN faculties f ON COALESCE(ia.faculty_id, d.faculty_id, p.faculty_id) = f.id
      LEFT JOIN deliveries dl ON ia.delivery_id = dl.id
      LEFT JOIN requests r ON r.id = dl.request_id OR r.tracking_id = ia.tracking_id
      WHERE ia.is_deleted = FALSE
        AND (
          i.item_code LIKE ?
          OR i.name_ps LIKE ?
          OR i.name_fa LIKE ?
          OR p.full_name LIKE ?
          OR ia.tracking_id LIKE ?
          OR r.tracking_id LIKE ?
          OR CAST(r.id AS CHAR) = ?
        )
      ORDER BY ia.assigned_at DESC
      LIMIT 100
    `, [like, like, like, like, like, like, query]);
    return rows;
  }

  static async getFacultyLedger(facultyId: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        ia.id, ia.quantity, ia.assigned_at, ia.source_type, ia.status,
        ia.notes, ia.tracking_id, ia.delivery_id,
        i.item_code, i.name_ps as item_name_ps, i.name_fa as item_name_fa,
        u.name_ps as unit_name_ps,
        p.full_name as person_name,
        d.name_ps as dept_name_ps
      FROM item_assignments ia
      LEFT JOIN items i ON ia.item_id = i.id
      LEFT JOIN units u ON i.unit_id = u.id
      LEFT JOIN people p ON ia.person_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE (ia.faculty_id = ? OR p.department_id IN (
        SELECT id FROM departments WHERE faculty_id = ? AND is_deleted = FALSE
      )) AND ia.is_deleted = FALSE
      ORDER BY ia.assigned_at DESC
    `, [facultyId, facultyId]);
    return rows;
  }

  static async getExportData(filters: any) {
    let where = `ia.is_deleted = FALSE`;
    const params: any[] = [];
    if (filters.department_id) { where += ` AND d.id = ?`; params.push(filters.department_id); }
    if (filters.faculty_id) { where += ` AND f.id = ?`; params.push(filters.faculty_id); }
    if (filters.person_id) { where += ` AND p.id = ?`; params.push(filters.person_id); }
    if (filters.section === 'admin') { where += ` AND d.department_type = 'ADMIN'`; }
    if (filters.section === 'faculty') { where += ` AND d.department_type = 'FACULTY'`; }

    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        p.full_name as person_name, p.position,
        d.name_ps as dept_name_ps, d.name_fa as dept_name_fa, d.department_type,
        f.name_ps as faculty_name_ps, f.level,
        i.item_code, i.name_ps as item_name_ps, i.name_fa as item_name_fa, i.description,
        ia.quantity, u.name_ps as unit_name, ia.assigned_at, ia.source_type,
        ia.tracking_id, ia.delivery_id, ia.status, ia.notes
      FROM item_assignments ia
      LEFT JOIN items i ON ia.item_id = i.id
      LEFT JOIN units u ON (ia.unit_id = u.id OR i.unit_id = u.id)
      LEFT JOIN people p ON ia.person_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      WHERE ${where}
      ORDER BY ia.assigned_at DESC
    `, params);
    return rows;
  }

  static async manualAssignment(data: {
    item_id: number;
    quantity: number;
    unit_id?: number;
    person_id?: number;
    department_id?: number;
    faculty_id?: number;
    source_type: string;
    notes?: string;
    assigned_by?: number;
    tracking_id?: string;
    delivery_id?: number;
  }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (!data.item_id || !data.quantity || data.quantity <= 0) {
        throw new Error('invalid_data');
      }

      const [itemRows] = await conn.query<RowDataPacket[]>(
        `SELECT id, name_ps, current_stock FROM items WHERE id = ? AND is_deleted = FALSE FOR UPDATE`,
        [data.item_id]
      );
      if (!itemRows.length) throw new Error('item_not_found');

      const item = itemRows[0] as any;
      if (item.current_stock < data.quantity) throw new Error('insufficient_stock');

      const prevStock = item.current_stock;
      const newStock = prevStock - data.quantity;

      await conn.query(
        `UPDATE items SET current_stock = ? WHERE id = ?`,
        [newStock, data.item_id]
      );

      await conn.query(
        `INSERT INTO stock_transactions (item_id, transaction_type, quantity, previous_stock, new_stock, source_type, notes, created_by)
         VALUES (?, 'OUT', ?, ?, ?, ?, ?, ?)`,
        [data.item_id, data.quantity, prevStock, newStock, data.source_type || 'manual', data.notes || null, data.assigned_by || null]
      );

      const [iaResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO item_assignments (item_id, person_id, department_id, faculty_id, quantity, unit_id, source_type, status, notes, assigned_by, tracking_id, delivery_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ASSIGNED', ?, ?, ?, ?)`,
        [
          data.item_id,
          data.person_id || null,
          data.department_id || null,
          data.faculty_id || null,
          data.quantity,
          data.unit_id || null,
          data.source_type || 'manual',
          data.notes || null,
          data.assigned_by || null,
          data.tracking_id || null,
          data.delivery_id || null,
        ]
      );

      await conn.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
         VALUES (?, 'manual_assignment', 'item_assignment', ?, ?)`,
        [
          data.assigned_by || null,
          String(iaResult.insertId),
          JSON.stringify({ item_id: data.item_id, quantity: data.quantity, person_id: data.person_id }),
        ]
      );

      await conn.commit();
      return { assignment_id: iaResult.insertId, new_stock: newStock };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}
