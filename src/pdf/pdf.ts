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
  const companyAny = company as any;

  const pdf = new jsPDF();
  const pageHeight = 297;
  const pageWidth = 210;

  // Colors
  const primaryColor: [number, number, number] = [30, 58, 95]; // Dark blue

  // ============ HEADER SECTION ============
  let currentY = 10;

  // Two logos on left side
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", 12, currentY, 20, 20);
      pdf.addImage(company.logoDataUrl, "PNG", 35, currentY, 20, 20);
    } catch {}
  }

  // Company name in header (large, bold, centered)
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text(company.name || "SMART EXIT", 105, currentY + 8, { align: "center" });

  // Document type on right
  pdf.setFontSize(14);
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RÉCEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };
  pdf.text(typeMap[doc.mode][doc.type], pageWidth - 15, currentY + 8, { align: "right" });

  // Separator line below header
  currentY = 35;
  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setLineWidth(0.5);
  pdf.line(12, currentY, pageWidth - 12, currentY);

  // ============ INFO BOXES SECTION ============
  currentY = 42;
  const boxWidth = 88;
  const boxHeight = 25;
  
  // Left box - INFORMATIONS DOCUMENT
  pdf.setFillColor(245, 247, 250);
  pdf.rect(12, currentY, boxWidth, boxHeight, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  pdf.rect(12, currentY, boxWidth, boxHeight, 'S');

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text("INFORMATIONS DOCUMENT", 16, currentY + 7);
  
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Date: ${new Date(doc.date).toLocaleDateString('fr-FR')}`, 16, currentY + 15);

  // Right box - CLIENT/FOURNISSEUR
  pdf.setFillColor(245, 247, 250);
  pdf.rect(pageWidth - 12 - boxWidth, currentY, boxWidth, boxHeight, 'F');
  pdf.setDrawColor(200, 200, 200);
  pdf.rect(pageWidth - 12 - boxWidth, currentY, boxWidth, boxHeight, 'S');

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.text(doc.mode === "vente" ? "CLIENT" : "FOURNISSEUR", pageWidth - 8 - boxWidth, currentY + 7);
  
  pdf.setTextColor(60, 60, 60);
  pdf.setFont("helvetica", "normal");
  pdf.text(clientName, pageWidth - 8 - boxWidth, currentY + 15);
  if (client?.address) {
    pdf.setFontSize(8);
    const addr = client.address.length > 40 ? client.address.substring(0, 40) + "..." : client.address;
    pdf.text(addr, pageWidth - 8 - boxWidth, currentY + 21);
  }

  // ============ PRODUCTS TABLE ============
  currentY = 75;

  // Calculate HT price: HT = TTC / 1.2
  const body = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    const priceTTC = l.unitPrice;
    const priceHT = priceTTC / 1.2; // HT = TTC / 1.2
    const remise = l.remiseAmount;
    const qty = l.qty;
    const totalLineHT = (priceHT - remise) * qty;
    const ref = p?.sku || "-";
    const designation = l.description || p?.name || "";
    
    return [
      idx + 1,
      designation,
      qty,
      priceHT.toFixed(2) + " MAD",
      remise > 0 ? remise.toFixed(2) + " MAD" : "-",
      totalLineHT.toFixed(2) + " MAD"
    ];
  });

  autoTable(pdf, {
    head: [["N° Réf.", "Désignation", "QTE", "P.U.H.T", "Remise", "Total H.T"]],
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
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'left', cellWidth: 65 },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 32 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    margin: { left: 12, right: 12 },
    theme: 'grid',
  });

  // ============ TOTALS SECTION ============
  const tableEndY = (pdf as any).lastAutoTable.finalY || currentY + 50;
  
  // Calculate totals: HT = TTC / 1.2, TVA = TTC - HT = HT * 0.2
  const totalHT = doc.lines.reduce((s, l) => {
    const priceHT = l.unitPrice / 1.2;
    return s + (priceHT - l.remiseAmount) * l.qty;
  }, 0);
  
  const totalTVA = totalHT * 0.2; // TVA is 20% of HT
  
  const remiseTotal = doc.lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
  const includeTVA = doc.includeTVA === true;
  const totalTTC = totalHT + (includeTVA ? totalTVA : 0);

  // Amount in words (left side)
  let leftY = tableEndY + 8;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  pdf.text("Arrêtée la présente facture à la somme de:", 12, leftY);
  
  const finalTotal = includeTVA ? totalTTC : totalHT;
  const amountWords = amountToFrenchWords(finalTotal);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(50, 50, 50);
  const splitWords = pdf.splitTextToSize(amountWords, 95);
  pdf.text(splitWords, 12, leftY + 6);

  // Totals box (right side)
  let totalsY = tableEndY + 5;
  const totalsX = 120;
  const totalsWidth = 78;
  
  pdf.setFontSize(9);
  pdf.setTextColor(60, 60, 60);
  
  // Total H.T line
  pdf.setFont("helvetica", "normal");
  pdf.text("Total H.T:", totalsX, totalsY + 5);
  pdf.text(totalHT.toFixed(2) + " MAD", totalsX + totalsWidth - 2, totalsY + 5, { align: "right" });
  
  // Remises (if any)
  if (remiseTotal > 0) {
    totalsY += 6;
    pdf.text("Remises:", totalsX, totalsY + 5);
    pdf.text(`-${remiseTotal.toFixed(2)} MAD`, totalsX + totalsWidth - 2, totalsY + 5, { align: "right" });
  }
  
  // TVA - only show if includeTVA is true
  if (includeTVA) {
    totalsY += 6;
    pdf.text("TVA 20%:", totalsX, totalsY + 5);
    pdf.text(totalTVA.toFixed(2) + " MAD", totalsX + totalsWidth - 2, totalsY + 5, { align: "right" });
  }
  
  // Separator line
  totalsY += 10;
  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setLineWidth(0.5);
  pdf.line(totalsX, totalsY, totalsX + totalsWidth, totalsY);
  
  // Final Total
  totalsY += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  
  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  pdf.text(totalLabel, totalsX, totalsY);
  pdf.text(finalTotal.toFixed(2) + " MAD", totalsX + totalsWidth - 2, totalsY, { align: "right" });

  // ============ PAYMENT SECTION ============
  if (doc.type === "FA") {
    const db = getDB();
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    let payY = Math.max(leftY + 20, totalsY + 15);
    
    // Payment section header
    pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    pdf.rect(12, payY, 90, 6, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Mode de paiement", 16, payY + 4.5);
    
    payY += 10;
    pdf.setTextColor(50, 50, 50);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    
    if (payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = finalTotal - totalPaid;
      
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
        pdf.text(`• ${method}: ${fmtMAD(payment.amount)} (${date})`, 16, payY);
        payY += 5;
      });
      
      payY += 3;
      pdf.setFont("helvetica", "bold");
      if (remaining > 0) {
        pdf.setTextColor(200, 50, 50);
        pdf.text(`Reste à payer: ${fmtMAD(remaining)}`, 16, payY);
      } else {
        pdf.setTextColor(50, 150, 80);
        pdf.text("PAYÉ INTÉGRALEMENT", 16, payY);
      }
    } else {
      pdf.text("• En attente de paiement", 16, payY);
    }
  }

  // ============ FOOTER ============
  const footerY = pageHeight - 25;
  
  // Footer separator line
  pdf.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  pdf.setLineWidth(0.5);
  pdf.line(12, footerY - 10, pageWidth - 12, footerY - 10);
  
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
