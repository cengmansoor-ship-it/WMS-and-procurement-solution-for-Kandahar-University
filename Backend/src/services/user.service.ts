import bcrypt from 'bcryptjs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { runColumnMigration } from '../utils/migrationHelper';

const BUILTIN_ROLES = [
  { name: 'Super Admin', label_ps: 'سوپر ادمین', label_fa: 'سوپر ادمین' },
  { name: 'Admin', label_ps: 'اجناسو آمر', label_fa: 'آمر اجناس' },
  { name: 'Procurement Director', label_ps: 'د تدارکاتو مدیر', label_fa: 'مدیر تدارکات' },
  { name: 'Warehouse Director', label_ps: 'اجناسو مدیر', label_fa: 'مدیر اجناس' },
  { name: 'Requester', label_ps: 'غوښتنه کوونکی', label_fa: 'درخواست‌دهنده' },
  { name: 'Request Confirmer', label_ps: 'د غوښتنې تاییدوونکی', label_fa: 'تأییدکننده درخواست' },
  { name: 'Warehouse Entry Person', label_ps: 'د ګدام ثبت کوونکی', label_fa: 'ثبت‌کننده انبار' },
];

const SEED_USERS = [
  { name: 'Enayatullah Mansoor', email: 'superadmin@ku.edu.af', phone: '0700100001', password: 'SuperAdmin@1', role: 'Super Admin', person_id: 1, department_id: 1 },
  { name: 'Fazalrahman Mayar', email: 'admin@ku.edu.af', phone: '0700100002', password: 'Admin@1234', role: 'Admin', person_id: 2, department_id: 2 },
  { name: 'Abdulhadi Rahimi', email: 'procurement@ku.edu.af', phone: '0700100003', password: 'Procure@123', role: 'Procurement Director', person_id: 3, department_id: 3 },
  { name: 'Nazirahmad Bashare', email: 'warehouse@ku.edu.af', phone: '0700100004', password: 'Warehouse@1', role: 'Warehouse Director', person_id: 4, department_id: 4 },
  { name: 'Afghan Sahib', email: 'requester@ku.edu.af', phone: '0700100005', password: 'Request@123', role: 'Requester', person_id: 5, department_id: 6, faculty_id: 1 },
  { name: 'Doostyar Sahib', email: 'confirmer@ku.edu.af', phone: '0700100006', password: 'Confirm@123', role: 'Request Confirmer', person_id: 6, department_id: 6, faculty_id: 1 },
  { name: 'Mansoor Ahmad', email: 'entry@ku.edu.af', phone: '0700100007', password: 'Entry@1234', role: 'Warehouse Entry Person', person_id: 7, department_id: 5 },
];

type UserPayload = {
  name?: string;
  email?: string;
  phone?: string | null;
  role?: string;
  active?: boolean;
  password?: string;
  forcePasswordChange?: boolean;
  person_id?: number | null;
  faculty_id?: number | null;
  department_id?: number | null;
};

const cleanEmail = (email: string) => email.trim().toLowerCase();

const toMillis = (value: unknown) => {
  const time = value ? new Date(value as string).getTime() : Date.now();
  return Number.isFinite(time) ? time : Date.now();
};

const mapUser = (row: any) => ({
  uid: String(row.id),
  name: row.name || '',
  email: row.email || '',
  phone: row.phone || '',
  role: row.role_name || row.role || 'Requester',
  active: row.status === 'active' && !row.is_deleted,
  forcePasswordChange: Boolean(row.force_password_change),
  createdAt: toMillis(row.created_at),
  updatedAt: toMillis(row.updated_at),
  ...(row.person_id != null ? { person_id: Number(row.person_id) } : {}),
  ...(row.faculty_id != null ? { faculty_id: Number(row.faculty_id) } : {}),
  ...(row.department_id != null ? { department_id: Number(row.department_id) } : {}),
});

