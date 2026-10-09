import { ResultSetHeader, RowDataPacket } from 'mysql2';
import db from '../config/db';
import { InventoryService } from './inventory.service';

// ── Map Pashto/Dari priority labels → DB ENUM ────────────────────────────────
function normalizeRequestLevel(level: string): 'URGENT' | 'NORMAL' | 'LOW' {
  if (!level) return 'NORMAL';
  const s = level.trim();
  if (['URGENT', 'NORMAL', 'LOW'].includes(s)) return s as 'URGENT' | 'NORMAL' | 'LOW';
  // Pashto urgent
  if (['ډېر عاجل', 'ډیر عاجل', 'عاجل', 'بسیار عاجل', 'فوري', 'urgent'].includes(s)) return 'URGENT';
  // Pashto high-importance
  if (['ډېر مهم', 'ډیر مهم', 'بسیار مهم', 'خورا مهم'].includes(s)) return 'URGENT';
  // Pashto low
  if (['لږ مهم', 'کم‌اهمیت', 'کم اهمیت', 'low'].includes(s)) return 'LOW';
  // Pashto normal / متوسط
  if (['عادي', 'عادی', 'متوسط', 'normal'].includes(s)) return 'NORMAL';
  return 'NORMAL';
}

// ── Workflow stage configuration ─────────────────────────────────────────────
const STAGE_MAP: Record<string, {
  progress: number; stage_ps: string;
  assignedRole: string; nextAction: string; complete: boolean;
}> = {
  Draft:                        { progress: 0,   stage_ps: 'غوښتنه جوړه شوه',                  assignedRole: 'REQUESTER',             nextAction: 'غوښتنه بیاکتنې ته واستوئ',            complete: false },
  PendingReview:                { progress: 0,   stage_ps: 'د لومړني بیاکتنې انتظار کې',       assignedRole: 'REQUEST_CONFIRMER',     nextAction: 'غوښتنه وکتل سي / پیشنهاد منظور کړئ', complete: false },
  ReviewReturned:               { progress: 0,   stage_ps: 'بیاکتنې سره بیرته راستانه شوه',   assignedRole: 'REQUESTER',             nextAction: 'ملاحظې سمه کړئ او بیا واستوئ',        complete: false },
  Submitted:                    { progress: 0,   stage_ps: 'غوښتنه رسمي واستول شوه',           assignedRole: 'REQUEST_CONFIRMER',     nextAction: 'غوښتنه تاییدول یا ردول',              complete: false },
  ConfirmedByRequestConfirmer:  { progress: 5,   stage_ps: 'د تایید کوونکي لخوا تایید شوه',      assignedRole: 'SUPER_ADMIN',           nextAction: 'غوښتنه منظورول یا ردول',              complete: false },
  RejectedByRequestConfirmer:   { progress: 0,   stage_ps: 'د تایید کوونکي لخوا رد شوه',        assignedRole: 'REQUESTER',             nextAction: 'غوښتنه بیاکتنه وکړئ',                complete: false },
  ApprovedBySuperAdmin:         { progress: 10,  stage_ps: 'د لوی مدیر لخوا منظور شوه',         assignedRole: 'ADMIN',                 nextAction: 'موجودي وګورئ او راجع کړئ',            complete: false },
  RejectedBySuperAdmin:         { progress: 0,   stage_ps: 'د لوی مدیر لخوا رد شوه',           assignedRole: 'REQUESTER',             nextAction: 'غوښتنه بیاکتنه وکړئ',                complete: false },
  ReturnedToSuperAdmin:         { progress: 10,  stage_ps: 'بیا کتنې ته سوپر اډمین ته راستانه شوه', assignedRole: 'SUPER_ADMIN',          nextAction: 'غوښتنه بیاکتنه وکړئ',                  complete: false },
  RejectedByAdmin:              { progress: 0,   stage_ps: 'د اډمین لخوا رد شوه',               assignedRole: 'REQUESTER',             nextAction: 'غوښتنه بیاکتنه وکړئ',                complete: false },
  StockAvailable:               { progress: 20,  stage_ps: 'ګودام ته راجع شو',                 assignedRole: 'WAREHOUSE_DIRECTOR',    nextAction: 'اجناس چمتو کړئ',                      complete: false },
  StockNotAvailable:            { progress: 20,  stage_ps: 'تدارکاتو ته راجع شو',              assignedRole: 'PROCUREMENT_DIRECTOR',  nextAction: 'د تدارکاتو پروسه پیل کړئ',           complete: false },
  ProcurementPending:           { progress: 25,  stage_ps: 'تدارکات پیل شول',                  assignedRole: 'PROCUREMENT_DIRECTOR',  nextAction: 'مناقصه جوړه کړئ',                    complete: false },
  TenderCreated:                { progress: 35,  stage_ps: 'مناقصه جوړه شوه',                  assignedRole: 'PROCUREMENT_DIRECTOR',  nextAction: 'آفرونه راټول کړئ',                   complete: false },
  OffersReceived:               { progress: 45,  stage_ps: 'آفرونه ترلاسه شول',                assignedRole: 'PROCUREMENT_DIRECTOR',  nextAction: 'آفرونه پرتله کړئ',                   complete: false },
  ComparisonCreated:            { progress: 55,  stage_ps: 'پرتلنه جوړه شوه',                  assignedRole: 'PROCUREMENT_DIRECTOR',  nextAction: 'بریالی وټاکئ',                       complete: false },
  WinnerSelected:               { progress: 65,  stage_ps: 'بریالی وټاکل شو',                  assignedRole: 'PROCUREMENT_DIRECTOR',  nextAction: 'د خریدارۍ امر جوړ کړئ',             complete: false },
  PurchaseOrderCreated:         { progress: 70,  stage_ps: 'د خریدارۍ امر جوړ شو',            assignedRole: 'WAREHOUSE_DIRECTOR',    nextAction: 'اجناس ترلاسه کړئ',                   complete: false },
  ReceiptReportCreated:         { progress: 75,  stage_ps: 'د اخیستلو راپور جوړ شو',           assignedRole: 'WAREHOUSE_DIRECTOR',    nextAction: 'اجناس ګودام ته داخل کړئ',           complete: false },
  ReceivedToInventory:          { progress: 80,  stage_ps: 'اجناس ګودام ته داخل شول',          assignedRole: 'WAREHOUSE_DIRECTOR',    nextAction: 'ف.س-۵ جوړ کړئ',                     complete: false },
  FS5Required:                  { progress: 82,  stage_ps: 'د پیشنهاد او ف.س-۵ غوښتنه',         assignedRole: 'REQUESTER',             nextAction: 'پیشنهاد او ف.س-۵ جوړ او واستوئ',    complete: false },
  DeliveryFormsRequested:       { progress: 82,  stage_ps: 'اجناس ګدام ته داخل شول - د تسلیمۍ فورمونه غوښتل شوي', assignedRole: 'REQUESTER', nextAction: 'د تسلیمۍ لپاره پیشنهاد او ف.س-۵ جوړ او واستوئ', complete: false },
  DeliveryReviewReturned:       { progress: 82,  stage_ps: 'د تسلیمۍ فورمونه د سمون لپاره بیرته راستانه شول', assignedRole: 'REQUESTER', nextAction: 'پیشنهاد او ف.س-۵ سم کړئ او بیا یې واستوئ', complete: false },
  DeliveryFormsSubmitted:       { progress: 84,  stage_ps: 'د تسلیمۍ پیشنهاد او ف.س-۵ تایید ته واستول شول', assignedRole: 'REQUEST_CONFIRMER', nextAction: 'د تسلیمۍ فورمونه تایید یا رد کړئ', complete: false },
  DeliveryConfirmedByRequestConfirmer: { progress: 86, stage_ps: 'د تسلیمۍ فورمونه د تایید کوونکي لخوا تایید شول', assignedRole: 'SUPER_ADMIN', nextAction: 'منظورول یا ردول', complete: false },
  DeliveryRejectedByRequestConfirmer:  { progress: 82, stage_ps: 'د تسلیمۍ فورمونه د تایید کوونکي لخوا رد شول', assignedRole: 'REQUESTER', nextAction: 'بیاکتنه وکړئ', complete: false },
  DeliveryReturnedToConfirmer:  { progress: 84,  stage_ps: 'د مقام لخوا تایید کوونکي ته د تسلیمۍ فورمونه بیرته راستانه شول', assignedRole: 'REQUEST_CONFIRMER', nextAction: 'بیا یې وڅېړئ او واستوئ', complete: false },
  DeliveryApprovedBySuperAdmin: { progress: 88,  stage_ps: 'د تسلیمۍ فورمونه د مقام لخوا منظور شول', assignedRole: 'ADMIN', nextAction: 'ګدام ته راجع کړئ، رد یې کړئ، یا بیرته یې واستوئ', complete: false },
  DeliveryRejectedBySuperAdmin: { progress: 82,  stage_ps: 'د تسلیمۍ فورمونه د مقام لخوا رد شول', assignedRole: 'REQUESTER', nextAction: 'بیاکتنه وکړئ', complete: false },
  DeliveryReturnedToSuperAdmin: { progress: 88,  stage_ps: 'د اډمین لخوا مقام ته د بیاکتنې لپاره راستانه شول', assignedRole: 'SUPER_ADMIN', nextAction: 'بیا یې وڅېړئ', complete: false },
  DeliveryRejectedByAdmin:      { progress: 82,  stage_ps: 'د تسلیمۍ فورمونه د اډمین لخوا رد شول', assignedRole: 'REQUESTER', nextAction: 'بیاکتنه وکړئ', complete: false },
  DeliveryReferredToWarehouse:  { progress: 90,  stage_ps: 'د تسلیمۍ لپاره ګدام ته راجع شو', assignedRole: 'WAREHOUSE_DIRECTOR', nextAction: 'اجناس د تایید شوي ف.س-۵ له مخې وسپارئ', complete: false },
  FS5Created:                   { progress: 90,  stage_ps: 'ف.س-۵ جوړ شو',                    assignedRole: 'WAREHOUSE_DIRECTOR',    nextAction: 'اجناس وسپارئ',                       complete: false },
  Delivered:                    { progress: 100, stage_ps: 'اجناس وسپارل شول',                 assignedRole: 'NONE',                  nextAction: 'بشپړه',                               complete: true  },
  Completed:                    { progress: 100, stage_ps: 'بشپړه شوه',                        assignedRole: 'NONE',                  nextAction: 'بشپړه',                               complete: true  },
  // Legacy/canonical statuses
  PENDING:                      { progress: 0,   stage_ps: 'غوښتنه واستول شوه',                 assignedRole: 'REQUEST_CONFIRMER',     nextAction: 'غوښتنه تاییدول',                      complete: false },
  CONFIRMED:                    { progress: 5,   stage_ps: 'تایید شوه',                        assignedRole: 'SUPER_ADMIN',           nextAction: 'منظورول',                             complete: false },
  SENT_TO_PROCUREMENT:          { progress: 25,  stage_ps: 'تدارکاتو ته لیږل شوه',             assignedRole: 'PROCUREMENT_DIRECTOR',  nextAction: 'تدارکات',                             complete: false },
  READY_FOR_DELIVERY:           { progress: 80,  stage_ps: 'د سپارلو لپاره چمتو دی',           assignedRole: 'WAREHOUSE_DIRECTOR',    nextAction: 'اجناس وسپارئ',                       complete: false },
  DELIVERED:                    { progress: 100, stage_ps: 'وسپارل شول',                       assignedRole: 'NONE',                  nextAction: 'بشپړه',                               complete: true  },
  COMPLETED:                    { progress: 100, stage_ps: 'بشپړه',                            assignedRole: 'NONE',                  nextAction: 'بشپړه',                               complete: true  },
  REJECTED:                     { progress: 0,   stage_ps: 'رد شوه',                           assignedRole: 'REQUESTER',             nextAction: 'بیاکتنه',                             complete: false },
};

