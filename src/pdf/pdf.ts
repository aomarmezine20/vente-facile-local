import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document } from "@/types";
import { getCompany, getClients, getProducts, getDB } from "@/store/localdb";

// Convert number to French words
function numberToFrenchWords(num: number): string {
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];
  
  if (num === 0) return 'zero';
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

function formatMAD(num: number): string {
  const fixed = num.toFixed(2);
  const parts = fixed.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return intPart + ',' + parts[1] + ' MAD';
}

export async function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const db = getDB();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;
  const clientName = client?.name || doc.vendorName || "-";

  // Colors matching screenshot
  const tealColor: [number, number, number] = [46, 139, 171]; // #2E8BAB
  const darkColor: [number, number, number] = [51, 51, 51];
  const redColor: [number, number, number] = [180, 40, 40];
  const lightTeal: [number, number, number] = [230, 244, 248];

  // Document type labels
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  const includeTVA = doc.includeTVA === true;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ========== HEADER ==========
  // Logo (left side) - use company logo if available
  if (company?.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, 'JPEG', 15, 10, 25, 25);
    } catch (e) {
      // Fallback to text logo
      pdf.setDrawColor(...tealColor);
      pdf.setLineWidth(0.5);
      pdf.rect(15, 12, 25, 20);
      pdf.setFontSize(8);
      pdf.setTextColor(...tealColor);
      pdf.text("LOGO", 27.5, 23, { align: "center" });
    }
  } else {
    // Default text logo placeholder
    pdf.setDrawColor(...tealColor);
    pdf.setLineWidth(0.5);
    pdf.rect(15, 12, 25, 20);
    pdf.setFontSize(8);
    pdf.setTextColor(...tealColor);
    pdf.text("SMART", 20, 20);
    pdf.setFontSize(7);
    pdf.text("EXIT", 20, 25);
    pdf.setFontSize(5);
    pdf.text("be open be smart", 17, 29);
  }

  // Company name and address
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkColor);
  pdf.text(company?.name || "SMART EXIT", 45, 20);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(company?.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", 45, 27);

  // Document type box (right side)
  pdf.setFillColor(...lightTeal);
  pdf.rect(140, 12, 55, 22, "F");
  pdf.setDrawColor(...tealColor);
  pdf.rect(140, 12, 55, 22);
  
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkColor);
  pdf.text(typeMap[doc.mode][doc.type], 168, 20, { align: "center" });
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("N° " + doc.code, 168, 28, { align: "center" });

  // ========== INFO SECTIONS ==========
  const infoY = 45;
  
  // INFORMATIONS DOCUMENT header
  pdf.setFillColor(...tealColor);
  pdf.rect(15, infoY, 85, 8, "F");
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("INFORMATIONS DOCUMENT", 57.5, infoY + 5.5, { align: "center" });

  // CLIENT header
  pdf.rect(105, infoY, 90, 8, "F");
  pdf.text("CLIENT", 150, infoY + 5.5, { align: "center" });

  // Date box
  pdf.setDrawColor(...tealColor);
  pdf.setFillColor(255, 255, 255);
  pdf.rect(15, infoY + 10, 85, 15, "FD");
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkColor);
  pdf.text("Date: " + new Date(doc.date).toLocaleDateString('fr-FR'), 20, infoY + 19);

  // Client name box
  pdf.rect(105, infoY + 10, 90, 15, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.text(clientName.substring(0, 35), 150, infoY + 19, { align: "center" });

  // ========== TABLE ==========
  const tableY = infoY + 35;

  // Calculate table data - when TVA is OFF, unitPrice IS the HT price directly
  const tableData = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    
    // When TVA is included, unitPrice is TTC so we calculate HT = TTC / 1.2
    // When TVA is NOT included, unitPrice IS already HT
    const priceHT = includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
    const remise = l.remiseAmount;
    const qty = l.qty;
    const totalLineHT = (priceHT - remise) * qty;
    const ref = p?.sku || "-";
    const designation = l.description || p?.name || "";
    
    return [
      String(idx + 1),
      ref.substring(0, 12),
      designation.substring(0, 30),
      String(qty),
      formatMAD(priceHT),
      remise > 0 ? formatMAD(remise) : "-",
      formatMAD(totalLineHT)
    ];
  });

  autoTable(pdf, {
    startY: tableY,
    head: [["N°", "Réf.", "Désignation", "QTE", "P.U.H.T", "Remise", "Total H.T"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: tealColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      valign: "middle",
      cellPadding: 3
    },
    bodyStyles: {
      fontSize: 9,
      textColor: darkColor,
      cellPadding: 3,
      valign: "middle"
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 22 },
      2: { halign: "left", cellWidth: 55 },
      3: { halign: "center", cellWidth: 15 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 25 },
      6: { halign: "right", cellWidth: 28 }
    },
    styles: {
      lineColor: tealColor,
      lineWidth: 0.3
    },
    margin: { left: 15, right: 15 },
    tableWidth: "auto"
  });

  // @ts-ignore
  const finalY = pdf.lastAutoTable.finalY + 10;

  // Calculate totals - same logic as table
  const totalHT = doc.lines.reduce((s, l) => {
    const priceHT = includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
    return s + (priceHT - l.remiseAmount) * l.qty;
  }, 0);
  
  const totalTVA = includeTVA ? totalHT * 0.2 : 0;
  const remiseTotal = doc.lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
  const totalTTC = totalHT + totalTVA;
  const finalTotal = includeTVA ? totalTTC : totalHT;

  // ========== AMOUNT IN WORDS (Left) ==========
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(...darkColor);
  pdf.text("Arretee la presente facture a la somme de:", 15, finalY);
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  const words = amountToFrenchWords(finalTotal);
  const wordLines = pdf.splitTextToSize(words, 90);
  pdf.text(wordLines, 15, finalY + 6);

  // ========== TOTALS BOX (Right) ==========
  const totX = 125;
  const totY = finalY - 5;
  const totWidth = 70;
  
  // Box border
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(0.5);
  pdf.rect(totX, totY, totWidth, includeTVA ? 45 : 30);

  let currentTotY = totY + 8;

  // Total H.T
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkColor);
  pdf.text("Total H.T:", totX + 5, currentTotY);
  pdf.text(formatMAD(totalHT), totX + totWidth - 5, currentTotY, { align: "right" });
  currentTotY += 8;

  // Remises
  if (remiseTotal > 0) {
    pdf.text("Remises:", totX + 5, currentTotY);
    pdf.setTextColor(...redColor);
    pdf.text("-" + formatMAD(remiseTotal), totX + totWidth - 5, currentTotY, { align: "right" });
    pdf.setTextColor(...darkColor);
    currentTotY += 8;
  }

  // TVA (only if included)
  if (includeTVA) {
    pdf.text("TVA 20%:", totX + 5, currentTotY);
    pdf.text(formatMAD(totalTVA), totX + totWidth - 5, currentTotY, { align: "right" });
    currentTotY += 8;
  }

  // Line before total
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(1);
  pdf.line(totX + 3, currentTotY - 2, totX + totWidth - 3, currentTotY - 2);
  currentTotY += 5;

  // TOTAL line
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  pdf.text(totalLabel, totX + 5, currentTotY);
  pdf.setTextColor(...tealColor);
  pdf.text(formatMAD(finalTotal), totX + totWidth - 5, currentTotY, { align: "right" });

  // ========== PAYMENT SECTION (Invoices only) ==========
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    const payY = finalY + (words.length > 45 ? 20 : 15);
    
    // Payment method box
    pdf.setDrawColor(...tealColor);
    pdf.setLineWidth(0.3);
    pdf.rect(15, payY, 70, 8);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...darkColor);
    pdf.text("Mode de paiement", 50, payY + 5.5, { align: "center" });
    
    let pY = payY + 14;
    
    if (payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = finalTotal - totalPaid;
      
      const methodLabels: Record<string, string> = {
        especes: "Especes", cheque: "Cheque", virement: "Virement bancaire",
        carte: "Carte bancaire", versement: "Versement", traite: "Traite", autre: "Autre"
      };
      
      payments.slice(0, 4).forEach((payment) => {
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString('fr-FR');
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...darkColor);
        pdf.text("• " + method + ": " + formatMAD(payment.amount) + " (" + date + ")", 15, pY);
        pY += 5;
      });
      
      pY += 3;
      if (remaining > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...redColor);
        pdf.text("Reste a payer: " + formatMAD(remaining), 15, pY);
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...tealColor);
        pdf.text("PAYE INTEGRALEMENT", 15, pY);
      }
    } else {
      pdf.text("• En attente de paiement", 15, pY);
    }
  }

  // ========== FOOTER ==========
  const footerY = pageHeight - 25;
  
  // Footer line
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(0.5);
  pdf.line(15, footerY, pageWidth - 15, footerY);
  
  // Footer text - use company info from settings
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkColor);
  pdf.text("S.A.R.L au capital de 200.000,00 DH • Siege: " + (company?.address || "14 RUE EL HATIMI RIVIERA,CASABLANCA"), pageWidth / 2, footerY + 5, { align: "center" });
  pdf.text("Tel: " + (company?.phone || "+212 522995252") + " | Email: " + (company?.email || "contact.smartexit@gmail.com"), pageWidth / 2, footerY + 10, { align: "center" });
  pdf.text("RC: 487155 | IF: 48541278 | TP: 32252429 | ICE: 002726225000084", pageWidth / 2, footerY + 15, { align: "center" });

  // Save and download
  pdf.save(doc.code + ".pdf");
}
