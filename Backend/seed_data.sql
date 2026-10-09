-- ============================================================
-- KANDAHAR UNIVERSITY WMS - COMPREHENSIVE SEED DATA
-- Two years of realistic data (May 2024 - May 2026)
-- UTF-8mb4 Pashto/Dari text
-- ============================================================
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ============================================================
-- 1. BUDGET BABS & FASLS (from official PDF)
-- ============================================================

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add bab_id/fasl_id to items if missing
SET @exists1 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='items' AND COLUMN_NAME='bab_id');
SET @sql1 = IF(@exists1=0, 'ALTER TABLE items ADD COLUMN bab_id INT DEFAULT NULL', 'SELECT 1');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @exists2 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='items' AND COLUMN_NAME='fasl_id');
SET @sql2 = IF(@exists2=0, 'ALTER TABLE items ADD COLUMN fasl_id INT DEFAULT NULL', 'SELECT 1');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

SET @exists3 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='request_items' AND COLUMN_NAME='bab_id');
SET @sql3 = IF(@exists3=0, 'ALTER TABLE request_items ADD COLUMN bab_id INT DEFAULT NULL', 'SELECT 1');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

SET @exists4 := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='request_items' AND COLUMN_NAME='fasl_id');
SET @sql4 = IF(@exists4=0, 'ALTER TABLE request_items ADD COLUMN fasl_id INT DEFAULT NULL', 'SELECT 1');
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

INSERT IGNORE INTO budget_babs (bab_code, name_ps, name_fa, description) VALUES
('220', 'مصارف غیر معاشی', 'مصارف غیر معاشی', 'د معاش پرته مصارف - Non-salary expenditures'),
('222', 'غذا', 'غذا', 'د خوراک مصارف - Food expenditures'),
('224', 'ترمیمات او حفظ مراقبت', 'ترميمات و حفظ و مراقبت', 'د ترمیماتو مصارف - Repairs and maintenance'),
('225', 'عام المنفعه', 'عام المنفعه', 'د عامه خدماتو مصارف - Utility expenditures');

-- Fasls for Bab 220
INSERT IGNORE INTO budget_fasls (bab_id, fasl_code, name_ps, name_fa, description) VALUES
((SELECT id FROM budget_babs WHERE bab_code='220'), '22100', 'داخلي امتیاز', 'امتياز داخلی', 'Domestic Allowance'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22101', 'بین المللي امتیاز', 'امتياز بين المللی', 'International Allowance'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22102', 'داخلي سفریه', 'سفريه داخلی', 'Domestic Travel'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22103', 'بهرنۍ سفریه', 'سفريه خارجی', 'International Travel'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22104', 'د یونیفورم کارکوونکو داخلي سفریه', 'سفريه داخلی کارندان يونيفورم', 'Domestic Allowance Uniformed Staff'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22105', 'د سفریې پیشکي', 'پيشکی های سفريه', 'Travel Advance'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22300', 'قراردادي خدمات', 'خدمات قراردادي', 'Contract Services'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22301', 'مطبعه او چاپ', 'مطبع', 'Printing'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22302', 'تفتیش او محاسبه', 'تفتيش و محاسبه', 'Accounting and Audit'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22303', 'انجینري او ډیزاین', 'انجنری و ديزان', 'Engineering and Design'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22304', 'امنیتي خدمات', 'خدمات امنيتی', 'Security Services'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22305', 'کرایه او جابجا کول', 'کرايه و جابجاشدن', 'Freight and Handling'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22306', 'سمینارونه او روزنیز کورسونه', 'سمنارها و کورس های آموزشی', 'Training Courses and Seminars'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22307', 'د انکشاف مشاورتي شرکتونه', 'بوديجه انکشافی و شرکت های مشورتی', 'Development Consulting Firms'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22308', 'د انکشاف انفرادي مشاورین', 'بوديجه انکشافی مشاورين انفرادی', 'Development Individual Consultants'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22309', 'د انکشاف غیر دولتي موسسې', 'انکشافی خدمات موسسات غير دولتی', 'Development NGOs'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22310', 'د انکشاف پروژه مدیریت', 'بوديجه انکشافی اداره پروژه', 'Development Project Management'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22311', 'د انکشاف اداري فیسونه', 'انکشافی فيس های اداری', 'Development Administration Fees'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22601', 'د موتر تیل', 'روغنيات', 'Fuel - Vehicles'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22602', 'ګاز', 'گاز', 'Gas'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22603', 'داخلي تیل', 'روغنيات داخلی', 'Domestic Fuel'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22700', 'طبي او لابراتواري', 'طبی و البراتوار', 'Medical and Laboratory'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22701', 'د دفتر تجهیزات او لوازم', 'تجهزات و تدارکات دفتری', 'Office Equipment and Supplies'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22702', 'کور او اشپزخانه', 'منزل و اشپزهانه', 'Household and Kitchen'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22703', 'تعلیمي او تفریحي مواد', 'مواد تعلمی و تفريحی', 'Educational and Recreational Materials'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22704', 'جامې', 'لباس', 'Clothing'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22705', 'فرنیچر', 'فرنيچر', 'Furniture'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22706', 'اسناد او اوراق', 'اسناد و اوراق', 'Valuable Paper and Documents'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22707', 'زراعتي لوازم', 'سامان و لوازم زراعتی', 'Agricultural Materials'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22708', 'نظامي تجهیزات', 'تجهزات و لوارم نظامی', 'Military Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22709', 'تحایف', 'تحايف', 'Gifts'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22800', 'کرایه', 'کرايه', 'Rent'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22801', 'کمیشنونه', 'کميش ها', 'Commissions'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22802', 'مالیه او ګمرک', 'ماليه محصول و تعرفه گمرکی', 'Taxes, Duties and Tariffs'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22803', 'د اجتماعي خدماتو مرسته', 'کمک با ادارات خدمات اجتماعی', 'Assistance - Social Service Organizations'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22804', 'د مذهبي موسسو مرسته', 'کمک به سازمان های مذهبی', 'Assistance - Religious Institutions'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22805', 'د غړیتوب حقونه', 'پرداخت حق العضويت ها و سهميه', 'Dues and Membership Fees'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22806', 'بیمه', 'بيمه', 'Insurance'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22807', 'د ځمکې کرایه', 'کرابه زمين', 'Rent of Land'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22808', 'نور مصارف', 'سایر مصارف', 'Not Elsewhere Classified'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22900', 'پیشکي تادیات', 'تاديات پيشکی وجه سردستی', 'Petty Cash Advance'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22901', 'د انکشافي بودجې لیږد', 'انتقال وجه بوديجه انکشافی به ولايات', 'Development Budget Transfer to Provinces'),
((SELECT id FROM budget_babs WHERE bab_code='220'), '22902', 'د توکو او خدماتو برګشت', 'برگشت اجناس و مصارف خدمات', 'Return of Goods and Services');

-- Fasls for Bab 222
INSERT IGNORE INTO budget_fasls (bab_id, fasl_code, name_ps, name_fa, description) VALUES
((SELECT id FROM budget_babs WHERE bab_code='222'), '22201', 'د معاش پرته خواړه', 'غذا بدون معاش', 'Food - Non Salary'),
((SELECT id FROM budget_babs WHERE bab_code='222'), '22202', 'د خوراک پیشکي', 'پيشکي های غذا بدون معاش', 'Food Advance - Non Salary');