export class RequestService {
  static async runMigrations() {
    const { withRetry } = await import('../utils/migrationHelper');

    await withRetry(() => db.query(`ALTER TABLE request_items ADD COLUMN unit_price DECIMAL(15,2) DEFAULT 0`)).catch(() => {});
    await withRetry(() => db.query(`ALTER TABLE request_items ADD COLUMN total_price DECIMAL(15,2) DEFAULT 0`)).catch(() => {});
    await withRetry(() => db.query(`ALTER TABLE request_items ADD COLUMN unit_name VARCHAR(100) DEFAULT ''`)).catch(() => {});

    await withRetry(() => db.query(`ALTER TABLE requests MODIFY COLUMN status VARCHAR(100) DEFAULT 'Submitted'`)).catch(() => {});
    await withRetry(() => db.query(`ALTER TABLE requests ADD COLUMN current_stage VARCHAR(100) NULL`)).catch(() => {});
    await withRetry(() => db.query(`ALTER TABLE requests ADD COLUMN assigned_role VARCHAR(100) NULL`)).catch(() => {});
    await withRetry(() => db.query(`ALTER TABLE requests ADD COLUMN faculty_name_text VARCHAR(255) NULL`)).catch(() => {});
    await withRetry(() => db.query(`ALTER TABLE requests ADD COLUMN department_name_text VARCHAR(255) NULL`)).catch(() => {});
    await withRetry(() => db.query(`ALTER TABLE requests ADD COLUMN requester_name_text VARCHAR(150) NULL`)).catch(() => {});

    await withRetry(() => db.query(`
      UPDATE requests
      SET current_stage = 'REQUEST_CONFIRMER',
          assigned_role = 'REQUEST_CONFIRMER'
      WHERE (current_stage IS NULL OR current_stage = '')
        AND status IN ('Submitted','PENDING','submitted')
        AND is_deleted = FALSE
    `)).catch(() => {});

    await withRetry(() => db.query(`
      UPDATE requests
      SET current_stage = 'REQUESTER',
          assigned_role = 'REQUESTER',
          progress_percent = GREATEST(progress_percent, 82)
      WHERE status = 'FS5Required'
        AND is_deleted = FALSE
    `)).catch(() => {});

    // Older hosted requests were created with the controller's fallback
    // system user (id=1). Re-link only unambiguous requester/person matches.
    await withRetry(() => db.query(`
      UPDATE requests r
      INNER JOIN users u
        ON u.person_id = r.person_id
       AND u.status = 'active'
       AND u.is_deleted = FALSE
      INNER JOIN roles role
        ON role.id = u.role_id
       AND role.name = 'Requester'
      SET r.requester_id = u.id
      WHERE r.requester_id = 1
        AND r.person_id IS NOT NULL
        AND (r.requester_name_text = u.name OR r.requester_name_text IS NULL)
        AND r.is_deleted = FALSE
    `)).catch(() => {});

    // Some requests created during the hosted cut-over used system user 1 and
    // had no person_id. Re-link only an exact, unique active Requester name.
    await withRetry(() => db.query(`
      UPDATE requests r
      INNER JOIN (
        SELECT
          u.name,
          MIN(u.id) AS user_id,
          MIN(u.person_id) AS person_id
        FROM users u
        INNER JOIN roles role ON role.id = u.role_id
        WHERE role.name = 'Requester'
          AND u.status = 'active'
          AND u.is_deleted = FALSE
          AND u.person_id IS NOT NULL
        GROUP BY u.name
        HAVING COUNT(*) = 1
      ) matched ON matched.name = r.requester_name_text
      SET r.requester_id = matched.user_id,
          r.person_id = matched.person_id
      WHERE r.requester_id = 1
        AND r.requester_name_text IS NOT NULL
        AND r.is_deleted = FALSE
    `)).catch(() => {});

    // A final delivery always belongs to the requester's linked person. Repair
    // legacy delivery/assignment rows without changing stock transactions.
    await withRetry(() => db.query(`
      UPDATE deliveries dl
      INNER JOIN requests r ON r.id = dl.request_id
      INNER JOIN users u
        ON u.id = r.requester_id
       AND u.person_id IS NOT NULL
      SET dl.delivered_to_person_id = u.person_id
      WHERE dl.is_deleted = FALSE
        AND dl.status IN ('DELIVERED', 'Delivered')
        AND (
          dl.delivered_to_person_id IS NULL
          OR dl.delivered_to_person_id <> u.person_id
        )
    `)).catch(() => {});

    await withRetry(() => db.query(`
      UPDATE item_assignments ia
      INNER JOIN deliveries dl ON dl.id = ia.delivery_id
      INNER JOIN requests r ON r.id = dl.request_id
      INNER JOIN users u
        ON u.id = r.requester_id
       AND u.person_id IS NOT NULL
      INNER JOIN people person
        ON person.id = u.person_id
       AND person.is_deleted = FALSE
      LEFT JOIN departments dept ON dept.id = person.department_id
      SET ia.person_id = person.id,
          ia.department_id = person.department_id,
          ia.faculty_id = COALESCE(dept.faculty_id, person.faculty_id)
      WHERE ia.is_deleted = FALSE
        AND ia.source_type = 'DELIVERY'
        AND (
          ia.person_id IS NULL
          OR ia.person_id <> person.id
          OR NOT (ia.department_id <=> person.department_id)
          OR NOT (ia.faculty_id <=> COALESCE(dept.faculty_id, person.faculty_id))
        )
    `)).catch(() => {});

    await withRetry(() => db.query(`
      CREATE TABLE IF NOT EXISTS request_pipeline (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        request_id     INT NOT NULL,
        status         VARCHAR(100) NOT NULL,
        stage_label    VARCHAR(255) DEFAULT '',
        progress       INT DEFAULT 0,
        action_by      VARCHAR(100) DEFAULT '',
        action_by_name VARCHAR(150) DEFAULT '',
        action_by_role VARCHAR(100) DEFAULT '',
        assigned_role  VARCHAR(100) DEFAULT '',
        next_action    TEXT,
        comment        TEXT,
        work_complete  TINYINT(1) DEFAULT 0,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pipeline_request (request_id)
      ) ENGINE=InnoDB
    `)).catch(() => {});

    // If a legacy client later overwrote an already completed request, restore
    // only its current pointer. Preserve every historical pipeline row.
    await withRetry(() => db.query(`
      UPDATE requests r
      SET r.status = 'DELIVERED',
          r.progress_percent = 100,
          r.current_stage = 'DELIVERED',
          r.assigned_role = 'NONE'
      WHERE r.status IN ('READY_FOR_DELIVERY', 'ReceivedToInventory')
        AND r.is_deleted = FALSE
        AND EXISTS (
          SELECT 1
          FROM request_pipeline p
          WHERE p.request_id = r.id
            AND (
              p.work_complete = 1
              OR p.status IN ('Delivered', 'DELIVERED', 'Completed', 'COMPLETED')
            )
        )
    `)).catch(() => {});

    // Old clients used READY_FOR_DELIVERY/ReceivedToInventory and could leave an
    // unfinished request with the warehouse director, skipping the requester's
    // Proposal + FS-5 delivery round. Repair only unfinished requests which
    // have never entered (or completed) that delivery round.
    await withRetry(() => db.query(`
      UPDATE requests r
      SET r.status = 'DeliveryFormsRequested',
          r.progress_percent = 82,
          r.current_stage = 'DeliveryFormsRequested',
          r.assigned_role = 'REQUESTER'
      WHERE r.status IN ('READY_FOR_DELIVERY', 'ReceivedToInventory')
        AND r.is_deleted = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM request_pipeline p
          WHERE p.request_id = r.id
            AND p.status IN (
              'FS5Required',
              'DeliveryFormsRequested',
              'DeliveryFormsSubmitted',
              'DeliveryConfirmedByRequestConfirmer',
              'DeliveryApprovedBySuperAdmin',
              'DeliveryReferredToWarehouse',
              'Delivered', 'DELIVERED', 'Completed', 'COMPLETED'
            )
        )
    `)).catch(() => {});

    // Keep the repaired active request visible in the same progress history as
    // the reference requests. This is idempotent and never rewrites history.
    await withRetry(() => db.query(`
      INSERT INTO request_pipeline
        (request_id, status, stage_label, progress, action_by, action_by_name, action_by_role,
         assigned_role, next_action, comment, work_complete)
      SELECT
        r.id,
        'DeliveryFormsRequested',
        'اجناس ګدام ته داخل شول - د تسلیمۍ فورمونه غوښتل شوي',
        82,
        '',
        'System Migration',
        'SYSTEM',
        'REQUESTER',
        'د تسلیمۍ لپاره پیشنهاد او ف.س-۵ جوړ او واستوئ',
        'زاړه فعال مسیر د معیاري پیشنهاد او ف.س-۵ مرحلې ته برابر شو.',
        0
      FROM requests r
      WHERE r.status = 'DeliveryFormsRequested'
        AND r.is_deleted = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM request_pipeline p
          WHERE p.request_id = r.id
            AND p.status IN ('FS5Required', 'DeliveryFormsRequested')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM request_pipeline p
          WHERE p.request_id = r.id
            AND p.status IN ('Delivered', 'DELIVERED', 'Completed', 'COMPLETED')
        )
    `)).catch(() => {});

    await withRetry(() => db.query(`
      UPDATE request_pipeline
      SET progress = 82,
          assigned_role = 'REQUESTER',
          next_action = 'پیشنهاد او ف.س-۵ جوړ او واستوئ'
      WHERE status = 'FS5Required'
        AND (progress < 82 OR assigned_role IS NULL OR assigned_role = '')
    `)).catch(() => {});

    // Official forms must be shared by every LAN client.  The old frontend-only
    // localStorage copy worked on one computer, but disappeared for the next
    // workflow actor on another computer.
    await withRetry(() => db.query(`
      CREATE TABLE IF NOT EXISTS official_form_instances (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        request_id      INT NOT NULL,
        form_type       VARCHAR(50) NOT NULL,
        form_data       LONGTEXT NOT NULL,
        created_by      VARCHAR(100) DEFAULT '',
        created_by_name VARCHAR(150) DEFAULT '',
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_deleted      TINYINT(1) DEFAULT 0,
        UNIQUE KEY uq_request_form_type (request_id, form_type),
        INDEX idx_official_forms_request (request_id)
      ) ENGINE=InnoDB
    `)).catch(() => {});

    await withRetry(() => db.query(`CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_name_text)`)).catch(() => {});
    await withRetry(() => db.query(`CREATE INDEX IF NOT EXISTS idx_requests_created ON requests(created_at)`)).catch(() => {});
    await withRetry(() => db.query(`CREATE INDEX IF NOT EXISTS idx_requests_deleted ON requests(is_deleted)`)).catch(() => {});
    await withRetry(() => db.query(`CREATE INDEX IF NOT EXISTS idx_request_items_item ON request_items(item_id)`)).catch(() => {});
  }

