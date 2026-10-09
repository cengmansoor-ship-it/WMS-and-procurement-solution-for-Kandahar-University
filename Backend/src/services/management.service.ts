import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { runColumnMigration } from '../utils/migrationHelper';

export class ManagementService {

  static async runMigrations() {
    const cols = [
      { table: 'people',    col: 'photo',      def: `MEDIUMTEXT DEFAULT NULL` },
      { table: 'faculties', col: 'level',       def: `VARCHAR(20) DEFAULT NULL` },
      { table: 'people',    col: 'faculty_id',  def: `INT DEFAULT NULL` },
    ];
    for (const c of cols) {
      try {
        await runColumnMigration(c.table, c.col, c.def, 'Management');
      } catch (e: any) {
        console.warn(`[Management] Migration warning for ${c.table}.${c.col}:`, e.message);
      }
    }
    // Make department_id nullable for faculty-level people (e.g. confirmers)
    try {
      await db.query(`ALTER TABLE people MODIFY COLUMN department_id INT DEFAULT NULL`);
    } catch (_e: any) { /* already nullable */ }
  }

  // ─── Faculties ─────────────────────────────────────────────────────────────

  static async getFaculties() {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT id, name_ps, name_fa, level, created_at, updated_at FROM faculties WHERE is_deleted = FALSE ORDER BY name_ps ASC`
    );
    return rows;
  }

  static async createFaculty(data: { name_ps: string; name_fa: string; level?: string }) {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO faculties (name_ps, name_fa, level) VALUES (?, ?, ?)`,
      [data.name_ps, data.name_fa || data.name_ps, data.level || null]
    );
    return result.insertId;
  }

  static async updateFaculty(id: number, data: { name_ps?: string; name_fa?: string; level?: string }) {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.name_ps !== undefined) { fields.push('name_ps = ?'); params.push(data.name_ps); }
    if (data.name_fa !== undefined) { fields.push('name_fa = ?'); params.push(data.name_fa); }
    if (data.level !== undefined) { fields.push('level = ?'); params.push(data.level || null); }
    if (fields.length === 0) return true;
    params.push(id);
    await db.query(`UPDATE faculties SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    return true;
  }

  static async deleteFaculty(id: number, reason?: string | null, deletedByName?: string | null) {
    await db.query(
      `UPDATE faculties SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW(), delete_reason = ?, deleted_by_name = ? WHERE id = ?`,
      [reason || null, deletedByName || null, id]
    );
    return true;
  }

  // ─── Departments ───────────────────────────────────────────────────────────

  static async getDepartments() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT d.id, d.name_ps, d.name_fa, d.department_type, d.faculty_id,
             f.name_ps as faculty_name_ps, f.name_fa as faculty_name_fa,
             f.level as faculty_level,
             d.created_at, d.updated_at
      FROM departments d
      LEFT JOIN faculties f ON d.faculty_id = f.id AND f.is_deleted = FALSE
      WHERE d.is_deleted = FALSE
      ORDER BY d.department_type ASC, f.level ASC, d.name_ps ASC
    `);
    return rows;
  }

  static async createDepartment(data: { name_ps: string; name_fa: string; department_type: string; faculty_id?: number }) {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO departments (name_ps, name_fa, department_type, faculty_id) VALUES (?, ?, ?, ?)`,
      [data.name_ps, data.name_fa || data.name_ps, data.department_type || 'ADMIN', data.faculty_id || null]
    );
    return result.insertId;
  }

  static async updateDepartment(id: number, data: { name_ps?: string; name_fa?: string; department_type?: string; faculty_id?: number }) {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.name_ps !== undefined) { fields.push('name_ps = ?'); params.push(data.name_ps); }
    if (data.name_fa !== undefined) { fields.push('name_fa = ?'); params.push(data.name_fa); }
    if (data.department_type !== undefined) { fields.push('department_type = ?'); params.push(data.department_type); }
    if (data.faculty_id !== undefined) { fields.push('faculty_id = ?'); params.push(data.faculty_id || null); }
    if (fields.length === 0) return true;
    params.push(id);
    await db.query(`UPDATE departments SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    return true;
  }

  static async deleteDepartment(id: number, reason?: string | null, deletedByName?: string | null) {
    await db.query(
      `UPDATE departments SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW(), delete_reason = ?, deleted_by_name = ? WHERE id = ?`,
      [reason || null, deletedByName || null, id]
    );
    return true;
  }

  // ─── People ────────────────────────────────────────────────────────────────

  static async getPeople(departmentId?: number) {
    let where = `p.is_deleted = FALSE`;
    const params: any[] = [];
    if (departmentId) { where += ` AND p.department_id = ?`; params.push(departmentId); }
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT p.id, p.full_name, p.position, p.phone, p.email, p.photo,
             p.department_id, d.name_ps as dept_name_ps, d.name_fa as dept_name_fa,
             d.department_type, COALESCE(d.faculty_id, p.faculty_id) as faculty_id,
             COALESCE(f2.name_ps, f.name_ps) as faculty_name_ps,
             COALESCE(f2.name_fa, f.name_fa) as faculty_name_fa,
             COALESCE(f2.level, f.level) as faculty_level,
             p.faculty_id as direct_faculty_id,
             p.created_at, p.updated_at
      FROM people p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      LEFT JOIN faculties f2 ON p.faculty_id = f2.id
      WHERE ${where}
      ORDER BY p.full_name ASC
    `, params);
    return rows;
  }

  static async getPersonById(id: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT p.id, p.full_name, p.position, p.phone, p.email, p.photo,
             p.department_id, d.name_ps as dept_name_ps, d.name_fa as dept_name_fa,
             COALESCE(d.faculty_id, p.faculty_id) as faculty_id,
             p.faculty_id as direct_faculty_id
      FROM people p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ? AND p.is_deleted = FALSE
    `, [id]);
    return rows[0] || null;
  }

  static async findPersonByEmail(email: string) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT p.id, p.full_name, p.position, p.phone, p.email, p.photo,
             p.department_id, p.faculty_id as direct_faculty_id,
             COALESCE(d.faculty_id, p.faculty_id) as faculty_id,
             d.name_ps as dept_name_ps, d.department_type,
             f.level as faculty_level
      FROM people p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON COALESCE(d.faculty_id, p.faculty_id) = f.id
      WHERE p.email = ? AND p.is_deleted = FALSE
      LIMIT 1
    `, [email.trim().toLowerCase()]);
    return rows[0] || null;
  }

  static async createPerson(data: {
    full_name: string;
    department_id?: number | null;
    faculty_id?: number | null;
    position?: string;
    phone?: string;
    email?: string;
    photo?: string;
  }) {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO people (full_name, department_id, faculty_id, position, phone, email, photo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.full_name, data.department_id || null, data.faculty_id || null, data.position || null, data.phone || null, data.email || null, data.photo || null]
    );
    return result.insertId;
  }

  static async upsertPersonByEmail(data: {
    full_name: string;
    department_id?: number | null;
    faculty_id?: number | null;
    position?: string;
    phone?: string;
    email: string;
    photo?: string;
  }): Promise<{ id: number; created: boolean }> {
    const existing = await ManagementService.findPersonByEmail(data.email);
    if (existing) {
      await ManagementService.updatePerson(existing.id, {
        full_name: data.full_name,
        department_id: data.department_id,
        faculty_id: data.faculty_id,
        position: data.position,
        phone: data.phone,
        email: data.email,
      });
      return { id: existing.id, created: false };
    }
    const id = await ManagementService.createPerson(data);
    return { id, created: true };
  }

  static async updatePerson(id: number, data: {
    full_name?: string;
    department_id?: number | null;
    faculty_id?: number | null;
    position?: string;
    phone?: string;
    email?: string;
    photo?: string;
  }) {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.full_name !== undefined) { fields.push('full_name = ?'); params.push(data.full_name); }
    if (data.department_id !== undefined) { fields.push('department_id = ?'); params.push(data.department_id ?? null); }
    if (data.faculty_id !== undefined) { fields.push('faculty_id = ?'); params.push(data.faculty_id ?? null); }
    if (data.position !== undefined) { fields.push('position = ?'); params.push(data.position || null); }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone || null); }
    if (data.email !== undefined) { fields.push('email = ?'); params.push(data.email || null); }
    if (data.photo !== undefined) { fields.push('photo = ?'); params.push(data.photo || null); }
    if (fields.length === 0) return true;
    params.push(id);
    await db.query(`UPDATE people SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    return true;
  }

  static async deletePerson(id: number, reason?: string | null, deletedByName?: string | null) {
    await db.query(
      `UPDATE people SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW(), delete_reason = ?, deleted_by_name = ? WHERE id = ?`,
      [reason || null, deletedByName || null, id]
    );
    return true;
  }

  static async importPeople(rows: { full_name: string; department_id: number; position?: string; phone?: string; email?: string }[]) {
    let inserted = 0;
    const errors: string[] = [];
    for (const row of rows) {
      try {
        await db.query(
          `INSERT INTO people (full_name, department_id, position, phone, email) VALUES (?, ?, ?, ?, ?)`,
          [row.full_name, row.department_id, row.position || null, row.phone || null, row.email || null]
        );
        inserted++;
      } catch (e: any) {
        errors.push(`${row.full_name}: ${e.message}`);
      }
    }
    return { inserted, errors };
  }

  // ─── Item Assignments ──────────────────────────────────────────────────────

  static async getAssignments(filters: { person_id?: number; department_id?: number; faculty_id?: number }) {
    let where = `ia.is_deleted = FALSE`;
    const params: any[] = [];
    if (filters.person_id) { where += ` AND ia.person_id = ?`; params.push(filters.person_id); }
    if (filters.department_id) { where += ` AND ia.department_id = ?`; params.push(filters.department_id); }
    if (filters.faculty_id) { where += ` AND ia.faculty_id = ?`; params.push(filters.faculty_id); }
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT
        ia.id, ia.quantity, ia.status, ia.source_type, ia.notes,
        ia.assigned_at, ia.tracking_id, ia.delivery_id,
        ia.person_id, ia.department_id, ia.faculty_id,
        i.item_code, i.name_ps as item_name_ps, i.name_fa as item_name_fa,
        u.name_ps as unit_name_ps,
        p.full_name as person_name,
        d.name_ps as dept_name_ps
      FROM item_assignments ia
      LEFT JOIN items i ON ia.item_id = i.id
      LEFT JOIN units u ON (ia.unit_id = u.id OR i.unit_id = u.id)
      LEFT JOIN people p ON ia.person_id = p.id
      LEFT JOIN departments d ON ia.department_id = d.id
      WHERE ${where}
      ORDER BY ia.assigned_at DESC
      LIMIT 500
    `, params);
    return rows;
  }

  static async updateAssignmentStatus(id: number, status: string, notes?: string) {
    await db.query(
      `UPDATE item_assignments SET status = ?, notes = COALESCE(?, notes) WHERE id = ?`,
      [status, notes || null, id]
    );
    return true;
  }

  static async deleteAssignment(id: number) {
    await db.query(`UPDATE item_assignments SET is_deleted = TRUE WHERE id = ?`, [id]);
    return true;
  }
}
