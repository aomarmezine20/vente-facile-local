import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Client, Company, Document, Payment, Product } from "@/types";
import { getCompany, getClients, getDB, getProducts } from "@/store/localdb";

type PdfColor = [number, number, number];

interface TotalsRow {
  label: string;
  value: string;
  highlight: boolean;
}

interface PaymentDisplayLine {
  text: string;
  tone: "default" | "muted" | "danger" | "success";
}

interface DocumentPdfContext {
  company: Company;
  client: Client | null;
  document: Document;
  documentLabel: string;
  clientName: string;
  products: Product[];
  payments: Payment[];
  includeTVA: boolean;
  tableData: string[][];
  totalsRows: TotalsRow[];
  paymentLines: PaymentDisplayLine[];
  amountInWords: string;
  finalTotal: number;
  effectiveRowUnits: number;
}

interface PdfStylePlan {
  frameScale: number;
  bodyFontSize: number;
  headFontSize: number;
  cellPadding: number;
  minRowHeight: number;
  headRowHeight: number;
  footerFontSize: number;
  summaryFontSize: number;
  paymentFontSize: number;
  paymentLineHeight: number;
  totalsRowHeight: number;
  summaryGap: number;
}

type PdfLayoutPlan =
  | { mode: "single"; style: PdfStylePlan }
  | { mode: "multi"; style: PdfStylePlan };

const PAGE = {
  marginX: 12,
  frameTop: 8,
  continuationTop: 16,
  footerHeight: 20,
  footerReserve: 24,
  summaryGap: 8,
};

const COLORS = {
  primary: [46, 80, 144] as PdfColor,
  dark: [51, 51, 51] as PdfColor,
  muted: [100, 100, 100] as PdfColor,
  light: [245, 245, 245] as PdfColor,
  border: [180, 180, 180] as PdfColor,
  highlight: [255, 249, 214] as PdfColor,
  danger: [180, 40, 40] as PdfColor,
};

const TABLE_HEAD = [["N°", "Réf.", "Désignation", "QTE", "P.U.H.T", "Total H.T"]];

const DOC_TYPE_LABELS: Record<string, Record<string, string>> = {
  vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
  achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  interne: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
};

const SINGLE_PAGE_FRAME_SCALES = [1.16, 1.1, 1.04, 0.98, 0.92, 0.86, 0.8, 0.74, 0.68];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createPdf() {
  return new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
}

function getPageWidth(pdf: jsPDF) {
  return pdf.internal.pageSize.getWidth();
}

function getFooterTop(pdf: jsPDF) {
  return pdf.internal.pageSize.getHeight() - PAGE.footerHeight - 1;
}

function getLastAutoTableY(pdf: jsPDF) {
  return ((pdf as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0);
}

function inferImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
}

function numberToFrenchWords(num: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

  if (num === 0) return "zero";
  if (num < 0) return `moins ${numberToFrenchWords(-num)}`;

  let words = "";

  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    words += millions === 1 ? "un million " : `${numberToFrenchWords(millions)} millions `;
    num %= 1000000;
  }

  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    words += thousands === 1 ? "mille " : `${numberToFrenchWords(thousands)} mille `;
    num %= 1000;
  }

  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    words += hundreds === 1 ? "cent " : `${units[hundreds]} cent `;
    num %= 100;
  }

  if (num >= 20) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;

    if (ten === 7 || ten === 9) {
      words += `${tens[ten]}-${units[10 + unit]} `;
    } else if (ten === 8 && unit === 0) {
      words += "quatre-vingts ";
    } else {
      words += `${tens[ten]}${unit === 1 && ten !== 8 ? " et un " : unit > 0 ? `-${units[unit]} ` : " "}`;
    }
  } else if (num > 0) {
    words += `${units[num]} `;
  }

  return words.trim();
}

