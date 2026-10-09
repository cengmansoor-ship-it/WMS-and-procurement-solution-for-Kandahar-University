import type { InventoryRequest } from "../firebase/requests";
import type { VendorOffer, ReceiptReportRecord } from "../firebase/procurement";
import type { FS5Document } from "../firebase/receiving";
import type { OfficialFormSharedData, OfficialTemplateId } from "../components/OfficialFormViewer";

export type { OfficialFormSharedData };

const FORM_ORDER = ["proposal", "tender", "comparison", "purchaseOrder", "receiptReport", "si9", "pc5"];

const TEMPLATE_TO_FORM: Record<string, string> = {
  formTemplate0: "proposal",
  formTemplate1: "tender",
  formTemplate2: "comparison",
  formTemplate3: "purchaseOrder",
  formTemplate4: "receiptReport",
  formTemplate5: "si9",
  formTemplate6: "pc5",
};

export function getOfficialFormKey(requestId: string, formType: string): string {
  return `ku_req_${requestId}_procurement_form_${formType}`;
}

export function getOfficialTemplateId(formType: string): OfficialTemplateId {
  const map: Record<string, OfficialTemplateId> = {
    proposal: "formTemplate0",
    tender: "formTemplate1",
    comparison: "formTemplate2",
    purchaseOrder: "formTemplate3",
    receiptReport: "formTemplate4",
    si9: "formTemplate5",
    fs5: "formTemplate6",
    pc5: "formTemplate6",
  };
  return map[formType] || "formTemplate0";
}

export function loadOfficialFormData(requestId: string, formType: string): OfficialFormSharedData | null {
  try {
    const key = getOfficialFormKey(requestId, formType);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as OfficialFormSharedData;
  } catch {
    return null;
  }
}

export function saveOfficialFormData(requestId: string, formType: string, data: OfficialFormSharedData): void {
  try {
    const key = getOfficialFormKey(requestId, formType);
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage may be full or unavailable
  }
}

export function extractSharedRequestData(request: InventoryRequest): Record<string, string> {
  const faculty = (request.faculty || "").trim();
  return {
    v7RequesterName: request.requesterName || "",
    v7ProposalSubject: request.reason || request.items?.[0]?.name || "",
    v7FacultySelect: request.faculty || "",
    v7FacultyDepartment: request.departmentOrPerson || "",
    v7FacultyLevel: request.currentRequestLevel || request.originalRequestLevel || "",
    // Dynamic proposal header/signature faculty — only injected when a real
    // (non-empty, non-whitespace) faculty name exists, so empty values never
    // blank out the static defaults.
    ...(faculty
      ? {
          v7HeaderFaculty: faculty,
          v7SignatureFaculty: `${faculty} رئیس`,
        }
      : {}),
  };
}

export function extractSharedItemRows(items: InventoryRequest["items"]): OfficialFormSharedData["itemRows"] {
  return (items || []).map((item, idx) => ({
    serial: String(idx + 1),
    itemName: item.name || "",
    itemType: item.specifications || item.name || "",
    itemNameType: item.specifications ? `${item.name} - ${item.specifications}` : item.name || "",
    quantity: String(item.quantity || ""),
    unit: item.unit || "",
    unitPrice: item.unitPrice ? String(item.unitPrice) : "",
    totalPrice: item.totalPrice ? String(item.totalPrice) : "",
  }));
}

/**
 * Builds the tender (جګړه پاڼه) rows from the requested items while deliberately
 * leaving both price columns empty. Tender prices are entered manually on the
 * tender form and must never be inherited from the original request.
 */
export function extractTenderItemRows(items: InventoryRequest["items"]): OfficialFormSharedData["itemRows"] {
  return (items || []).map((item, idx) => ({
    serial: String(idx + 1),
    itemName: item.name || "",
    itemType: item.specifications || item.name || "",
    itemNameType: item.specifications ? `${item.name} - ${item.specifications}` : item.name || "",
    quantity: String(item.quantity || ""),
    unit: item.unit || "",
    unitPrice: "",
    totalPrice: "",
  }));
}

