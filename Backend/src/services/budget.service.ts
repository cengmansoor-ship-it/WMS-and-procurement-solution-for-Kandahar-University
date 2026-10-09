import pool from '../config/db';
import { withRetry } from '../utils/migrationHelper';

export class BudgetService {
  static async runMigrations() {
    const conn = await pool.getConnection();
    try {
      await withRetry(() => conn.query(`
        CREATE TABLE IF NOT EXISTS budget_babs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bab_code VARCHAR(20) NOT NULL,
          name_ps VARCHAR(200) NOT NULL,
          name_fa VARCHAR(200) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          is_deleted TINYINT(1) DEFAULT 0,
          UNIQUE KEY uq_bab_code (bab_code),
          INDEX idx_bab_code (bab_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `));
      await withRetry(() => conn.query(`
        CREATE TABLE IF NOT EXISTS budget_fasls (
          id INT AUTO_INCREMENT PRIMARY KEY,
          bab_id INT NOT NULL,
          fasl_code VARCHAR(20) NOT NULL,
          name_ps VARCHAR(200) NOT NULL,
          name_fa VARCHAR(200) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          is_deleted TINYINT(1) DEFAULT 0,
          UNIQUE KEY uq_bab_fasl (bab_id, fasl_code),
          INDEX idx_fasl_code (fasl_code),
          INDEX idx_bab_id (bab_id),
          FOREIGN KEY (bab_id) REFERENCES budget_babs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `));
      // ── Seed standard Afghan government budget bab/fasl codes ─────────────
      const seedBabs = [
        { bab_code: '21',  name_ps: 'معاشات او مزدونه',                 name_fa: 'معاشات و مزدها',               description: 'د کارمندانو معاشات' },
        { bab_code: '22',  name_ps: 'اجناس او خدمات',                   name_fa: 'کالاها و خدمات',               description: 'د دفتري اجناسو او خدماتو لیاقت' },
        { bab_code: '220', name_ps: 'سفریه',                             name_fa: 'سفریه',                        description: 'Travel Allowances' },
        { bab_code: '222', name_ps: 'غذا',                               name_fa: 'غذا',                          description: 'Food (non-salary)' },
        { bab_code: '223', name_ps: 'خدمات قراردادي',                   name_fa: 'خدمات قراردادی',               description: 'Contract Services' },
        { bab_code: '224', name_ps: 'ترمیمات او حفظ او مراقبت',         name_fa: 'ترمیمات و حفظ و مراقبت',      description: 'Repairs and Maintenance' },
        { bab_code: '225', name_ps: 'عام المنفعه',                       name_fa: 'عام المنفعه',                   description: 'Utilities' },
        { bab_code: '226', name_ps: 'روغنیات',                           name_fa: 'سوخت',                          description: 'Fuel' },
        { bab_code: '227', name_ps: 'سامان او لوازم',                   name_fa: 'سامان و لوازم',                description: 'Tools and Materials' },
        { bab_code: '228', name_ps: 'سایر مصارفات',                     name_fa: 'سایر مصارفات',                 description: 'Others Expenditure' },
        { bab_code: '229', name_ps: 'پیشکي ها او برګشت مصارف',          name_fa: 'پیشکی‌ها و برگشت مصارف',      description: 'Advances and Return of Expenditure' },
        { bab_code: '23',  name_ps: 'پانګه اچونه',                       name_fa: 'سرمایه‌گذاری',                 description: 'د سامانه، فرنیچر او تجهیزاتو خریداری' },
        { bab_code: '24',  name_ps: 'د پروژو مصارف',                    name_fa: 'مصارف پروژه‌ها',               description: 'د پراختیایي پروژو لپاره مصارف' },
        { bab_code: '25',  name_ps: 'نور مصارف',                         name_fa: 'سایر مصارف',                  description: 'د پورتنیو بابونو له دایرې بهر مصارف' },
      ];
      for (const b of seedBabs) {
        await conn.query(
          `INSERT IGNORE INTO budget_babs (bab_code, name_ps, name_fa, description) VALUES (?, ?, ?, ?)`,
          [b.bab_code, b.name_ps, b.name_fa, b.description]
        ).catch(() => {});
      }

      const seedFasls = [
        // Bab 21 — Salaries
        { bab_code: '21', fasl_code: '2101', name_ps: 'اساسي معاشات',                     name_fa: 'معاشات اساسی' },
        { bab_code: '21', fasl_code: '2102', name_ps: 'اضافه معاشات',                      name_fa: 'حق‌الزحمه اضافی' },
        // Bab 22 — Goods & Services
        { bab_code: '22', fasl_code: '2201', name_ps: 'قرطاسیه او دفتري مواد',            name_fa: 'قرطاسیه و لوازم دفتری' },
        { bab_code: '22', fasl_code: '2202', name_ps: 'کمپیوټري مواد',                     name_fa: 'لوازم کامپیوتری' },
        { bab_code: '22', fasl_code: '2203', name_ps: 'د چاپ او خپرونې مصارف',            name_fa: 'مصارف چاپ و نشر' },
        { bab_code: '22', fasl_code: '2204', name_ps: 'مخابراتي مصارف',                    name_fa: 'مصارف مخابراتی' },
        { bab_code: '22', fasl_code: '2205', name_ps: 'د لارې مصارف',                      name_fa: 'مصارف ترانسپورتی' },
        { bab_code: '22', fasl_code: '2206', name_ps: 'برق او اوبه',                       name_fa: 'برق و آب' },
        { bab_code: '22', fasl_code: '2207', name_ps: 'د پاکولو مواد',                     name_fa: 'مواد نظافتی' },
        { bab_code: '22', fasl_code: '2208', name_ps: 'د ماشین الاتو ساتنه',               name_fa: 'نگهداری ماشین‌آلات' },
        { bab_code: '22', fasl_code: '2209', name_ps: 'د دفتر کرایه',                      name_fa: 'اجاره دفتر' },
        { bab_code: '22', fasl_code: '2210', name_ps: 'نور اجناس او خدمات',                name_fa: 'سایر کالاها و خدمات' },
        // Bab 220 — Travel
        { bab_code: '220', fasl_code: '22100', name_ps: 'امتیاز داخلی',                   name_fa: 'امتیاز داخلی',          description: 'Allowance domestic' },
        { bab_code: '220', fasl_code: '22101', name_ps: 'امتیاز بین المللی',               name_fa: 'امتیاز بین المللی',     description: 'Allowance international' },
        { bab_code: '220', fasl_code: '22102', name_ps: 'سفریه داخلی',                     name_fa: 'سفریه داخلی',           description: 'Travel domestic' },
        { bab_code: '220', fasl_code: '22103', name_ps: 'سفریه خارجی',                     name_fa: 'سفریه خارجی',           description: 'Travel international' },
        { bab_code: '220', fasl_code: '22104', name_ps: 'سفریه داخلی کارندان یونیفورم',   name_fa: 'سفریه داخلی کارکنان',   description: 'Allowance domestic uniformed' },
        { bab_code: '220', fasl_code: '22105', name_ps: 'پیشکي هاي سفریه',                name_fa: 'پیشکی‌های سفریه',       description: 'Travel advance' },
        // Bab 222 — Food
        { bab_code: '222', fasl_code: '22201', name_ps: 'غذا - بدون معاش',                name_fa: 'غذا بدون معاش',         description: 'Food non-salary' },
        { bab_code: '222', fasl_code: '22202', name_ps: 'پیشکي هاي غذا بدون معاش',        name_fa: 'پیشکی‌های غذا',         description: 'Advance of Food' },
        // Bab 223 — Contract Services
        { bab_code: '223', fasl_code: '22300', name_ps: 'خدمات اشتهازي تبلیغاتي',        name_fa: 'خدمات تبلیغاتی',        description: 'Public relation advertising' },
        { bab_code: '223', fasl_code: '22301', name_ps: 'مطبع',                            name_fa: 'چاپخانه',               description: 'Printing' },
        { bab_code: '223', fasl_code: '22302', name_ps: 'تفتیش و محاسبه',                  name_fa: 'حسابرسی و محاسبه',     description: 'Accounting and audit' },
        { bab_code: '223', fasl_code: '22303', name_ps: 'انجنیري او ډیزان',               name_fa: 'مهندسی و طراحی',        description: 'Engineering and design' },
        { bab_code: '223', fasl_code: '22304', name_ps: 'خدماتي امنیتي',                  name_fa: 'خدمات امنیتی',          description: 'Security services' },
        { bab_code: '223', fasl_code: '22305', name_ps: 'کرایه او جابجاشدن',              name_fa: 'کرایه و جابجایی',       description: 'Freight and handling' },
        { bab_code: '223', fasl_code: '22306', name_ps: 'سمینارونه او کورسونه',            name_fa: 'سمینارها و کورس‌های آموزشی', description: 'Training courses and seminars' },
        { bab_code: '223', fasl_code: '22307', name_ps: 'د مشورتي شرکتونو بودجه',         name_fa: 'شرکت‌های مشورتی انکشافی', description: 'Development consulting firms' },
        { bab_code: '223', fasl_code: '22308', name_ps: 'انفرادي مشاورین بودجه انکشافي', name_fa: 'مشاورین انفرادی انکشافی', description: 'Dev individual consultants' },
        { bab_code: '223', fasl_code: '22309', name_ps: 'خدمات موسسات غیر دولتي',         name_fa: 'خدمات NGO انکشافی',    description: 'Development NGOs' },
        { bab_code: '223', fasl_code: '22310', name_ps: 'اداره پروژه بودجه انکشافي',      name_fa: 'مدیریت پروژه انکشافی',  description: 'Development project management' },
        // Bab 224 — Repairs and Maintenance
        { bab_code: '224', fasl_code: '22400', name_ps: 'وسیله نقلیه',                    name_fa: 'وسایل نقلیه',           description: 'Vehicles' },
        { bab_code: '224', fasl_code: '22401', name_ps: 'تجهزات ساختماني',                name_fa: 'تجهیزات ساختمانی',     description: 'Construction equipment' },
        { bab_code: '224', fasl_code: '22402', name_ps: 'تجهزات ټرانسپورټي',             name_fa: 'تجهیزات ترانسپورتی',    description: 'Transport equipment' },
        { bab_code: '224', fasl_code: '22403', name_ps: 'تجهزات مخابراتي',                name_fa: 'تجهیزات مخابراتی',     description: 'Telecommunication equipment' },
        { bab_code: '224', fasl_code: '22404', name_ps: 'تجهزات اطلاعاتي جمعي',          name_fa: 'تجهیزات رسانه‌ای',     description: 'Broadcasting equipment' },
        { bab_code: '224', fasl_code: '22405', name_ps: 'تجهزات مولد انرژي',              name_fa: 'تجهیزات مولد انرژی',   description: 'Energy generating equipment' },
        { bab_code: '224', fasl_code: '22407', name_ps: 'تجهزات استخراج معادن',           name_fa: 'تجهیزات استخراج معادن', description: 'Mining excavation equipment' },
        { bab_code: '224', fasl_code: '22408', name_ps: 'تجهزات زراعتي',                  name_fa: 'تجهیزات زراعتی',       description: 'Agriculture equipment' },
        { bab_code: '224', fasl_code: '22409', name_ps: 'تجهزات دفتري او کمپوټري',       name_fa: 'تجهیزات دفتری و کامپیوتری', description: 'Office equipment and computer' },
        { bab_code: '224', fasl_code: '22410', name_ps: 'تجهزات توزیع آب او کانالیزاسیون', name_fa: 'تجهیزات آبرسانی',    description: 'Water supply and canals' },
        { bab_code: '224', fasl_code: '22411', name_ps: 'تجهزات نظامي',                   name_fa: 'تجهیزات نظامی',         description: 'Military equipment' },
        { bab_code: '224', fasl_code: '22412', name_ps: 'تجهزات طبي او لابراتواري',      name_fa: 'تجهیزات طبی و لابراتواری', description: 'Medical laboratory equipment' },
        { bab_code: '224', fasl_code: '22413', name_ps: 'تجهزات ورزشي او تفریحي',        name_fa: 'تجهیزات ورزشی و تفریحی', description: 'Recreational equipment' },
        { bab_code: '224', fasl_code: '22414', name_ps: 'تجهزات تولید او ورکشاپونه',     name_fa: 'تجهیزات تولید و کارگاه', description: 'Workshop and manufacturing' },
        { bab_code: '224', fasl_code: '22415', name_ps: 'تجهزات اثار عتیقه او هنري',    name_fa: 'آثار تاریخی و فرهنگی',  description: 'Historical culture structure' },
        { bab_code: '224', fasl_code: '22416', name_ps: 'منازل',                           name_fa: 'منازل',                 description: 'Dwellings' },
        { bab_code: '224', fasl_code: '22417', name_ps: 'ساختمانونه',                     name_fa: 'ساختمان‌ها',            description: 'Buildings' },
        { bab_code: '224', fasl_code: '22418', name_ps: 'نور عمارتونه',                   name_fa: 'سایر سازه‌ها',          description: 'Other structures' },
        { bab_code: '224', fasl_code: '22419', name_ps: 'پیشکي هاي ترمیمات',              name_fa: 'پیشکی‌های تعمیرات',    description: 'Advance of repairs and maintenance' },
        // Bab 225 — Utilities
        { bab_code: '225', fasl_code: '22500', name_ps: 'برق',                             name_fa: 'برق',                   description: 'Electricity' },
        { bab_code: '225', fasl_code: '22501', name_ps: 'اوبه',                            name_fa: 'آب',                    description: 'Water' },
        { bab_code: '225', fasl_code: '22502', name_ps: 'مخابرات',                         name_fa: 'مخابرات',               description: 'Telecommunication' },
        { bab_code: '225', fasl_code: '22503', name_ps: 'خدمات شارولي',                   name_fa: 'خدمات شهرداری',         description: 'Municipal services' },
        { bab_code: '225', fasl_code: '22504', name_ps: 'د پوستې مخارج',                  name_fa: 'مخارج پستی',            description: 'Postage' },
        { bab_code: '225', fasl_code: '22505', name_ps: 'پیشکي هاي عام المنفعه',          name_fa: 'پیشکی‌های خدمات عمومی', description: 'Utilities advance' },
        { bab_code: '225', fasl_code: '22506', name_ps: 'انتقال وجوه بودجه انکشافي خدمات عامه', name_fa: 'انتقال بودجه انکشافی خدمات عمومی', description: 'Development public services transfer' },
        // Bab 226 — Fuel
        { bab_code: '226', fasl_code: '22601', name_ps: 'روغنیات موټرونو',                name_fa: 'سوخت وسایل نقلیه',     description: 'Fuel vehicles' },
        { bab_code: '226', fasl_code: '22602', name_ps: 'ګاز',                             name_fa: 'گاز',                   description: 'Gas' },
        { bab_code: '226', fasl_code: '22603', name_ps: 'روغنیات داخلي',                  name_fa: 'سوخت داخلی',            description: 'Fuel vehicles domestic' },
        // Bab 227 — Tools and Materials
        { bab_code: '227', fasl_code: '22700', name_ps: 'طبي او لابراتوار',               name_fa: 'طبی و لابراتواری',      description: 'Medical and laboratory' },
        { bab_code: '227', fasl_code: '22701', name_ps: 'تجهزات او تدارکات دفتري',        name_fa: 'تجهیزات و لوازم دفتری', description: 'Office equipment and supplies' },
        { bab_code: '227', fasl_code: '22702', name_ps: 'منزل او آشپزخانه',               name_fa: 'منزل و آشپزخانه',       description: 'Household and kitchen' },
        { bab_code: '227', fasl_code: '22703', name_ps: 'مواد تعلیمي او تفریحي',          name_fa: 'مواد آموزشی و تفریحی', description: 'Education and recreational' },
        { bab_code: '227', fasl_code: '22704', name_ps: 'لباس',                            name_fa: 'لباس',                  description: 'Clothing' },
        { bab_code: '227', fasl_code: '22705', name_ps: 'فرنیچر',                          name_fa: 'مبلمان',                description: 'Furniture' },
        { bab_code: '227', fasl_code: '22706', name_ps: 'اسناد او اوراق',                 name_fa: 'اسناد و اوراق',         description: 'Valuable paper and documents' },
        { bab_code: '227', fasl_code: '22707', name_ps: 'سامان او لوازم زراعتي',          name_fa: 'لوازم زراعی',           description: 'Agriculture' },
        { bab_code: '227', fasl_code: '22708', name_ps: 'تجهزات او لوازم نظامي',          name_fa: 'تجهیزات و لوازم نظامی', description: 'Military' },
        { bab_code: '227', fasl_code: '22709', name_ps: 'تحایف',                           name_fa: 'هدایا',                 description: 'Gifts' },
        // Bab 228 — Others Expenditure
        { bab_code: '228', fasl_code: '22800', name_ps: 'فیس لایسنسونه او جوازنامې',     name_fa: 'فیس مجوزها و لیسانس‌ها', description: 'Fees licenses permits' },
        { bab_code: '228', fasl_code: '22801', name_ps: 'کمیشنونه',                        name_fa: 'کمیسیون‌ها',            description: 'Commissions' },
        { bab_code: '228', fasl_code: '22802', name_ps: 'مالیه محصول او تعرفه ګمرکي',    name_fa: 'مالیات و تعرفه گمرکی', description: 'Taxes duties and tariffs' },
        { bab_code: '228', fasl_code: '22803', name_ps: 'کمک ادارات خدمات اجتماعي',      name_fa: 'کمک به ارگان‌های خدمات اجتماعی', description: 'Assistance social service org' },
        { bab_code: '228', fasl_code: '22804', name_ps: 'کمک سازمانونه مذهبي',            name_fa: 'کمک به سازمان‌های مذهبی', description: 'Assistance religious institutions' },
        { bab_code: '228', fasl_code: '22805', name_ps: 'حق العضویت او سهمیه',            name_fa: 'حق عضویت و سهمیه',     description: 'Dues and membership fees' },
        { bab_code: '228', fasl_code: '22806', name_ps: 'بیمه',                            name_fa: 'بیمه',                  description: 'Insurance' },
        { bab_code: '228', fasl_code: '22807', name_ps: 'کرایه ځمکه',                     name_fa: 'اجاره زمین',            description: 'Rent of land' },
        { bab_code: '228', fasl_code: '22808', name_ps: 'نور مصارف',                       name_fa: 'سایر موارد',            description: 'Not elsewhere classified' },
        // Bab 229 — Advances
        { bab_code: '229', fasl_code: '22900', name_ps: 'تادیات پیشکي اجناس او خدمات',   name_fa: 'پیشکی کالاها و خدمات', description: 'Goods and service advance' },
        { bab_code: '229', fasl_code: '22901', name_ps: 'انتقال وجوه بودجه انکشافي',     name_fa: 'انتقال بودجه انکشافی', description: 'Development budget transfer' },
        { bab_code: '229', fasl_code: '22902', name_ps: 'برګشت اجناس او مصارف خدمات',    name_fa: 'برگشت کالاها و خدمات', description: 'Return of goods and services' },
        // Bab 23 — Capital
        { bab_code: '23', fasl_code: '2301', name_ps: 'فرنیچر او وسایل',                  name_fa: 'مبلمان و لوازم' },
        { bab_code: '23', fasl_code: '2302', name_ps: 'کمپیوټر او تجهیزات',               name_fa: 'کامپیوتر و تجهیزات' },
        { bab_code: '23', fasl_code: '2303', name_ps: 'موټر او وسیله',                     name_fa: 'وسایط نقلیه' },
        { bab_code: '23', fasl_code: '2304', name_ps: 'د ودانیو جوړول',                    name_fa: 'ساخت و ساز' },
        // Bab 24 — Projects
        { bab_code: '24', fasl_code: '2401', name_ps: 'د پراختیا پروژه',                  name_fa: 'پروژه توسعه‌ای' },
        // Bab 25 — Other
        { bab_code: '25', fasl_code: '2501', name_ps: 'نور مصارف',                         name_fa: 'سایر مصارف' },
      ];
      for (const f of seedFasls) {
        try {
          const [babRows]: any = await conn.query(
            `SELECT id FROM budget_babs WHERE bab_code = ? AND is_deleted = 0 LIMIT 1`, [f.bab_code]);
          if (babRows[0]) {
            await conn.query(
              `INSERT IGNORE INTO budget_fasls (bab_id, fasl_code, name_ps, name_fa) VALUES (?, ?, ?, ?)`,
              [babRows[0].id, f.fasl_code, f.name_ps, f.name_fa]
            );
          }
        } catch { /* skip if already exists */ }
      }
      // ────────────────────────────────────────────────────────────────────

      const cols = [
        { table: 'items',         col: 'bab_id',  def: 'INT DEFAULT NULL' },
        { table: 'items',         col: 'fasl_id', def: 'INT DEFAULT NULL' },
        { table: 'request_items', col: 'bab_id',  def: 'INT DEFAULT NULL' },
        { table: 'request_items', col: 'fasl_id', def: 'INT DEFAULT NULL' },
      ];
      for (const c of cols) {
        try {
          await withRetry(async () => {
            const [rows]: any = await conn.query(
              `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
              [c.table, c.col]
            );
            if (rows[0].cnt === 0) {
              await conn.query(`ALTER TABLE \`${c.table}\` ADD COLUMN \`${c.col}\` ${c.def}`);
            }
          });
        } catch (e: any) {
          console.warn(`[Budget] Migration warning for ${c.table}.${c.col}:`, e.message);
        }
      }
    } finally {
      conn.release();
    }
  }

  static async getBabs() {
    const [rows]: any = await pool.query(
      `SELECT id, bab_code, name_ps, name_fa, description FROM budget_babs WHERE is_deleted = 0 ORDER BY bab_code ASC`
    );
    return rows;
  }

  static async getBabById(id: number) {
    const [rows]: any = await pool.query(
      `SELECT id, bab_code, name_ps, name_fa, description FROM budget_babs WHERE id = ? AND is_deleted = 0`,
      [id]
    );
    return rows[0] || null;
  }

  static async getFaslsByBab(babId: number) {
    const [rows]: any = await pool.query(
      `SELECT id, bab_id, fasl_code, name_ps, name_fa, description FROM budget_fasls WHERE bab_id = ? AND is_deleted = 0 ORDER BY fasl_code ASC`,
      [babId]
    );
    return rows;
  }

  static async getAllFasls() {
    const [rows]: any = await pool.query(
      `SELECT f.id, f.bab_id, f.fasl_code, f.name_ps, f.name_fa, b.bab_code, b.name_ps as bab_name_ps
       FROM budget_fasls f JOIN budget_babs b ON f.bab_id = b.id
       WHERE f.is_deleted = 0 AND b.is_deleted = 0
       ORDER BY b.bab_code ASC, f.fasl_code ASC`
    );
    return rows;
  }

  static async search(q: string) {
    const like = `%${q}%`;
    const [babs]: any = await pool.query(
      `SELECT id, bab_code, name_ps, name_fa FROM budget_babs WHERE is_deleted = 0 AND (bab_code LIKE ? OR name_ps LIKE ? OR name_fa LIKE ?) ORDER BY bab_code LIMIT 20`,
      [like, like, like]
    );
    const [fasls]: any = await pool.query(
      `SELECT f.id, f.bab_id, f.fasl_code, f.name_ps, f.name_fa, b.bab_code FROM budget_fasls f
       JOIN budget_babs b ON f.bab_id = b.id
       WHERE f.is_deleted = 0 AND (f.fasl_code LIKE ? OR f.name_ps LIKE ? OR f.name_fa LIKE ? OR b.bab_code LIKE ?)
       ORDER BY b.bab_code, f.fasl_code LIMIT 30`,
      [like, like, like, like]
    );
    return { babs, fasls };
  }

  static async createBab(data: { bab_code: string; name_ps: string; name_fa: string; description?: string }) {
    const [existing]: any = await pool.query(
      `SELECT id FROM budget_babs WHERE bab_code = ? AND is_deleted = 0 LIMIT 1`, [data.bab_code]
    );
    if (existing.length > 0) throw new Error('bab_code_exists');
    const [result]: any = await pool.query(
      `INSERT INTO budget_babs (bab_code, name_ps, name_fa, description) VALUES (?, ?, ?, ?)`,
      [data.bab_code, data.name_ps, data.name_fa, data.description || null]
    );
    return { id: result.insertId, ...data };
  }

  static async createFasl(data: { bab_id: number; fasl_code: string; name_ps: string; name_fa: string; description?: string }) {
    const [babRows]: any = await pool.query(
      `SELECT id FROM budget_babs WHERE id = ? AND is_deleted = 0 LIMIT 1`, [data.bab_id]
    );
    if (!babRows.length) throw new Error('bab_not_found');
    const [existing]: any = await pool.query(
      `SELECT id FROM budget_fasls WHERE bab_id = ? AND fasl_code = ? AND is_deleted = 0 LIMIT 1`,
      [data.bab_id, data.fasl_code]
    );
    if (existing.length > 0) throw new Error('fasl_code_exists');
    const [result]: any = await pool.query(
      `INSERT INTO budget_fasls (bab_id, fasl_code, name_ps, name_fa, description) VALUES (?, ?, ?, ?, ?)`,
      [data.bab_id, data.fasl_code, data.name_ps, data.name_fa, data.description || null]
    );
    return { id: result.insertId, ...data };
  }

  static async deleteBab(id: number) {
    const [rows]: any = await pool.query(
      `SELECT id FROM budget_babs WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]
    );
    if (!rows.length) throw new Error('not_found');
    const [used]: any = await pool.query(
      `SELECT COUNT(*) as cnt FROM items WHERE bab_id = ? AND is_deleted = 0`, [id]
    );
    if (used[0].cnt > 0) throw new Error('in_use');
    await pool.query(`UPDATE budget_babs SET is_deleted = 1 WHERE id = ?`, [id]);
  }

  static async deleteFasl(id: number) {
    const [rows]: any = await pool.query(
      `SELECT id FROM budget_fasls WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]
    );
    if (!rows.length) throw new Error('not_found');
    const [used]: any = await pool.query(
      `SELECT COUNT(*) as cnt FROM items WHERE fasl_id = ? AND is_deleted = 0`, [id]
    );
    if (used[0].cnt > 0) throw new Error('in_use');
    await pool.query(`UPDATE budget_fasls SET is_deleted = 1 WHERE id = ?`, [id]);
  }

  static async updateBab(id: number, data: { bab_code?: string; name_ps?: string; name_fa?: string; description?: string }) {
    const [rows]: any = await pool.query(
      `SELECT id FROM budget_babs WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]
    );
    if (!rows.length) throw new Error('not_found');
    await pool.query(
      `UPDATE budget_babs SET bab_code = COALESCE(?, bab_code), name_ps = COALESCE(?, name_ps), name_fa = COALESCE(?, name_fa), description = COALESCE(?, description) WHERE id = ?`,
      [data.bab_code || null, data.name_ps || null, data.name_fa || null, data.description ?? null, id]
    );
    const [updated]: any = await pool.query(`SELECT * FROM budget_babs WHERE id = ?`, [id]);
    return updated[0];
  }

  static async updateFasl(id: number, data: { fasl_code?: string; name_ps?: string; name_fa?: string; description?: string }) {
    const [rows]: any = await pool.query(
      `SELECT id FROM budget_fasls WHERE id = ? AND is_deleted = 0 LIMIT 1`, [id]
    );
    if (!rows.length) throw new Error('not_found');
    await pool.query(
      `UPDATE budget_fasls SET fasl_code = COALESCE(?, fasl_code), name_ps = COALESCE(?, name_ps), name_fa = COALESCE(?, name_fa), description = COALESCE(?, description) WHERE id = ?`,
      [data.fasl_code || null, data.name_ps || null, data.name_fa || null, data.description ?? null, id]
    );
    const [updated]: any = await pool.query(`SELECT * FROM budget_fasls WHERE id = ?`, [id]);
    return updated[0];
  }

  static async importBabFasl(babs: any[], fasls: any[]) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      let babsInserted = 0, babsSkipped = 0, faslsInserted = 0, faslsSkipped = 0;
      for (const b of babs) {
        const [res]: any = await conn.query(
          `INSERT IGNORE INTO budget_babs (bab_code, name_ps, name_fa, description) VALUES (?, ?, ?, ?)`,
          [b.bab_code, b.name_ps, b.name_fa, b.description || null]
        );
        if (res.affectedRows > 0) babsInserted++; else babsSkipped++;
      }
      for (const f of fasls) {
        const [babRows]: any = await conn.query(
          `SELECT id FROM budget_babs WHERE bab_code = ? AND is_deleted = 0 LIMIT 1`,
          [f.bab_code]
        );
        if (!babRows[0]) { faslsSkipped++; continue; }
        const [res]: any = await conn.query(
          `INSERT IGNORE INTO budget_fasls (bab_id, fasl_code, name_ps, name_fa, description) VALUES (?, ?, ?, ?, ?)`,
          [babRows[0].id, f.fasl_code, f.name_ps, f.name_fa, f.description || null]
        );
        if (res.affectedRows > 0) faslsInserted++; else faslsSkipped++;
      }
      await conn.commit();
      return { babsInserted, babsSkipped, faslsInserted, faslsSkipped };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // ── Budget Ceilings ────────────────────────────────────────────────────────
  static async runCeilingMigration(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_ceilings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bab_id INT NOT NULL,
        fiscal_year VARCHAR(10) NOT NULL DEFAULT '1404',
        ceiling_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        notes VARCHAR(500) DEFAULT '',
        alert_80_sent TINYINT(1) DEFAULT 0,
        alert_100_sent TINYINT(1) DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_bab_year (bab_id, fiscal_year),
        FOREIGN KEY (bab_id) REFERENCES budget_babs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  static async getCeilings(): Promise<any[]> {
    const [rows]: any = await pool.query(`
      SELECT
        bc.id, bc.bab_id, bc.fiscal_year, bc.ceiling_amount, bc.notes,
        bc.alert_80_sent, bc.alert_100_sent,
        bb.bab_code, bb.name_ps, bb.name_fa,
        COALESCE(sp.spent_value, 0) AS spent_value,
        CASE WHEN bc.ceiling_amount > 0
          THEN ROUND(COALESCE(sp.spent_value, 0) / bc.ceiling_amount * 100, 1)
          ELSE 0
        END AS utilization_percent
      FROM budget_ceilings bc
      JOIN budget_babs bb ON bc.bab_id = bb.id AND bb.is_deleted = 0
      LEFT JOIN (
        SELECT bab_id, SUM(unit_price * current_stock) AS spent_value
        FROM items
        WHERE is_deleted = FALSE AND bab_id IS NOT NULL
        GROUP BY bab_id
      ) sp ON sp.bab_id = bc.bab_id
      WHERE bc.is_active = 1
      ORDER BY bb.bab_code
    `);
    return rows || [];
  }

  static async setCeiling(babId: number, fiscalYear: string, ceilingAmount: number, notes?: string): Promise<any> {
    const [babRows]: any = await pool.query(
      `SELECT id FROM budget_babs WHERE id = ? AND is_deleted = 0 LIMIT 1`, [babId]
    );
    if (!babRows.length) throw new Error('bab_not_found');
    await pool.query(`
      INSERT INTO budget_ceilings (bab_id, fiscal_year, ceiling_amount, notes, alert_80_sent, alert_100_sent)
      VALUES (?, ?, ?, ?, 0, 0)
      ON DUPLICATE KEY UPDATE
        ceiling_amount = VALUES(ceiling_amount),
        notes = VALUES(notes),
        alert_80_sent = 0,
        alert_100_sent = 0,
        updated_at = CURRENT_TIMESTAMP
    `, [babId, fiscalYear, ceilingAmount, notes || '']);
    const [rows]: any = await pool.query(`
      SELECT bc.*, bb.bab_code, bb.name_ps, bb.name_fa
      FROM budget_ceilings bc
      JOIN budget_babs bb ON bc.bab_id = bb.id
      WHERE bc.bab_id = ? AND bc.fiscal_year = ?
    `, [babId, fiscalYear]);
    return rows[0];
  }

  static async deleteCeiling(id: number): Promise<void> {
    const [rows]: any = await pool.query(`SELECT id FROM budget_ceilings WHERE id = ? LIMIT 1`, [id]);
    if (!rows.length) throw new Error('not_found');
    await pool.query(`DELETE FROM budget_ceilings WHERE id = ?`, [id]);
  }

  static async getCeilingsForSmsCheck(): Promise<any[]> {
    const [rows]: any = await pool.query(`
      SELECT
        bc.id, bc.bab_id, bc.fiscal_year, bc.ceiling_amount,
        bc.alert_80_sent, bc.alert_100_sent,
        bb.bab_code, bb.name_ps,
        COALESCE(sp.spent_value, 0) AS spent_value,
        CASE WHEN bc.ceiling_amount > 0
          THEN ROUND(COALESCE(sp.spent_value, 0) / bc.ceiling_amount * 100, 1)
          ELSE 0
        END AS utilization_percent
      FROM budget_ceilings bc
      JOIN budget_babs bb ON bc.bab_id = bb.id AND bb.is_deleted = 0
      LEFT JOIN (
        SELECT bab_id, SUM(unit_price * current_stock) AS spent_value
        FROM items
        WHERE is_deleted = FALSE AND bab_id IS NOT NULL
        GROUP BY bab_id
      ) sp ON sp.bab_id = bc.bab_id
      WHERE bc.is_active = 1 AND bc.ceiling_amount > 0
      ORDER BY bb.bab_code
    `);
    return rows || [];
  }

  static async markCeilingAlertSent(id: number, type: '80' | '100'): Promise<void> {
    if (type === '80') {
      await pool.query(`UPDATE budget_ceilings SET alert_80_sent = 1 WHERE id = ?`, [id]);
    } else {
      await pool.query(`UPDATE budget_ceilings SET alert_100_sent = 1 WHERE id = ?`, [id]);
    }
  }
}