function amountToFrenchWords(amount: number): string {
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  let result = `${numberToFrenchWords(intPart)} dirhams`;
  if (decPart > 0) {
    result += ` et ${numberToFrenchWords(decPart)} centimes`;
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
}

function formatPdfMAD(value: number) {
  const fixed = value.toFixed(2);
  const [intPart, decimalPart] = fixed.split(".");
  return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decimalPart}`;
}

function estimateDescriptionUnits(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return 1;
  return Math.max(1, Math.ceil(normalized.length / 34));
}

function buildPaymentLines(payments: Payment[], finalTotal: number): PaymentDisplayLine[] {
  if (payments.length === 0) {
    return [{ text: "• En attente de paiement", tone: "muted" }];
  }

  const methodLabels: Record<string, string> = {
    especes: "Especes",
    cheque: "Cheque",
    virement: "Virement bancaire",
    carte: "Carte bancaire",
    versement: "Versement",
    traite: "Traite",
    autre: "Autre",
  };

  const lines: PaymentDisplayLine[] = payments.slice(0, 4).map((payment) => ({
    text: `• ${methodLabels[payment.method] || payment.method}: ${formatPdfMAD(payment.amount)} MAD (${new Date(payment.date).toLocaleDateString("fr-FR")})`,
    tone: "default" as const,
  }));

  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const remaining = finalTotal - totalPaid;

  lines.push(
    remaining > 0
      ? { text: `Reste a payer: ${formatPdfMAD(Math.max(remaining, 0))} MAD`, tone: "danger" }
      : { text: "PAYE INTEGRALEMENT", tone: "success" },
  );

  return lines;
}

function buildContext(doc: Document): DocumentPdfContext {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const productMap = new Map(products.map((product) => [product.id, product]));
  const payments = getDB().payments.filter((payment) => payment.documentId === doc.id);
  const client = doc.clientId ? clients.find((currentClient) => currentClient.id === doc.clientId) ?? null : null;
  const clientName = client?.name || doc.vendorName || "-";
  const includeTVA = doc.includeTVA === true;

  const tableData = doc.lines.map((line, index) => {
    const product = productMap.get(line.productId);
    const priceHT = line.unitPrice / 1.2;
    const remiseHT = (line.remiseAmount || 0) / 1.2;
    const totalLineHT = (priceHT - remiseHT) * line.qty;

    return [
      String(index + 1),
      product?.sku || "-",
      line.description || product?.name || "",
      String(line.qty),
      formatPdfMAD(priceHT),
      formatPdfMAD(totalLineHT),
    ];
  });

  const totalHTBrut = doc.lines.reduce((sum, line) => sum + (line.unitPrice / 1.2) * line.qty, 0);
  const remiseTotalHT = doc.lines.reduce((sum, line) => sum + ((line.remiseAmount || 0) / 1.2) * line.qty, 0);
  const totalHTNet = totalHTBrut - remiseTotalHT;
  const totalTVA = includeTVA ? totalHTNet * 0.2 : 0;
  const finalTotal = includeTVA ? totalHTNet + totalTVA : totalHTNet;

  const totalsRows: TotalsRow[] = [
    { label: "Total H.T(HR)", value: formatPdfMAD(totalHTBrut), highlight: false },
    { label: "Remise H.T", value: formatPdfMAD(remiseTotalHT), highlight: false },
    { label: "Total H.T(NET)", value: formatPdfMAD(totalHTNet), highlight: false },
  ];

  if (includeTVA) {
    totalsRows.push({ label: "T.V.A", value: formatPdfMAD(totalTVA), highlight: false });
  }

  totalsRows.push({ label: "NET A PAYER T.T.C", value: formatPdfMAD(finalTotal), highlight: true });

  return {
    company,
    client,
    document: doc,
    documentLabel: DOC_TYPE_LABELS[doc.mode]?.[doc.type] || doc.type,
    clientName,
    products,
    payments,
    includeTVA,
    tableData,
    totalsRows,
    paymentLines: doc.type === "FA" ? buildPaymentLines(payments, finalTotal) : [],
    amountInWords: amountToFrenchWords(finalTotal),
    finalTotal,
    effectiveRowUnits: doc.lines.reduce((sum, line) => {
      const description = line.description || productMap.get(line.productId)?.name || "";
      return sum + estimateDescriptionUnits(description);
    }, 0) || 1,
  };
}

function drawLogoPlaceholder(pdf: jsPDF) {
  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(16, 12, 28, 32, 2, 2, "S");
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.primary);
  pdf.text("SMART", 22, 24);
  pdf.setFontSize(10);
  pdf.text("EXIT", 24, 31);
  pdf.setFontSize(5);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(...COLORS.muted);
  pdf.text("be open be smart", 19, 38);
}

function drawFooter(pdf: jsPDF, company: Company, fontSize: number) {
  const pageWidth = getPageWidth(pdf);
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerY = pageHeight - 18;
  const safeFontSize = clamp(fontSize, 7, 8.2);

  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(0.5);
  pdf.line(PAGE.marginX, footerY, pageWidth - PAGE.marginX, footerY);

  pdf.setFontSize(safeFontSize);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.dark);
  pdf.text(
    `S.A.R.L au capital de ${company.capital || "200.000,00 DH"} | Siege: ${company.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA"}`,
    pageWidth / 2,
    footerY + 4,
    { align: "center" },
  );

  pdf.setFont("helvetica", "normal");
  pdf.text(
    `Tel: ${company.phone || "+212 522995252"} | Email: ${company.email || "contact.smartexit@gmail.com"}`,
    pageWidth / 2,
    footerY + 8,
    { align: "center" },
  );
  pdf.text(
    `RC: ${company.rc || "487155"} | IF: ${company.if || "48541278"} | TP: ${company.tp || "32252429"} | ICE: ${company.ice || "002726225000084"}`,
    pageWidth / 2,
    footerY + 12,
    { align: "center" },
  );
}