  static async getRequests() {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT r.*,
        COALESCE(r.requester_name_text, u.name) as requester_name,
        COALESCE(r.faculty_name_text, f.name_ps)   as faculty_name,
        COALESCE(r.department_name_text, d.name_ps) as department_name,
        p.full_name as person_name
      FROM requests r
      LEFT JOIN users u ON r.requester_id = u.id
      LEFT JOIN faculties f ON r.faculty_id = f.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN people p ON r.person_id = p.id
      WHERE r.is_deleted = FALSE
      ORDER BY r.created_at DESC
    `);

    if ((rows as any[]).length === 0) return rows;

    // Fetch items for all requests in one query and merge
    const ids = (rows as any[]).map((r: any) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const [itemRows] = await db.query<RowDataPacket[]>(`
      SELECT ri.*, i.item_code, COALESCE(u2.name_ps, ri.unit_name, '') as unit_name
      FROM request_items ri
      LEFT JOIN items i ON ri.item_id = i.id
      LEFT JOIN units u2 ON ri.unit_id = u2.id
      WHERE ri.request_id IN (${placeholders})
    `, ids);

    const itemsByRequest: Record<number, any[]> = {};
    for (const item of itemRows as any[]) {
      if (!itemsByRequest[item.request_id]) itemsByRequest[item.request_id] = [];
      itemsByRequest[item.request_id].push(item);
    }

    return (rows as any[]).map((r: any) => ({
      ...r,
      items: itemsByRequest[r.id] || []
    }));
  }

  static async getRequestById(id: number) {
    const [requests] = await db.query<RowDataPacket[]>(`
      SELECT r.*,
        COALESCE(r.requester_name_text, u.name) as requester_name,
        COALESCE(r.faculty_name_text, f.name_ps)   as faculty_name,
        COALESCE(r.department_name_text, d.name_ps) as department_name,
        p.full_name as person_name
      FROM requests r
      LEFT JOIN users u ON r.requester_id = u.id
      LEFT JOIN faculties f ON r.faculty_id = f.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN people p ON r.person_id = p.id
      WHERE r.id = ? AND r.is_deleted = FALSE
    `, [id]);

    if (requests.length === 0) return null;

    const [items] = await db.query<RowDataPacket[]>(`
      SELECT ri.*, i.item_code, COALESCE(u.name_ps, ri.unit_name, '') as unit_name
      FROM request_items ri
      LEFT JOIN items i ON ri.item_id = i.id
      LEFT JOIN units u ON ri.unit_id = u.id
      WHERE ri.request_id = ?
    `, [id]);

    const forms = await this.getFormInstances(id);
    const formInstances: Record<string, number> = {};
    for (const form of forms) {
      if (form.form_type === 'Proposal') formInstances.proposalId = form.id;
      if (form.form_type === 'SI-9') formInstances.si9Id = form.id;
      if (form.form_type === 'FS-5') formInstances.fs5Id = form.id;
      if (form.form_type === 'Tender') formInstances.tenderId = form.id;
      if (form.form_type === 'Comparison') formInstances.comparisonId = form.id;
      if (form.form_type === 'PurchaseOrder') formInstances.purchaseOrderId = form.id;
      if (form.form_type === 'ReceiptReport') formInstances.receiptReportId = form.id;
    }

    return { ...requests[0], items, forms, form_instances: formInstances };
  }

  static async getFormInstances(requestId: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT id, request_id, form_type, form_data, created_by, created_by_name, created_at, updated_at
      FROM official_form_instances
      WHERE request_id = ? AND is_deleted = FALSE
      ORDER BY updated_at DESC
    `, [requestId]);

