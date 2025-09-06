import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document } from "@/types";
import { getCompany, getClients, getDepots, getProducts } from "@/store/localdb";
import { fmtMAD } from "@/utils/format";

export function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const depots = getDepots();
  const clientName = doc.clientId ? clients.find((c) => c.id === doc.clientId)?.name : doc.vendorName || "-";
  const depotName = doc.depotId ? depots.find((d) => d.id === doc.depotId)?.name : "-";

  const pdf = new jsPDF();

  // Header
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", 15, 10, 25, 25);
    } catch {}
  }
  pdf.setFontSize(18);
  pdf.text(company.name, 45, 18);
  pdf.setFontSize(10);
  if (company.address) pdf.text(company.address, 45, 24);
  if (company.phone) pdf.text(company.phone, 45, 29);
  if (company.email) pdf.text(company.email, 45, 34);

  pdf.setFontSize(16);
  pdf.text(`${doc.mode === "vente" ? "Vente" : "Achat"} - ${doc.type}`, 150, 15, { align: "right" });
  pdf.setFontSize(12);
  pdf.text(doc.code, 150, 22, { align: "right" });
  pdf.text(new Date(doc.date).toLocaleDateString(), 150, 28, { align: "right" });

  pdf.setFontSize(12);
  pdf.text(`Client/Fournisseur: ${clientName}`, 15, 45);
  pdf.text(`Dépôt: ${depotName}`, 15, 52);

  const body = doc.lines.map((l, idx) => {
    const p = products.find((p) => p.id === l.productId);
    const unit = p?.unit || "u";
    const lib = l.description || p?.name || l.productId;
    const pu = l.unitPrice;
    const remise = l.remiseAmount;
    const qty = l.qty;
    const total = (pu - remise) * qty;
    return [idx + 1, p?.sku || "-", lib, unit, qty, fmtMAD(pu), fmtMAD(remise), fmtMAD(total)];
  });

  autoTable(pdf, {
    head: [["#", "Réf.", "Désignation", "Unité", "Qté", "PU", "Remise", "Total"]],
    body,
    startY: 60,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  const subtotal = doc.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const remiseTotal = doc.lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
  const total = subtotal - remiseTotal;

  const endY = (pdf as any).lastAutoTable.finalY || 60;
  pdf.setFontSize(12);
  pdf.text(`Sous-total: ${fmtMAD(subtotal)}`, 195, endY + 10, { align: "right" });
  pdf.text(`Remises: ${fmtMAD(remiseTotal)}`, 195, endY + 16, { align: "right" });
  pdf.setFontSize(14);
  pdf.text(`Total: ${fmtMAD(total)}`, 195, endY + 24, { align: "right" });

  pdf.save(`${doc.code}.pdf`);
}