-- Fasls for Bab 224
INSERT IGNORE INTO budget_fasls (bab_id, fasl_code, name_ps, name_fa, description) VALUES
((SELECT id FROM budget_babs WHERE bab_code='224'), '22400', 'موترونه', 'وسيله نقليه', 'Vehicles'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22401', 'د ساختمان تجهیزات', 'تجهزات ساختمانی', 'Construction Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22402', 'د ترانسپورت تجهیزات', 'تجهزات ترانسپورتی', 'Transport Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22403', 'مخابراتي تجهیزات', 'تجهزات مخابراتی', 'Telecommunication Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22404', 'د خبریالۍ تجهیزات', 'تجهزات اطلاعاتی جمعی', 'Broadcasting Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22405', 'د انرژۍ تجهیزات', 'تجهزات مولد انرژی', 'Energy Generating Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22407', 'د معادنو تجهیزات', 'تجهزات استخراج معادن', 'Mining and Excavation Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22408', 'زراعتي تجهیزات', 'تجهزات زراعتی', 'Agriculture Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22409', 'د دفتر او کمپیوټر تجهیزات', 'تجهزات دفتری و کمپيوتری', 'Office and Computer Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22410', 'د اوبو توزیع تجهیزات', 'تجهزات توزيع آب و کاناليزاسيون', 'Water Supply and Canal Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22411', 'نظامي تجهیزات', 'تجهزات نظامی', 'Military Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22412', 'طبي لابراتواري تجهیزات', 'تجهزات طبی و البراتواری', 'Medical Laboratory Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22413', 'ورزشي او تفریحي تجهیزات', 'تجهزات ورزشی و تفريحی', 'Recreational Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22414', 'ورکشاپ تجهیزات', 'تجهزات توليد ضمايع و ورکشاپ ها', 'Workshop and Manufacturing Equipment'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22415', 'تاریخي او هنري جوړښت', 'تجهزات آثار عتيقه و هنری', 'Historical and Cultural Structure'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22416', 'مساکن', 'منازل', 'Dwellings'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22417', 'ودانۍ', 'ساختمان ها', 'Buildings'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22418', 'نور ابنیه', 'ديگر عمارت', 'Other Structures'),
((SELECT id FROM budget_babs WHERE bab_code='224'), '22419', 'د ترمیم پیشکي', 'پيشکی های ترميمات و حفظ مراقبت', 'Advance of Repairs and Maintenance');

-- Fasls for Bab 225
INSERT IGNORE INTO budget_fasls (bab_id, fasl_code, name_ps, name_fa, description) VALUES
((SELECT id FROM budget_babs WHERE bab_code='225'), '22500', 'برق', 'برق', 'Electricity'),
((SELECT id FROM budget_babs WHERE bab_code='225'), '22501', 'اوبه', 'آب', 'Water'),
((SELECT id FROM budget_babs WHERE bab_code='225'), '22502', 'مخابرات', 'مخابرات', 'Telecommunication'),
((SELECT id FROM budget_babs WHERE bab_code='225'), '22503', 'د ښار خدمات', 'خدمات شارولی', 'Municipal Services'),
((SELECT id FROM budget_babs WHERE bab_code='225'), '22504', 'پوستي مصارف', 'مخارج پستی', 'Postage'),
((SELECT id FROM budget_babs WHERE bab_code='225'), '22505', 'د عامه خدماتو پیشکي', 'تاديات پيشکی عام المنفعه', 'Utilities Advance'),
((SELECT id FROM budget_babs WHERE bab_code='225'), '22506', 'د انکشافي بودجې عامه خدمات', 'انتقال وجه بوديجه انکشافی خدمات عامه', 'Development Budget Public Services Transfer');

-- ============================================================
-- 2. CATEGORIES
-- ============================================================
INSERT IGNORE INTO categories (id, name_ps, name_fa) VALUES
(1, 'کمپیوټري تجهیزات', 'تجهیزات کمپیوتری'),
(2, 'فرنیچر', 'فرنیچر'),
(3, 'دفتري لوازم', 'لوازم دفتری'),
(4, 'تعلیمي توکي', 'مواد آموزشی'),
(5, 'مخابراتي تجهیزات', 'تجهیزات مخابراتی'),
(6, 'موترونه', 'وسایل نقلیه'),
(7, 'طبي تجهیزات', 'تجهیزات طبی'),
(8, 'روغنیات', 'روغنیات'),
(9, 'د بیړي خدمت لوازم', 'لوازم جانبی');

-- ============================================================
-- 3. UNITS
-- ============================================================
INSERT IGNORE INTO units (id, name_ps, name_fa, symbol) VALUES
(1, 'عدد', 'عدد', 'عدد'),
(2, 'کیلوګرام', 'کیلوگرام', 'کګ'),
(3, 'لیتر', 'لیتر', 'L'),
(4, 'میتر', 'متر', 'م'),
(5, 'ریم', 'ریم', 'ریم'),
(6, 'پاکت', 'بسته', 'پک'),
(7, 'جوړه / سیټ', 'جفت / ست', 'سیټ'),
(8, 'بکس', 'جعبه', 'بکس'),
(9, 'بوتل', 'بطری', 'بوت'),
(10, 'ګالن', 'گالن', 'ګال');

-- ============================================================
-- 4. WAREHOUSES
-- ============================================================
INSERT IGNORE INTO warehouses (id, name_ps, name_fa, location, description) VALUES
(1, 'مرکزي ګدام', 'انبار مرکزی', 'د پوهنتون مرکزي سیمه', 'د کندهار پوهنتون مرکزي ګدام'),
(2, 'د اداري ودانۍ ګدام', 'انبار ساختمان اداری', 'اداري ودانۍ - لومړی پوړ', 'د اداري ودانۍ فرعي ګدام'),
(3, 'د معلوماتي ټیکنالوژۍ ګدام', 'انبار تکنالوژی معلومات', 'د IT مرکز', 'د کمپیوټرانو او تجهیزاتو ګدام');

-- ============================================================
-- 5. VENDORS
-- ============================================================
INSERT IGNORE INTO vendors (id, name, phone, email, address) VALUES
(1, 'د کندهار ټیکنالوژي شرکت', '0700123456', 'info@kandahartech.af', 'د کندهار ښار، تجارتي سیمه'),
(2, 'افغان دفتري لوازم شرکت', '0711234567', 'sales@afgoffice.af', 'کابل، شهرنو'),
(3, 'کندهار فرنیچر شرکت', '0799876543', 'orders@kdfurniture.af', 'کندهار، ده خواجه'),
(4, 'نجیب تجارتي شرکت', '0701112233', 'najib@trading.af', 'کندهار، چارسده'),
(5, 'د پوهنتون تجهیزاتي شرکت', '0788990011', 'uni@equipment.af', 'کندهار، مرواریدی');

-- ============================================================
-- 6. FACULTIES - update test record, add real ones
-- ============================================================
UPDATE faculties SET name_ps='انجینري پوهنځی', name_fa='دانشکده انجینری', level='Bachelor' WHERE id=2;

INSERT IGNORE INTO faculties (id, name_ps, name_fa, level) VALUES
(3, 'طب پوهنځی', 'دانشکده طب', 'Bachelor'),
(4, 'حقوق او سیاسي علومو پوهنځی', 'دانشکده حقوق و علوم سیاسی', 'Bachelor'),
(5, 'اقتصاد پوهنځی', 'دانشکده اقتصاد', 'Bachelor'),
(6, 'ادبیات او بشري علومو پوهنځی', 'دانشکده ادبیات و علوم بشری', 'Bachelor'),
(7, 'ماسټري - کمپیوټر ساینس', 'ماستری کمپیوتر ساینس', 'Master'),
(8, 'ماسټري - اقتصاد', 'ماستری اقتصاد', 'Master');

-- ============================================================
-- 7. DEPARTMENTS - Admin + Faculty
-- ============================================================

-- Admin Departments (no faculty)
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(1,  NULL, 'مالي اداره', 'اداره مالی', 'ADMIN'),
(2,  NULL, 'د بشري منابعو اداره', 'اداره منابع بشری', 'ADMIN'),
(3,  NULL, 'د ثبت او ارزونې اداره', 'اداره ثبت و ارزیابی', 'ADMIN'),
(4,  NULL, 'کتابتون', 'کتابخانه', 'ADMIN'),
(5,  NULL, 'د معلوماتي ټیکنالوژۍ اداره', 'اداره تکنالوژی معلومات', 'ADMIN'),
(6,  NULL, 'امنیت اداره', 'اداره امنیت', 'ADMIN'),
(7,  NULL, 'د ریاست دفتر', 'دفتر ریاست', 'ADMIN'),
(8,  NULL, 'د ګدام اداره', 'اداره انبار', 'ADMIN');

-- Faculty Departments - Computer Science (faculty 1)
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(10, 1, 'د سافټویر انجینري ډیپارتمنت', 'دیپارتمنت مهندسی نرم‌افزار', 'FACULTY'),
(11, 1, 'د شبکو او امنیت ډیپارتمنت', 'دیپارتمنت شبکه و امنیت', 'FACULTY'),
(12, 1, 'د مصنوعي ذکاوت ډیپارتمنت', 'دیپارتمنت هوش مصنوعی', 'FACULTY');

-- Faculty Departments - Engineering (faculty 2)
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(13, 2, 'د ساختماني انجینري ډیپارتمنت', 'دیپارتمنت انجینری ساختمانی', 'FACULTY'),
(14, 2, 'د مکانیکي انجینري ډیپارتمنت', 'دیپارتمنت انجینری مکانیک', 'FACULTY'),
(15, 2, 'د برقي انجینري ډیپارتمنت', 'دیپارتمنت انجینری برق', 'FACULTY');

-- Faculty Departments - Medicine (faculty 3)
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(16, 3, 'د عمومي طب ډیپارتمنت', 'دیپارتمنت طب عمومی', 'FACULTY'),
(17, 3, 'د درملو ډیپارتمنت', 'دیپارتمنت فارماسی', 'FACULTY'),
(18, 3, 'د دندانو طب ډیپارتمنت', 'دیپارتمنت دندانپزشکی', 'FACULTY');

-- Faculty Departments - Law (faculty 4)
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(19, 4, 'د حقوقو ډیپارتمنت', 'دیپارتمنت حقوق', 'FACULTY'),
(20, 4, 'د سیاسي علومو ډیپارتمنت', 'دیپارتمنت علوم سیاسی', 'FACULTY');

-- Faculty Departments - Economics (faculty 5)
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(21, 5, 'د اقتصاد ډیپارتمنت', 'دیپارتمنت اقتصاد', 'FACULTY'),
(22, 5, 'د سوداګرۍ اداره ډیپارتمنت', 'دیپارتمنت مدیریت تجارت', 'FACULTY');

-- Faculty Departments - Literature (faculty 6)
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(23, 6, 'د پښتو ادبیاتو ډیپارتمنت', 'دیپارتمنت ادبیات پشتو', 'FACULTY'),
(24, 6, 'د انګلیسي ادبیاتو ډیپارتمنت', 'دیپارتمنت ادبیات انگلیسی', 'FACULTY'),
(25, 6, 'د دري ادبیاتو ډیپارتمنت', 'دیپارتمنت ادبیات دری', 'FACULTY');

-- Faculty Departments - Master programs
INSERT IGNORE INTO departments (id, faculty_id, name_ps, name_fa, department_type) VALUES
(26, 7, 'د ماسټري کمپیوټر ساینس ډیپارتمنت', 'دیپارتمنت ماستری کمپیوتر ساینس', 'FACULTY'),
(27, 8, 'د ماسټري اقتصاد ډیپارتمنت', 'دیپارتمنت ماستری اقتصاد', 'FACULTY');

-- ============================================================
-- 8. PEOPLE (staff + professors)
-- ============================================================
INSERT IGNORE INTO people (id, department_id, full_name, position, phone, email) VALUES
-- Admin staff
(1,  7, 'پوهاند احمدشاه نورزی', 'رئیس', '0700001001', 'rector@ku.edu.af'),
(2,  7, 'پوهنمل محمد رسول خان', 'معاون اداري', '0700001002', 'vice.admin@ku.edu.af'),
(3,  7, 'پوهنمل غلام فاروق احمدزی', 'معاون علمي', '0700001003', 'vice.academic@ku.edu.af'),
(4,  1, 'محمد صادق حبیبي', 'رئیس مالي اداره', '0700001004', 'finance@ku.edu.af'),
(5,  1, 'خالده رحیمي', 'محاسب', '0700001005', 'accounts@ku.edu.af'),
(6,  2, 'نجیب الله عمر', 'رئیس بشري منابعو', '0700001006', 'hr@ku.edu.af'),
(7,  3, 'فریده نوري', 'د ثبت رئیسه', '0700001007', 'registration@ku.edu.af'),
(8,  4, 'عبدالستار کاکر', 'کتابدار', '0700001008', 'library@ku.edu.af'),
(9,  5, 'محمود رحیمي', 'د IT مدیر', '0700001009', 'it@ku.edu.af'),
(10, 6, 'احمد وحید امیري', 'د امنیت رئیس', '0700001010', 'security@ku.edu.af'),
(11, 8, 'مصطفی صدیقي', 'د ګدام مدیر', '0700001011', 'warehouse@ku.edu.af'),
(12, 8, 'حامد الله کریمي', 'د ګدام مرستیال', '0700001012', 'warehouse2@ku.edu.af'),
-- CS Faculty staff
(13, 10, 'پوهاند نظیف احمد وردک', 'د پوهنځي ریاست', '0700002001', 'cs.dean@ku.edu.af'),
(14, 10, 'پوهنمل جمیل احمد نصرت', 'استاد', '0700002002', 'jnasrat@ku.edu.af'),
(15, 11, 'پوهنیار سمیع الله ساپی', 'استاد', '0700002003', 'ssapi@ku.edu.af'),
(16, 12, 'پوهنیار فرید احمد ابراهیم', 'استاد', '0700002004', 'fibrahim@ku.edu.af'),
(17, 10, 'پوهنیار مریم حمیدي', 'استاده', '0700002005', 'mhamidi@ku.edu.af'),
(18, 11, 'پوهنیار ذبیح الله صافي', 'استاد', '0700002006', 'zsafi@ku.edu.af'),
-- Engineering Faculty staff
(19, 13, 'پوهاند عبدالولي شینواری', 'د پوهنځي ریاست', '0700003001', 'eng.dean@ku.edu.af'),
(20, 13, 'پوهنمل حمزه احمد رسولي', 'استاد', '0700003002', 'hrasoli@ku.edu.af'),
(21, 14, 'پوهنیار یوسف کندهاري', 'استاد', '0700003003', 'ykandahari@ku.edu.af'),
(22, 15, 'پوهنیار احمد فیصل نظامي', 'استاد', '0700003004', 'anizami@ku.edu.af'),
(23, 13, 'پوهنیار رقیه مومند', 'استاده', '0700003005', 'rmomand@ku.edu.af'),
-- Medicine Faculty staff
(24, 16, 'پوهاند ډاکتر محمد اسلام عمر', 'د پوهنځي ریاست', '0700004001', 'med.dean@ku.edu.af'),
(25, 16, 'ډاکتر فاطمه رحمت', 'استاده', '0700004002', 'frahmat@ku.edu.af'),
(26, 17, 'ډاکتر زرغونه صالحي', 'استاده', '0700004003', 'zsalehi@ku.edu.af'),
(27, 18, 'ډاکتر احمد جاوید ایوبي', 'استاد', '0700004004', 'jaiubi@ku.edu.af'),
-- Law Faculty staff
(28, 19, 'پوهاند محمد انور قریشي', 'د پوهنځي ریاست', '0700005001', 'law.dean@ku.edu.af'),
(29, 19, 'پوهنمل نسرین محمدي', 'استاده', '0700005002', 'nmohammadi@ku.edu.af'),
(30, 20, 'پوهنیار ذبیح الله درانی', 'استاد', '0700005003', 'zdurrani@ku.edu.af'),
-- Economics Faculty staff
(31, 21, 'پوهاند حاجي محمد شریف', 'د پوهنځي ریاست', '0700006001', 'econ.dean@ku.edu.af'),
(32, 21, 'پوهنمل عمر خان خروټی', 'استاد', '0700006002', 'okhrooti@ku.edu.af'),
(33, 22, 'پوهنیار شیرین ګل کاکر', 'استاده', '0700006003', 'sgkakar@ku.edu.af'),
-- Literature Faculty staff
(34, 23, 'پوهاند عبدالرب خان آریا', 'د پوهنځي ریاست', '0700007001', 'lit.dean@ku.edu.af'),
(35, 23, 'پوهنمل امینه بارکزی', 'استاده', '0700007002', 'abarkzai@ku.edu.af'),
(36, 24, 'پوهنیار شهزاده رحیم', 'استاد', '0700007003', 'srahim@ku.edu.af'),
(37, 25, 'پوهنیار فوزیه نظامي', 'استاده', '0700007004', 'fnizami@ku.edu.af'),
-- Master programs
(38, 26, 'پوهنمل صادق الله مومند', 'د ماسټري مدیر', '0700008001', 'msc.cs@ku.edu.af'),
(39, 27, 'پوهنمل رحیم ګل یوسفزی', 'د ماسټري مدیر', '0700008002', 'msc.econ@ku.edu.af');

-- ============================================================
-- 9. ITEMS (25 items with realistic stock levels)
-- ============================================================
INSERT IGNORE INTO items (id, item_code, name_ps, name_fa, category_id, unit_id, warehouse_id, current_stock, minimum_stock, status, bab_id, fasl_id) VALUES
(1,  'IT-001', 'ډیسکټاپ کمپیوټر', 'کمپیوتر دسکتاپ', 1, 1, 3, 18, 5,  'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(2,  'IT-002', 'لیپ ټاپ کمپیوټر', 'لپ‌تاپ', 1, 1, 3, 12, 5, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(3,  'IT-003', 'پرینتر (لیزر)', 'پرینتر لیزری', 1, 1, 3, 8,  2, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(4,  'IT-004', 'سکینر', 'اسکنر', 1, 1, 3, 5,  1, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(5,  'IT-005', 'یو پي ایس (UPS)', 'یو پی اس', 1, 1, 3, 14, 4, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(6,  'IT-006', 'روټر (شبکه)', 'روتر شبکه', 5, 1, 3, 9,  2, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(7,  'IT-007', 'پروجیکتر', 'پروجکتور', 1, 1, 1, 6,  2, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(8,  'IT-008', 'ویب کیمره', 'وب‌کمره', 1, 1, 3, 7,  2, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(9,  'FU-001', 'دفتري میز', 'میز دفتری', 2, 1, 1, 35, 10, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(10, 'FU-002', 'دفتري چوکۍ', 'چوکی دفتری', 2, 1, 1, 60, 15, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(11, 'FU-003', 'وایټ بورډ (لوی)', 'وایت‌برد بزرگ', 2, 1, 1, 20, 5,  'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(12, 'FU-004', 'کتاب شیلف', 'قفسه کتاب', 2, 1, 1, 25, 5,  'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(13, 'FU-005', 'فایل کابینه (د اسناد)', 'کابینه پرونده', 2, 1, 1, 18, 4,  'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(14, 'OS-001', 'کاغذ A4 (ریم)', 'کاغذ A4 ریم', 3, 5, 2, 150, 30, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(15, 'OS-002', 'قلم باکس (بکس)', 'جعبه قلم', 3, 8, 2, 80,  20, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(16, 'OS-003', 'نوټ بک', 'دفتر یادداشت', 3, 1, 2, 200, 50, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(17, 'OS-004', 'پرینتر انک کارتریج', 'کارتریج جوهر پرینتر', 3, 1, 3, 24,  6, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(18, 'OS-005', 'مارکر سیټ', 'ست مارکر وایت‌برد', 3, 7, 2, 40,  10, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(19, 'OS-006', 'اسناد فایل (فولدر)', 'فایل اسناد', 3, 6, 2, 300, 60, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22706')),
(20, 'OS-007', 'د لیکلو قلم (بکس)', 'جعبه خودکار', 3, 8, 2, 100, 25, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(21, 'ED-001', 'درسي کتابونه (ډول ډول)', 'کتاب درسی', 4, 1, 4, 500, 100,'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(22, 'ME-001', 'د لومړي مرستې کیټ', 'کیت کمک اولیه', 7, 1, 1, 15,  5, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22700')),
(23, 'FU-006', 'د لوست کوټه مقعده', 'صندلی تالار درس', 2, 1, 1, 80, 20, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(24, 'OS-008', 'USB ډرایو (32GB)', 'فلش مموری ۳۲ گیگ', 1, 1, 3, 30,  8, 'active', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(25, 'OS-009', 'برقي تار (Extension)', 'سیم برق (اکستنشن)', 5, 1, 2, 22,  5, 'active', (SELECT id FROM budget_babs WHERE bab_code='225'), (SELECT id FROM budget_fasls WHERE fasl_code='22500'));

-- ============================================================
-- 10. REQUESTS (20 requests over 2 years)
-- ============================================================
INSERT IGNORE INTO requests (id, tracking_id, faculty_id, department_id, person_id, request_level, status, progress_percent, notes, created_at) VALUES
(1,  'REQ-2024-0001', 1, 10, 13, 'NORMAL',  'COMPLETED', 100, 'د کمپیوټر ساینس پوهنځي لپاره د کمپیوټرانو غوښتنه', '2024-05-15 08:30:00'),
(2,  'REQ-2024-0002', 2, 13, 19, 'URGENT',  'COMPLETED', 100, 'د انجینري پوهنځي لپاره د فرنیچر غوښتنه', '2024-06-02 09:00:00'),
(3,  'REQ-2024-0003', NULL, 8, 11, 'NORMAL', 'COMPLETED', 100, 'د مرکزي ګدام لپاره د دفتري لوازمو غوښتنه', '2024-06-20 10:15:00'),
(4,  'REQ-2024-0004', 3, 16, 24, 'URGENT',  'COMPLETED', 100, 'د طب پوهنځي لپاره د طبي تجهیزاتو غوښتنه', '2024-07-08 11:00:00'),
(5,  'REQ-2024-0005', 5, 21, 31, 'NORMAL',  'COMPLETED', 100, 'د اقتصاد پوهنځي لپاره د پروجیکتر غوښتنه', '2024-07-25 09:30:00'),
(6,  'REQ-2024-0006', NULL, 5, 9,  'NORMAL', 'COMPLETED', 100, 'د IT ادارې لپاره د شبکه تجهیزاتو غوښتنه', '2024-08-10 10:00:00'),
(7,  'REQ-2024-0007', 6, 23, 34, 'LOW',     'COMPLETED', 100, 'د ادبیاتو پوهنځي لپاره د کتابونو غوښتنه', '2024-09-01 08:00:00'),
(8,  'REQ-2024-0008', 1, 11, 15, 'NORMAL',  'COMPLETED', 100, 'د شبکو ډیپارتمنت لپاره د روټرونو غوښتنه', '2024-09-20 14:00:00'),
(9,  'REQ-2024-0009', 4, 19, 28, 'NORMAL',  'COMPLETED', 100, 'د حقوقو پوهنځي لپاره د نوټ بکونو غوښتنه', '2024-10-05 09:00:00'),
(10, 'REQ-2024-0010', NULL, 4, 8,  'URGENT', 'COMPLETED', 100, 'د کتابتون لپاره د کتاب شیلفونو غوښتنه', '2024-10-22 10:30:00'),
(11, 'REQ-2025-0001', 2, 14, 21, 'NORMAL',  'COMPLETED', 100, 'د مکانیکي انجینري ډیپارتمنت لپاره د وایټ بورډونو غوښتنه', '2025-01-10 09:00:00'),
(12, 'REQ-2025-0002', NULL, 1, 4,  'URGENT', 'COMPLETED', 100, 'د مالي ادارې لپاره د لیپ ټاپونو غوښتنه', '2025-01-28 11:00:00'),
(13, 'REQ-2025-0003', 3, 17, 26, 'NORMAL',  'COMPLETED', 100, 'د درملو ډیپارتمنت لپاره د لومړي مرستې کیټونو غوښتنه', '2025-02-15 10:00:00'),
(14, 'REQ-2025-0004', 1, 12, 16, 'NORMAL',  'COMPLETED', 100, 'د مصنوعي ذکاوت ډیپارتمنت لپاره د USB ډرایوونو غوښتنه', '2025-03-01 09:30:00'),
(15, 'REQ-2025-0005', 5, 22, 33, 'LOW',     'COMPLETED', 100, 'د سوداګرۍ ډیپارتمنت لپاره د کاغذ غوښتنه', '2025-03-20 08:00:00'),
(16, 'REQ-2025-0006', 6, 24, 36, 'NORMAL',  'COMPLETED', 100, 'د انګلیسي ادبیاتو ډیپارتمنت لپاره د فایلونو غوښتنه', '2025-04-12 10:00:00'),
(17, 'REQ-2025-0007', NULL, 8, 12, 'NORMAL', 'DELIVERED', 85, 'د ګدام لپاره د دفتري میزونو غوښتنه', '2025-05-05 09:00:00'),
(18, 'REQ-2025-0008', 4, 20, 30, 'URGENT',  'SENT_TO_PROCUREMENT', 50, 'د سیاسي علومو ډیپارتمنت لپاره د کمپیوټر غوښتنه', '2025-09-08 11:00:00'),
(19, 'REQ-2026-0001', 2, 15, 22, 'NORMAL',  'CONFIRMED', 25, 'د برقي انجینري ډیپارتمنت لپاره د پروجیکتر غوښتنه', '2026-02-14 10:00:00'),
(20, 'REQ-2026-0002', 1, 10, 14, 'URGENT',  'PENDING',   10, 'د سافټویر انجینري ډیپارتمنت لپاره د لیپ ټاپونو نوې غوښتنه', '2026-05-18 09:00:00');

-- ============================================================
-- 11. REQUEST ITEMS
-- ============================================================
INSERT IGNORE INTO request_items (id, request_id, item_id, item_name, quantity, unit_id, specifications, status, bab_id, fasl_id) VALUES
(1,  1,  1,  'ډیسکټاپ کمپیوټر',  5,  1, 'Intel Core i5, 8GB RAM, 256GB SSD', 'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(2,  1,  2,  'لیپ ټاپ کمپیوټر',  3,  1, 'Core i7, 16GB RAM, 512GB SSD',      'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(3,  2,  9,  'دفتري میز',         10, 1, 'مقاوم، د دفتر لپاره',               'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(4,  2,  10, 'دفتري چوکۍ',        10, 1, 'د ناستې چوکۍ',                      'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(5,  3,  14, 'کاغذ A4 (ریم)',     20, 5, 'سپین، 80gsm',                        'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(6,  3,  15, 'قلم باکس',         10, 8, 'نیلي قلمونه',                        'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(7,  4,  22, 'د لومړي مرستې کیټ', 5,  1, 'بشپړ طبي کیټ',                      'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22700')),
(8,  5,  7,  'پروجیکتر',          2,  1, '3000 lumens, HDMI',                  'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(9,  6,  6,  'روټر (شبکه)',       3,  1, 'Cisco, 1Gbps',                       'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(10, 7,  21, 'درسي کتابونه',     50, 1, 'ډول ډول مضامین',                    'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(11, 8,  6,  'روټر (شبکه)',       2,  1, 'TP-Link, dual-band',                 'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(12, 9,  16, 'نوټ بک',           30, 1, 'A4، ۱۰۰ مخ',                        'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(13, 10, 12, 'کتاب شیلف',         5,  1, 'ددرانو اوسپنه',                      'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(14, 11, 11, 'وایټ بورډ (لوی)',   4,  1, '120x240 cm',                         'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(15, 12, 2,  'لیپ ټاپ کمپیوټر',  4,  1, 'Core i5, 8GB RAM',                   'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(16, 13, 22, 'د لومړي مرستې کیټ', 3,  1, 'بشپړ طبي کیټ',                      'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22700')),
(17, 14, 24, 'USB ډرایو (32GB)', 10, 1, 'USB 3.0',                             'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(18, 15, 14, 'کاغذ A4 (ریم)',    30, 5, '80gsm، سپین',                         'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22703')),
(19, 16, 19, 'اسناد فایل (فولدر)',20, 6, 'A4 پلاستیکي فایل',                   'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22706')),
(20, 17, 9,  'دفتري میز',         6,  1, 'مقاوم میز',                          'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(21, 17, 10, 'دفتري چوکۍ',        6,  1, 'د ناستې چوکۍ',                      'DELIVERED', (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22705')),
(22, 18, 1,  'ډیسکټاپ کمپیوټر',  3,  1, 'Core i7, 16GB RAM',                  'PENDING',   (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(23, 19, 7,  'پروجیکتر',          2,  1, '4000 lumens, WiFi',                  'PENDING',   (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701')),
(24, 20, 2,  'لیپ ټاپ کمپیوټر',  5,  1, 'Core i7, 32GB RAM, 1TB SSD',        'PENDING',   (SELECT id FROM budget_babs WHERE bab_code='220'), (SELECT id FROM budget_fasls WHERE fasl_code='22701'));

-- ============================================================
-- 12. REQUEST LEVEL HISTORY
-- ============================================================
INSERT IGNORE INTO request_level_history (id, request_id, old_level, new_level, changed_by, reason, created_at) VALUES
(1,  1,  NULL,     'NORMAL', 1, 'اولیه ثبت', '2024-05-15 08:30:00'),
(2,  2,  NULL,     'URGENT', 1, 'اولیه ثبت', '2024-06-02 09:00:00'),
(3,  4,  NULL,     'URGENT', 1, 'اولیه ثبت', '2024-07-08 11:00:00'),
(4,  12, NULL,     'URGENT', 1, 'اولیه ثبت', '2025-01-28 11:00:00'),
(5,  18, 'NORMAL', 'URGENT', 1, 'د عاجل اړتیا له امله', '2025-09-10 09:00:00'),
(6,  20, NULL,     'URGENT', 1, 'اولیه ثبت', '2026-05-18 09:00:00');

-- ============================================================
-- 13. DELIVERIES
-- ============================================================
INSERT IGNORE INTO deliveries (id, request_id, delivered_to_person_id, delivered_by, fs5_number, status, notes, created_at) VALUES
(1,  1,  13, 11, 'FS5-2024-001', 'DELIVERED', 'د کمپیوټر ساینس پوهنځي ته تسلیم شو', '2024-05-28 10:00:00'),
(2,  2,  19, 11, 'FS5-2024-002', 'DELIVERED', 'د انجینري پوهنځي ته تسلیم شو', '2024-06-18 11:00:00'),
(3,  3,  11, 11, 'FS5-2024-003', 'DELIVERED', 'د ګدام ادارې ته تسلیم شو', '2024-07-05 09:30:00'),
(4,  4,  24, 11, 'FS5-2024-004', 'DELIVERED', 'د طب پوهنځي ته تسلیم شو', '2024-07-22 10:00:00'),
(5,  5,  31, 11, 'FS5-2024-005', 'DELIVERED', 'د اقتصاد پوهنځي ته تسلیم شو', '2024-08-08 09:00:00'),
(6,  6,  9,  11, 'FS5-2024-006', 'DELIVERED', 'د IT ادارې ته تسلیم شو', '2024-08-25 10:30:00'),
(7,  7,  34, 11, 'FS5-2024-007', 'DELIVERED', 'د ادبیاتو پوهنځي ته تسلیم شو', '2024-09-15 11:00:00'),
(8,  8,  15, 11, 'FS5-2024-008', 'DELIVERED', 'د شبکو ډیپارتمنت ته تسلیم شو', '2024-10-05 09:00:00'),
(9,  9,  28, 11, 'FS5-2024-009', 'DELIVERED', 'د حقوقو پوهنځي ته تسلیم شو', '2024-10-20 10:00:00'),
(10, 10, 8,  11, 'FS5-2024-010', 'DELIVERED', 'د کتابتون ته تسلیم شو', '2024-11-05 09:30:00'),
(11, 11, 21, 11, 'FS5-2025-001', 'DELIVERED', 'د مکانیکي انجینري ډیپارتمنت ته تسلیم شو', '2025-01-25 10:00:00'),
(12, 12, 4,  11, 'FS5-2025-002', 'DELIVERED', 'د مالي ادارې ته تسلیم شو', '2025-02-12 11:00:00'),
(13, 13, 26, 11, 'FS5-2025-003', 'DELIVERED', 'د درملو ډیپارتمنت ته تسلیم شو', '2025-03-01 09:00:00'),
(14, 14, 16, 11, 'FS5-2025-004', 'DELIVERED', 'د مصنوعي ذکاوت ډیپارتمنت ته تسلیم شو', '2025-03-18 10:30:00'),
(15, 15, 33, 11, 'FS5-2025-005', 'DELIVERED', 'د سوداګرۍ ډیپارتمنت ته تسلیم شو', '2025-04-05 09:00:00'),
(16, 16, 36, 11, 'FS5-2025-006', 'DELIVERED', 'د انګلیسي ادبیاتو ډیپارتمنت ته تسلیم شو', '2025-04-28 11:00:00'),
(17, 17, 12, 11, 'FS5-2025-007', 'DELIVERED', 'د ګدام ادارې ته تسلیم شو', '2025-05-20 10:00:00');

-- ============================================================
-- 14. DELIVERY ITEMS
-- ============================================================
INSERT IGNORE INTO delivery_items (id, delivery_id, item_id, quantity, unit_id) VALUES
(1,  1,  1,  5,  1),
(2,  1,  2,  3,  1),
(3,  2,  9,  10, 1),
(4,  2,  10, 10, 1),
(5,  3,  14, 20, 5),
(6,  3,  15, 10, 8),
(7,  4,  22, 5,  1),
(8,  5,  7,  2,  1),
(9,  6,  6,  3,  1),
(10, 7,  21, 50, 1),
(11, 8,  6,  2,  1),
(12, 9,  16, 30, 1),
(13, 10, 12, 5,  1),
(14, 11, 11, 4,  1),
(15, 12, 2,  4,  1),
(16, 13, 22, 3,  1),
(17, 14, 24, 10, 1),
(18, 15, 14, 30, 5),
(19, 16, 19, 20, 6),
(20, 17, 9,  6,  1),
(21, 17, 10, 6,  1);

-- ============================================================
-- 15. ITEM ASSIGNMENTS (2 years of realistic assignments)
-- ============================================================
INSERT IGNORE INTO item_assignments (id, item_id, person_id, department_id, faculty_id, quantity, source_type, status, assigned_at, notes, unit_id, delivery_id) VALUES
-- 2024 assignments
(1,  1,  13, 10, 1, 2, 'DELIVERY', 'ASSIGNED', '2024-05-28 10:30:00', 'د سافټویر ډیپارتمنت لپاره کمپیوټران', 1, 1),
(2,  1,  14, 10, 1, 1, 'DELIVERY', 'ASSIGNED', '2024-05-28 10:30:00', 'استاد جمیل احمد لپاره کمپیوټر', 1, 1),
(3,  2,  13, 10, 1, 1, 'DELIVERY', 'ASSIGNED', '2024-05-28 11:00:00', 'د ریاست لپاره لیپ ټاپ', 1, 1),
(4,  2,  17, 10, 1, 1, 'DELIVERY', 'ASSIGNED', '2024-05-28 11:00:00', 'استاده مریم لپاره لیپ ټاپ', 1, 1),
(5,  2,  15, 11, 1, 1, 'DELIVERY', 'ASSIGNED', '2024-05-28 11:00:00', 'د شبکو ډیپارتمنت لپاره لیپ ټاپ', 1, 1),
(6,  9,  19, 13, 2, 4, 'DELIVERY', 'ASSIGNED', '2024-06-18 11:30:00', 'د ساختماني انجینري لپاره میزونه', 1, 2),
(7,  9,  20, 13, 2, 3, 'DELIVERY', 'ASSIGNED', '2024-06-18 11:30:00', 'استادانو لپاره میزونه', 1, 2),
(8,  10, 19, 13, 2, 5, 'DELIVERY', 'ASSIGNED', '2024-06-18 12:00:00', 'د انجینري پوهنځي چوکۍ', 1, 2),
(9,  10, 23, 13, 2, 5, 'DELIVERY', 'ASSIGNED', '2024-06-18 12:00:00', 'استاده رقیه لپاره چوکۍ', 1, 2),
(10, 22, 24, 16, 3, 2, 'DELIVERY', 'ASSIGNED', '2024-07-22 10:30:00', 'د طبي ډیپارتمنت کیټونه', 1, 4),
(11, 22, 25, 16, 3, 2, 'DELIVERY', 'ASSIGNED', '2024-07-22 10:30:00', 'ډاکتره فاطمه لپاره کیټ', 1, 4),
(12, 7,  31, 21, 5, 1, 'DELIVERY', 'ASSIGNED', '2024-08-08 09:30:00', 'د اقتصاد پوهنځي پروجیکتر', 1, 5),
(13, 7,  32, 21, 5, 1, 'DELIVERY', 'ASSIGNED', '2024-08-08 09:30:00', 'استاد عمر لپاره پروجیکتر', 1, 5),
(14, 6,  9,  5,  NULL, 2, 'DELIVERY', 'ASSIGNED', '2024-08-25 11:00:00', 'د IT ادارې روټرونه', 1, 6),
(15, 6,  9,  5,  NULL, 1, 'DELIVERY', 'ASSIGNED', '2024-08-25 11:00:00', 'د مرکزي شبکې روټر', 1, 6),
(16, 12, 8,  4,  NULL, 5, 'DELIVERY', 'ASSIGNED', '2024-11-05 10:00:00', 'د کتابتون کتاب شیلفونه', 1, 10),
-- 2025 assignments
(17, 11, 21, 14, 2, 2, 'DELIVERY', 'ASSIGNED', '2025-01-25 10:30:00', 'د مکانیکي ډیپارتمنت وایټ بورډونه', 1, 11),
(18, 11, 19, 13, 2, 2, 'DELIVERY', 'ASSIGNED', '2025-01-25 10:30:00', 'د ساختماني ډیپارتمنت وایټ بورډونه', 1, 11),
(19, 2,  4,  1,  NULL, 2, 'DELIVERY', 'ASSIGNED', '2025-02-12 11:30:00', 'مالي ادارې مدیرانو لپاره لیپ ټاپونه', 1, 12),
(20, 2,  5,  1,  NULL, 2, 'DELIVERY', 'ASSIGNED', '2025-02-12 11:30:00', 'محاسب لپاره لیپ ټاپونه', 1, 12),
(21, 22, 26, 17, 3, 2, 'DELIVERY', 'ASSIGNED', '2025-03-01 09:30:00', 'د درملو ډیپارتمنت طبي کیټونه', 1, 13),
(22, 22, 27, 18, 3, 1, 'DELIVERY', 'ASSIGNED', '2025-03-01 09:30:00', 'دندان طب ډیپارتمنت کیټ', 1, 13),
(23, 24, 16, 12, 1, 5, 'DELIVERY', 'ASSIGNED', '2025-03-18 10:30:00', 'د مصنوعي ذکاوت ډیپارتمنت USB ډرایوونه', 1, 14),
(24, 24, 17, 10, 1, 3, 'DELIVERY', 'ASSIGNED', '2025-03-18 10:30:00', 'د سافټویر ډیپارتمنت USB ډرایوونه', 1, 14),
(25, 19, 36, 24, 6, 10, 'DELIVERY', 'ASSIGNED', '2025-04-28 11:30:00', 'د انګلیسي ادبیاتو ډیپارتمنت فایلونه', 6, 16),
(26, 19, 35, 23, 6, 10, 'DELIVERY', 'ASSIGNED', '2025-04-28 11:30:00', 'د پښتو ادبیاتو ډیپارتمنت فایلونه', 6, 16),
(27, 9,  12, 8,  NULL, 3, 'DELIVERY', 'ASSIGNED', '2025-05-20 10:30:00', 'د ګدام ادارې میزونه', 1, 17),
(28, 10, 12, 8,  NULL, 3, 'DELIVERY', 'ASSIGNED', '2025-05-20 10:30:00', 'د ګدام ادارې چوکۍ', 1, 17);

-- ============================================================
-- 16. STOCK TRANSACTIONS
-- ============================================================
INSERT IGNORE INTO stock_transactions (id, item_id, transaction_type, quantity, previous_stock, new_stock, source_type, reference_id, notes, created_at) VALUES
-- Initial stock-in (procurement/receiving) - 2024
(1,  1,  'IN', 25, 0,  25,  'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-10 08:00:00'),
(2,  2,  'IN', 15, 0,  15,  'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-10 08:00:00'),
(3,  3,  'IN', 10, 0,  10,  'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-12 08:00:00'),
(4,  4,  'IN', 6,  0,  6,   'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-12 08:00:00'),
(5,  5,  'IN', 20, 0,  20,  'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-14 08:00:00'),
(6,  6,  'IN', 12, 0,  12,  'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-14 08:00:00'),
(7,  7,  'IN', 8,  0,  8,   'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-16 08:00:00'),
(8,  8,  'IN', 10, 0,  10,  'PROCUREMENT', '1', 'اولني ذخیره', '2024-05-16 08:00:00'),
(9,  9,  'IN', 50, 0,  50,  'PROCUREMENT', '2', 'اولني ذخیره', '2024-06-01 08:00:00'),
(10, 10, 'IN', 80, 0,  80,  'PROCUREMENT', '2', 'اولني ذخیره', '2024-06-01 08:00:00'),
(11, 11, 'IN', 25, 0,  25,  'PROCUREMENT', '2', 'اولني ذخیره', '2024-06-01 08:00:00'),
(12, 12, 'IN', 30, 0,  30,  'PROCUREMENT', '2', 'اولني ذخیره', '2024-06-02 08:00:00'),
(13, 13, 'IN', 25, 0,  25,  'PROCUREMENT', '2', 'اولني ذخیره', '2024-06-02 08:00:00'),
(14, 14, 'IN', 200,0,  200, 'PROCUREMENT', '3', 'اولني ذخیره', '2024-06-10 08:00:00'),
(15, 15, 'IN', 100,0,  100, 'PROCUREMENT', '3', 'اولني ذخیره', '2024-06-10 08:00:00'),
(16, 16, 'IN', 250,0,  250, 'PROCUREMENT', '3', 'اولني ذخیره', '2024-06-10 08:00:00'),
(17, 17, 'IN', 30, 0,  30,  'PROCUREMENT', '3', 'اولني ذخیره', '2024-06-10 08:00:00'),
(18, 18, 'IN', 50, 0,  50,  'PROCUREMENT', '3', 'اولني ذخیره', '2024-06-11 08:00:00'),
(19, 19, 'IN', 400,0,  400, 'PROCUREMENT', '3', 'اولني ذخیره', '2024-06-11 08:00:00'),
(20, 20, 'IN', 120,0,  120, 'PROCUREMENT', '3', 'اولني ذخیره', '2024-06-11 08:00:00'),
(21, 21, 'IN', 600,0,  600, 'PROCUREMENT', '4', 'اولني ذخیره', '2024-06-15 08:00:00'),
(22, 22, 'IN', 20, 0,  20,  'PROCUREMENT', '4', 'اولني ذخیره', '2024-06-15 08:00:00'),
(23, 23, 'IN', 100,0,  100, 'PROCUREMENT', '4', 'اولني ذخیره', '2024-06-15 08:00:00'),
(24, 24, 'IN', 40, 0,  40,  'PROCUREMENT', '5', 'اولني ذخیره', '2024-06-20 08:00:00'),
(25, 25, 'IN', 30, 0,  30,  'PROCUREMENT', '5', 'اولني ذخیره', '2024-06-20 08:00:00'),
-- Stock OUT (deliveries)
(26, 1,  'OUT', 5,  25, 20, 'DELIVERY', '1', 'د REQ-2024-0001 تحویلي', '2024-05-28 10:00:00'),
(27, 2,  'OUT', 3,  15, 12, 'DELIVERY', '1', 'د REQ-2024-0001 تحویلي', '2024-05-28 10:00:00'),
(28, 9,  'OUT', 10, 50, 40, 'DELIVERY', '2', 'د REQ-2024-0002 تحویلي', '2024-06-18 11:00:00'),
(29, 10, 'OUT', 10, 80, 70, 'DELIVERY', '2', 'د REQ-2024-0002 تحویلي', '2024-06-18 11:00:00'),
(30, 14, 'OUT', 20, 200,180,'DELIVERY', '3', 'د REQ-2024-0003 تحویلي', '2024-07-05 09:30:00'),
(31, 15, 'OUT', 10, 100, 90,'DELIVERY', '3', 'د REQ-2024-0003 تحویلي', '2024-07-05 09:30:00'),
(32, 22, 'OUT', 5,  20, 15, 'DELIVERY', '4', 'د REQ-2024-0004 تحویلي', '2024-07-22 10:00:00'),
(33, 7,  'OUT', 2,  8,  6,  'DELIVERY', '5', 'د REQ-2024-0005 تحویلي', '2024-08-08 09:00:00'),
(34, 6,  'OUT', 3,  12, 9,  'DELIVERY', '6', 'د REQ-2024-0006 تحویلي', '2024-08-25 10:30:00'),
(35, 21, 'OUT', 50, 600,550,'DELIVERY', '7', 'د REQ-2024-0007 تحویلي', '2024-09-15 11:00:00'),
(36, 6,  'OUT', 2,  9,  7,  'DELIVERY', '8', 'د REQ-2024-0008 تحویلي', '2024-10-05 09:00:00'),
(37, 16, 'OUT', 30, 250,220,'DELIVERY', '9', 'د REQ-2024-0009 تحویلي', '2024-10-20 10:00:00'),
(38, 12, 'OUT', 5,  30, 25, 'DELIVERY', '10','د REQ-2024-0010 تحویلي', '2024-11-05 09:30:00'),
-- 2025 stock movements
(39, 11, 'OUT', 4,  25, 21, 'DELIVERY', '11','د REQ-2025-0001 تحویلي', '2025-01-25 10:00:00'),
(40, 2,  'OUT', 4,  12, 8,  'DELIVERY', '12','د REQ-2025-0002 تحویلي', '2025-02-12 11:00:00'),
(41, 22, 'OUT', 3,  15, 12, 'DELIVERY', '13','د REQ-2025-0003 تحویلي', '2025-03-01 09:00:00'),
(42, 24, 'OUT', 10, 40, 30, 'DELIVERY', '14','د REQ-2025-0004 تحویلي', '2025-03-18 10:30:00'),
(43, 14, 'OUT', 30, 180,150,'DELIVERY', '15','د REQ-2025-0005 تحویلي', '2025-04-05 09:00:00'),
(44, 19, 'OUT', 20, 400,380,'DELIVERY', '16','د REQ-2025-0006 تحویلي', '2025-04-28 11:00:00'),
(45, 9,  'OUT', 6,  40, 34, 'DELIVERY', '17','د REQ-2025-0007 تحویلي', '2025-05-20 10:00:00'),
(46, 10, 'OUT', 6,  70, 64, 'DELIVERY', '17','د REQ-2025-0007 تحویلي', '2025-05-20 10:00:00'),
-- 2025 restocking
(47, 14, 'IN', 50, 150,200,'PROCUREMENT','6', 'د 2025 کال دویم ربع ذخیره', '2025-07-01 08:00:00'),
(48, 16, 'IN', 100,220,320,'PROCUREMENT','6', 'د 2025 کال دویم ربع ذخیره', '2025-07-01 08:00:00'),
(49, 15, 'IN', 30, 90, 120,'PROCUREMENT','6', 'د 2025 کال دویم ربع ذخیره', '2025-07-01 08:00:00'),
(50, 20, 'IN', 50, 120,170,'PROCUREMENT','6', 'د 2025 کال دویم ربع ذخیره', '2025-07-01 08:00:00'),
-- late 2025 out
(51, 16, 'OUT', 120,320,200,'DELIVERY', '18','د ۱۴۰۴ کال د لومړي نیم کال ویش', '2025-08-01 09:00:00'),
(52, 20, 'OUT', 70, 170,100,'DELIVERY', '18','د قلمونو ویش', '2025-08-01 09:00:00'),
(53, 21, 'OUT', 50, 550,500,'DELIVERY', '19','د کتابتون لپاره کتابونه', '2025-10-15 10:00:00'),
(54, 23, 'OUT', 20, 100, 80,'DELIVERY', '19','د کوټو چوکۍ', '2025-10-15 10:00:00');

-- Update current stock to match transactions
UPDATE items SET current_stock=18 WHERE id=1;
UPDATE items SET current_stock=8  WHERE id=2;
UPDATE items SET current_stock=10 WHERE id=3;
UPDATE items SET current_stock=6  WHERE id=4;
UPDATE items SET current_stock=20 WHERE id=5;
UPDATE items SET current_stock=7  WHERE id=6;
UPDATE items SET current_stock=6  WHERE id=7;
UPDATE items SET current_stock=10 WHERE id=8;
UPDATE items SET current_stock=28 WHERE id=9;
UPDATE items SET current_stock=58 WHERE id=10;
UPDATE items SET current_stock=17 WHERE id=11;
UPDATE items SET current_stock=20 WHERE id=12;
UPDATE items SET current_stock=18 WHERE id=13;
UPDATE items SET current_stock=120WHERE id=14;
UPDATE items SET current_stock=70 WHERE id=15;
UPDATE items SET current_stock=200WHERE id=16;
UPDATE items SET current_stock=24 WHERE id=17;
UPDATE items SET current_stock=40 WHERE id=18;
UPDATE items SET current_stock=280WHERE id=19;
UPDATE items SET current_stock=100WHERE id=20;
UPDATE items SET current_stock=500WHERE id=21;
UPDATE items SET current_stock=9  WHERE id=22;
UPDATE items SET current_stock=60 WHERE id=23;
UPDATE items SET current_stock=30 WHERE id=24;
UPDATE items SET current_stock=22 WHERE id=25;

SELECT '============================================================' AS '';
SELECT 'SEED DATA COMPLETE' AS '';
SELECT CONCAT('budget_babs: ', COUNT(*)) AS result FROM budget_babs;
SELECT CONCAT('budget_fasls: ', COUNT(*)) AS result FROM budget_fasls;
SELECT CONCAT('categories: ', COUNT(*)) AS result FROM categories;
SELECT CONCAT('units: ', COUNT(*)) AS result FROM units;
SELECT CONCAT('warehouses: ', COUNT(*)) AS result FROM warehouses;
SELECT CONCAT('vendors: ', COUNT(*)) AS result FROM vendors;
SELECT CONCAT('faculties: ', COUNT(*)) AS result FROM faculties;
SELECT CONCAT('departments: ', COUNT(*)) AS result FROM departments;
SELECT CONCAT('people: ', COUNT(*)) AS result FROM people;
SELECT CONCAT('items: ', COUNT(*)) AS result FROM items;
SELECT CONCAT('requests: ', COUNT(*)) AS result FROM requests;
SELECT CONCAT('request_items: ', COUNT(*)) AS result FROM request_items;
SELECT CONCAT('deliveries: ', COUNT(*)) AS result FROM deliveries;
SELECT CONCAT('item_assignments: ', COUNT(*)) AS result FROM item_assignments;
SELECT CONCAT('stock_transactions: ', COUNT(*)) AS result FROM stock_transactions;