export function extractVendorOfferRows(
  offers: VendorOffer[],
  requestItems: InventoryRequest["items"]
): OfficialFormSharedData["itemRows"] {
  if (!offers || offers.length === 0) return extractSharedItemRows(requestItems);

  const winner = selectWinningVendor(offers);
  if (!winner) return extractSharedItemRows(requestItems);

  return (winner.items || []).map((item, idx) => ({
    serial: String(idx + 1),
    itemName: item.itemName || "",
    itemType: item.itemName || "",
    itemNameType: item.itemName || "",
    quantity: String(item.quantity || ""),
    unit: item.unit || "",
    unitPrice: String(item.unitPrice || ""),
    totalPrice: String(item.totalPrice || item.quantity * item.unitPrice || ""),
  }));
}

export function calculateOfferTotals(offers: VendorOffer[]): number[] {
  return (offers || []).map((offer) => {
    return Number(offer.totalOfferPrice) || (offer.items || []).reduce((sum, item) => sum + (item.totalPrice || item.quantity * item.unitPrice || 0), 0);
  });
}

export function selectWinningVendor(offers: VendorOffer[]): VendorOffer | null {
  if (!offers || offers.length === 0) return null;

  const explicitlySelected = offers.find((offer) => offer.isWinner);
  if (explicitlySelected) return explicitlySelected;

  const totals = calculateOfferTotals(offers);
  const valid = totals
    .map((total, index) => ({ total, index }))
    .filter(({ total }) => Number.isFinite(total) && total > 0);
  if (valid.length === 0) return offers[0];

  const winner = valid.reduce((lowest, current) => current.total < lowest.total ? current : lowest);
  return offers[winner.index];
}

export function mapRequestToProposal(request: InventoryRequest): OfficialFormSharedData {
  const items = extractSharedItemRows(request.items ?? []) ?? [];
  const grandTotal = items.reduce((s, item) => {
    const n = parseFloat(item.totalPrice || "0");
    return s + (isFinite(n) ? n : 0);
  }, 0);
  return {
    sourceTemplateId: "formTemplate0",
    sourceFormName: "proposal",
    sharedFields: {
      ...extractSharedRequestData(request),
      v7RequesterName: request.requesterName || "",
      v7ProposalSubject: request.reason || request.items?.[0]?.name || "",
    },
    itemRows: items,
    grandTotal,
    savedAt: new Date().toISOString(),
  };
}

export function mapRequestToSI9(request: InventoryRequest): OfficialFormSharedData {
  const items = extractSharedItemRows(request.items);
  return {
    sourceTemplateId: "formTemplate5",
    sourceFormName: "si9",
    sharedFields: extractSharedRequestData(request),
    itemRows: items,
    grandTotal: 0,
    savedAt: new Date().toISOString(),
  };
}

