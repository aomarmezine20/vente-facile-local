import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document } from "@/types";
import { getCompany, getClients, getDepots, getProducts, getDB } from "@/store/localdb";
import { fmtMAD } from "@/utils/format";

// Convert number to French words
function numberToFrenchWords(num: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  
  if (num === 0) return 'zéro';
  if (num < 0) return 'moins ' + numberToFrenchWords(-num);
  
  let words = '';
  
  if (num >= 1000000) {
    const millions = Math.floor(num / 1000000);
    words += (millions === 1 ? 'un million ' : numberToFrenchWords(millions) + ' millions ');
    num %= 1000000;
  }
  
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    words += (thousands === 1 ? 'mille ' : numberToFrenchWords(thousands) + ' mille ');
    num %= 1000;
  }
  
  if (num >= 100) {
    const hundreds = Math.floor(num / 100);
    words += (hundreds === 1 ? 'cent ' : units[hundreds] + ' cent ');
    num %= 100;
  }
  
  if (num >= 20) {
    const ten = Math.floor(num / 10);
    const unit = num % 10;
    if (ten === 7 || ten === 9) {
      words += tens[ten] + '-' + units[10 + unit] + ' ';
    } else if (ten === 8 && unit === 0) {
      words += 'quatre-vingts ';
    } else {
      words += tens[ten] + (unit === 1 && ten !== 8 ? ' et un ' : (unit > 0 ? '-' + units[unit] + ' ' : ' '));
    }
  } else if (num > 0) {
    words += units[num] + ' ';
  }
  
  return words.trim();
}

