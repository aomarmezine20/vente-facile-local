import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document } from "@/types";
import { getCompany, getClients, getDepots, getProducts, getDB } from "@/store/localdb";
import { fmtMAD } from "@/utils/format";

export function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const depots = getDepots();
  const clientName = doc.clientId ? clients.find((c) => c.id === doc.clientId)?.name : doc.vendorName || "-";
  const depotName = doc.depotId ? depots.find((d) => d.id === doc.depotId)?.name : "-";

  const pdf = new jsPDF();

  // Calculate content height and center vertically
  const lineCount = doc.lines.length;
  const estimatedContentHeight = 80 + (lineCount * 10) + 50;
  const pageHeight = 297; // A4 height in mm
  const startY = Math.max(30, (pageHeight - estimatedContentHeight) / 2);

  // Header
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", 15, startY, 25, 25);
    } catch {}
  }
  pdf.setFontSize(18);
  pdf.text(company.name, 45, startY + 8);
  pdf.setFontSize(10);
  if (company.address) pdf.text(company.address, 45, startY + 14);
  if (company.phone) pdf.text(company.phone, 45, startY + 19);
  if (company.email) pdf.text(company.email, 45, startY + 24);

  pdf.setFontSize(16);
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "Devis", BC: "Bon de commande", BL: "Bon de livraison", BR: "Bon de retour", FA: "Facture" },
    achat: { DV: "Devis", BC: "Bon de commande", BL: "Bon de réception", BR: "Bon de retour", FA: "Facture" },
  };
  const docLabel = `${doc.mode === "vente" ? "Vente" : "Achat"} — ${typeMap[doc.mode][doc.type]}`;
  pdf.text(docLabel, 190, startY + 5, { align: "right" });
  pdf.setFontSize(12);
  pdf.text(doc.code, 190, startY + 12, { align: "right" });
  pdf.text(new Date(doc.date).toLocaleDateString(), 190, startY + 18, { align: "right" });

  pdf.setFontSize(12);
  pdf.text(`Client/Fournisseur: ${clientName}`, 15, startY + 35);
  pdf.text(`Dépôt: ${depotName}`, 15, startY + 42);

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
    startY: startY + 50,
    styles: { 
      fontSize: 10,
      halign: 'center',
      cellPadding: 3
    },
    headStyles: { 
      fillColor: [30, 41, 59],
      halign: 'center',
      fontStyle: 'bold'
    },
    margin: { left: 20, right: 20 },
    tableWidth: 'auto',
    theme: 'grid'
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

  // Show payments if this is a facture with payments
  if (doc.type === "FA") {
    const db = getDB();
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    if (payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = total - totalPaid;
      
      let currentY = endY + 35;
      pdf.setFontSize(12);
      pdf.text("Paiements:", 15, currentY);
      currentY += 6;
      
      pdf.setFontSize(10);
      payments.forEach(payment => {
        const methodLabels: Record<string, string> = {
          especes: "Espèces",
          cheque: "Chèque",
          virement: "Virement",
          carte: "Carte",
          autre: "Autre"
        };
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString();
        pdf.text(`${date} - ${method}: ${fmtMAD(payment.amount)}`, 20, currentY);
        currentY += 5;
      });
      
      currentY += 3;
      pdf.setFontSize(12);
      pdf.text(`Total payé: ${fmtMAD(totalPaid)}`, 195, currentY, { align: "right" });
      currentY += 6;
      if (remaining > 0) {
        pdf.setFontSize(11);
        pdf.setTextColor(220, 38, 38);
        pdf.text(`Reste à payer: ${fmtMAD(remaining)}`, 195, currentY, { align: "right" });
        pdf.setTextColor(0, 0, 0);
      } else {
        pdf.setFontSize(11);
        pdf.setTextColor(22, 163, 74);
        pdf.text("Payé intégralement", 195, currentY, { align: "right" });
        pdf.setTextColor(0, 0, 0);
      }
    }
  }

  // Add footer
  const footerY = 25;
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  
  // Draw footer line
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(15, footerY + 10, 195, footerY + 10);
  
  // Footer text - centered
  pdf.setFont("helvetica", "bold");
  pdf.text("S.A.R.L au capital de 200.000.00 DH* Siège : 14 Rue Hatimi Riviera, Casablanca", 105, footerY + 5, { align: "center" });
  
  pdf.setFont("helvetica", "normal");
  pdf.text("Tél : +212 661 85 71 32 / +212 6 19 57 23 19 / +212 5 22 99 52 52", 105, footerY, { align: "center" });
  pdf.text("Email: contact.smartexit@gmail.com", 105, footerY - 5, { align: "center" });
  pdf.text("RC: 487155 - IF: 48541278 - TP: 32252429 ICE: 002726225000084", 105, footerY - 10, { align: "center" });

  pdf.save(`${doc.code}.pdf`);
}