export function mapVendorOffersToComparison(
  offers: VendorOffer[],
  requestItems: InventoryRequest["items"],
  preferredWinnerName?: string
): OfficialFormSharedData {
  const safeOffers = (offers || []).filter(Boolean);
  const preferredWinner = preferredWinnerName
    ? safeOffers.find((offer) => offer.vendorName === preferredWinnerName)
    : undefined;
  const winner = preferredWinner || selectWinningVendor(safeOffers);

  // The selected/lowest-price winner must always be the first company in the
  // comparison form, even when it was entered as the second or third offer.
  const winnerIndex = winner ? safeOffers.indexOf(winner) : -1;
  const orderedOffers = winner && winnerIndex >= 0
    ? [winner, ...safeOffers.filter((_, index) => index !== winnerIndex)]
    : safeOffers;

  const getOfferItem = (offer: VendorOffer | undefined, requestItem: any, index: number) => {
    if (!offer) return undefined;
    return (offer.items || []).find((item) =>
      (requestItem.itemId && String(item.itemId) === String(requestItem.itemId)) ||
      item.itemName === requestItem.name
    ) || (offer.items || [])[index];
  };

  const itemRows: OfficialFormSharedData["itemRows"] = (requestItems || []).map((item, idx) => {
    const v1 = getOfferItem(orderedOffers[0], item, idx);
    const v2 = getOfferItem(orderedOffers[1], item, idx);
    const v3 = getOfferItem(orderedOffers[2], item, idx);
    const priceText = (value: unknown) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? String(number) : "";
    };
    const totalText = (offerItem: typeof v1) => {
      if (!offerItem) return "";
      const savedTotal = Number(offerItem.totalPrice);
      if (Number.isFinite(savedTotal) && savedTotal > 0) return String(savedTotal);
      const quantity = Number(offerItem.quantity || item.quantity || 0);
      const unitPrice = Number(offerItem.unitPrice || 0);
      const calculated = quantity * unitPrice;
      return Number.isFinite(calculated) && calculated > 0 ? String(calculated) : "";
    };

    return {
      serial: String(idx + 1),
      itemName: item.name || "",
      itemType: item.specifications || "",
      itemNameType: item.specifications ? `${item.name} - ${item.specifications}` : item.name || "",
      quantity: String(item.quantity || v1?.quantity || ""),
      unit: item.unit || v1?.unit || "",
      unitPrice: priceText(v1?.unitPrice),
      totalPrice: totalText(v1),
      v2UnitPrice: priceText(v2?.unitPrice),
      v2TotalPrice: totalText(v2),
      v3UnitPrice: priceText(v3?.unitPrice),
      v3TotalPrice: totalText(v3),
    };
  });

  const orderedTotals = calculateOfferTotals(orderedOffers);
  const winnerName = winner?.vendorName || "";

  return {
    sourceTemplateId: "formTemplate2",
    sourceFormName: "comparison",
    sharedFields: {
      v7ProposalSubject: `مقایسوی فورم - ${orderedOffers.map(o => o.vendorName || "").join(" / ")}`,
    },
    itemRows,
    grandTotal: orderedTotals[0] || 0,
    savedAt: new Date().toISOString(),
    vendorNames: orderedOffers.map(o => o.vendorName || ""),
    vendorAddresses: orderedOffers.map(o => o.vendorAddress || ""),
    winnerVendorName: winnerName,
  } as any;
}

export function mapWinnerToPurchaseOrder(
  winner: VendorOffer,
  request: InventoryRequest
): OfficialFormSharedData {
  const itemRows: OfficialFormSharedData["itemRows"] = (winner.items || []).map((item, idx) => ({
    serial: String(idx + 1),
    itemName: item.itemName || "",
    itemType: item.itemName || "",
    itemNameType: item.itemName || "",
    quantity: String(item.quantity || ""),
    unit: item.unit || "",
    unitPrice: String(item.unitPrice || ""),
    totalPrice: String(item.totalPrice || item.quantity * item.unitPrice || ""),
  }));

  const grandTotal = calculateOfferTotals([winner])[0];

  return {
    sourceTemplateId: "formTemplate3",
    sourceFormName: "purchaseOrder",
    sharedFields: {
      ...extractSharedRequestData(request),
      v7ProposalSubject: `${winner.vendorName} - ${request.reason || ""}`,
    },
    itemRows,
    grandTotal,
    savedAt: new Date().toISOString(),
  };
}

export function mapReceivingToReceiptReport(
  receiving: ReceiptReportRecord,
  request: InventoryRequest
): OfficialFormSharedData {
  const itemRows: OfficialFormSharedData["itemRows"] = (receiving.receivedItems || request.items || []).map(
    (item: any, idx: number) => ({
      serial: String(idx + 1),
      itemName: item.itemName || item.name || "",
      itemType: item.itemType || item.specifications || "",
      itemNameType: item.itemName || item.name || "",
      quantity: String(item.quantity || item.receivedQuantity || ""),
      unit: item.unit || "",
      unitPrice: String(item.unitPrice || ""),
      totalPrice: String(item.totalPrice || ""),
    })
  );

  const grandTotal = itemRows.reduce((s, item) => {
    const n = parseFloat(item.totalPrice || "0");
    return s + (isFinite(n) ? n : 0);
  }, 0);

  return {
    sourceTemplateId: "formTemplate4",
    sourceFormName: "receiptReport",
    sharedFields: {
      ...extractSharedRequestData(request),
      v7ProposalSubject: `${receiving.vendorName} - ${request.reason || ""}`,
    },
    itemRows,
    grandTotal,
    savedAt: new Date().toISOString(),
  };
}

