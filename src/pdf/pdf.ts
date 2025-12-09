import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Document } from "@/types";
import { getCompany, getClients, getDepots, getProducts, getDB } from "@/store/localdb";
import invoiceTemplate from "@/assets/invoice-template.pdf";

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

// Format number - avoid narrow no-break space (0x202f) that pdf-lib can't encode
function formatMAD(num: number): string {
  // Use manual formatting to avoid French locale's narrow no-break space
  const fixed = num.toFixed(2);
  const parts = fixed.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // Regular space
  return intPart + ',' + parts[1] + ' MAD';
}

export async function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const db = getDB();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;
  const clientName = client?.name || doc.vendorName || "-";

  // Load the PDF template
  const templateBytes = await fetch(invoiceTemplate).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  const pages = pdfDoc.getPages();
  const page = pages[0];
  const { width, height } = page.getSize();
  
  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Colors
  const darkColor = rgb(0.15, 0.15, 0.15);
  const grayColor = rgb(0.35, 0.35, 0.35);
  const greenColor = rgb(0, 0.5, 0.25);
  const redColor = rgb(0.7, 0.15, 0.15);
  
  // TVA Calculation: Price in system is TTC, so HT = TTC / 1.2
  const includeTVA = doc.includeTVA === true;

  // Document type labels
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RÉCEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  // ============ CLEAR AND FILL DATA AREAS ============
  
  // 1. Document type area (top right) - clear and write
  page.drawRectangle({
    x: 445,
    y: height - 55,
    width: 130,
    height: 40,
    color: rgb(1, 1, 1),
  });
  
  page.drawText(typeMap[doc.mode][doc.type], {
    x: 480,
    y: height - 35,
    size: 14,
    font: boldFont,
    color: darkColor,
  });
  
  page.drawText(`N° ${doc.code}`, {
    x: 475,
    y: height - 52,
    size: 10,
    font: font,
    color: grayColor,
  });

  // 2. Date area (left info box) - clear and write
  page.drawRectangle({
    x: 42,
    y: height - 162,
    width: 150,
    height: 20,
    color: rgb(1, 1, 1),
  });
  
  page.drawText(`Date: ${new Date(doc.date).toLocaleDateString('fr-FR')}`, {
    x: 45,
    y: height - 155,
    size: 10,
    font: font,
    color: darkColor,
  });

  // 3. Client name area (right info box) - clear and write
  page.drawRectangle({
    x: 320,
    y: height - 162,
    width: 200,
    height: 20,
    color: rgb(1, 1, 1),
  });
  
  page.drawText(clientName.substring(0, 35), {
    x: 325,
    y: height - 155,
    size: 10,
    font: boldFont,
    color: darkColor,
  });

  // 4. Table body area - clear rows
  const tableTopY = height - 195;
  const rowHeight = 22;
  const maxRows = 8;
  
  page.drawRectangle({
    x: 40,
    y: tableTopY - (maxRows * rowHeight),
    width: 520,
    height: maxRows * rowHeight,
    color: rgb(1, 1, 1),
  });

  // Draw table data rows
  doc.lines.forEach((l, idx) => {
    if (idx >= maxRows) return; // Max rows that fit
    
    const p = products.find((pr) => pr.id === l.productId);
    const priceTTC = l.unitPrice;
    const priceHT = priceTTC / 1.2;
    const remise = l.remiseAmount;
    const qty = l.qty;
    const totalLineHT = (priceHT - remise) * qty;
    const ref = p?.sku || "-";
    const designation = l.description || p?.name || "";
    
    const y = tableTopY - (idx * rowHeight) - 15;
    
    // N° Réf.
    page.drawText(String(idx + 1), { x: 48, y, size: 9, font, color: darkColor });
    
    // Désignation
    page.drawText(designation.substring(0, 32), { x: 75, y, size: 9, font, color: darkColor });
    
    // QTE
    page.drawText(String(qty), { x: 295, y, size: 9, font, color: darkColor });
    
    // P.U.H.T
    page.drawText(formatMAD(priceHT), { x: 330, y, size: 8, font, color: darkColor });
    
    // Remise
    page.drawText(remise > 0 ? formatMAD(remise) : "-", { x: 410, y, size: 8, font, color: darkColor });
    
    // Total H.T
    page.drawText(formatMAD(totalLineHT), { x: 480, y, size: 8, font, color: darkColor });
  });

  // Calculate totals
  const totalHT = doc.lines.reduce((s, l) => {
    const priceHT = l.unitPrice / 1.2;
    return s + (priceHT - l.remiseAmount) * l.qty;
  }, 0);
  
  const totalTVA = totalHT * 0.2;
  const remiseTotal = doc.lines.reduce((s, l) => s + l.remiseAmount * l.qty, 0);
  const totalTTC = totalHT + totalTVA;
  const finalTotal = includeTVA ? totalTTC : totalHT;

  // 5. Amount in words area (bottom left) - clear and write
  const wordsY = height - 400;
  page.drawRectangle({
    x: 40,
    y: wordsY - 35,
    width: 270,
    height: 50,
    color: rgb(1, 1, 1),
  });

  page.drawText("Arrêtée la présente facture à la somme de:", {
    x: 42,
    y: wordsY,
    size: 9,
    font: font,
    color: grayColor,
  });
  
  const amountWords = amountToFrenchWords(finalTotal);
  const words1 = amountWords.substring(0, 45);
  const words2 = amountWords.length > 45 ? amountWords.substring(45, 90) : "";
  
  page.drawText(words1, { x: 42, y: wordsY - 14, size: 10, font: boldFont, color: darkColor });
  if (words2) {
    page.drawText(words2, { x: 42, y: wordsY - 26, size: 10, font: boldFont, color: darkColor });
  }

  // 6. Totals area (bottom right) - clear and write
  const totalsX = 380;
  const totalsY = height - 395;
  
  page.drawRectangle({
    x: totalsX - 10,
    y: totalsY - 55,
    width: 180,
    height: 70,
    color: rgb(1, 1, 1),
  });

  // Total H.T
  page.drawText("Total H.T:", { x: totalsX, y: totalsY, size: 10, font, color: darkColor });
  page.drawText(formatMAD(totalHT), { x: totalsX + 100, y: totalsY, size: 10, font, color: darkColor });

  let lineY = totalsY - 14;
  
  // Remise
  if (remiseTotal > 0) {
    page.drawText("Remises:", { x: totalsX, y: lineY, size: 10, font, color: darkColor });
    page.drawText(`-${formatMAD(remiseTotal)}`, { x: totalsX + 100, y: lineY, size: 10, font, color: darkColor });
    lineY -= 14;
  }

  // TVA
  if (includeTVA) {
    page.drawText("TVA 20%:", { x: totalsX, y: lineY, size: 10, font, color: darkColor });
    page.drawText(formatMAD(totalTVA), { x: totalsX + 100, y: lineY, size: 10, font, color: darkColor });
    lineY -= 14;
  }

  // Final total
  lineY -= 4;
  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  page.drawText(totalLabel, { x: totalsX, y: lineY, size: 11, font: boldFont, color: darkColor });
  page.drawText(formatMAD(finalTotal), { x: totalsX + 90, y: lineY, size: 11, font: boldFont, color: darkColor });

  // 7. Payment section (for invoices only) - clear and write
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    const paymentY = height - 470;
    page.drawRectangle({
      x: 40,
      y: paymentY - 60,
      width: 220,
      height: 80,
      color: rgb(1, 1, 1),
    });
    
    // Payment header box
    page.drawRectangle({
      x: 40,
      y: paymentY + 5,
      width: 110,
      height: 16,
      color: rgb(0.94, 0.94, 0.94),
    });
    
    page.drawText("Mode de paiement", { x: 45, y: paymentY + 10, size: 9, font, color: darkColor });
    
    let payY = paymentY - 10;
    
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
      
      payments.slice(0, 3).forEach((payment) => {
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString('fr-FR');
        page.drawText(`• ${method}: ${formatMAD(payment.amount)} (${date})`, {
          x: 45, y: payY, size: 9, font, color: darkColor
        });
        payY -= 12;
      });
      
      payY -= 5;
      if (remaining > 0) {
        page.drawText(`Reste à payer: ${formatMAD(remaining)}`, {
          x: 45, y: payY, size: 10, font: boldFont, color: redColor
        });
      } else {
        page.drawText("PAYÉ INTÉGRALEMENT", {
          x: 45, y: payY, size: 10, font: boldFont, color: greenColor
        });
      }
    } else {
      page.drawText("• En attente de paiement", { x: 45, y: payY, size: 9, font, color: darkColor });
    }
  }

  // Save and download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${doc.code}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