function drawPageNumber(pdf: jsPDF, pageNumber: number, totalPages: number) {
  const pageWidth = getPageWidth(pdf);
  const pageHeight = pdf.internal.pageSize.getHeight();

  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(150, 150, 150);
  pdf.text(`Page ${pageNumber}/${totalPages}`, pageWidth - 14, pageHeight - 3, { align: "right" });
}

function drawHeader(pdf: jsPDF, context: DocumentPdfContext, scale: number) {
  const pageWidth = getPageWidth(pdf);
  const headerHeight = clamp(38 * scale, 34, 46);
  const headerWidth = pageWidth - PAGE.marginX * 2;
  const logoWidth = clamp(26 * scale, 24, 30);
  const logoHeight = clamp(30 * scale, 28, 34);
  const docBoxWidth = 58;
  const docBoxHeight = clamp(headerHeight - 12, 24, 34);
  const docBoxX = pageWidth - PAGE.marginX - docBoxWidth - 4;
  const docBoxY = PAGE.frameTop + (headerHeight - docBoxHeight) / 2;
  const textX = 16 + logoWidth + 5;
  const textMaxWidth = docBoxX - textX - 4;

  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(PAGE.marginX, PAGE.frameTop, headerWidth, headerHeight, 3, 3, "S");
  pdf.roundedRect(docBoxX, docBoxY, docBoxWidth, docBoxHeight, 2, 2, "S");

  if (context.company.logoDataUrl) {
    try {
      pdf.addImage(context.company.logoDataUrl, inferImageFormat(context.company.logoDataUrl), 16, 10, logoWidth, logoHeight);
    } catch {
      drawLogoPlaceholder(pdf);
    }
  } else {
    drawLogoPlaceholder(pdf);
  }

  pdf.setTextColor(...COLORS.dark);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(clamp(16 * scale, 13, 18));
  const companyNameLines = pdf.splitTextToSize(context.company.name || "SMART EXIT", textMaxWidth);
  pdf.text(companyNameLines.slice(0, 2), textX, PAGE.frameTop + headerHeight * 0.38);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.muted);
  pdf.setFontSize(clamp(8.5 * scale, 7.5, 9.5));
  const addressLines = pdf.splitTextToSize(context.company.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", textMaxWidth);
  pdf.text(addressLines.slice(0, 2), textX, PAGE.frameTop + headerHeight * 0.62);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.dark);
  pdf.setFontSize(clamp(13 * scale, 11, 15));
  pdf.text(context.documentLabel, docBoxX + docBoxWidth / 2, docBoxY + docBoxHeight * 0.44, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(clamp(8.8 * scale, 8, 10));
  pdf.text(`N° ${context.document.code}`, docBoxX + docBoxWidth / 2, docBoxY + docBoxHeight * 0.7, { align: "center" });

  return headerHeight;
}

