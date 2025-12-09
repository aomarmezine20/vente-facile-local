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

// Format number with French locale (spaces as thousand separator, comma as decimal)
function formatMAD(num: number): string {
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
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
  const primaryBlue: [number, number, number] = [0, 102, 153]; // Teal blue like template
  const darkGray: [number, number, number] = [60, 60, 60];
  const lightGray: [number, number, number] = [240, 240, 240];

  // ============ HEADER SECTION ============
  let currentY = 12;

  // Logo on left with border
  pdf.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  pdf.setLineWidth(1);
  pdf.rect(12, currentY, 35, 30, 'S');
  
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", 14, currentY + 2, 31, 26);
    } catch {}
  }

  // Company name and address (center-left)
  pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text(company.name || "SMART EXIT", 55, currentY + 12);
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(company.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", 55, currentY + 22);

  // Document type box on right
  const docTypeX = pageWidth - 55;
  pdf.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  pdf.setLineWidth(0.5);
  pdf.rect(docTypeX, currentY, 43, 30, 'S');
  
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RÉCEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };
  
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  pdf.text(typeMap[doc.mode][doc.type], docTypeX + 21.5, currentY + 12, { align: "center" });
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`N° ${doc.code}`, docTypeX + 21.5, currentY + 22, { align: "center" });

  // Blue separator line
  currentY = 48;
  pdf.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  pdf.setLineWidth(3);
  pdf.line(12, currentY, pageWidth - 12, currentY);

  // ============ INFO BOXES SECTION ============
  currentY = 58;
  
  // Left title - INFORMATIONS DOCUMENT
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  pdf.text("INFORMATIONS DOCUMENT", 12, currentY);
  
  // Right title - CLIENT/FOURNISSEUR
  pdf.text(doc.mode === "vente" ? "CLIENT" : "FOURNISSEUR", pageWidth / 2 + 10, currentY);
  
  // Left box - Date info
  currentY = 64;
  const boxWidth = 85;
  const boxHeight = 24;
  
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.rect(12, currentY, boxWidth, boxHeight, 'S');
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  pdf.text(`Date: ${new Date(doc.date).toLocaleDateString('fr-FR')}`, 16, currentY + 10);

  // Right box - Client info
  pdf.setDrawColor(180, 180, 180);
  pdf.rect(pageWidth / 2 + 10, currentY, boxWidth, boxHeight, 'S');
  
  pdf.setFontSize(10);
  pdf.text(clientName, pageWidth / 2 + 14, currentY + 10);
  if (client?.address) {
    pdf.setFontSize(9);
    const addr = client.address.length > 35 ? client.address.substring(0, 35) + "..." : client.address;
    pdf.text(addr, pageWidth / 2 + 14, currentY + 18);
  }

  // ============ PRODUCTS TABLE ============
  currentY = 100;

  // TVA Calculation: Price in system is TTC, so HT = TTC / 1.2
  const includeTVA = doc.includeTVA === true;
  
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
      ref,
      designation,
      qty,
      formatMAD(priceHT),
      remise > 0 ? formatMAD(remise) : "-",
      formatMAD(totalLineHT)
    ];
  });

  autoTable(pdf, {
    head: [["N°", "Réf.", "Désignation", "QTE", "P.U.H.T", "Remise", "Total H.T"]],
    body,
    startY: currentY,
    styles: { 
      fontSize: 9,
      cellPadding: 5,
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
      textColor: [50, 50, 50],
    },
    headStyles: { 
      fillColor: [255, 255, 255],
      textColor: primaryBlue,
      fontStyle: 'bold',
      halign: 'center',
      lineColor: [200, 200, 200],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'left', cellWidth: 55 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 28 },
    },
    margin: { left: 12, right: 12 },
    theme: 'grid',
  });

  // ============ TOTALS SECTION ============
  const tableEndY = (pdf as any).lastAutoTable.finalY || currentY + 50;
  
  // Calculate totals: HT = TTC / 1.2, TVA = HT * 0.2
  const totalHT = doc.lines.reduce((s, l) => {
    const priceHT = l.unitPrice / 1.2;
    return s + (priceHT - l.remiseAmount) * l.qty;
  }, 0);
  
  const totalTVA = totalHT * 0.2; // TVA is 20% of HT
  const remiseTotal = doc.lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
  const totalTTC = totalHT + totalTVA;
  
  // Final display amount depends on TVA checkbox
  const finalTotal = includeTVA ? totalTTC : totalHT;

  // Amount in words (left side)
  let leftY = tableEndY + 12;
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(9);
  pdf.setTextColor(80, 80, 80);
  pdf.text("Arrêtée la présente facture à la somme de:", 12, leftY);
  
  const amountWords = amountToFrenchWords(finalTotal);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(50, 50, 50);
  const splitWords = pdf.splitTextToSize(amountWords, 90);
  pdf.text(splitWords, 12, leftY + 7);

  // Totals box (right side)
  let totalsY = tableEndY + 8;
  const totalsX = pageWidth / 2 + 10;
  const totalsWidth = 78;
  
  // Draw totals box border
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.3);
  
  const totalsBoxHeight = includeTVA ? 50 : 38;
  pdf.rect(totalsX, totalsY, totalsWidth, totalsBoxHeight, 'S');
  
  let lineY = totalsY + 10;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  // Total H.T line
  pdf.text("Total H.T:", totalsX + 5, lineY);
  pdf.text(formatMAD(totalHT), totalsX + totalsWidth - 5, lineY, { align: "right" });
  
  // Remises (if any)
  if (remiseTotal > 0) {
    lineY += 8;
    pdf.text("Remises:", totalsX + 5, lineY);
    pdf.text(`-${formatMAD(remiseTotal)}`, totalsX + totalsWidth - 5, lineY, { align: "right" });
  }
  
  // TVA - only show if includeTVA is true
  if (includeTVA) {
    lineY += 8;
    pdf.text("TVA 20%:", totalsX + 5, lineY);
    pdf.text(formatMAD(totalTVA), totalsX + totalsWidth - 5, lineY, { align: "right" });
  }
  
  // Separator line before total
  lineY += 5;
  pdf.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  pdf.setLineWidth(0.8);
  pdf.line(totalsX + 3, lineY, totalsX + totalsWidth - 3, lineY);
  
  // Final Total
  lineY += 10;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  
  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  pdf.text(totalLabel, totalsX + 5, lineY);
  pdf.text(formatMAD(finalTotal), totalsX + totalsWidth - 5, lineY, { align: "right" });

  // ============ PAYMENT SECTION ============
  if (doc.type === "FA") {
    const db = getDB();
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    let payY = leftY + 22;
    
    // Payment section box
    pdf.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.rect(12, payY, 90, 10, 'FD');
    
    pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Mode de paiement", 16, payY + 7);
    
    payY += 15;
    
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
        pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        pdf.text(`• ${method}: ${formatMAD(payment.amount)} (${date})`, 14, payY);
        payY += 6;
      });
      
      payY += 2;
      pdf.setFont("helvetica", "bold");
      if (remaining > 0) {
        pdf.setTextColor(200, 50, 50);
        pdf.text(`Reste à payer: ${formatMAD(remaining)}`, 14, payY);
      } else {
        pdf.setTextColor(0, 150, 80);
        pdf.text("PAYÉ INTÉGRALEMENT", 14, payY);
      }
    } else {
      pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      pdf.text("• En attente de paiement", 14, payY);
    }
  }

  // ============ FOOTER ============
  const footerY = pageHeight - 22;
  
  // Footer separator line
  pdf.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
  pdf.setLineWidth(1);
  pdf.line(12, footerY - 8, pageWidth - 12, footerY - 8);
  
  pdf.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  
  // Line 1: Capital and address
  const capitalText = companyAny.capital ? `S.A.R.L au capital de ${companyAny.capital} DH` : "S.A.R.L au capital de 200.000,00 DH";
  const addressText = company.address || "14 RUE EL HATIMI RIVIERA,CASABLANCA";
  pdf.text(`${capitalText} • Siège: ${addressText}`, pageWidth / 2, footerY - 3, { align: "center" });
  
  // Line 2: Contact
  pdf.setFont("helvetica", "normal");
  const phoneText = company.phone || "+212 522995252";
  const emailText = company.email || "contact.smartexit@gmail.com";
  pdf.text(`Tél: ${phoneText} | Email: ${emailText}`, pageWidth / 2, footerY + 2, { align: "center" });
  
  // Line 3: Legal info
  const rc = companyAny.rc || "487155";
  const ifNum = companyAny.identifiantFiscal || "48541278";
  const tp = companyAny.tp || "32252429";
  const ice = companyAny.ice || "002726225000084";
  pdf.text(`RC: ${rc} | IF: ${ifNum} | TP: ${tp} | ICE: ${ice}`, pageWidth / 2, footerY + 7, { align: "center" });

  pdf.save(`${doc.code}.pdf`);
}
