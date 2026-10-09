import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { lazy, Suspense } from "react";
import { ensureSeedVersion } from "./firebase/localStore";
import ErrorBoundary from "./components/common/ErrorBoundary";

ensureSeedVersion();
import { ScrollToTop } from "./components/common/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layout/AppLayout";
import ReportsLayout from "./layouts/ReportsLayout";
import SettingsLayout from "./layouts/SettingsLayout";
import { ROLES } from "./constants/roles";

import SignIn from "./pages/AuthPages/SignIn";
import NotFound from "./pages/OtherPage/NotFound";

const Home = lazy(() => import("./pages/Dashboard/Home"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const RoleManagement = lazy(() => import("./pages/RoleManagement"));

const InventoryDashboard = lazy(() => import("./pages/Inventory/Dashboard"));
const ItemList = lazy(() => import("./pages/Inventory/ItemList"));
const AddItem = lazy(() => import("./pages/Inventory/AddItem"));
const EditItem = lazy(() => import("./pages/Inventory/EditItem"));
const StockIn = lazy(() => import("./pages/Inventory/StockIn"));
const StockOut = lazy(() => import("./pages/Inventory/StockOut"));
const StockReturn = lazy(() => import("./pages/Inventory/StockReturn"));
const InventoryLedger = lazy(() => import("./pages/Inventory/Ledger"));
const BarcodeScanner = lazy(() => import("./pages/Inventory/BarcodeScanner"));
const ChecklistManagement = lazy(() => import("./pages/Inventory/ChecklistManagement"));

const RequestList = lazy(() => import("./pages/Requests/RequestList"));
const CreateRequest = lazy(() => import("./pages/Requests/CreateRequest"));
const RequestDetails = lazy(() => import("./pages/Requests/RequestDetails"));

const ProcurementRequestList = lazy(() => import("./pages/Procurement/ProcurementRequestList"));
const ProcurementDetails = lazy(() => import("./pages/Procurement/ProcurementDetails"));
const VendorOffersPage = lazy(() => import("./pages/Procurement/VendorOffersPage"));

const WarehouseRequestList = lazy(() => import("./pages/Receiving/WarehouseRequestList"));
const WarehouseRequestDetails = lazy(() => import("./pages/Receiving/WarehouseRequestDetails"));

const ReportsDashboard = lazy(() => import("./pages/Reports/ReportsDashboard"));
const InventoryReport = lazy(() => import("./pages/Reports/InventoryReport"));
const AnnualNeedsReport = lazy(() => import("./pages/Reports/AnnualNeedsReport"));
const ForecastingReport = lazy(() => import("./pages/Reports/ForecastingReport"));
const StockMovementReport = lazy(() => import("./pages/Reports/StockMovementReport"));
const RequestReport = lazy(() => import("./pages/Reports/RequestReport"));
const ProcurementReport = lazy(() => import("./pages/Reports/ProcurementReport"));
const ReceivingDeliveryReport = lazy(() => import("./pages/Reports/ReceivingDeliveryReport"));
const FacultyReport = lazy(() => import("./pages/Reports/FacultyReport"));
const DepartmentReport = lazy(() => import("./pages/Reports/DepartmentReport"));
const PersonAssignmentReport = lazy(() => import("./pages/Reports/PersonAssignmentReport"));
const AuditActivityReport = lazy(() => import("./pages/Reports/AuditActivityReport"));
const ReturnReport = lazy(() => import("./pages/Reports/ReturnReport"));

const TrashList = lazy(() => import("./pages/Maintenance/TrashList"));
const RecoveryHistory = lazy(() => import("./pages/Maintenance/RecoveryHistory"));
const BackupExport = lazy(() => import("./pages/Settings/BackupManagement"));
const SystemHealth = lazy(() => import("./pages/Maintenance/SystemHealth"));
const FinalQAChecklist = lazy(() => import("./pages/Maintenance/FinalQAChecklist"));
const OfficialFormsPage = lazy(() => import("./pages/OfficialForms/OfficialFormsPage"));
const NotificationsPage = lazy(() => import("./pages/Notifications/NotificationsPage"));
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage"));
const BudgetCodes = lazy(() => import("./pages/Settings/BudgetCodes"));
const DelegationManagement = lazy(() => import("./pages/Admin/DelegationManagement"));
const AboutPage = lazy(() => import("./pages/About/AboutPage"));
const TraceabilityPage = lazy(() => import("./pages/Traceability/TraceabilityPage"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdmin/SuperAdminDashboard"));
const AnalyticsDashboard = lazy(() => import("./pages/SuperAdmin/AnalyticsDashboard"));
const InventoryMonitor = lazy(() => import("./pages/SuperAdmin/InventoryMonitor"));
const RequestsMonitor = lazy(() => import("./pages/SuperAdmin/RequestsMonitor"));
const ProcurementMonitor = lazy(() => import("./pages/SuperAdmin/ProcurementMonitor"));
const ReceivingMonitor = lazy(() => import("./pages/SuperAdmin/ReceivingMonitor"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px]" dir="rtl">
      <div className="text-center space-y-2">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-gray-400">بارول...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<Navigate to="/signin" replace />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />

            <Route path="/inventory" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><InventoryDashboard /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/items" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><ItemList /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/add" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><AddItem /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/add-item" element={<Navigate to="/inventory/add" replace />} />
            <Route path="/inventory/edit/:id" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><EditItem /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/stock-in" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><StockIn /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/stock-in/:id" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><StockIn /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/stock-out" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><StockOut /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/stock-out/:id" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><StockOut /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/returns" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><StockReturn /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/ledger" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><InventoryLedger /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/barcode-scanner" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><BarcodeScanner /></Suspense></ProtectedRoute>} />
            <Route path="/inventory/checklist" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><ChecklistManagement /></Suspense></ProtectedRoute>} />

            <Route path="/requests" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.REQUESTER, ROLES.REQUEST_CONFIRMER, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR, ROLES.PROCUREMENT_DIRECTOR]}><Suspense fallback={<PageLoader />}><RequestList /></Suspense></ProtectedRoute>} />
            <Route path="/requests/create" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.REQUESTER]}><Suspense fallback={<PageLoader />}><CreateRequest /></Suspense></ProtectedRoute>} />
            <Route path="/requests/details/:id" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.REQUESTER, ROLES.REQUEST_CONFIRMER, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.WAREHOUSE_DIRECTOR, ROLES.PROCUREMENT_DIRECTOR]}><Suspense fallback={<PageLoader />}><RequestDetails /></Suspense></ProtectedRoute>} />

            <Route path="/procurement" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_DIRECTOR]}><Suspense fallback={<PageLoader />}><ProcurementRequestList /></Suspense></ProtectedRoute>} />
            <Route path="/procurement/details/:id" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_DIRECTOR, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><ProcurementDetails /></Suspense></ProtectedRoute>} />
            <Route path="/procurement/offers/:id" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.PROCUREMENT_DIRECTOR]}><Suspense fallback={<PageLoader />}><VendorOffersPage /></Suspense></ProtectedRoute>} />

            <Route path="/receiving" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON]}><Suspense fallback={<PageLoader />}><WarehouseRequestList /></Suspense></ProtectedRoute>} />
            <Route path="/receiving/receipt-reports" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON]}><Suspense fallback={<PageLoader />}><WarehouseRequestList /></Suspense></ProtectedRoute>} />
            <Route path="/receiving/details/:id" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON]}><Suspense fallback={<PageLoader />}><WarehouseRequestDetails /></Suspense></ProtectedRoute>} />

            <Route path="/official-forms" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_DIRECTOR, ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON, ROLES.REQUESTER, ROLES.REQUEST_CONFIRMER]}><Suspense fallback={<PageLoader />}><OfficialFormsPage /></Suspense></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_DIRECTOR, ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON]}><Suspense fallback={<PageLoader />}><NotificationsPage /></Suspense></ProtectedRoute>} />

            {/* Reports — Tab Layout */}
            <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROCUREMENT_DIRECTOR, ROLES.WAREHOUSE_DIRECTOR]}><ReportsLayout /></ProtectedRoute>}>
              <Route path="/reports" element={<Suspense fallback={<PageLoader />}><ReportsDashboard /></Suspense>} />
              <Route path="/reports/inventory" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><InventoryReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/movement" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><StockMovementReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/requests" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}><Suspense fallback={<PageLoader />}><RequestReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/procurement" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.PROCUREMENT_DIRECTOR]}><Suspense fallback={<PageLoader />}><ProcurementReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/delivery" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><ReceivingDeliveryReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/faculty" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><FacultyReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/department" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><DepartmentReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/person-assignment" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><PersonAssignmentReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/needs" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}><Suspense fallback={<PageLoader />}><AnnualNeedsReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/forecast" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN]}><Suspense fallback={<PageLoader />}><ForecastingReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/audit" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><Suspense fallback={<PageLoader />}><AuditActivityReport /></Suspense></ProtectedRoute>} />
              <Route path="/reports/returns" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR]}><Suspense fallback={<PageLoader />}><ReturnReport /></Suspense></ProtectedRoute>} />
            </Route>

            {/* Settings — Tab Layout (Super Admin only) */}
            <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><SettingsLayout /></ProtectedRoute>}>
              <Route path="/user-management" element={<Suspense fallback={<PageLoader />}><UserManagement /></Suspense>} />
              <Route path="/role-management" element={<Suspense fallback={<PageLoader />}><RoleManagement /></Suspense>} />
              <Route path="/delegation" element={<Suspense fallback={<PageLoader />}><DelegationManagement /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
              <Route path="/settings/budget-codes" element={<Suspense fallback={<PageLoader />}><BudgetCodes /></Suspense>} />
              <Route path="/maintenance/trash" element={<Suspense fallback={<PageLoader />}><TrashList /></Suspense>} />
              <Route path="/maintenance/recovery-history" element={<Suspense fallback={<PageLoader />}><RecoveryHistory /></Suspense>} />
              <Route path="/maintenance/backup" element={<Suspense fallback={<PageLoader />}><BackupExport /></Suspense>} />
              <Route path="/maintenance/health" element={<Suspense fallback={<PageLoader />}><SystemHealth /></Suspense>} />
              <Route path="/maintenance/final-qa" element={<Suspense fallback={<PageLoader />}><FinalQAChecklist /></Suspense>} />
            </Route>

            <Route path="/traceability" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.WAREHOUSE_DIRECTOR, ROLES.WAREHOUSE_ENTRY_PERSON]}><Suspense fallback={<PageLoader />}><TraceabilityPage /></Suspense></ProtectedRoute>} />

            {/* Super Admin Monitoring Routes */}
            <Route path="/superadmin" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><Suspense fallback={<PageLoader />}><SuperAdminDashboard /></Suspense></ProtectedRoute>} />
            <Route path="/superadmin/analytics" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><Suspense fallback={<PageLoader />}><AnalyticsDashboard /></Suspense></ProtectedRoute>} />
            <Route path="/superadmin/inventory" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><Suspense fallback={<PageLoader />}><InventoryMonitor /></Suspense></ProtectedRoute>} />
            <Route path="/superadmin/requests" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><Suspense fallback={<PageLoader />}><RequestsMonitor /></Suspense></ProtectedRoute>} />
            <Route path="/superadmin/procurement" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><Suspense fallback={<PageLoader />}><ProcurementMonitor /></Suspense></ProtectedRoute>} />
            <Route path="/superadmin/receiving" element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}><Suspense fallback={<PageLoader />}><ReceivingMonitor /></Suspense></ProtectedRoute>} />
            <Route path="/about" element={<Suspense fallback={<PageLoader />}><AboutPage /></Suspense>} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