export function mapDeliveryToFS5(
  delivery: FS5Document,
  request: InventoryRequest
): OfficialFormSharedData {
  const itemRows: OfficialFormSharedData["itemRows"] = (delivery.items || request.items || []).map(
    (item: any, idx: number) => ({
      serial: String(idx + 1),
      itemName: item.itemName || item.name || "",
      itemType: item.itemType || item.specifications || "",
      itemNameType: item.itemName || item.name || "",
      quantity: String(item.quantity || item.deliveredQuantity || ""),
      unit: item.unit || "",
      unitPrice: String(item.unitPrice || ""),
      totalPrice: String(item.totalPrice || ""),
    })
  );

  return {
    sourceTemplateId: "formTemplate6",
    sourceFormName: "pc5",
    sharedFields: {
      ...extractSharedRequestData(request),
      v7RequesterName: delivery.receiverName || request.requesterName || "",
      v7FacultySelect: delivery.facultyName || request.faculty || "",
      v7ProposalSubject: request.reason || "",
    },
    itemRows,
    grandTotal: 0,
    savedAt: new Date().toISOString(),
  };
}

export function syncForwardOnly(
  requestId: string,
  sourceFormType: string,
  sharedData: OfficialFormSharedData
): void {
  const sourceIndex = FORM_ORDER.indexOf(sourceFormType);
  if (sourceIndex === -1) return;
  FORM_ORDER.forEach((targetFormType, targetIndex) => {
    if (targetIndex <= sourceIndex) return;
    applySharedDataToTargetForm(requestId, targetFormType, sharedData);
  });
}

export function applySharedDataToTargetForm(
  requestId: string,
  targetFormType: string,
  sharedData: OfficialFormSharedData
): void {
  const existing = loadOfficialFormData(requestId, targetFormType);
  const merged: OfficialFormSharedData = {
    ...existing,
    sharedFields: { ...sharedData.sharedFields, ...(existing?.sharedFields || {}) },
    itemRows: sharedData.itemRows,
    grandTotal: sharedData.grandTotal,
    savedAt: new Date().toISOString(),
  };
  saveOfficialFormData(requestId, targetFormType, merged);
}

export function buildAllFormsData(
  request: InventoryRequest,
  vendorOffers?: VendorOffer[],
  receiptReport?: ReceiptReportRecord | null,
  fs5?: FS5Document | null
): Record<string, OfficialFormSharedData> {
  const result: Record<string, OfficialFormSharedData> = {};

  result["formTemplate0"] = mapRequestToProposal(request);
  result["formTemplate5"] = mapRequestToSI9(request);

  if (vendorOffers && vendorOffers.length > 0) {
    result["formTemplate1"] = {
      sourceTemplateId: "formTemplate1",
      sourceFormName: "tender",
      sharedFields: extractSharedRequestData(request),
      itemRows: extractTenderItemRows(request.items),
      grandTotal: 0,
      savedAt: new Date().toISOString(),
    };
    result["formTemplate2"] = mapVendorOffersToComparison(vendorOffers, request.items);

    const winner = selectWinningVendor(vendorOffers);
    if (winner) {
      result["formTemplate3"] = mapWinnerToPurchaseOrder(winner, request);
    }
  }

  if (receiptReport) {
    result["formTemplate4"] = mapReceivingToReceiptReport(receiptReport, request);
  }

  if (fs5) {
    result["formTemplate6"] = mapDeliveryToFS5(fs5, request);
  }

  return result;
}

export function connectFormSaveToProgressTracking(
  _requestId: string,
  _formType: string,
  _stage: string
): void {
  // Progress tracking is handled by the existing request workflow.
  // Form saves are independent and do not directly trigger stage changes.
  // Stage changes happen through the Requests/Procurement/Receiving workflows.
}

export { TEMPLATE_TO_FORM, FORM_ORDER };