    return rows.map((row: any) => ({
      ...row,
      form_data: this.parseFormData(row.form_data),
    }));
  }

  static async getFormInstance(requestId: number, formId: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT id, request_id, form_type, form_data, created_by, created_by_name, created_at, updated_at
      FROM official_form_instances
      WHERE id = ? AND request_id = ? AND is_deleted = FALSE
      LIMIT 1
    `, [formId, requestId]);
    if (rows.length === 0) return null;
    return {
      ...rows[0],
      form_data: this.parseFormData((rows[0] as any).form_data),
    };
  }

  static async upsertFormInstance(
    requestId: number,
    formType: string,
    formData: any,
    createdBy: string,
    createdByName: string,
  ) {
    const [requests] = await db.query<RowDataPacket[]>(
      `SELECT id FROM requests WHERE id = ? AND is_deleted = FALSE`,
      [requestId],
    );
    if (requests.length === 0) throw new Error('not_found');

    await db.query(`
      INSERT INTO official_form_instances
        (request_id, form_type, form_data, created_by, created_by_name)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        form_data = VALUES(form_data),
        created_by = VALUES(created_by),
        created_by_name = VALUES(created_by_name),
        is_deleted = FALSE,
        updated_at = CURRENT_TIMESTAMP
    `, [
      requestId,
      formType,
      JSON.stringify(formData ?? {}),
      createdBy || '',
      createdByName || '',
    ]);

    // Keep the procurement case in step with the canonical server-side form.
    // Only advance early stages here; winner and PO stages are advanced by
    // their own validated procurement transactions.
    if (formType === 'Tender') {
      await db.query(`
        UPDATE procurement_cases
        SET status = 'TENDER_CREATED'
        WHERE request_id = ?
          AND is_deleted = FALSE
          AND status = 'OPEN'
      `, [requestId]);
    } else if (formType === 'Comparison') {
      await db.query(`
        UPDATE procurement_cases
        SET status = 'COMPARISON_CREATED'
        WHERE request_id = ?
          AND is_deleted = FALSE
          AND status IN ('OPEN', 'TENDER_CREATED', 'OFFERS_RECEIVED')
      `, [requestId]);
    }

    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT id, request_id, form_type, form_data, created_by, created_by_name, created_at, updated_at
      FROM official_form_instances
      WHERE request_id = ? AND form_type = ? AND is_deleted = FALSE
      LIMIT 1
    `, [requestId, formType]);

    return {
      ...rows[0],
      form_data: this.parseFormData((rows[0] as any).form_data),
    };
  }

  private static parseFormData(raw: any) {
    if (raw == null || typeof raw === 'object') return raw ?? {};
    try {
      return JSON.parse(String(raw));
    } catch {
      return {};
    }
  }

  static async createRequest(data: any, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const trackingId = 'REQ-' + Date.now();
      const status       = 'PendingReview';
      const currentStage = 'REQUEST_CONFIRMER';
      const assignedRole = 'REQUEST_CONFIRMER';
      const progress     = 0;

      const [result] = await connection.query<ResultSetHeader>(`
        INSERT INTO requests
          (tracking_id, requester_id, faculty_id, department_id, person_id,
           request_level, notes, status, current_stage, assigned_role, progress_percent,
           faculty_name_text, department_name_text, requester_name_text)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        trackingId,
        userId,
        data.faculty_id || null,
        data.department_id || null,
        data.person_id || null,
        normalizeRequestLevel(data.request_level || ''),
        data.notes || '',
        status,
        currentStage,
        assignedRole,
        progress,
        data.faculty_name || null,
        data.department_name || null,
        data.requester_name || null,
      ]);

      const requestId = result.insertId;

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const placeholders = data.items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values: any[] = [];
        for (const item of data.items) {
          let resolvedItemId: number | null = null;
          try {
            resolvedItemId = await InventoryService.resolveItemId({
              item_id: item.item_id,
              checklist_id: item.checklist_id,
              item_name: item.item_name,
            });
          } catch {
            resolvedItemId = null;
          }
          values.push(requestId, resolvedItemId, item.item_name, item.quantity, item.unit_id || null, item.unit_name || '', item.specifications || '', item.unit_price || 0, item.total_price || 0);
        }
        await connection.query(`
          INSERT INTO request_items (request_id, item_id, item_name, quantity, unit_id, unit_name, specifications, unit_price, total_price)
          VALUES ${placeholders}
        `, values);
      }

      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'CREATE', 'REQUEST', requestId,
          JSON.stringify({ status, current_stage: currentStage, assigned_role: assignedRole })]);

      // Seed pipeline entry for submission
      await connection.query(`
        INSERT INTO request_pipeline
          (request_id, status, stage_label, progress, action_by, action_by_name, action_by_role,
           assigned_role, next_action, comment, work_complete)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [requestId, status, 'د لومړني بیاکتنې لپاره واستول شوه', progress,
          userId?.toString() ?? '', data.requester_name ?? '', 'Requester',
          assignedRole, 'غوښتنه وکتل سي / پیشنهاد منظور کړئ', '', 0]);

      await connection.commit();
      return requestId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateStatus(
    id: number,
    status: string,
    userId: number | null,
    opts: {
      stageLabelOverride?: string;
      actionByName?: string;
      actionByRole?: string;
      comment?: string;
      progressOverride?: number;
    } = {}
  ) {
    // These two legacy states represented "items are ready/received", but they
    // also allowed older callers to bypass the mandatory requester delivery
    // forms. Always route them into the canonical Proposal + FS-5 round.
    const workflowStatus = ['READY_FOR_DELIVERY', 'ReceivedToInventory'].includes(status)
      ? 'DeliveryFormsRequested'
      : status;
    const cfg = STAGE_MAP[workflowStatus] ?? { progress: 0, stage_ps: workflowStatus, assignedRole: '', nextAction: '', complete: false };
    const progress = workflowStatus !== status
      ? cfg.progress
      : (opts.progressOverride !== undefined ? opts.progressOverride : cfg.progress);
    const stageLabel = workflowStatus !== status
      ? cfg.stage_ps
      : (opts.stageLabelOverride || cfg.stage_ps);
    const assignedRole = cfg.assignedRole;

    const [result] = await db.query<ResultSetHeader>(`
      UPDATE requests
      SET status = ?, progress_percent = ?, current_stage = ?, assigned_role = ?
      WHERE id = ?
    `, [workflowStatus, progress, workflowStatus, assignedRole, id]);

    if (result.affectedRows === 0) throw new Error('not_found');

    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
      VALUES (?, ?, ?, ?, ?)
    `, [userId, 'UPDATE_STATUS', 'REQUEST', id,
        JSON.stringify({ status: workflowStatus, progress_percent: progress, assigned_role: assignedRole })]);

    await db.query(`
      INSERT INTO request_pipeline
        (request_id, status, stage_label, progress, action_by, action_by_name, action_by_role,
         assigned_role, next_action, comment, work_complete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, workflowStatus, stageLabel, progress,
      userId?.toString() ?? '',
      opts.actionByName ?? '',
      opts.actionByRole ?? '',
      assignedRole,
      cfg.nextAction,
      opts.comment ?? '',
      cfg.complete ? 1 : 0,
    ]).catch(() => {});

    return {
      requestID:        id.toString(),
      currentStage:     stageLabel,
      assignedRole,
      progressPercent:  progress,
      nextActionRequired: cfg.nextAction,
      workflowComplete: cfg.complete,
    };
  }

  static async updateLevel(id: number, newLevel: string, reason: string, userId: number | null) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [requests] = await connection.query<RowDataPacket[]>(
        `SELECT request_level FROM requests WHERE id = ?`, [id]);
      if (requests.length === 0) throw new Error('not_found');

      const oldLevel = requests[0].request_level;

      await connection.query(`UPDATE requests SET request_level = ? WHERE id = ?`, [newLevel, id]);
      await connection.query(`
        INSERT INTO request_level_history (request_id, old_level, new_level, changed_by, reason)
        VALUES (?, ?, ?, ?, ?)
      `, [id, oldLevel, newLevel, userId, reason]);
      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'UPDATE_LEVEL', 'REQUEST', id, JSON.stringify({ new_level: newLevel })]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getLevelHistory(id: number) {
    const [rows] = await db.query<RowDataPacket[]>(`
      SELECT h.*, u.name as changed_by_name
      FROM request_level_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.request_id = ?
      ORDER BY h.created_at DESC
    `, [id]);
    return rows;
  }

  static async getPipelineHistory(id: number) {
    const [request] = await db.query<RowDataPacket[]>(`
      SELECT r.id, r.tracking_id, r.status, r.current_stage, r.assigned_role,
             r.progress_percent, r.request_level, r.created_at, r.updated_at
      FROM requests r
      WHERE r.id = ? AND r.is_deleted = FALSE
    `, [id]);

    if (request.length === 0) throw new Error('not_found');

    const req = request[0];
    const cfg = STAGE_MAP[req.status] ?? {
      progress: req.progress_percent, stage_ps: req.status,
      assignedRole: req.assigned_role || '', nextAction: '', complete: false,
    };

    const workflowSummary = {
      requestID:          req.id.toString(),
      currentStage:       cfg.stage_ps,
      assignedRole:       req.assigned_role || cfg.assignedRole,
      progressPercent:    cfg.progress,
      nextActionRequired: cfg.nextAction,
      workflowComplete:   cfg.complete,
    };

    let pipelineRows: RowDataPacket[] = [];
    try {
      const [rows] = await db.query<RowDataPacket[]>(`
        SELECT p.*, u.name as actor_name
        FROM request_pipeline p
        LEFT JOIN users u ON p.action_by = u.id
        WHERE p.request_id = ?
        ORDER BY p.created_at ASC
      `, [id]);
      pipelineRows = rows;
    } catch {
      const [auditLogs] = await db.query<RowDataPacket[]>(`
        SELECT al.action, al.new_value, al.created_at
        FROM audit_logs al
        WHERE al.entity_type = 'REQUEST' AND al.entity_id = ?
        ORDER BY al.created_at ASC
      `, [id.toString()]);
      pipelineRows = auditLogs;
    }

    const [levelHistory] = await db.query<RowDataPacket[]>(`
      SELECT h.*, u.name as changed_by_name
      FROM request_level_history h
      LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.request_id = ?
      ORDER BY h.created_at ASC
    `, [id]);

    return { workflow: workflowSummary, pipeline: pipelineRows, level_history: levelHistory };
  }

  static async updateItems(id: number, items: any[], userId: number) {
    const connection = await (db as any).getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(`DELETE FROM request_items WHERE request_id = ?`, [id]);
      if (items.length > 0) {
        const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values: any[] = [];
        for (const item of items) {
          let resolvedItemId: number | null = null;
          try {
            resolvedItemId = await InventoryService.resolveItemId({
              item_id: item.item_id,
              checklist_id: item.checklist_id,
              item_name: item.item_name,
            });
          } catch {
            resolvedItemId = null;
          }
          values.push(id, resolvedItemId, item.item_name, item.quantity, item.unit_id || null, item.unit_name || '', item.specifications || '', item.unit_price || 0, item.total_price || 0);
        }
        await connection.query(`
          INSERT INTO request_items (request_id, item_id, item_name, quantity, unit_id, unit_name, specifications, unit_price, total_price)
          VALUES ${placeholders}
        `, values);
      }
      await connection.query(`
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, 'UPDATE_ITEMS', 'REQUEST', id, JSON.stringify({ items_count: items.length })]);
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  static async deleteRequest(id: number, userId: number | null) {
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE requests SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new Error('not_found');

    await db.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id)
      VALUES (?, ?, ?, ?)
    `, [userId, 'DELETE', 'REQUEST', id]);

    return true;
  }
}