function drawInfoSection(pdf: jsPDF, context: DocumentPdfContext, scale: number, headerHeight: number) {
  const pageWidth = getPageWidth(pdf);
  const gap = 5;
  const boxWidth = (pageWidth - PAGE.marginX * 2 - gap) / 2;
  const leftX = PAGE.marginX;
  const rightX = leftX + boxWidth + gap;
  const titleY = PAGE.frameTop + headerHeight + clamp(6 * scale, 5, 8);
  const boxY = titleY + clamp(5.5 * scale, 5, 7);
  const infoBoxHeight = clamp(18 * scale, 17, 22);
  const titleFontSize = clamp(9.8 * scale, 9, 10.5);
  const contentFontSize = clamp(8.2 * scale, 7.2, 9.2);
  const lineHeight = clamp(4.2 * scale, 3.6, 4.8);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(titleFontSize);
  pdf.setTextColor(...COLORS.primary);
  pdf.text("INFORMATIONS DOCUMENT", leftX + boxWidth / 2, titleY, { align: "center" });
  pdf.text("CLIENT", rightX + boxWidth / 2, titleY, { align: "center" });

  pdf.setFillColor(...COLORS.light);
  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(leftX, boxY, boxWidth, infoBoxHeight, 2, 2, "FD");

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(contentFontSize);
  pdf.setTextColor(...COLORS.dark);
  pdf.text(`Date: ${new Date(context.document.date).toLocaleDateString("fr-FR")}`, leftX + 6, boxY + infoBoxHeight * 0.58);

  pdf.setFontSize(contentFontSize - 0.1);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(`Type: ${context.documentLabel}`, leftX + boxWidth - 6, boxY + infoBoxHeight * 0.58, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(contentFontSize);
  const clientNameLines = pdf.splitTextToSize(context.clientName, boxWidth - 10);
  const addressLines = context.client?.address ? pdf.splitTextToSize(context.client.address, boxWidth - 10) : [];
  const clientMeta = context.client?.type === "entreprise" && context.client.ice
    ? `ICE: ${context.client.ice}`
    : context.client?.phone
      ? `Tel: ${context.client.phone}`
      : context.client?.email
        ? `Email: ${context.client.email}`
        : "";
  const clientContentLineCount = clientNameLines.length + addressLines.length + (clientMeta ? 1 : 0);
  const clientBoxHeight = Math.max(clamp(26 * scale, 24, 34), 9 + clientContentLineCount * lineHeight + 7);

  pdf.setFillColor(...COLORS.light);
  pdf.roundedRect(rightX, boxY, boxWidth, clientBoxHeight, 2, 2, "FD");

  if (context.client?.code) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(clamp(7.5 * scale, 7, 8.2));
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`Code: ${context.client.code}`, rightX + boxWidth - 5, boxY + 5, { align: "right" });
  }

  let textY = boxY + 7;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(clamp(9.4 * scale, 8.2, 10.2));
  pdf.setTextColor(...COLORS.dark);
  pdf.text(clientNameLines, rightX + 5, textY);
  textY += clientNameLines.length * lineHeight + 0.6;

  if (addressLines.length > 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(contentFontSize);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(addressLines, rightX + 5, textY);
    textY += addressLines.length * lineHeight + 0.6;
  }

  if (clientMeta) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(contentFontSize);
    pdf.setTextColor(...COLORS.dark);
    pdf.text(clientMeta, rightX + 5, Math.min(textY, boxY + clientBoxHeight - 4));
  }

  return boxY + Math.max(infoBoxHeight, clientBoxHeight) + clamp(7 * scale, 6, 9);
}

