const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const database = process.env.DB_NAME || 'kandahar_db';

const ROLES = [
  { id: 1, name: 'Super Admin', label_ps: 'سوپر ادمین', label_fa: 'سوپر ادمین' },
  { id: 2, name: 'Admin', label_ps: 'اجناسو آمر', label_fa: 'آمر اجناس' },
  { id: 3, name: 'Procurement Director', label_ps: 'د تدارکاتو مدیر', label_fa: 'مدیر تدارکات' },
  { id: 4, name: 'Warehouse Director', label_ps: 'اجناسو مدیر', label_fa: 'مدیر اجناس' },
  { id: 5, name: 'Requester', label_ps: 'غوښتنه کوونکی', label_fa: 'درخواست‌دهنده' },
  { id: 6, name: 'Request Confirmer', label_ps: 'د غوښتنې تاییدوونکی', label_fa: 'تأییدکننده درخواست' },
  { id: 7, name: 'Warehouse Entry Person', label_ps: 'د ګدام ثبت کوونکی', label_fa: 'ثبت‌کننده انبار' },
];

const USERS = [
  { name: 'Enayatullah Mansoor', email: 'superadmin@ku.edu.af', phone: '0700100001', password: 'SuperAdmin@1', role: 'Super Admin', person_id: 1, department_id: 1 },
  { name: 'Fazalrahman Mayar', email: 'admin@ku.edu.af', phone: '0700100002', password: 'Admin@1234', role: 'Admin', person_id: 2, department_id: 2 },
  { name: 'Abdulhadi Rahimi', email: 'procurement@ku.edu.af', phone: '0700100003', password: 'Procure@123', role: 'Procurement Director', person_id: 3, department_id: 3 },
  { name: 'Nazirahmad Bashare', email: 'warehouse@ku.edu.af', phone: '0700100004', password: 'Warehouse@1', role: 'Warehouse Director', person_id: 4, department_id: 4 },
  { name: 'Afghan Sahib', email: 'requester@ku.edu.af', phone: '0700100005', password: 'Request@123', role: 'Requester', person_id: 5, department_id: 6, faculty_id: 1 },
  { name: 'Doostyar Sahib', email: 'confirmer@ku.edu.af', phone: '0700100006', password: 'Confirm@123', role: 'Request Confirmer', person_id: 6, department_id: 6, faculty_id: 1 },
  { name: 'Mansoor Ahmad', email: 'entry@ku.edu.af', phone: '0700100007', password: 'Entry@1234', role: 'Warehouse Entry Person', person_id: 7, department_id: 5 },
];

const CATEGORIES = [
  { id: 1, name_ps: 'قرطاسیه', name_fa: 'قرطاسیه', description: 'د دفتري کار لپاره قرطاسیه' },
  { id: 2, name_ps: 'کمپیوټري وسایل', name_fa: 'وسایل کامپیوتری', description: 'کمپیوټري او تخنیکي وسایل' },
  { id: 3, name_ps: 'فرنیچر', name_fa: 'مبل و اثاثیه', description: 'د دفتر او صنف فرنیچر' },
  { id: 4, name_ps: 'شبکه', name_fa: 'شبکه', description: 'د شبکې او انټرنیت وسایل' },
  { id: 5, name_ps: 'برقي تجهیزات', name_fa: 'تجهیزات برقی', description: 'برقي وسایل او تجهیزات' },
  { id: 6, name_ps: 'تعلیمي وسایل', name_fa: 'وسایل آموزشی', description: 'د تدریس او زده‌کړې وسایل' },
  { id: 7, name_ps: 'نظافت', name_fa: 'نظافت', description: 'د صفایۍ مواد' },
];

const UNITS = [
  { id: 1, name_ps: 'ریمه', name_fa: 'ریم', symbol: 'ریم' },
  { id: 2, name_ps: 'دانه', name_fa: 'عدد', symbol: 'عدد' },
  { id: 3, name_ps: 'متر', name_fa: 'متر', symbol: 'م' },
  { id: 4, name_ps: 'پاکټ', name_fa: 'بسته', symbol: 'بسته' },
];