function amountToFrenchWords(amount: number): string {
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  
  let result = numberToFrenchWords(intPart) + ' dirhams';
  if (decPart > 0) {
    result += ' et ' + numberToFrenchWords(decPart) + ' centimes';
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const depots = getDepots();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;
  const clientName = client?.name || doc.vendorName || "-";
  const depotName = doc.depotId ? depots.find((d) => d.id === doc.depotId)?.name : "-";

  const pdf = new jsPDF();
  const pageHeight = 297;
  const pageWidth = 210;

  // Header - Company info
  let currentY = 15;
  
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", 15, currentY, 25, 25);
    } catch {}
  }
  
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(company.name || "SMART EXIT", 45, currentY + 8);
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  if (company.address) pdf.text(company.address, 45, currentY + 14);
  if (company.phone) pdf.text(`Tél: ${company.phone}`, 45, currentY + 19);
  if (company.email) pdf.text(`Email: ${company.email}`, 45, currentY + 24);

  // Document type and info - right side
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RÉCEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };
  pdf.text(typeMap[doc.mode][doc.type], 195, currentY + 8, { align: "right" });
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text(`N°: ${doc.code}`, 195, currentY + 15, { align: "right" });
  pdf.text(`Date: ${new Date(doc.date).toLocaleDateString('fr-FR')}`, 195, currentY + 21, { align: "right" });

  // Client info box
  currentY = 50;
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.rect(15, currentY, 90, 20);
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text(doc.mode === "vente" ? "CLIENT:" : "FOURNISSEUR:", 18, currentY + 6);
  pdf.setFont("helvetica", "normal");
  pdf.text(clientName, 18, currentY + 12);
  if (client?.address) {
    pdf.setFontSize(8);
    pdf.text(client.address, 18, currentY + 17);
  }

  // Depot info
  pdf.setFontSize(9);
  pdf.text(`Dépôt: ${depotName}`, 120, currentY + 10);

  // Product table - styled like reference
  currentY = 80;
  
  const body = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    const pu = l.unitPrice;
    const remise = l.remiseAmount;
    const qty = l.qty;
    const totalHT = (pu - remise) * qty;
    
    // Build designation with product details
    let designation = l.description || p?.name || "";
    if (p) {
      const details: string[] = [];
      if ((p as any).brand) details.push(`Marque: ${(p as any).brand}`);
      if ((p as any).origin) details.push(`Origine: ${(p as any).origin}`);
      if ((p as any).material) details.push(`Matériaux: ${(p as any).material}`);
      details.push("Garantie: à vie");
      if (details.length > 0) {
        designation += "\n" + details.join("\n");
      }
    }
    
    return [
      idx + 1,
      designation,
      qty,
      fmtMAD(pu - remise),
      fmtMAD(totalHT)
    ];
  });

  autoTable(pdf, {
    head: [["N°", "Désignation", "Quantité", "P.U.H.T (Dhs)", "Montant H.T (Dhs)"]],
    body,
    startY: currentY,
    styles: { 
      fontSize: 9,
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'left', cellWidth: 80 },
      2: { halign: 'center', cellWidth: 25 },
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 35 },
    },
    margin: { left: 15, right: 15 },
    theme: 'grid',
  });

  // Totals section
  const tableEndY = (pdf as any).lastAutoTable.finalY || currentY + 50;
  
  const subtotal = doc.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0);
  const tva = subtotal * 0.20;
  const totalTTC = subtotal + tva;

  // Draw totals table on the right
  const totalsX = 120;
  let totalsY = tableEndY + 5;
  
  // Total H.T row
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.3);
  pdf.rect(totalsX, totalsY, 40, 7);
  pdf.rect(totalsX + 40, totalsY, 35, 7);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Total H.T", totalsX + 2, totalsY + 5);
  pdf.text(fmtMAD(subtotal), totalsX + 73, totalsY + 5, { align: "right" });
  
  // TVA row
  totalsY += 7;
  pdf.rect(totalsX, totalsY, 40, 7);
  pdf.rect(totalsX + 40, totalsY, 35, 7);
  pdf.text("Montant TVA 20%", totalsX + 2, totalsY + 5);
  pdf.text(fmtMAD(tva), totalsX + 73, totalsY + 5, { align: "right" });
  
  // Total TTC row
  totalsY += 7;
  pdf.rect(totalsX, totalsY, 40, 7);
  pdf.rect(totalsX + 40, totalsY, 35, 7);
  pdf.setFont("helvetica", "bold");
  pdf.text("Total TTC", totalsX + 2, totalsY + 5);
  pdf.text(fmtMAD(totalTTC) + " MAD", totalsX + 73, totalsY + 5, { align: "right" });

  // Amount in words
  totalsY += 12;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const amountWords = amountToFrenchWords(totalTTC);
  pdf.text("Arrêtée la présente facture à la somme de :", 15, totalsY);
  pdf.setFont("helvetica", "bold");
  pdf.text(amountWords, 15, totalsY + 5);

  // Show payments if this is a facture with payments
  if (doc.type === "FA") {
    const db = getDB();
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    if (payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = totalTTC - totalPaid;
      
      let payY = totalsY + 15;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Paiements:", 15, payY);
      payY += 5;
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      payments.forEach(payment => {
        const methodLabels: Record<string, string> = {
          especes: "Espèces",
          cheque: "Chèque",
          virement: "Virement",
          carte: "Carte",
          autre: "Autre"
        };
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString('fr-FR');
        pdf.text(`${date} - ${method}: ${fmtMAD(payment.amount)}`, 20, payY);
        payY += 4;
      });
      
      payY += 2;
      pdf.setFontSize(9);
      if (remaining > 0) {
        pdf.setTextColor(220, 38, 38);
        pdf.text(`Reste à payer: ${fmtMAD(remaining)}`, 15, payY);
        pdf.setTextColor(0, 0, 0);
      } else {
        pdf.setTextColor(22, 163, 74);
        pdf.text("Payé intégralement", 15, payY);
        pdf.setTextColor(0, 0, 0);
      }
    }
  }

  // Footer at very bottom of page
  const footerY = pageHeight - 20;
  
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.5);
  pdf.line(15, footerY - 12, 195, footerY - 12);
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  
  // Line 1: Capital and address
  const companyAny = company as any;
  const capitalText = companyAny.capital ? `S.A.R.L au capital de ${companyAny.capital} DH` : "S.A.R.L au capital de 200.000,00 DH";
  const line1 = `${capitalText}* Siège : ${company.address || "14 Rue Hatimi Riviera, Casablanca"}`;
  pdf.text(line1, pageWidth / 2, footerY - 8, { align: "center" });
  
  // Line 2: Phone numbers
  pdf.setFont("helvetica", "normal");
  const phoneText = company.phone || "+212 661 85 71 32 / +212 6 19 57 23 19 / +212 5 22 99 52 52";
  pdf.text(`Tél : ${phoneText}`, pageWidth / 2, footerY - 4, { align: "center" });
  
  // Line 3: Email
  const emailText = company.email || "contact.smartexit@gmail.com";
  pdf.text(`Email: ${emailText}`, pageWidth / 2, footerY, { align: "center" });
  
  // Line 4: Legal info
  const rc = companyAny.rc || "487155";
  const ifNum = companyAny.identifiantFiscal || "48541278";
  const tp = companyAny.tp || "32252429";
  const ice = companyAny.ice || "002726225000084";
  pdf.text(`RC: ${rc} - IF: ${ifNum} - TP: ${tp} ICE: ${ice}`, pageWidth / 2, footerY + 4, { align: "center" });

  pdf.save(`${doc.code}.pdf`);
}