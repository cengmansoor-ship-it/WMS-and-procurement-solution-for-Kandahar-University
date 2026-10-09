import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { InventoryService } from './inventory.service';

export interface ChecklistItem {
  id: number;
  original_id: string;
  category: string;
  item_name: string;
  description: string;
  unit: string;
  estimated_price: number;
  item_code: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

const SEED_DATA = [
  { original_id: "KU1405-CLEAN-001", category: "صفایي", item_name: "جارو", description: "باڼسي خاشووالا", unit: "عدد", estimated_price: 15, item_code: "KU-CLEAN-0001" },
  { original_id: "KU1405-CLEAN-002", category: "صفایي", item_name: "پاسپاس", description: "فلزي غټ اسفنجي", unit: "عدد", estimated_price: 130, item_code: "KU-CLEAN-0002" },
  { original_id: "KU1405-CLEAN-003", category: "صفایي", item_name: "برس", description: "دکمود مینځلولپاره اهني لاستي والا", unit: "عدد", estimated_price: 35, item_code: "KU-CLEAN-0003" },
  { original_id: "KU1405-CLEAN-004", category: "صفایي", item_name: "پاسپاس", description: "تاروالا۵۰سانتي متره", unit: "عدد", estimated_price: 115, item_code: "KU-CLEAN-0004" },
  { original_id: "KU1405-CLEAN-005", category: "صفایي", item_name: "برس", description: "دصفائي لپاره پاکستاني غټ (د فرش پرېولو)", unit: "عدد", estimated_price: 25, item_code: "KU-CLEAN-0005" },
  { original_id: "KU1405-CLEAN-006", category: "صفایي", item_name: "تیزاب", description: "تیرک، دکموډاوکاشی پریوللولپاره", unit: "بوتل", estimated_price: 55, item_code: "KU-CLEAN-0006" },
  { original_id: "KU1405-CLEAN-007", category: "صفایي", item_name: "ګډوې", description: "پلاستیکي وطني اصلي غټ ډ بلي", unit: "عدد", estimated_price: 20, item_code: "KU-CLEAN-0007" },
  { original_id: "KU1405-CLEAN-008", category: "صفایي", item_name: "برس", description: "رولروالاچهارقولو", unit: "عدد", estimated_price: 50, item_code: "KU-CLEAN-0008" },
  { original_id: "KU1405-CLEAN-009", category: "صفایي", item_name: "شیشه صفاکن", description: "صفوناوطني دښیښوپاکولومایع", unit: "بوتل", estimated_price: 40, item_code: "KU-CLEAN-0009" },
  { original_id: "KU1405-CLEAN-010", category: "صفایي", item_name: "ټوکر", description: "نخي دصافو لپاره", unit: "متر", estimated_price: 10, item_code: "KU-CLEAN-0010" },
  { original_id: "KU1405-CLEAN-011", category: "صفایي", item_name: "خاک انداز", description: "پلاستیکي وطني", unit: "عدد", estimated_price: 20, item_code: "KU-CLEAN-0011" },
  { original_id: "KU1405-CLEAN-012", category: "صفایي", item_name: "کچره داني", description: "۶۰لیټره ساده", unit: "عدد", estimated_price: 1050, item_code: "KU-CLEAN-0012" },
  { original_id: "KU1405-CLEAN-013", category: "صفایي", item_name: "صابون(پوډري)", description: "دکالوپریوللولپاره دنیا مالیزیاوالا", unit: "قطۍ", estimated_price: 47, item_code: "KU-CLEAN-0013" },
  { original_id: "KU1405-CLEAN-014", category: "صفایي", item_name: "تیزاب", description: "کارټکس دکالودلکوصفاکولومایع۴لیټره", unit: "بوتل", estimated_price: 160, item_code: "KU-CLEAN-0014" },
  { original_id: "KU1405-CLEAN-015", category: "صفایي", item_name: "چمپلان", description: "داوداسه لپاره پلاستیکي", unit: "عدد", estimated_price: 60, item_code: "KU-CLEAN-0015" },
  { original_id: "KU1405-CLEAN-016", category: "صفایي", item_name: "صابون", description: "ډیټول اورجینل ۸۵ګرامه", unit: "عدد", estimated_price: 33, item_code: "KU-CLEAN-0016" },
  { original_id: "KU1405-CLEAN-017", category: "صفایي", item_name: "تشناب کاغذ", description: "سور", unit: "بسته", estimated_price: 55, item_code: "KU-CLEAN-0017" },
  { original_id: "KU1405-CLEAN-018", category: "صفایي", item_name: "دسکشي", description: "ربړي", unit: "قطۍ", estimated_price: 30, item_code: "KU-CLEAN-0018" },
  { original_id: "KU1405-CLEAN-019", category: "صفایي", item_name: "ډيټول", description: "مايع", unit: "بوتل", estimated_price: 130, item_code: "KU-CLEAN-0019" },
  { original_id: "KU1405-CLEAN-020", category: "صفایي", item_name: "ناریل صابون", description: "پاکستاني", unit: "عدد", estimated_price: 25, item_code: "KU-CLEAN-0020" },
  { original_id: "KU1405-CLEAN-021", category: "صفایي", item_name: "هوا فریشنر", description: "اسپریAir Freshener", unit: "عدد", estimated_price: 150, item_code: "KU-CLEAN-0021" },
  { original_id: "KU1405-CLEAN-022", category: "صفایي", item_name: "دکاغذ صنطل", description: "بکسي", unit: "قطۍ", estimated_price: 50, item_code: "KU-CLEAN-0022" },
  { original_id: "KU1405-CLEAN-023", category: "صفایي", item_name: "ښیښوصفاکن", description: "۵لیټره ساده", unit: "دانه", estimated_price: 80, item_code: "KU-CLEAN-0023" },
  { original_id: "KU1405-CLEAN-024", category: "صفایي", item_name: "پاکي وړي", description: "پلاستیکي اصلي", unit: "عدد", estimated_price: 5, item_code: "KU-CLEAN-0024" },
  { original_id: "KU1405-CLEAN-025", category: "صفایي", item_name: "اوبه ولاړه", description: "د ګوتو لپاره", unit: "عدد", estimated_price: 40, item_code: "KU-CLEAN-0025" },
  { original_id: "KU1405-CLEAN-026", category: "صفایي", item_name: "اسفنج", description: "دظروفو مینځلو لپاره", unit: "عدد", estimated_price: 15, item_code: "KU-CLEAN-0026" },
  { original_id: "KU1405-CLEAN-027", category: "صفایي", item_name: "اوبه پیلواله", description: "پلاستیکي", unit: "عدد", estimated_price: 50, item_code: "KU-CLEAN-0027" },
  { original_id: "KU1405-CLEAN-028", category: "صفایي", item_name: "موندو", description: "د ویالو لپاره", unit: "عدد", estimated_price: 30, item_code: "KU-CLEAN-0028" },
  { original_id: "KU1405-CLEAN-029", category: "صفایي", item_name: "وایاس", description: "پاکستاني ۱کیلو", unit: "قطۍ", estimated_price: 100, item_code: "KU-CLEAN-0029" },
  { original_id: "KU1405-FURN-001", category: "فرنیچري", item_name: "چوکۍ", description: "فلزي", unit: "عدد", estimated_price: 1500, item_code: "KU-FURN-0001" },
  { original_id: "KU1405-FURN-002", category: "فرنیچري", item_name: "میز", description: "دفتري لوی", unit: "عدد", estimated_price: 5000, item_code: "KU-FURN-0002" },
  { original_id: "KU1405-FURN-003", category: "فرنیچري", item_name: "الماري", description: "فلزي دوه دروازې", unit: "عدد", estimated_price: 8000, item_code: "KU-FURN-0003" },
  { original_id: "KU1405-FURN-004", category: "فرنیچري", item_name: "تختخواب", description: "فلزي", unit: "عدد", estimated_price: 3000, item_code: "KU-FURN-0004" },
  { original_id: "KU1405-FURN-005", category: "فرنیچري", item_name: "صوفه", description: "درې کسیزه", unit: "عدد", estimated_price: 10000, item_code: "KU-FURN-0005" },
  { original_id: "KU1405-FURN-006", category: "فرنیچري", item_name: "بوک شیلف", description: "لرګیزه", unit: "عدد", estimated_price: 4000, item_code: "KU-FURN-0006" },
  { original_id: "KU1405-FURN-007", category: "فرنیچري", item_name: "د کتاب الماري", description: "شیشه ییزه دروازه لرونکې", unit: "عدد", estimated_price: 6000, item_code: "KU-FURN-0007" },
  { original_id: "KU1405-FURN-008", category: "فرنیچري", item_name: "کوچنی میز", description: "دفتري", unit: "عدد", estimated_price: 2500, item_code: "KU-FURN-0008" },
  { original_id: "KU1405-FURN-009", category: "فرنیچري", item_name: "پرده", description: "دکمره لپاره", unit: "متر", estimated_price: 200, item_code: "KU-FURN-0009" },
  { original_id: "KU1405-FURN-010", category: "فرنیچري", item_name: "قالین", description: "وطني ۳x4 متره", unit: "عدد", estimated_price: 12000, item_code: "KU-FURN-0010" },
  { original_id: "KU1405-FURN-011", category: "فرنیچري", item_name: "سوفه یو کسیزه", description: "فلزي", unit: "عدد", estimated_price: 3500, item_code: "KU-FURN-0011" },
  { original_id: "KU1405-FURN-012", category: "فرنیچري", item_name: "بوک کیس", description: "شیشه ییزه دروازه", unit: "عدد", estimated_price: 7000, item_code: "KU-FURN-0012" },
  { original_id: "KU1405-FURN-013", category: "فرنیچري", item_name: "میز غونډه", description: "لرګیزه", unit: "عدد", estimated_price: 8000, item_code: "KU-FURN-0013" },
  { original_id: "KU1405-FURN-014", category: "فرنیچري", item_name: "تابلو", description: "سپین بورد", unit: "عدد", estimated_price: 2000, item_code: "KU-FURN-0014" },
  { original_id: "KU1405-FURN-015", category: "فرنیچري", item_name: "تختهٔ سیاه", description: "معیاري", unit: "عدد", estimated_price: 1800, item_code: "KU-FURN-0015" },
  { original_id: "KU1405-COMP-001", category: "کمپیوټري", item_name: "لپتاپ", description: "Dell Latitude 5420", unit: "دانه", estimated_price: 45000, item_code: "KU-COMP-0001" },
  { original_id: "KU1405-COMP-002", category: "کمپیوټري", item_name: "ډیسک تاپ", description: "HP Core i5", unit: "دانه", estimated_price: 35000, item_code: "KU-COMP-0002" },
  { original_id: "KU1405-COMP-003", category: "کمپیوټري", item_name: "پرنټر", description: "HP LaserJet", unit: "دانه", estimated_price: 15000, item_code: "KU-COMP-0003" },
  { original_id: "KU1405-COMP-004", category: "کمپیوټري", item_name: "سکینر", description: "HP Flatbed", unit: "دانه", estimated_price: 8000, item_code: "KU-COMP-0004" },
  { original_id: "KU1405-COMP-005", category: "کمپیوټري", item_name: "UPS", description: "1000VA", unit: "دانه", estimated_price: 5000, item_code: "KU-COMP-0005" },
  { original_id: "KU1405-COMP-006", category: "کمپیوټري", item_name: "مانیتور", description: "21 انچ", unit: "دانه", estimated_price: 10000, item_code: "KU-COMP-0006" },
  { original_id: "KU1405-COMP-007", category: "کمپیوټري", item_name: "کیبورد", description: "USB وطني", unit: "دانه", estimated_price: 500, item_code: "KU-COMP-0007" },
  { original_id: "KU1405-COMP-008", category: "کمپیوټري", item_name: "ماوس", description: "USB وطني", unit: "دانه", estimated_price: 300, item_code: "KU-COMP-0008" },
  { original_id: "KU1405-COMP-009", category: "کمپیوټري", item_name: "فلش ډرایو", description: "32GB", unit: "دانه", estimated_price: 400, item_code: "KU-COMP-0009" },
  { original_id: "KU1405-COMP-010", category: "کمپیوټري", item_name: "هارد دیسک", description: "1TB External", unit: "دانه", estimated_price: 3000, item_code: "KU-COMP-0010" },
  { original_id: "KU1405-COMP-011", category: "کمپیوټري", item_name: "هیډ سیټ", description: "USB", unit: "دانه", estimated_price: 800, item_code: "KU-COMP-0011" },
  { original_id: "KU1405-COMP-012", category: "کمپیوټري", item_name: "ویب کیم", description: "1080p", unit: "دانه", estimated_price: 2000, item_code: "KU-COMP-0012" },
  { original_id: "KU1405-COMP-013", category: "کمپیوټري", item_name: "وای فای روټر", description: "TP-Link", unit: "دانه", estimated_price: 3500, item_code: "KU-COMP-0013" },
  { original_id: "KU1405-COMP-014", category: "کمپیوټري", item_name: "نیټ ورک سویچ", description: "24 Port", unit: "دانه", estimated_price: 8000, item_code: "KU-COMP-0014" },
  { original_id: "KU1405-COMP-015", category: "کمپیوټري", item_name: "پروجیکتر", description: "Epson", unit: "دانه", estimated_price: 20000, item_code: "KU-COMP-0015" },
  { original_id: "KU1405-COMP-016", category: "کمپیوټري", item_name: "پروجیکتر سکرین", description: "۱۰۰ انچ", unit: "دانه", estimated_price: 5000, item_code: "KU-COMP-0016" },
  { original_id: "KU1405-COMP-017", category: "کمپیوټري", item_name: "کمره", description: "CCTV IP", unit: "دانه", estimated_price: 4000, item_code: "KU-COMP-0017" },
  { original_id: "KU1405-OFFC-001", category: "دفتري", item_name: "قلم", description: "پاسپاسي ازرق", unit: "دوجن", estimated_price: 50, item_code: "KU-OFFC-0001" },
  { original_id: "KU1405-OFFC-002", category: "دفتري", item_name: "قلم مارکر", description: "سور ازرق", unit: "دوجن", estimated_price: 120, item_code: "KU-OFFC-0002" },
  { original_id: "KU1405-OFFC-003", category: "دفتري", item_name: "قیچي", description: "دفتري", unit: "عدد", estimated_price: 80, item_code: "KU-OFFC-0003" },
  { original_id: "KU1405-OFFC-004", category: "دفتري", item_name: "پنکار", description: "دستي", unit: "عدد", estimated_price: 40, item_code: "KU-OFFC-0004" },
  { original_id: "KU1405-OFFC-005", category: "دفتري", item_name: "استیپلر", description: "24/6", unit: "عدد", estimated_price: 150, item_code: "KU-OFFC-0005" },
  { original_id: "KU1405-OFFC-006", category: "دفتري", item_name: "پین استیپلر", description: "24/6", unit: "بکس", estimated_price: 30, item_code: "KU-OFFC-0006" },
  { original_id: "KU1405-OFFC-007", category: "دفتري", item_name: "سوراخ کوونکی", description: "دوه سوراخه", unit: "عدد", estimated_price: 120, item_code: "KU-OFFC-0007" },
  { original_id: "KU1405-OFFC-008", category: "دفتري", item_name: "حساب ماشین", description: "Casio", unit: "عدد", estimated_price: 500, item_code: "KU-OFFC-0008" },
  { original_id: "KU1405-OFFC-009", category: "دفتري", item_name: "ربر", description: "سپین", unit: "دوجن", estimated_price: 30, item_code: "KU-OFFC-0009" },
  { original_id: "KU1405-OFFC-010", category: "دفتري", item_name: "مداد", description: "HB", unit: "دوجن", estimated_price: 60, item_code: "KU-OFFC-0010" },
  { original_id: "KU1405-OFFC-011", category: "دفتري", item_name: "ټیپ", description: "شفاف", unit: "عدد", estimated_price: 20, item_code: "KU-OFFC-0011" },
  { original_id: "KU1405-OFFC-012", category: "دفتري", item_name: "ټیپ ډسپنسر", description: "دفتري", unit: "عدد", estimated_price: 60, item_code: "KU-OFFC-0012" },
  { original_id: "KU1405-OFFC-013", category: "دفتري", item_name: "کارد", description: "دفتري", unit: "عدد", estimated_price: 30, item_code: "KU-OFFC-0013" },
  { original_id: "KU1405-OFFC-014", category: "دفتري", item_name: "خاور ایستونکی", description: "مایع", unit: "عدد", estimated_price: 40, item_code: "KU-OFFC-0014" },
  { original_id: "KU1405-OFFC-015", category: "دفتري", item_name: "پوزه", description: "وطني", unit: "دوجن", estimated_price: 80, item_code: "KU-OFFC-0015" },
  { original_id: "KU1405-OFFC-016", category: "دفتري", item_name: "فایل", description: "A4 سیاه", unit: "دوجن", estimated_price: 200, item_code: "KU-OFFC-0016" },
  { original_id: "KU1405-OFFC-017", category: "دفتري", item_name: "بایندر", description: "A4", unit: "عدد", estimated_price: 150, item_code: "KU-OFFC-0017" },
  { original_id: "KU1405-OFFC-018", category: "دفتري", item_name: "پنزل ښویندل", description: "برقي", unit: "عدد", estimated_price: 200, item_code: "KU-OFFC-0018" },
  { original_id: "KU1405-OFFC-019", category: "دفتري", item_name: "کاغذ ګیر", description: "دفتري", unit: "بکس", estimated_price: 50, item_code: "KU-OFFC-0019" },
  { original_id: "KU1405-OFFC-020", category: "دفتري", item_name: "مهر", description: "دفتري", unit: "عدد", estimated_price: 200, item_code: "KU-OFFC-0020" },
  { original_id: "KU1405-OFFC-021", category: "دفتري", item_name: "مهر کوشن", description: "مایع", unit: "عدد", estimated_price: 50, item_code: "KU-OFFC-0021" },
  { original_id: "KU1405-OFFC-022", category: "دفتري", item_name: "کارتریج قلم", description: "ازرق", unit: "بکس", estimated_price: 80, item_code: "KU-OFFC-0022" },
  { original_id: "KU1405-STAT-001", category: "قرطاسیه", item_name: "کاغذ A4", description: "70 ګرامه", unit: "ریمه", estimated_price: 350, item_code: "KU-STAT-0001" },
  { original_id: "KU1405-STAT-002", category: "قرطاسیه", item_name: "کاغذ A4", description: "80 ګرامه", unit: "ریمه", estimated_price: 400, item_code: "KU-STAT-0002" },
  { original_id: "KU1405-STAT-003", category: "قرطاسیه", item_name: "کاغذ A3", description: "80 ګرامه", unit: "ریمه", estimated_price: 700, item_code: "KU-STAT-0003" },
  { original_id: "KU1405-STAT-004", category: "قرطاسیه", item_name: "کاپي بوک", description: "96 پاڼې", unit: "دوجن", estimated_price: 180, item_code: "KU-STAT-0004" },
  { original_id: "KU1405-STAT-005", category: "قرطاسیه", item_name: "نوټ بوک", description: "A5 پاکستاني", unit: "دوجن", estimated_price: 120, item_code: "KU-STAT-0005" },
  { original_id: "KU1405-STAT-006", category: "قرطاسیه", item_name: "ثبت", description: "۲۰۰ پاڼې", unit: "عدد", estimated_price: 150, item_code: "KU-STAT-0006" },
  { original_id: "KU1405-STAT-007", category: "قرطاسیه", item_name: "جریده", description: "دفتري", unit: "عدد", estimated_price: 200, item_code: "KU-STAT-0007" },
  { original_id: "KU1405-STAT-008", category: "قرطاسیه", item_name: "خام دفتر", description: "A4", unit: "عدد", estimated_price: 100, item_code: "KU-STAT-0008" },
  { original_id: "KU1405-STAT-009", category: "قرطاسیه", item_name: "فاتورې", description: "سه نسخه ییزې", unit: "بسته", estimated_price: 250, item_code: "KU-STAT-0009" },
  { original_id: "KU1405-STAT-010", category: "قرطاسیه", item_name: "لیفافه", description: "لوی سپین A4", unit: "بسته", estimated_price: 120, item_code: "KU-STAT-0010" },
  { original_id: "KU1405-STAT-011", category: "قرطاسیه", item_name: "لیفافه", description: "کوچنی A5", unit: "بسته", estimated_price: 80, item_code: "KU-STAT-0011" },
  { original_id: "KU1405-STAT-012", category: "قرطاسیه", item_name: "پلاستیکي لیفافه", description: "A4 شفاف", unit: "بسته", estimated_price: 60, item_code: "KU-STAT-0012" },
  { original_id: "KU1405-STAT-013", category: "قرطاسیه", item_name: "کارډ بورډ", description: "A4 سپین", unit: "پاکټ", estimated_price: 250, item_code: "KU-STAT-0013" },
  { original_id: "KU1405-STAT-014", category: "قرطاسیه", item_name: "کاربن کاغذ", description: "A4 ازرق", unit: "بسته", estimated_price: 200, item_code: "KU-STAT-0014" },
  { original_id: "KU1405-STAT-015", category: "قرطاسیه", item_name: "لیبل", description: "سپین A4", unit: "پاکټ", estimated_price: 150, item_code: "KU-STAT-0015" },
  { original_id: "KU1405-STAT-016", category: "قرطاسیه", item_name: "پوست ایت", description: "رنګارنګ", unit: "پاکټ", estimated_price: 80, item_code: "KU-STAT-0016" },
  { original_id: "KU1405-STAT-017", category: "قرطاسیه", item_name: "ټیکه", description: "د کاغذ", unit: "بکس", estimated_price: 30, item_code: "KU-STAT-0017" },
  { original_id: "KU1405-STAT-018", category: "قرطاسیه", item_name: "مفتول", description: "کوچنی", unit: "بکس", estimated_price: 40, item_code: "KU-STAT-0018" },
  { original_id: "KU1405-STAT-019", category: "قرطاسیه", item_name: "مفتول", description: "لوی", unit: "بکس", estimated_price: 60, item_code: "KU-STAT-0019" },
  { original_id: "KU1405-STAT-020", category: "قرطاسیه", item_name: "جلد کتاب", description: "پلاستیکي", unit: "متر", estimated_price: 30, item_code: "KU-STAT-0020" },
  { original_id: "KU1405-STAT-021", category: "قرطاسیه", item_name: "لاستی", description: "رنګارنګ", unit: "بکس", estimated_price: 25, item_code: "KU-STAT-0021" },
  { original_id: "KU1405-STAT-022", category: "قرطاسیه", item_name: "سرنج", description: "د مارکر ډکولو", unit: "دوجن", estimated_price: 40, item_code: "KU-STAT-0022" },
  { original_id: "KU1405-STAT-023", category: "قرطاسیه", item_name: "رول ټیپ", description: "لوی", unit: "عدد", estimated_price: 50, item_code: "KU-STAT-0023" },
  { original_id: "KU1405-STAT-024", category: "قرطاسیه", item_name: "ګم", description: "مایع سپین", unit: "عدد", estimated_price: 40, item_code: "KU-STAT-0024" },
  { original_id: "KU1405-STAT-025", category: "قرطاسیه", item_name: "ماشین ګم", description: "د کاغذ لپاره", unit: "عدد", estimated_price: 30, item_code: "KU-STAT-0025" },
  { original_id: "KU1405-STAT-026", category: "قرطاسیه", item_name: "پلیت", description: "اکسل", unit: "عدد", estimated_price: 200, item_code: "KU-STAT-0026" },
  { original_id: "KU1405-STAT-027", category: "قرطاسیه", item_name: "چاپ کاغذ", description: "A4 لیزري", unit: "ریمه", estimated_price: 350, item_code: "KU-STAT-0027" },
  { original_id: "KU1405-STAT-028", category: "قرطاسیه", item_name: "فلوچارت", description: "A4 سپین", unit: "بسته", estimated_price: 100, item_code: "KU-STAT-0028" },
  { original_id: "KU1405-STAT-029", category: "قرطاسیه", item_name: "کوریر پاکټ", description: "A4 ازرق", unit: "بسته", estimated_price: 90, item_code: "KU-STAT-0029" },
  { original_id: "KU1405-STAT-030", category: "قرطاسیه", item_name: "ورق ثبت", description: "دبلوک", unit: "بسته", estimated_price: 80, item_code: "KU-STAT-0030" },
  { original_id: "KU1405-STAT-031", category: "قرطاسیه", item_name: "بلاک نوټ", description: "A5", unit: "دوجن", estimated_price: 120, item_code: "KU-STAT-0031" },
  { original_id: "KU1405-STAT-032", category: "قرطاسیه", item_name: "ورق A4", description: "د نقشې لپاره", unit: "پاکټ", estimated_price: 200, item_code: "KU-STAT-0032" },
  { original_id: "KU1405-STAT-033", category: "قرطاسیه", item_name: "ورق فوتو", description: "A4 لاسري", unit: "پاکټ", estimated_price: 300, item_code: "KU-STAT-0033" },
  { original_id: "KU1405-STAT-034", category: "قرطاسیه", item_name: "کاغذ پاکه", description: "A4 اصلي", unit: "بسته", estimated_price: 100, item_code: "KU-STAT-0034" },
  { original_id: "KU1405-STAT-035", category: "قرطاسیه", item_name: "لیفافه بوک", description: "A4 شفاف", unit: "عدد", estimated_price: 150, item_code: "KU-STAT-0035" },
  { original_id: "KU1405-STAT-036", category: "قرطاسیه", item_name: "کلیرفایل", description: "A4 شفاف", unit: "عدد", estimated_price: 100, item_code: "KU-STAT-0036" },
  { original_id: "KU1405-STAT-037", category: "قرطاسیه", item_name: "رپورت کاور", description: "A4", unit: "عدد", estimated_price: 50, item_code: "KU-STAT-0037" },
  { original_id: "KU1405-STAT-038", category: "قرطاسیه", item_name: "پرتوپل سیله", description: "پلاستیکي", unit: "عدد", estimated_price: 80, item_code: "KU-STAT-0038" },
  { original_id: "KU1405-STAT-039", category: "قرطاسیه", item_name: "مقوا ورق", description: "A4 رنګارنګ", unit: "پاکټ", estimated_price: 150, item_code: "KU-STAT-0039" },
  { original_id: "KU1405-STAT-040", category: "قرطاسیه", item_name: "پلاستیکي لیفافه", description: "A3", unit: "بسته", estimated_price: 100, item_code: "KU-STAT-0040" },
  { original_id: "KU1405-STAT-041", category: "قرطاسیه", item_name: "ورق اصلي", description: "کتاب A4", unit: "ریمه", estimated_price: 500, item_code: "KU-STAT-0041" },
  { original_id: "KU1405-STAT-042", category: "قرطاسیه", item_name: "سرتیفیکیټ کاغذ", description: "A4 لاسري", unit: "پاکټ", estimated_price: 400, item_code: "KU-STAT-0042" },
  { original_id: "KU1405-STAT-043", category: "قرطاسیه", item_name: "پاڼه فارم", description: "A4 دوه رویه", unit: "بسته", estimated_price: 150, item_code: "KU-STAT-0043" },
  { original_id: "KU1405-STAT-044", category: "قرطاسیه", item_name: "حضور ورق", description: "A4", unit: "بسته", estimated_price: 120, item_code: "KU-STAT-0044" },
  { original_id: "KU1405-STAT-045", category: "قرطاسیه", item_name: "امتحاني ورقه", description: "A4 وسط خط", unit: "بسته", estimated_price: 200, item_code: "KU-STAT-0045" },
  { original_id: "KU1405-STAT-046", category: "قرطاسیه", item_name: "امتحاني بوک", description: "16 پاڼې", unit: "دوجن", estimated_price: 120, item_code: "KU-STAT-0046" },
  { original_id: "KU1405-STAT-047", category: "قرطاسیه", item_name: "A4 ګروپ", description: "۵۰۰ پاڼې رنګي", unit: "پاکټ", estimated_price: 500, item_code: "KU-STAT-0047" },
  { original_id: "KU1405-STAT-048", category: "قرطاسیه", item_name: "شیلف لیبل", description: "کوچنی", unit: "پاکټ", estimated_price: 60, item_code: "KU-STAT-0048" },
  { original_id: "KU1405-STAT-049", category: "قرطاسیه", item_name: "نیم ورق", description: "A5 خط دار", unit: "بسته", estimated_price: 100, item_code: "KU-STAT-0049" },
  { original_id: "KU1405-STAT-050", category: "قرطاسیه", item_name: "پلاستیکي فولدر", description: "A4", unit: "عدد", estimated_price: 50, item_code: "KU-STAT-0050" },
  { original_id: "KU1405-STAT-051", category: "قرطاسیه", item_name: "فایل باکس", description: "پلاستیکي", unit: "عدد", estimated_price: 250, item_code: "KU-STAT-0051" },
  { original_id: "KU1405-STAT-052", category: "قرطاسیه", item_name: "ورق لیزري", description: "A4 اصلي", unit: "ریمه", estimated_price: 380, item_code: "KU-STAT-0052" },
  { original_id: "KU1405-STAT-053", category: "قرطاسیه", item_name: "اسناد باکس", description: "کارتني", unit: "عدد", estimated_price: 120, item_code: "KU-STAT-0053" },
  { original_id: "KU1405-STAT-054", category: "قرطاسیه", item_name: "ورق حساب", description: "A4 وسط", unit: "بسته", estimated_price: 130, item_code: "KU-STAT-0054" },
  { original_id: "KU1405-STAT-055", category: "قرطاسیه", item_name: "کاغذ سویني", description: "A5", unit: "بسته", estimated_price: 90, item_code: "KU-STAT-0055" },
  { original_id: "KU1405-STAT-056", category: "قرطاسیه", item_name: "نوټ پیډ", description: "A5 خط دار", unit: "دوجن", estimated_price: 110, item_code: "KU-STAT-0056" },
  { original_id: "KU1405-STAT-057", category: "قرطاسیه", item_name: "کاغذ اصلي", description: "A4 80g", unit: "کارتن", estimated_price: 4000, item_code: "KU-STAT-0057" },
  { original_id: "KU1405-STAT-058", category: "قرطاسیه", item_name: "فایل زپ", description: "A4", unit: "عدد", estimated_price: 60, item_code: "KU-STAT-0058" },
  { original_id: "KU1405-STAT-059", category: "قرطاسیه", item_name: "ثبت کوچنی", description: "۱۰۰ پاڼې", unit: "عدد", estimated_price: 80, item_code: "KU-STAT-0059" },
  { original_id: "KU1405-STAT-060", category: "قرطاسیه", item_name: "ثبت لوی", description: "۳۰۰ پاڼې", unit: "عدد", estimated_price: 200, item_code: "KU-STAT-0060" },
  { original_id: "KU1405-STAT-061", category: "قرطاسیه", item_name: "وریژه", description: "دفتري", unit: "دوجن", estimated_price: 70, item_code: "KU-STAT-0061" },
  { original_id: "KU1405-STAT-062", category: "قرطاسیه", item_name: "دوسیه", description: "A4 سیاه کارتني", unit: "دوجن", estimated_price: 180, item_code: "KU-STAT-0062" },
  { original_id: "KU1405-STAT-063", category: "قرطاسیه", item_name: "بانک فولدر", description: "A4 اصلي", unit: "دوجن", estimated_price: 240, item_code: "KU-STAT-0063" },
  { original_id: "KU1405-TONER-001", category: "ټونر", item_name: "ټونر HP 12A", description: "HP LaserJet 1010", unit: "عدد", estimated_price: 2500, item_code: "KU-TONER-0001" },
  { original_id: "KU1405-TONER-002", category: "ټونر", item_name: "ټونر HP 35A", description: "HP LaserJet P1005", unit: "عدد", estimated_price: 3000, item_code: "KU-TONER-0002" },
  { original_id: "KU1405-TONER-003", category: "ټونر", item_name: "ټونر HP 85A", description: "HP LaserJet P1102", unit: "عدد", estimated_price: 3200, item_code: "KU-TONER-0003" },
  { original_id: "KU1405-TONER-004", category: "ټونر", item_name: "ټونر HP 83A", description: "HP LaserJet M125", unit: "عدد", estimated_price: 3500, item_code: "KU-TONER-0004" },
  { original_id: "KU1405-TONER-005", category: "ټونر", item_name: "ټونر HP 26A", description: "HP LaserJet M402", unit: "عدد", estimated_price: 4000, item_code: "KU-TONER-0005" },
  { original_id: "KU1405-TONER-006", category: "ټونر", item_name: "ټونر HP 17A", description: "HP LaserJet M102", unit: "عدد", estimated_price: 2800, item_code: "KU-TONER-0006" },
  { original_id: "KU1405-TONER-007", category: "ټونر", item_name: "ټونر HP 48A", description: "HP LaserJet M15", unit: "عدد", estimated_price: 3000, item_code: "KU-TONER-0007" },
  { original_id: "KU1405-TONER-008", category: "ټونر", item_name: "ټونر HP CF230A", description: "HP LaserJet M203", unit: "عدد", estimated_price: 3500, item_code: "KU-TONER-0008" },
  { original_id: "KU1405-TONER-009", category: "ټونر", item_name: "ټونر HP 58A", description: "HP LaserJet M404", unit: "عدد", estimated_price: 4500, item_code: "KU-TONER-0009" },
  { original_id: "KU1405-TONER-010", category: "ټونر", item_name: "ټونر HP 59A", description: "HP LaserJet M304", unit: "عدد", estimated_price: 4200, item_code: "KU-TONER-0010" },
  { original_id: "KU1405-TONER-011", category: "ټونر", item_name: "ټونر Canon 303", description: "Canon LBP2900", unit: "عدد", estimated_price: 2500, item_code: "KU-TONER-0011" },
  { original_id: "KU1405-TONER-012", category: "ټونر", item_name: "ټونر Canon 325", description: "Canon LBP6000", unit: "عدد", estimated_price: 2800, item_code: "KU-TONER-0012" },
  { original_id: "KU1405-TONER-013", category: "ټونر", item_name: "ټونر Canon 328", description: "Canon MF4400", unit: "عدد", estimated_price: 3000, item_code: "KU-TONER-0013" },
  { original_id: "KU1405-TONER-014", category: "ټونر", item_name: "ټونر Canon 737", description: "Canon MF211", unit: "عدد", estimated_price: 3200, item_code: "KU-TONER-0014" },
  { original_id: "KU1405-TONER-015", category: "ټونر", item_name: "ټونر Canon 052", description: "Canon LBP212", unit: "عدد", estimated_price: 3800, item_code: "KU-TONER-0015" },
  { original_id: "KU1405-TONER-016", category: "ټونر", item_name: "ټونر Samsung MLT-D101", description: "Samsung ML2160", unit: "عدد", estimated_price: 2500, item_code: "KU-TONER-0016" },
  { original_id: "KU1405-TONER-017", category: "ټونر", item_name: "ټونر Samsung 104", description: "Samsung ML1660", unit: "عدد", estimated_price: 2200, item_code: "KU-TONER-0017" },
  { original_id: "KU1405-TONER-018", category: "ټونر", item_name: "ټونر Brother TN2280", description: "Brother HL2130", unit: "عدد", estimated_price: 3000, item_code: "KU-TONER-0018" },
  { original_id: "KU1405-TONER-019", category: "ټونر", item_name: "ټونر Brother TN-2321", description: "Brother HL-L2300", unit: "عدد", estimated_price: 3200, item_code: "KU-TONER-0019" },
  { original_id: "KU1405-TONER-020", category: "ټونر", item_name: "ټونر HP C4127X", description: "HP LaserJet 4000", unit: "عدد", estimated_price: 5000, item_code: "KU-TONER-0020" },
  { original_id: "KU1405-TONER-021", category: "ټونر", item_name: "ټونر Epson M200", description: "Epson WorkForce", unit: "عدد", estimated_price: 4000, item_code: "KU-TONER-0021" },
  { original_id: "KU1405-TONER-022", category: "ټونر", item_name: "ټونر Kyocera TK1110", description: "Kyocera FS1040", unit: "عدد", estimated_price: 3500, item_code: "KU-TONER-0022" },
  { original_id: "KU1405-TONER-023", category: "ټونر", item_name: "ټونر Ricoh SP200", description: "Ricoh Aficio", unit: "عدد", estimated_price: 3000, item_code: "KU-TONER-0023" },
  { original_id: "KU1405-TONER-024", category: "ټونر", item_name: "ټونر Pantum P2200", description: "Pantum P2200", unit: "عدد", estimated_price: 2500, item_code: "KU-TONER-0024" },
  { original_id: "KU1405-TONER-025", category: "ټونر", item_name: "ټونر Lexmark E120", description: "Lexmark E120", unit: "عدد", estimated_price: 2800, item_code: "KU-TONER-0025" },
  { original_id: "KU1405-TONER-026", category: "ټونر", item_name: "رول کاغذ فکس", description: "A4 رول", unit: "عدد", estimated_price: 250, item_code: "KU-TONER-0026" },
  { original_id: "KU1405-TONER-027", category: "ټونر", item_name: "ريبن ماشین", description: "دست کاري", unit: "عدد", estimated_price: 500, item_code: "KU-TONER-0027" },
  { original_id: "KU1405-TONER-028", category: "ټونر", item_name: "ریبن بارکوډ", description: "ریزه", unit: "عدد", estimated_price: 1500, item_code: "KU-TONER-0028" },
  { original_id: "KU1405-TONER-029", category: "ټونر", item_name: "ټونر HP 81A", description: "HP M630", unit: "عدد", estimated_price: 4500, item_code: "KU-TONER-0029" },
  { original_id: "KU1405-TONER-030", category: "ټونر", item_name: "ټونر HP 87A", description: "HP M506", unit: "عدد", estimated_price: 5000, item_code: "KU-TONER-0030" },
  { original_id: "KU1405-TONER-031", category: "ټونر", item_name: "ټونر HP 89A", description: "HP M507", unit: "عدد", estimated_price: 5500, item_code: "KU-TONER-0031" },
  { original_id: "KU1405-TONER-032", category: "ټونر", item_name: "ټونر HP 37A", description: "HP M608", unit: "عدد", estimated_price: 6000, item_code: "KU-TONER-0032" },
];

// ── Category name → category_id mapping ──────────────────────────────
const CATEGORY_MAP: Record<string, number> = {
  'صفایي': 7,      // نظافت
  'فرنیچري': 3,    // فرنیچر
  'کمپیوټري': 2,   // کمپیوټري وسایل
  'دفتري': 1,      // قرطاسیه
  'قرطاسیه': 1,    // قرطاسیه
  'ټونر': 2,       // کمپیوټري وسایل
};

// ── Unit name → unit_id mapping ───────────────────────────────────────
const UNIT_MAP: Record<string, number> = {
  'ریمه': 1,
  'دانه': 2,
  'متر': 3,
  'بسته': 4,
  'قطۍ': 2,
  'بکس': 2,
  'دوجن': 2,
  'کارتن': 2,
  'پاکټ': 4,
  'عدد': 2,
  'بوتل': 2,
  'بست': 4,
};

export class ChecklistService {
  static async runMigrations() {
    const connection = await db.getConnection();
    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS checklist_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          original_id VARCHAR(50),
          category VARCHAR(100) NOT NULL,
          item_name VARCHAR(300) NOT NULL,
          description TEXT,
          unit VARCHAR(50),
          estimated_price DECIMAL(15,2) DEFAULT 0,
          item_code VARCHAR(50) UNIQUE,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          deleted_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_cl_category (category),
          INDEX idx_cl_item_code (item_code),
          INDEX idx_cl_active (is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      const alterations = [
        `ALTER TABLE checklist_items ADD COLUMN inventory_item_id INT DEFAULT NULL`,
        `ALTER TABLE checklist_items ADD COLUMN quantity INT NOT NULL DEFAULT 0`,
        `ALTER TABLE stock_transactions ADD COLUMN supplier_name VARCHAR(300) DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN document_reference VARCHAR(200) DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN unit_price DECIMAL(15,2) DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN receiver_name VARCHAR(200) DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN receiver_id_no VARCHAR(100) DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN faculty_id INT DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN department_id INT DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN person_id INT DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN linked_request_id INT DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN fs5_reference VARCHAR(100) DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN academic_level VARCHAR(100) DEFAULT NULL`,
        `ALTER TABLE stock_transactions ADD COLUMN assignment_qr_payload JSON DEFAULT NULL`,
      ];
      for (const sql of alterations) {
        try { await connection.query(sql); } catch (e: any) { if (!e.message?.includes('Duplicate column')) throw e; }
      }

      for (const item of SEED_DATA) {
        try {
          await connection.query(
            `INSERT IGNORE INTO checklist_items (original_id, category, item_name, description, unit, estimated_price, item_code, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
            [item.original_id, item.category, item.item_name, item.description, item.unit, item.estimated_price, item.item_code]
          );
          await connection.query(
            `UPDATE checklist_items SET deleted_at = NULL, is_active = TRUE
             WHERE original_id = ? AND (deleted_at IS NOT NULL OR is_active = FALSE)`,
            [item.original_id]
          );
        } catch (_) {}
      }
      console.log(`[WMS] Checklist seed verified: ${SEED_DATA.length} items ensured active.`);

      // ── Sync checklist_items → items (inventory) ──────────────────────────
      const syncResult = await ChecklistService.syncChecklistToInventory(connection);
      console.log(`[WMS] Checklist→inventory sync: ${syncResult.created} created, ${syncResult.existing} already exist.`);

      // ── Link existing request_items with missing item_ids to inventory ─────
      await ChecklistService.linkExistingRequestItems(connection);

    } finally {
      connection.release();
    }
  }

  /**
   * Ensures every active checklist_items row has a corresponding entry in the
   * `items` (inventory) table. Uses item_code as the primary match key.
   */
  static async syncChecklistToInventory(connection?: any): Promise<{ created: number; existing: number }> {
    const conn = connection || db;
    const [checklistRows] = await conn.query(
      `SELECT ci.* FROM checklist_items ci WHERE ci.is_active = TRUE AND ci.deleted_at IS NULL`
    );

    let created = 0;
    let existing = 0;

    for (const cl of checklistRows as any[]) {
      // Check if this item already exists in inventory by item_code
      const [invRows] = await conn.query(
        `SELECT id FROM items WHERE item_code = ? AND is_deleted = FALSE LIMIT 1`,
        [cl.item_code]
      );

      if (invRows.length > 0) {
        existing++;
        // Update the checklist_items.inventory_item_id if not already set
        if (!cl.inventory_item_id || Number(cl.inventory_item_id) !== Number((invRows[0] as any).id)) {
          await conn.query(
            `UPDATE checklist_items SET inventory_item_id = ? WHERE id = ?`,
            [(invRows[0] as any).id, cl.id]
          );
        }
        continue;
      }

      // Check by item_name (name_ps) as fallback
      const [byNameRows] = await conn.query(
        `SELECT id FROM items WHERE name_ps = ? AND is_deleted = FALSE LIMIT 1`,
        [cl.item_name]
      );

      if (byNameRows.length > 0) {
        existing++;
        await conn.query(
          `UPDATE checklist_items SET inventory_item_id = ? WHERE id = ?`,
          [(byNameRows[0] as any).id, cl.id]
        );
        continue;
      }

      // Not found in inventory → auto-create
      const categoryId = CATEGORY_MAP[cl.category] || 1;
      const unitId = UNIT_MAP[cl.unit] || 2; // default to 'عدد'
      const warehouseId = 1; // default warehouse

      try {
        const [insertResult] = await conn.query(
          `INSERT INTO items (item_code, name_ps, name_fa, description, category_id, unit_id, warehouse_id,
            minimum_stock, unit_price, current_stock, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, FALSE)`,
          [cl.item_code, cl.item_name, cl.item_name, cl.description || '',
           categoryId, unitId, warehouseId, cl.estimated_price || 0]
        );

        const newItemId = (insertResult as ResultSetHeader).insertId;
        // Generate tracking code
        const year = new Date().getFullYear();
        const trackingCode = `KDR-WMS-${year}-${String(newItemId).padStart(6, '0')}`;
        await conn.query(
          `UPDATE items SET tracking_code = ?, barcode_generated_at = NOW() WHERE id = ?`,
          [trackingCode, newItemId]
        );
        // Link back to checklist
        await conn.query(
          `UPDATE checklist_items SET inventory_item_id = ? WHERE id = ?`,
          [newItemId, cl.id]
        );
        created++;
      } catch (err: any) {
        // If item_code already exists somehow
        if (err.code === 'ER_DUP_ENTRY') {
          existing++;
        } else {
          console.warn(`[WMS] Failed to create inventory item for checklist #${cl.id} "${cl.item_name}":`, err.message);
        }
      }
    }

    return { created, existing };
  }

  /**
   * Links request_items that have null/0 item_id to their corresponding
   * inventory items (via checklist_items → items mapping).
   */
  static async linkExistingRequestItems(connection?: any): Promise<number> {
    const conn = connection || db;
    const [orphanRows] = await conn.query(`
      SELECT ri.id AS ri_id, ri.request_id, ri.item_id, ri.item_name, ci.inventory_item_id
      FROM request_items ri
      LEFT JOIN checklist_items ci ON (ci.item_name = ri.item_name AND ci.is_active = TRUE)
      WHERE (ri.item_id IS NULL OR ri.item_id = 0)
        AND ri.item_name IS NOT NULL
        AND ri.item_name != ''
    `);

    let fixed = 0;
    for (const row of orphanRows as any[]) {
      let invId = row.inventory_item_id;
      if (!invId) {
        // Try to look up directly in items table
        const [items] = await conn.query(
          `SELECT id FROM items WHERE (name_ps = ? OR name_fa = ?) AND is_deleted = FALSE LIMIT 1`,
          [row.item_name, row.item_name]
        );
        invId = items.length > 0 ? items[0].id : null;
      }
      if (invId) {
        await conn.query(
          `UPDATE request_items SET item_id = ? WHERE id = ?`,
          [invId, row.ri_id]
        );
        fixed++;
      }
    }
    if (fixed > 0) {
      console.log(`[WMS] Linked ${fixed} orphaned request_items to inventory items.`);
    }
    return fixed;
  }

  static async getAll(filters: { category?: string; search?: string; active_only?: boolean }) {
    let query = `
      SELECT ci.*,
             (SELECT ii.current_stock FROM items ii
              WHERE ii.is_deleted = FALSE AND (
                ii.id = ci.inventory_item_id
                OR ii.item_code = ci.item_code
                OR ii.name_ps = ci.item_name
              )
              ORDER BY CASE
                WHEN ii.id = ci.inventory_item_id THEN 1
                WHEN ii.item_code = ci.item_code THEN 2
                ELSE 3
              END LIMIT 1) AS current_stock,
             (SELECT ii.unit_price FROM items ii
              WHERE ii.is_deleted = FALSE AND (
                ii.id = ci.inventory_item_id
                OR ii.item_code = ci.item_code
                OR ii.name_ps = ci.item_name
              )
              ORDER BY CASE
                WHEN ii.id = ci.inventory_item_id THEN 1
                WHEN ii.item_code = ci.item_code THEN 2
                ELSE 3
              END LIMIT 1) AS inv_unit_price
      FROM checklist_items ci
      WHERE ci.deleted_at IS NULL`;
    const params: any[] = [];
    if (filters.active_only !== false) {
      query += ` AND ci.is_active = TRUE`;
    }
    if (filters.category) {
      query += ` AND ci.category = ?`;
      params.push(filters.category);
    }
    if (filters.search) {
      query += ` AND (ci.item_name LIKE ? OR ci.description LIKE ? OR ci.item_code LIKE ?)`;
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    query += ` ORDER BY ci.category ASC, ci.item_name ASC`;
    const [rows] = await db.query(query, params);
    return rows;
  }

  static async getCategories() {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT DISTINCT category FROM checklist_items WHERE deleted_at IS NULL ORDER BY category ASC`
    );
    return (rows as any[]).map((r: any) => r.category);
  }

  static async getById(id: number) {
    const [rows] = await db.query<RowDataPacket[]>(`SELECT * FROM checklist_items WHERE id = ? AND deleted_at IS NULL`, [id]);
    return (rows as any[])[0] || null;
  }

  static async create(data: {
    category: string; item_name: string; description?: string; unit?: string;
    estimated_price?: number; item_code?: string; inventory_item_id?: number | null;
  }) {
    const itemCode = data.item_code || await ChecklistService.generateItemCode(data.category);
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO checklist_items (category, item_name, description, unit, estimated_price, item_code, inventory_item_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`,
      [data.category, data.item_name, data.description || null, data.unit || null,
       data.estimated_price || 0, itemCode, data.inventory_item_id || null]
    );

    // Auto-create the corresponding inventory item
    const newId = result.insertId;
    let inventoryItemId = data.inventory_item_id || null;

    try {
      if (!inventoryItemId) {
        const categoryId = CATEGORY_MAP[data.category] || 1;
        const unitId = UNIT_MAP[data.unit || ''] || 2;
        const [inventoryResult] = await db.query<ResultSetHeader>(
          `INSERT INTO items (item_code, name_ps, name_fa, description, category_id, unit_id, warehouse_id,
            minimum_stock, unit_price, current_stock, is_deleted)
           VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, 0, FALSE)`,
          [itemCode, data.item_name, data.item_name, data.description || '',
           categoryId, unitId, data.estimated_price || 0]
        );
        inventoryItemId = inventoryResult.insertId;

        const year = new Date().getFullYear();
        const trackingCode = `KDR-WMS-${year}-${String(inventoryItemId).padStart(6, '0')}`;
        await db.query(
          `UPDATE items SET tracking_code = ?, barcode_generated_at = NOW() WHERE id = ?`,
          [trackingCode, inventoryItemId]
        );
      }

      await db.query(
        `UPDATE checklist_items SET inventory_item_id = ? WHERE id = ?`,
        [inventoryItemId, newId]
      );
    } catch (err: any) {
      // The checklist row is still valid even if an old inventory schema/data
      // prevents automatic linking. Keep the failure visible in the server log.
      console.warn(`[WMS] Checklist item #${newId} created, but inventory sync failed:`, err.message);
    }

    return ChecklistService.getById(newId);
  }

  static async update(id: number, data: Partial<{
    category: string; item_name: string; description: string; unit: string;
    estimated_price: number; item_code: string; inventory_item_id: number | null;
    quantity: number; is_active: boolean;
  }>) {
    const existing = await ChecklistService.getById(id) as any;
    if (!existing) return null;

    const fields: string[] = [];
    const values: any[] = [];
    const allowed = [
      'category', 'item_name', 'description', 'unit', 'estimated_price',
      'item_code', 'inventory_item_id', 'quantity', 'is_active'
    ] as const;

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) return existing;
    values.push(id);
    await db.query(
      `UPDATE checklist_items SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
      values
    );

    const updated = await ChecklistService.getById(id) as any;
    if (!updated) return null;

    const inventoryId = updated.inventory_item_id;
    if (inventoryId) {
      try {
        const inventoryFields: string[] = [];
        const inventoryValues: any[] = [];
        if (data.item_code !== undefined) { inventoryFields.push('item_code = ?'); inventoryValues.push(data.item_code); }
        if (data.item_name !== undefined) {
          inventoryFields.push('name_ps = ?', 'name_fa = ?');
          inventoryValues.push(data.item_name, data.item_name);
        }
        if (data.description !== undefined) { inventoryFields.push('description = ?'); inventoryValues.push(data.description || ''); }
        if (data.estimated_price !== undefined) { inventoryFields.push('unit_price = ?'); inventoryValues.push(data.estimated_price || 0); }
        if (data.category !== undefined) { inventoryFields.push('category_id = ?'); inventoryValues.push(CATEGORY_MAP[data.category] || 1); }
        if (data.unit !== undefined) { inventoryFields.push('unit_id = ?'); inventoryValues.push(UNIT_MAP[data.unit] || 2); }
        if (inventoryFields.length > 0) {
          inventoryValues.push(inventoryId);
          await db.query(`UPDATE items SET ${inventoryFields.join(', ')} WHERE id = ?`, inventoryValues);
        }
      } catch (err: any) {
        console.warn(`[WMS] Inventory link update failed for checklist #${id}:`, err.message);
      }
    }