const WAREHOUSES = [
  { id: 1, name_ps: 'د کندهار پوهنتون عمومي ګدام', name_fa: 'انبار عمومی پوهنتون کندهار', location: 'کندهار، افغانستان', description: 'مرکزي ګدام' },
];

const FACULTIES = [
  { id: 1, name_ps: 'د کمپیوټر ساینس پوهنځی', name_fa: 'پوهنځی کامپیوتر ساینس' },
  { id: 2, name_ps: 'د انجینري پوهنځی', name_fa: 'پوهنځی انجینری' },
  { id: 3, name_ps: 'د طب پوهنځی', name_fa: 'پوهنځی طب' },
  { id: 4, name_ps: 'د اقتصاد پوهنځی', name_fa: 'پوهنځی اقتصاد' },
  { id: 5, name_ps: 'د حقوقو پوهنځی', name_fa: 'پوهنځی حقوق' },
  { id: 6, name_ps: 'د زراعت پوهنځی', name_fa: 'پوهنځی زراعت' },
  { id: 7, name_ps: 'د اسلامي علومو پوهنځی', name_fa: 'پوهنځی علوم اسلامی' },
  { id: 8, name_ps: 'د اجتماعي علومو پوهنځی', name_fa: 'پوهنځی علوم اجتماعی' },
  { id: 9, name_ps: 'د ژورنالیزم پوهنځی', name_fa: 'پوهنځی ژورنالیزم' },
  { id: 10, name_ps: 'مرکزي اداره', name_fa: 'اداره مرکزی' },
];

