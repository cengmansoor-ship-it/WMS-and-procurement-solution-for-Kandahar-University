import { useState, useEffect, useCallback } from 'react';
import SuperAdminMonitoringService, {
  InventorySummary,
  RequestSummary,
  ProcurementSummary,
  ReceivingSummary,
} from '../services/superAdminMonitoringService';

export interface MonitoringState {
  inventorySummary: InventorySummary | null;
  requestSummary: RequestSummary | null;
  procurementSummary: ProcurementSummary | null;
  receivingSummary: ReceivingSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSuperAdminMonitoring(): MonitoringState {
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [requestSummary, setRequestSummary] = useState<RequestSummary | null>(null);
  const [procurementSummary, setProcurementSummary] = useState<ProcurementSummary | null>(null);
  const [receivingSummary, setReceivingSummary] = useState<ReceivingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inv, req, proc, rec] = await Promise.all([
        SuperAdminMonitoringService.getInventorySummary(),
        SuperAdminMonitoringService.getRequestSummary(),
        SuperAdminMonitoringService.getProcurementSummary(),
        SuperAdminMonitoringService.getReceivingDeliverySummary(),
      ]);
      setInventorySummary(inv);
      setRequestSummary(req);
      setProcurementSummary(proc);
      setReceivingSummary(rec);
    } catch (e: any) {
      setError('د معلوماتو بارولو پرمهال ستونزه رامنځته شوه.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { inventorySummary, requestSummary, procurementSummary, receivingSummary, loading, error, refresh: load };
}