function createSinglePageStyle(context: DocumentPdfContext, frameScale: number, availableTableHeight: number): PdfStylePlan {
  const wrapPenalty = Math.max(context.effectiveRowUnits - context.document.lines.length, 0) * 0.12;
  const targetRowHeight = clamp((availableTableHeight - 12) / (context.effectiveRowUnits + 0.35), 6.3, 15.5);
  const bodyFontSize = clamp(targetRowHeight * 0.95 + 1 - wrapPenalty, 6.4, 10.2);
  const cellPadding = clamp(targetRowHeight * 0.32 - wrapPenalty * 0.4, 1.6, 5.4);

  return {
    frameScale,
    bodyFontSize,
    headFontSize: clamp(bodyFontSize + 0.45, 7, 10.8),
    cellPadding,
    minRowHeight: targetRowHeight,
    headRowHeight: clamp(targetRowHeight + 1.4, 8.2, 16.5),
    footerFontSize: clamp(7.4 * frameScale, 7, 8.2),
    summaryFontSize: clamp(8.7 * frameScale, 7.2, 9.6),
    paymentFontSize: clamp(8.2 * frameScale, 7, 9),
    paymentLineHeight: clamp(4.4 * frameScale, 4, 5.3),
    totalsRowHeight: clamp(targetRowHeight + 0.5, 7.6, 10.8),
    summaryGap: clamp(PAGE.summaryGap * frameScale, 6, 9),
  };
}

function createMultiPageStyle(context: DocumentPdfContext): PdfStylePlan {
  const wrapPenalty = Math.max(context.effectiveRowUnits - context.document.lines.length, 0) * 0.08;
  const bodyFontSize = clamp(8.8 - wrapPenalty, 7.2, 9);
  const cellPadding = clamp(2.9 - wrapPenalty * 0.6, 1.7, 3.2);
  const minRowHeight = clamp(7.6 - wrapPenalty * 0.5, 6.7, 8.4);

  return {
    frameScale: 1,
    bodyFontSize,
    headFontSize: clamp(bodyFontSize + 0.4, 7.5, 9.4),
    cellPadding,
    minRowHeight,
    headRowHeight: 9.2,
    footerFontSize: 8,
    summaryFontSize: 8.6,
    paymentFontSize: 8.1,
    paymentLineHeight: 4.4,
    totalsRowHeight: 8.2,
    summaryGap: 8,
  };
}

function measureSummaryBlock(pdf: jsPDF, context: DocumentPdfContext, style: PdfStylePlan) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(style.summaryFontSize);
  const amountLines = pdf.splitTextToSize(context.amountInWords, 84);
  const amountLineHeight = clamp(style.summaryFontSize * 0.48, 4, 5.1);
  const wordsBlockHeight = 5 + amountLines.length * amountLineHeight + 4;
  const totalsBlockHeight = context.totalsRows.length * style.totalsRowHeight;
  let totalHeight = Math.max(wordsBlockHeight, totalsBlockHeight);

  if (context.document.type === "FA") {
    const paymentTitleHeight = clamp(10 * style.frameScale, 8, 12);
    const paymentBodyHeight = Math.max(10, context.paymentLines.length * style.paymentLineHeight + 6);
    totalHeight += paymentTitleHeight + paymentBodyHeight + 5;
  }

  return totalHeight;
}