    return updated;
  }

  static async softDelete(id: number): Promise<void> {
    await db.query(
      `UPDATE checklist_items
       SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
  }

  static async generateItemCode(category: string): Promise<string> {
    const knownPrefix = Object.entries(CATEGORY_MAP).find(([name]) => name === category)?.[0];
    const prefixMap: Record<string, string> = {
      'صفایي': 'CLEAN', 'فرنیچري': 'FURN', 'کمپیوټري': 'COMP',
      'دفتري': 'OFFC', 'قرطاسیه': 'STAT', 'ټونر': 'TONER'
    };
    const prefix = prefixMap[knownPrefix || category] || 'ITEM';
    const likePattern = `KU-${prefix}-%`;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT item_code FROM checklist_items WHERE item_code LIKE ? ORDER BY id DESC LIMIT 1`,
      [likePattern]
    );
    let next = 1;
    if (rows.length > 0) {
      const match = String((rows[0] as any).item_code || '').match(/(\d+)$/);
      if (match) next = Number(match[1]) + 1;
    }
    return `KU-${prefix}-${String(next).padStart(4, '0')}`;
  }

  static async validateBulkForDuplicates(rows: any[]): Promise<Array<{ row: number; field: string; message: string }>> {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const seenCodes = new Map<string, number>();
    const seenNames = new Map<string, number>();

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] || {};
      const rowNo = index + 1;
      const category = String(row.category || '').trim();
      const itemName = String(row.item_name || row.itemName || '').trim();
      const itemCode = String(row.item_code || row.itemCode || '').trim();

