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

  // Exact colors from screenshot
  const tealColor: [number, number, number] = [46, 139, 171]; // #2E8BAB
  const darkColor: [number, number, number] = [51, 51, 51];
  const redColor: [number, number, number] = [180, 40, 40];
  const lightTeal: [number, number, number] = [235, 247, 250];

  // Document type labels
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  // Check if TVA is included - when false, price IS the HT price directly
  const includeTVA = doc.includeTVA === true;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ========== HEADER ==========
  // Logo box (left side)
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(0.5);
  pdf.rect(15, 10, 28, 28);
  
  if (company?.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, 'JPEG', 16, 11, 26, 26);
    } catch (e) {
      // Fallback text
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...tealColor);
      pdf.text("SMART", 21, 22);
      pdf.setFontSize(12);
      pdf.text("EXIT", 21, 28);
      pdf.setFontSize(5);
      pdf.setFont("helvetica", "italic");
      pdf.text("be open be smart", 18, 34);
    }
  } else {
    // Default logo text like screenshot
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...tealColor);
    pdf.text("SMART", 21, 20);
    pdf.setFontSize(12);
    pdf.text("EXIT", 21, 27);
    pdf.setFontSize(5);
    pdf.setFont("helvetica", "italic");
    pdf.setTextColor(100, 100, 100);
    pdf.text("be open be smart", 18, 33);
  }

  // Company name - BOLD and big
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkColor);
  pdf.text(company?.name || "SMART EXIT", 48, 22);
  
  // Company address
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(80, 80, 80);
  pdf.text(company?.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", 48, 30);

  // Document type box (right side) - light teal background
  pdf.setFillColor(...lightTeal);
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(0.3);
  pdf.rect(145, 10, 50, 28, "FD");
  
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkColor);
  pdf.text(typeMap[doc.mode][doc.type], 170, 20, { align: "center" });
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text("N° " + doc.code, 170, 30, { align: "center" });

  // ========== INFO SECTIONS ==========
  const infoY = 48;
  
  // INFORMATIONS DOCUMENT header - teal background
  pdf.setFillColor(...tealColor);
  pdf.rect(15, infoY, 85, 8, "F");
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text("INFORMATIONS DOCUMENT", 57.5, infoY + 5.5, { align: "center" });

  // CLIENT header - teal background
  pdf.rect(105, infoY, 90, 8, "F");
  pdf.text("CLIENT", 150, infoY + 5.5, { align: "center" });

  // Date box - white with teal border
  pdf.setDrawColor(...tealColor);
  pdf.setFillColor(255, 255, 255);
  pdf.setLineWidth(0.3);
  pdf.rect(15, infoY + 10, 85, 18, "FD");
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkColor);
  pdf.text("Date: " + new Date(doc.date).toLocaleDateString('fr-FR'), 22, infoY + 21);

  // Client name box - white with teal border
  pdf.rect(105, infoY + 10, 90, 18, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(clientName.substring(0, 30), 150, infoY + 21, { align: "center" });

  // ========== TABLE ==========
  const tableY = infoY + 38;

  // Calculate table data - when TVA is OFF, unitPrice IS the HT price
  const tableData = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    
    // IMPORTANT: When TVA is NOT included, unitPrice IS the HT price directly
    // When TVA IS included, unitPrice is TTC, so HT = TTC / 1.2
    const priceHT = includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
    const remise = l.remiseAmount || 0;
    const qty = l.qty;
    const totalLineHT = (priceHT * qty) - (remise * qty);
    const ref = p?.sku || "-";
    const designation = l.description || p?.name || "";
    
    return [
      String(idx + 1),
      ref.substring(0, 12),
      designation.substring(0, 35),
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
      fontSize: 10,
      halign: "center",
      valign: "middle",
      cellPadding: 4
    },
    bodyStyles: {
      fontSize: 10,
      textColor: darkColor,
      cellPadding: 4,
      valign: "middle"
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 22 },
      2: { halign: "left", cellWidth: 50 },
      3: { halign: "center", cellWidth: 15 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "center", cellWidth: 25 },
      6: { halign: "right", cellWidth: 28 }
    },
    styles: {
      lineColor: tealColor,
      lineWidth: 0.3
    },
    margin: { left: 15, right: 15 }
  });

  // @ts-ignore
  const finalY = pdf.lastAutoTable.finalY + 12;

  // Calculate totals - same logic
  const totalHT = doc.lines.reduce((s, l) => {
    const priceHT = includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
    const remise = l.remiseAmount || 0;
    return s + (priceHT * l.qty) - (remise * l.qty);
  }, 0);
  
  const remiseTotal = doc.lines.reduce((s, l) => s + (l.remiseAmount || 0) * l.qty, 0);
  const totalTVA = includeTVA ? totalHT * 0.2 : 0;
  const totalTTC = totalHT + totalTVA;
  const finalTotal = includeTVA ? totalTTC : totalHT;

  // ========== AMOUNT IN WORDS (Left side) ==========
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(100, 100, 100);
  pdf.text("Arretee la presente facture a la somme de:", 15, finalY);
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...darkColor);
  const words = amountToFrenchWords(finalTotal);
  const wordLines = pdf.splitTextToSize(words, 85);
  pdf.text(wordLines, 15, finalY + 6);

  // ========== TOTALS BOX (Right side) ==========
  const totX = 125;
  const totY = finalY - 5;
  const totWidth = 70;
  const boxHeight = includeTVA ? 50 : 35;
  
  // Box with teal border
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(0.5);
  pdf.rect(totX, totY, totWidth, boxHeight);

  let currentTotY = totY + 10;

  // Total H.T
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkColor);
  pdf.text("Total H.T:", totX + 5, currentTotY);
  pdf.text(formatMAD(totalHT), totX + totWidth - 5, currentTotY, { align: "right" });
  currentTotY += 10;

  // Remises (if any)
  if (remiseTotal > 0) {
    pdf.text("Remises:", totX + 5, currentTotY);
    pdf.setTextColor(...redColor);
    pdf.text("-" + formatMAD(remiseTotal), totX + totWidth - 5, currentTotY, { align: "right" });
    pdf.setTextColor(...darkColor);
    currentTotY += 10;
  }

  // TVA (only if included)
  if (includeTVA) {
    pdf.text("TVA 20%:", totX + 5, currentTotY);
    pdf.text(formatMAD(totalTVA), totX + totWidth - 5, currentTotY, { align: "right" });
    currentTotY += 10;
  }

  // Separator line
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(1);
  pdf.line(totX + 3, currentTotY - 3, totX + totWidth - 3, currentTotY - 3);
  currentTotY += 5;

  // TOTAL line - bold and teal for amount
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...darkColor);
  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  pdf.text(totalLabel, totX + 5, currentTotY);
  pdf.setTextColor(...tealColor);
  pdf.text(formatMAD(finalTotal), totX + totWidth - 5, currentTotY, { align: "right" });

  // ========== PAYMENT SECTION (Invoices only) ==========
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    const payY = finalY + 18;
    
    // Payment method box
    pdf.setDrawColor(...tealColor);
    pdf.setLineWidth(0.3);
    pdf.rect(15, payY, 70, 10);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...darkColor);
    pdf.text("Mode de paiement", 50, payY + 7, { align: "center" });
    
    let pY = payY + 18;
    
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
        pY += 6;
      });
      
      pY += 4;
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
  const footerY = pageHeight - 28;
  
  // Footer line
  pdf.setDrawColor(...tealColor);
  pdf.setLineWidth(0.8);
  pdf.line(15, footerY, pageWidth - 15, footerY);
  
  // Footer text - address BOLD
  pdf.setFontSize(8);
  pdf.setTextColor(...darkColor);
  
  // First line with BOLD address
  pdf.setFont("helvetica", "normal");
  pdf.text("S.A.R.L au capital de 200.000,00 DH • Siege: ", pageWidth / 2 - 30, footerY + 6, { align: "right" });
  pdf.setFont("helvetica", "bold");
  pdf.text(company?.address || "14 RUE EL HATIMI RIVIERA,CASABLANCA", pageWidth / 2 - 30, footerY + 6, { align: "left" });
  
  // Contact line
  pdf.setFont("helvetica", "normal");
  pdf.text("Tel: " + (company?.phone || "+212 522995252") + " | Email: " + (company?.email || "contact.smartexit@gmail.com"), pageWidth / 2, footerY + 12, { align: "center" });
  
  // Legal info line
  pdf.text("RC: 487155 | IF: 48541278 | TP: 32252429 | ICE: 002726225000084", pageWidth / 2, footerY + 18, { align: "center" });

  // Save and download
  pdf.save(doc.code + ".pdf");
}