function renderTable(pdf: jsPDF, context: DocumentPdfContext, style: PdfStylePlan, startY: number, singlePage: boolean) {
  autoTable(pdf, {
    startY,
    head: TABLE_HEAD,
    body: context.tableData,
    theme: "grid",
    showHead: "everyPage",
    pageBreak: singlePage ? "avoid" : "auto",
    rowPageBreak: "avoid",
    margin: {
      top: PAGE.continuationTop,
      left: PAGE.marginX,
      right: PAGE.marginX,
      bottom: PAGE.footerReserve,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: COLORS.dark,
      fontStyle: "bold",
      fontSize: style.headFontSize,
      halign: "center",
      valign: "middle",
      cellPadding: style.cellPadding,
      minCellHeight: style.headRowHeight,
    },
    bodyStyles: {
      fontSize: style.bodyFontSize,
      textColor: COLORS.dark,
      cellPadding: style.cellPadding,
      valign: "middle",
      minCellHeight: style.minRowHeight,
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: COLORS.light,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 13 },
      1: { halign: "center", cellWidth: 23 },
      2: { halign: "left", cellWidth: 72 },
      3: { halign: "center", cellWidth: 16 },
      4: { halign: "right", cellWidth: 30 },
      5: { halign: "right", cellWidth: 32 },
    },
    styles: {
      lineColor: COLORS.border,
      lineWidth: 0.15,
      font: "helvetica",
    },
    didDrawPage: () => {
      drawFooter(pdf, context.company, style.footerFontSize);
    },
  });
}

function drawTotalsAndPayment(pdf: jsPDF, context: DocumentPdfContext, style: PdfStylePlan, startY: number) {
  const pageWidth = getPageWidth(pdf);
  const totalsWidth = 90;
  const totalsX = pageWidth - PAGE.marginX - totalsWidth;
  const labelColWidth = 48;
  const valueColWidth = totalsWidth - labelColWidth;
  const amountLineHeight = clamp(style.summaryFontSize * 0.48, 4, 5.1);
  const words = pdf.splitTextToSize(context.amountInWords, 84);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(style.summaryFontSize);
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Montant en lettres :", PAGE.marginX, startY);

  pdf.setTextColor(...COLORS.dark);
  pdf.text(words, PAGE.marginX, startY + 5);

  let totalsY = startY - 6;

  context.totalsRows.forEach((row) => {
    const fillColor: PdfColor = row.highlight ? COLORS.highlight : [255, 255, 255];
    pdf.setFillColor(...fillColor);
    pdf.rect(totalsX, totalsY, labelColWidth, style.totalsRowHeight, "FD");
    pdf.rect(totalsX + labelColWidth, totalsY, valueColWidth, style.totalsRowHeight, "FD");

    pdf.setDrawColor(...COLORS.border);
    pdf.setLineWidth(0.2);
    pdf.rect(totalsX, totalsY, labelColWidth, style.totalsRowHeight, "S");
    pdf.rect(totalsX + labelColWidth, totalsY, valueColWidth, style.totalsRowHeight, "S");

    pdf.setFont("helvetica", row.highlight ? "bold" : "normal");
    pdf.setFontSize(style.summaryFontSize);
    pdf.setTextColor(...COLORS.dark);
    pdf.text(row.label, totalsX + 2, totalsY + style.totalsRowHeight * 0.65);
    pdf.text(row.value, totalsX + totalsWidth - 2, totalsY + style.totalsRowHeight * 0.65, { align: "right" });

    totalsY += style.totalsRowHeight;
  });

  let bottomY = Math.max(totalsY, startY + 5 + words.length * amountLineHeight);

  if (context.document.type === "FA") {
    const paymentY = bottomY + 4;
    const paymentBoxWidth = 76;
    const paymentTitleHeight = clamp(8 * style.frameScale, 8, 10);
    let lineY = paymentY + 14 * style.frameScale;

    pdf.setDrawColor(...COLORS.primary);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(PAGE.marginX, paymentY, paymentBoxWidth, paymentTitleHeight, 2, 2, "S");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(style.paymentFontSize);
    pdf.setTextColor(...COLORS.dark);
    pdf.text("Mode de paiement", PAGE.marginX + paymentBoxWidth / 2, paymentY + paymentTitleHeight * 0.68, { align: "center" });

    context.paymentLines.forEach((paymentLine) => {
      pdf.setFont("helvetica", paymentLine.tone === "default" || paymentLine.tone === "muted" ? "normal" : "bold");
      pdf.setFontSize(style.paymentFontSize);

      if (paymentLine.tone === "danger") {
        pdf.setTextColor(...COLORS.danger);
      } else if (paymentLine.tone === "success") {
        pdf.setTextColor(...COLORS.primary);
      } else if (paymentLine.tone === "muted") {
        pdf.setTextColor(...COLORS.muted);
      } else {
        pdf.setTextColor(...COLORS.dark);
      }

      pdf.text(paymentLine.text, PAGE.marginX, lineY);
      lineY += style.paymentLineHeight;
    });

    bottomY = Math.max(bottomY, lineY);
  }

  return bottomY;
}

