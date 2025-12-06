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
  const companyAny = company as any;

  const pdf = new jsPDF();
  const pageHeight = 297;
  const pageWidth = 210;

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 95]; // Dark blue
  const accentColor: [number, number, number] = [70, 130, 180]; // Steel blue

  // ============ HEADER SECTION ============
  let currentY = 12;

  // Company header with background
  pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.rect(0, 0, pageWidth, 35, 'F');

  // Company logo
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", 15, 5, 25, 25);
    } catch {}
  }

  // Company name and info - white text on dark background
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(company.name || "SMART EXIT", 45, 15);
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  if (company.address) pdf.text(company.address, 45, 22);
  const contactLine = [company.phone, company.email].filter(Boolean).join(" | ");
  if (contactLine) pdf.text(contactLine, 45, 28);

  // Document type badge on right
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(140, 8, 55, 20, 3, 3, 'F');
  
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RÉCEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };
  pdf.text(typeMap[doc.mode][doc.type], 167.5, 16, { align: "center" });
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`N° ${doc.code}`, 167.5, 23, { align: "center" });

  // Reset text color
  pdf.setTextColor(0, 0, 0);

  // ============ DOCUMENT INFO SECTION ============
  currentY = 45;

  // Date and reference box
  pdf.setFillColor(245, 247, 250);
  pdf.rect(15, currentY, 85, 25, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(15, currentY, 85, 25);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text("INFORMATIONS DOCUMENT", 20, currentY + 6);
  
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Date: ${new Date(doc.date).toLocaleDateString('fr-FR')}`, 20, currentY + 13);
  pdf.text(`Dépôt: ${depotName}`, 20, currentY + 19);

  // Client info box
  pdf.setFillColor(245, 247, 250);
  pdf.rect(110, currentY, 85, 25, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(110, currentY, 85, 25);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text(doc.mode === "vente" ? "CLIENT" : "FOURNISSEUR", 115, currentY + 6);
  
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "normal");
  pdf.text(clientName, 115, currentY + 13);
  if (client?.address) {
    const addressLines = client.address.length > 35 
      ? [client.address.substring(0, 35), client.address.substring(35, 70)]
      : [client.address];
    addressLines.forEach((line, i) => {
      pdf.setFontSize(8);
      pdf.text(line, 115, currentY + 18 + (i * 4));
    });
  }

  // ============ PRODUCTS TABLE ============
  currentY = 80;

  const body = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    const pu = l.unitPrice;
    const remise = l.remiseAmount;
    const qty = l.qty;
    const totalHT = (pu - remise) * qty;
    const ref = p?.sku || "-";
    const designation = l.description || p?.name || "";
    
    return [
      idx + 1,
      ref,
      designation,
      qty,
      fmtMAD(pu),
      remise > 0 ? fmtMAD(remise) : "-",
      fmtMAD(totalHT)
    ];
  });

  autoTable(pdf, {
    head: [["N°", "Réf.", "Désignation", "Qté", "P.U.H.T", "Remise", "Total H.T"]],
    body,
    startY: currentY,
    styles: { 
      fontSize: 9,
      cellPadding: 4,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      textColor: [50, 50, 50],
    },
    headStyles: { 
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'left', cellWidth: 55 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 30, minCellWidth: 30 },
      5: { halign: 'right', cellWidth: 22 },
      6: { halign: 'right', cellWidth: 34, minCellWidth: 34 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    margin: { left: 15, right: 15 },
    theme: 'grid',
  });

  // ============ TOTALS SECTION ============
  const tableEndY = (pdf as any).lastAutoTable.finalY || currentY + 50;
  
  const subtotal = doc.lines.reduce((s, l) => s + (l.unitPrice - l.remiseAmount) * l.qty, 0);
  const remiseTotal = doc.lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
  const includeTVA = doc.includeTVA === true;
  const tva = includeTVA ? subtotal * 0.20 : 0;
  const totalFinal = subtotal + tva;

  let totalsY = tableEndY + 8;
  const totalsX = 125;
  const totalsWidth = 70;
  const boxHeight = includeTVA ? 40 : 30;
  
  // Totals box with styling
  pdf.setFillColor(245, 247, 250);
  pdf.roundedRect(totalsX, totalsY - 3, totalsWidth, boxHeight, 2, 2, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.roundedRect(totalsX, totalsY - 3, totalsWidth, boxHeight, 2, 2);

  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  
  // Total H.T
  pdf.setFont("helvetica", "normal");
  pdf.text("Total H.T:", totalsX + 5, totalsY + 5);
  pdf.text(fmtMAD(subtotal), totalsX + totalsWidth - 5, totalsY + 5, { align: "right" });
  
  // Remises
  if (remiseTotal > 0) {
    totalsY += 7;
    pdf.text("Remises:", totalsX + 5, totalsY + 5);
    pdf.text(`-${fmtMAD(remiseTotal)}`, totalsX + totalsWidth - 5, totalsY + 5, { align: "right" });
  }
  
  // TVA - only show if includeTVA is true
  if (includeTVA) {
    totalsY += 7;
    pdf.text("TVA 20%:", totalsX + 5, totalsY + 5);
    pdf.text(fmtMAD(tva), totalsX + totalsWidth - 5, totalsY + 5, { align: "right" });
  }
  
  // Separator line
  totalsY += 8;
  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setLineWidth(0.5);
  pdf.line(totalsX + 5, totalsY, totalsX + totalsWidth - 5, totalsY);
  
  // Total label based on TVA inclusion
  totalsY += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text(includeTVA ? "TOTAL TTC:" : "TOTAL H.T:", totalsX + 5, totalsY + 2);
  pdf.text(fmtMAD(totalFinal) + " MAD", totalsX + totalsWidth - 5, totalsY + 2, { align: "right" });

  // Amount in words on the left
  let leftY = tableEndY + 10;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  pdf.text("Arrêtée la présente facture à la somme de:", 15, leftY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(50, 50, 50);
  
  const amountWords = amountToFrenchWords(totalFinal);
  const splitWords = pdf.splitTextToSize(amountWords, 100);
  pdf.text(splitWords, 15, leftY + 5);

  // ============ PAYMENT SECTION ============
  if (doc.type === "FA") {
    const db = getDB();
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    let payY = leftY + 20;
    
    // Payment section header
    pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    pdf.rect(15, payY, 90, 6, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("MODE DE PAIEMENT", 20, payY + 4.5);
    
    payY += 10;
    pdf.setTextColor(50, 50, 50);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    
    if (payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = totalFinal - totalPaid;
      
      const methodLabels: Record<string, string> = {
        especes: "Espèces",
        cheque: "Chèque",
        virement: "Virement bancaire",
        carte: "Carte bancaire",
        versement: "Versement",
        traite: "Traite",
        autre: "Autre"
      };
      
      payments.forEach((payment, i) => {
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString('fr-FR');
        pdf.text(`• ${method}: ${fmtMAD(payment.amount)} (${date})`, 18, payY);
        payY += 5;
      });
      
      payY += 3;
      pdf.setFont("helvetica", "bold");
      if (remaining > 0) {
        pdf.setTextColor(200, 50, 50);
        pdf.text(`Reste à payer: ${fmtMAD(remaining)}`, 18, payY);
      } else {
        pdf.setTextColor(50, 150, 80);
        pdf.text("PAYÉ INTÉGRALEMENT", 18, payY);
      }
    } else {
      pdf.text("• En attente de paiement", 18, payY);
    }
  }

  // ============ FOOTER ============
  const footerY = pageHeight - 25;
  
  // Footer separator line
  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setLineWidth(1);
  pdf.line(15, footerY - 10, 195, footerY - 10);
  
  pdf.setTextColor(50, 50, 50);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  
  // Line 1: Capital and address
  const capitalText = companyAny.capital ? `S.A.R.L au capital de ${companyAny.capital} DH` : "S.A.R.L au capital de 200.000,00 DH";
  const addressText = company.address || "14 Rue Hatimi Riviera, Casablanca";
  pdf.text(`${capitalText} • Siège: ${addressText}`, pageWidth / 2, footerY - 5, { align: "center" });
  
  // Line 2: Contact
  pdf.setFont("helvetica", "normal");
  const phoneText = company.phone || "+212 661 85 71 32 / +212 6 19 57 23 19 / +212 5 22 99 52 52";
  const emailText = company.email || "contact.smartexit@gmail.com";
  pdf.text(`Tél: ${phoneText} | Email: ${emailText}`, pageWidth / 2, footerY, { align: "center" });
  
  // Line 3: Legal info
  const rc = companyAny.rc || "487155";
  const ifNum = companyAny.identifiantFiscal || "48541278";
  const tp = companyAny.tp || "32252429";
  const ice = companyAny.ice || "002726225000084";
  pdf.text(`RC: ${rc} | IF: ${ifNum} | TP: ${tp} | ICE: ${ice}`, pageWidth / 2, footerY + 5, { align: "center" });

  pdf.save(`${doc.code}.pdf`);
}