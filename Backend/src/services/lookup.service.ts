import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';

export class LookupService {

  // --- Vendors ---
  static async getVendors() {
    const [rows] = await db.query(`SELECT * FROM vendors WHERE is_deleted = FALSE ORDER BY name ASC`);
    return rows;
  }

  static async getVendorById(id: number) {
    const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM vendors WHERE id = ? AND is_deleted = FALSE`, [id]);
    return rows[0] || null;
  }

  static async createVendor(data: any) {
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO vendors (name, phone, email, address) VALUES (?, ?, ?, ?)
    `, [data.name, data.phone || null, data.email || null, data.address || null]);
    return result.insertId;
  }

  static async updateVendor(id: number, data: any) {
    const fields: string[] = [];
    const params: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name); }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone); }
    if (data.email !== undefined) { fields.push('email = ?'); params.push(data.email); }
    if (data.address !== undefined) { fields.push('address = ?'); params.push(data.address); }
    if (fields.length === 0) return true;
    params.push(id);
    await db.query(`UPDATE vendors SET ${fields.join(', ')} WHERE id = ?`, params);
    return true;
  }

  // --- Faculties ---
  static async getFaculties() {
    const [rows] = await db.query(`SELECT * FROM faculties WHERE is_deleted = FALSE ORDER BY name_ps ASC`);
    return rows;
  }

  static async createFaculty(data: any) {
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO faculties (name_ps, name_fa) VALUES (?, ?)
    `, [data.name_ps, data.name_fa || data.name_ps]);
    return result.insertId;
  }

  // --- Departments ---
  static async getDepartments(filters: any = {}) {
    let query = `
      SELECT d.*, f.name_ps AS faculty_name
      FROM departments d
      LEFT JOIN faculties f ON d.faculty_id = f.id
      WHERE d.is_deleted = FALSE
    `;
    const params: any[] = [];
    if (filters.faculty_id) {
      query += ` AND d.faculty_id = ?`;
      params.push(filters.faculty_id);
    }
    if (filters.type) {
      query += ` AND d.department_type = ?`;
      params.push(filters.type);
    }
    query += ` ORDER BY d.name_ps ASC`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async createDepartment(data: any) {
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO departments (faculty_id, name_ps, name_fa, department_type)
      VALUES (?, ?, ?, ?)
    `, [data.faculty_id || null, data.name_ps, data.name_fa || data.name_ps, data.department_type || 'ADMIN']);
    return result.insertId;
  }

  // --- People ---
  static async getPeople(filters: any = {}) {
    let query = `
      SELECT p.*,
        d.name_ps AS department_name,
        f.name_ps AS faculty_name
      FROM people p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      WHERE p.is_deleted = FALSE
    `;
    const params: any[] = [];
    if (filters.department_id) {
      query += ` AND p.department_id = ?`;
      params.push(filters.department_id);
    }
    query += ` ORDER BY p.full_name ASC`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getPersonById(id: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT p.*, d.name_ps AS department_name, f.name_ps AS faculty_name
      FROM people p
      LEFT JOIN departments d ON p.department_id = d.id
      LEFT JOIN faculties f ON d.faculty_id = f.id
      WHERE p.id = ? AND p.is_deleted = FALSE
    `, [id]);
    return rows[0] || null;
  }

  static async createPerson(data: any) {
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO people (department_id, full_name, position, phone, email)
      VALUES (?, ?, ?, ?, ?)
    `, [data.department_id, data.full_name, data.position || null, data.phone || null, data.email || null]);
    return result.insertId;
  }

  // --- Categories CRUD ---
  static async createCategory(data: any) {
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO categories (name_ps, name_fa, description) VALUES (?, ?, ?)
    `, [data.name_ps, data.name_fa || data.name_ps, data.description || null]);
    return result.insertId;
  }

  // --- Units CRUD ---
  static async createUnit(data: any) {
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO units (name_ps, name_fa, symbol) VALUES (?, ?, ?)
    `, [data.name_ps, data.name_fa || data.name_ps, data.symbol || null]);
    return result.insertId;
  }

  // --- Warehouses CRUD ---
  static async createWarehouse(data: any) {
    const [result] = await db.query<ResultSetHeader>(`
      INSERT INTO warehouses (name_ps, name_fa, location, description) VALUES (?, ?, ?, ?)
    `, [data.name_ps, data.name_fa || data.name_ps, data.location || null, data.description || null]);
    return result.insertId;
  }
}