const DEPARTMENTS = [
  { id: 1, faculty_id: 1, name_ps: 'د معلوماتي سیستمونو څانګه', name_fa: 'بخش سیستم‌های اطلاعاتی', department_type: 'FACULTY' },
  { id: 2, faculty_id: 1, name_ps: 'د نرم افزار لابراتوار', name_fa: 'لابراتوار نرم‌افزار', department_type: 'FACULTY' },
  { id: 3, faculty_id: 2, name_ps: 'د شبکې او IT لابراتوار', name_fa: 'لابراتوار شبکه و IT', department_type: 'FACULTY' },
  { id: 4, faculty_id: 2, name_ps: 'د کمپیوټر لابراتوار', name_fa: 'لابراتوار کامپیوتر', department_type: 'FACULTY' },
  { id: 5, faculty_id: 2, name_ps: 'د IT مدیریت', name_fa: 'مدیریت IT', department_type: 'FACULTY' },
  { id: 6, faculty_id: 2, name_ps: 'د تعمیراتو شعبه', name_fa: 'بخش تعمیرات', department_type: 'FACULTY' },
  { id: 7, faculty_id: 3, name_ps: 'کتابتون', name_fa: 'کتابخانه', department_type: 'FACULTY' },
  { id: 8, faculty_id: 3, name_ps: 'اداري دفتر', name_fa: 'دفتر اداری', department_type: 'FACULTY' },
  { id: 9, faculty_id: 3, name_ps: 'د رادیولوژۍ شعبه', name_fa: 'بخش رادیولوژی', department_type: 'FACULTY' },
  { id: 10, faculty_id: 4, name_ps: 'د مالي چارو شعبه', name_fa: 'بخش امور مالی', department_type: 'FACULTY' },
  { id: 11, faculty_id: 4, name_ps: 'اداري مدیریت', name_fa: 'مدیریت اداری', department_type: 'FACULTY' },
  { id: 12, faculty_id: 5, name_ps: 'اداري مدیریت', name_fa: 'مدیریت اداری', department_type: 'FACULTY' },
  { id: 13, faculty_id: 5, name_ps: 'اداري دفتر', name_fa: 'دفتر اداری', department_type: 'FACULTY' },
  { id: 14, faculty_id: 6, name_ps: 'د لابراتوار شعبه', name_fa: 'بخش لابراتوار', department_type: 'FACULTY' },
  { id: 15, faculty_id: 6, name_ps: 'د صنف مدیریت', name_fa: 'مدیریت صنف', department_type: 'FACULTY' },
  { id: 16, faculty_id: 7, name_ps: 'د لومړي کال محصلین', name_fa: 'دانشجویان سال اول', department_type: 'FACULTY' },
  { id: 17, faculty_id: 8, name_ps: 'د احصایې شعبه', name_fa: 'بخش آمار', department_type: 'FACULTY' },
  { id: 18, faculty_id: 9, name_ps: 'د رسنیو لابراتوار', name_fa: 'لابراتوار رسانه', department_type: 'FACULTY' },
  { id: 19, faculty_id: 10, name_ps: 'د ودانیو او خدماتو شعبه', name_fa: 'بخش ابنیه و خدمات', department_type: 'ADMIN' },
];

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database,
    multipleStatements: false,
  });

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const r of ROLES) {
      await connection.query(
        'INSERT INTO roles (id, name, label_ps, label_fa) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE label_ps = VALUES(label_ps), label_fa = VALUES(label_fa)',
        [r.id, r.name, r.label_ps, r.label_fa]
      );
    }
    console.log('[SEED] Roles seeded:', ROLES.length);

    for (const u of USERS) {
      const [existing] = await connection.query('SELECT id FROM users WHERE email = ? LIMIT 1', [u.email.trim().toLowerCase()]);
      if (existing.length > 0) {
        console.log(`[SEED] User exists (skipped): ${u.email}`);
        continue;
      }
      const roleId = u.role === 'Super Admin' ? 1 : u.role === 'Admin' ? 2 : u.role === 'Procurement Director' ? 3 : u.role === 'Warehouse Director' ? 4 : u.role === 'Request Confirmer' ? 6 : u.role === 'Warehouse Entry Person' ? 7 : 5;
      const hash = await bcrypt.hash(u.password, 10);
      await connection.query(
        `INSERT INTO users (name, email, password_hash, role_id, status, phone, person_id, faculty_id, department_id, force_password_change)
         VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, 0)`,
        [u.name, u.email.trim().toLowerCase(), hash, roleId, u.phone, u.person_id || null, u.faculty_id || null, u.department_id || null]
      );
      console.log(`[SEED] User created: ${u.email} (role: ${u.role})`);
    }

    for (const c of CATEGORIES) {
      await connection.query(
        'INSERT INTO categories (id, name_ps, name_fa, description) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name_ps = VALUES(name_ps), name_fa = VALUES(name_fa)',
        [c.id, c.name_ps, c.name_fa, c.description]
      );
    }
    console.log('[SEED] Categories seeded:', CATEGORIES.length);

    for (const u of UNITS) {
      await connection.query(
        'INSERT INTO units (id, name_ps, name_fa, symbol) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name_ps = VALUES(name_ps), name_fa = VALUES(name_fa)',
        [u.id, u.name_ps, u.name_fa, u.symbol]
      );
    }
    console.log('[SEED] Units seeded:', UNITS.length);

    for (const w of WAREHOUSES) {
      await connection.query(
        'INSERT INTO warehouses (id, name_ps, name_fa, location, description) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name_ps = VALUES(name_ps), name_fa = VALUES(name_fa)',
        [w.id, w.name_ps, w.name_fa, w.location, w.description]
      );
    }
    console.log('[SEED] Warehouses seeded:', WAREHOUSES.length);

    for (const f of FACULTIES) {
      await connection.query(
        'INSERT INTO faculties (id, name_ps, name_fa) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name_ps = VALUES(name_ps), name_fa = VALUES(name_fa)',
        [f.id, f.name_ps, f.name_fa]
      );
    }
    console.log('[SEED] Faculties seeded:', FACULTIES.length);

    for (const d of DEPARTMENTS) {
      await connection.query(
        'INSERT INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name_ps = VALUES(name_ps), name_fa = VALUES(name_fa)',
        [d.id, d.faculty_id, d.name_ps, d.name_fa, d.department_type]
      );
    }
    console.log('[SEED] Departments seeded:', DEPARTMENTS.length);

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('[SEED] Done.');
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[SEED] Failed:', err.message);
  process.exit(1);
});