function drawFirstPageFrame(pdf: jsPDF, context: DocumentPdfContext, frameScale: number) {
  const headerHeight = drawHeader(pdf, context, frameScale);
  return drawInfoSection(pdf, context, frameScale, headerHeight);
}

function trySinglePageLayout(context: DocumentPdfContext, frameScale: number) {
  const pdf = createPdf();
  const tableStartY = drawFirstPageFrame(pdf, context, frameScale);
  let availableTableHeight = getFooterTop(pdf) - tableStartY - 70;

  if (availableTableHeight < 38) {
    return null;
  }

  let style = createSinglePageStyle(context, frameScale, availableTableHeight);
  let summaryHeight = measureSummaryBlock(pdf, context, style);
  availableTableHeight = getFooterTop(pdf) - tableStartY - style.summaryGap - summaryHeight;

  if (availableTableHeight < 34) {
    return null;
  }

  style = createSinglePageStyle(context, frameScale, availableTableHeight);
  summaryHeight = measureSummaryBlock(pdf, context, style);
  renderTable(pdf, context, style, tableStartY, true);

  const finalY = getLastAutoTableY(pdf);
  const fitsOnSinglePage = pdf.getNumberOfPages() === 1 && finalY + style.summaryGap + summaryHeight <= getFooterTop(pdf);

  return fitsOnSinglePage ? style : null;
}

function chooseLayout(context: DocumentPdfContext): PdfLayoutPlan {
  for (const frameScale of SINGLE_PAGE_FRAME_SCALES) {
    const singlePageStyle = trySinglePageLayout(context, frameScale);
    if (singlePageStyle) {
      return { mode: "single", style: singlePageStyle };
    }
  }

  return { mode: "multi", style: createMultiPageStyle(context) };
}

export async function generateDocumentPdf(doc: Document) {
  const context = buildContext(doc);
  const layout = chooseLayout(context);
  const pdf = createPdf();
  const tableStartY = drawFirstPageFrame(pdf, context, layout.style.frameScale);

  renderTable(pdf, context, layout.style, tableStartY, layout.mode === "single");

  let summaryY = getLastAutoTableY(pdf) + layout.style.summaryGap;
  const summaryHeight = measureSummaryBlock(pdf, context, layout.style);

  if (layout.mode === "multi" && summaryY + summaryHeight > getFooterTop(pdf)) {
    pdf.addPage();
    drawFooter(pdf, context.company, layout.style.footerFontSize);
    summaryY = PAGE.continuationTop;
  }

  drawTotalsAndPayment(pdf, context, layout.style, summaryY);

  if (layout.mode === "multi") {
    const totalPages = pdf.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      pdf.setPage(pageNumber);
      drawPageNumber(pdf, pageNumber, totalPages);
    }
  }

  pdf.save(`${doc.code}.pdf`);
}