      if (!category) errors.push({ row: rowNo, field: 'category', message: 'کټګوري اړینه ده.' });
      if (!itemName) errors.push({ row: rowNo, field: 'item_name', message: 'د جنس نوم اړین دی.' });

      if (itemCode) {
        if (seenCodes.has(itemCode)) {
          errors.push({ row: rowNo, field: 'item_code', message: `دا جنس کوډ په همدې فایل کې تکرار شوی (کرښه ${seenCodes.get(itemCode)}).` });
        } else {
          seenCodes.set(itemCode, rowNo);
        }
      }

      if (category && itemName) {
        const nameKey = `${category}::${itemName}`.toLowerCase();
        if (seenNames.has(nameKey)) {
          errors.push({ row: rowNo, field: 'item_name', message: `دا جنس په همدې کټګورۍ کې تکرار شوی (کرښه ${seenNames.get(nameKey)}).` });
        } else {
          seenNames.set(nameKey, rowNo);
        }
      }
    }

    const codes = Array.from(seenCodes.keys());
    if (codes.length > 0) {
      const placeholders = codes.map(() => '?').join(',');
      const [existing] = await db.query<RowDataPacket[]>(
        `SELECT item_code FROM checklist_items WHERE item_code IN (${placeholders}) AND deleted_at IS NULL`,
        codes
      );
      const existingCodes = new Set((existing as any[]).map(row => String(row.item_code)));
      rows.forEach((row, index) => {
        const code = String(row?.item_code || row?.itemCode || '').trim();
        if (code && existingCodes.has(code)) {
          errors.push({ row: index + 1, field: 'item_code', message: 'دا جنس کوډ مخکې په سیستم کې موجود دی.' });
        }
      });
    }

    return errors;
  }
}
