import { apiClient } from '../api/apiClient';

export interface InventorySummary {
  total_items: number;
  total_stock_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_categories: number;
  total_warehouses: number;
}

export interface RequestSummary {
  total_requests: number;
  pending_count: number;
  confirmed_count: number;
  procurement_count: number;
  ready_count: number;
  delivered_count: number;
  completed_count: number;
  rejected_count: number;
  urgent_count: number;
  normal_count: number;
  low_count: number;
}

export interface ProcurementSummary {
  total_cases: number;
  open_count: number;
  winner_selected_count: number;
  po_created_count: number;
  total_po_amount: number;
}

export interface ReceivingSummary {
  total_receiving_records: number;
  total_units_received: number;
  total_deliveries: number;
  total_units_delivered: number;
}

export interface StockMovementRecord {
  id: number;
  item_name: string;
  item_code: string;
  transaction_type: 'IN' | 'OUT';
  quantity: number;
  created_at: string;
  notes?: string;
}

export interface AuditRecord {
  id: number;
  action: string;
  table_name: string;
  record_id: number;
  user_name: string;
  created_at: string;
  details?: string;
}

export interface InventoryItem {
  id: number;
  name_ps: string;
  item_code: string;
  current_stock: number;
  minimum_stock: number;
  category_name: string;
  warehouse_name: string;
  unit_name: string;
}

export interface RequestRecord {
  id: number;
  tracking_id: string;
  status: string;
  request_level: string;
  faculty_name: string;
  department_name: string;
  created_at: string;
}

export interface ProcurementRecord {
  id: number;
  status: string;
  request_tracking_id: string;
  po_number?: string;
  total_amount?: number;
  vendor_name?: string;
  created_at: string;
}

export interface ReceivingRecord {
  id: number;
  po_number?: string;
  request_tracking_id?: string;
  created_at: string;
}

const SuperAdminMonitoringService = {
  getInventorySummary: (): Promise<InventorySummary> =>
    apiClient.get('/reports/inventory-summary'),

  getRequestSummary: (): Promise<RequestSummary> =>
    apiClient.get('/reports/request-summary'),

  getProcurementSummary: (): Promise<ProcurementSummary> =>
    apiClient.get('/reports/procurement-summary'),

  getReceivingDeliverySummary: (): Promise<ReceivingSummary> =>
    apiClient.get('/reports/receiving-delivery-summary'),

  getRecentStockMovement: (): Promise<StockMovementRecord[]> =>
    apiClient.get('/reports/stock-movement'),

  getAuditActivity: (): Promise<AuditRecord[]> =>
    apiClient.get('/reports/audit-activity'),

  getInventoryItems: (): Promise<InventoryItem[]> =>
    apiClient.get('/inventory/items'),

  getRequests: (): Promise<RequestRecord[]> =>
    apiClient.get('/requests'),

  getProcurementCases: (): Promise<ProcurementRecord[]> =>
    apiClient.get('/procurement'),

  getReceivingRecords: (): Promise<ReceivingRecord[]> =>
    apiClient.get('/receiving'),
};

export default SuperAdminMonitoringService;