export class UserService {
  static async runMigrations() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        label_ps VARCHAR(100) NOT NULL,
        label_fa VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role_id INT NOT NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_deleted BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB
    `);

    const cols = [
      { col: 'phone', def: `VARCHAR(50) DEFAULT ''` },
      { col: 'force_password_change', def: `TINYINT(1) DEFAULT 0` },
      { col: 'person_id', def: `INT DEFAULT NULL` },
      { col: 'faculty_id', def: `INT DEFAULT NULL` },
      { col: 'department_id', def: `INT DEFAULT NULL` },
      { col: 'deleted_at', def: `TIMESTAMP NULL DEFAULT NULL` },
      { col: 'deleted_by_name', def: `VARCHAR(150) NULL DEFAULT NULL` },
      { col: 'delete_reason', def: `TEXT NULL` },
    ];
    for (const c of cols) {
      try {
        await runColumnMigration('users', c.col, c.def, 'Users');
      } catch (e: any) {
        console.warn(`[Users] Migration warning for users.${c.col}:`, e.message);
      }
    }

    for (const role of BUILTIN_ROLES) {
      await db.query(
        `INSERT INTO roles (name, label_ps, label_fa)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE label_ps = VALUES(label_ps), label_fa = VALUES(label_fa)`,
        [role.name, role.label_ps, role.label_fa]
      );
    }

    const [userCountRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM users`);
    const userCount = Number(userCountRows[0]?.total ?? 0);

    if (userCount === 0) {
      for (const user of SEED_USERS) {
        const [existing] = await db.query<RowDataPacket[]>(
          `SELECT id FROM users WHERE email = ? LIMIT 1`,
          [cleanEmail(user.email)]
        );
        if (existing.length > 0) continue;
        const roleId = await UserService.ensureRole(user.role);
        const hash = await bcrypt.hash(user.password, 10);
        await db.query(
          `INSERT INTO users
            (name, email, password_hash, role_id, status, phone, person_id, faculty_id, department_id, force_password_change)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0)`,
          [
            user.name,
            cleanEmail(user.email),
            hash,
            roleId,
            user.phone || '',
            user.person_id || null,
            user.faculty_id || null,
            user.department_id || null,
          ]
        );
      }
    }
  }

  static async ensureRole(name: string): Promise<number> {
    const roleName = (name || 'Requester').trim();
    const builtin = BUILTIN_ROLES.find(r => r.name === roleName);
    await db.query(
      `INSERT INTO roles (name, label_ps, label_fa)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [roleName, builtin?.label_ps || roleName, builtin?.label_fa || roleName]
    );
    const [rows] = await db.query<RowDataPacket[]>(`SELECT id FROM roles WHERE name = ? LIMIT 1`, [roleName]);
    return Number(rows[0].id);
  }

  static async getUsers() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.is_deleted = FALSE
      ORDER BY u.created_at DESC, u.id DESC
    `);
    return rows.map(mapUser);
  }

  static async getById(id: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.is_deleted = FALSE
      LIMIT 1
    `, [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  static async getByEmail(email: string) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.email) = ? AND u.is_deleted = FALSE
      LIMIT 1
    `, [cleanEmail(email)]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  static async createUser(data: UserPayload) {
    if (!data.name?.trim()) throw new Error('name_required');
    if (!data.email?.trim()) throw new Error('email_required');
    if (!data.password?.trim()) throw new Error('password_required');

    const email = cleanEmail(data.email);
    const existing = await UserService.getByEmail(email);
    if (existing) throw new Error('email_exists');

    const roleId = await UserService.ensureRole(data.role || 'Requester');
    const hash = await bcrypt.hash(data.password, 10);
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO users
        (name, email, password_hash, role_id, status, phone, force_password_change, person_id, faculty_id, department_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.name.trim(),
        email,
        hash,
        roleId,
        data.active === false ? 'inactive' : 'active',
        data.phone || '',
        data.forcePasswordChange ? 1 : 0,
        data.person_id ?? null,
        data.faculty_id ?? null,
        data.department_id ?? null,
      ]
    );
    return UserService.getById(result.insertId);
  }

  static async updateUser(id: number, data: UserPayload) {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); params.push(data.name.trim()); }
    if (data.email !== undefined) {
      const email = cleanEmail(data.email);
      const [dupes] = await db.query<RowDataPacket[]>(
        `SELECT id FROM users WHERE LOWER(email) = ? AND id <> ? AND is_deleted = FALSE LIMIT 1`,
        [email, id]
      );
      if (dupes.length > 0) throw new Error('email_exists');
      fields.push('email = ?'); params.push(email);
    }
    if (data.role !== undefined) {
      fields.push('role_id = ?');
      params.push(await UserService.ensureRole(data.role));
    }
    if (data.phone !== undefined) { fields.push('phone = ?'); params.push(data.phone || ''); }
    if (data.active !== undefined) { fields.push('status = ?'); params.push(data.active ? 'active' : 'inactive'); }
    if (data.forcePasswordChange !== undefined) { fields.push('force_password_change = ?'); params.push(data.forcePasswordChange ? 1 : 0); }
    if (data.person_id !== undefined) { fields.push('person_id = ?'); params.push(data.person_id ?? null); }
    if (data.faculty_id !== undefined) { fields.push('faculty_id = ?'); params.push(data.faculty_id ?? null); }
    if (data.department_id !== undefined) { fields.push('department_id = ?'); params.push(data.department_id ?? null); }
    if (data.password?.trim()) {
      fields.push('password_hash = ?');
      params.push(await bcrypt.hash(data.password, 10));
    }

    if (fields.length === 0) return UserService.getById(id);
    params.push(id);
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND is_deleted = FALSE`,
      params
    );
    if (result.affectedRows === 0) throw new Error('not_found');
    return UserService.getById(id);
  }

  static async setActive(id: number, active: boolean) {
    if (!active) {
      const user = await UserService.getById(id);
      if (!user) throw new Error('not_found');
      if (user.role === 'Super Admin') {
        const [rows] = await db.query<RowDataPacket[]>(`
          SELECT COUNT(*) AS total
          FROM users u
          INNER JOIN roles r ON r.id = u.role_id
          WHERE r.name = 'Super Admin' AND u.is_deleted = FALSE AND u.status = 'active'
        `);
        if (Number(rows[0]?.total || 0) <= 1) throw new Error('last_super_admin');
      }
    }
    return UserService.updateUser(id, { active });
  }

  static async softDelete(id: number, deletedByName?: string, deleteReason?: string) {
    const user = await UserService.getById(id);
    if (!user) throw new Error('not_found');

    if (user.role === 'Super Admin') {
      const [rows] = await db.query<RowDataPacket[]>(`
        SELECT COUNT(*) AS total
        FROM users u
        INNER JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'Super Admin' AND u.is_deleted = FALSE
      `);
      if (Number(rows[0]?.total || 0) <= 1) throw new Error('last_super_admin');
    }

    const [result] = await db.query<ResultSetHeader>(`
      UPDATE users
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by_name = ?,
          delete_reason = ?,
          updated_at = NOW()
      WHERE id = ? AND is_deleted = FALSE
    `, [deletedByName || null, deleteReason || null, id]);
    if (result.affectedRows === 0) throw new Error('not_found');
    return user;
  }

  static async authenticate(email: string, password: string) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT u.*, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE LOWER(u.email) = ? AND u.is_deleted = FALSE
      LIMIT 1
    `, [cleanEmail(email)]);
    if (rows.length === 0) throw new Error('user_not_found');
    const row = rows[0];
    if (row.status !== 'active') throw new Error('inactive_user');
    const ok = await bcrypt.compare(password, row.password_hash || '');
    if (!ok) throw new Error('wrong_password');
    return mapUser(row);
  }
}
