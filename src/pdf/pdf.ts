import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Document } from "@/types";
import { getCompany, getClients, getDepots, getProducts, getDB } from "@/store/localdb";
import invoiceTemplate from "@/assets/invoice-template.pdf";

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

// Format number - avoid narrow no-break space that pdf-lib can't encode
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

  // Load the PDF template
  const templateBytes = await fetch(invoiceTemplate).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  const pages = pdfDoc.getPages();
  const page = pages[0];
  const { width, height } = page.getSize();
  
  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Colors matching template
  const darkColor = rgb(0.2, 0.2, 0.2);
  const tealColor = rgb(0.18, 0.54, 0.67); // Teal/cyan color from template
  const greenColor = rgb(0.18, 0.54, 0.34);
  const redColor = rgb(0.7, 0.15, 0.15);
  
  // TVA Calculation: Price in system is TTC, so HT = TTC / 1.2
  const includeTVA = doc.includeTVA === true;

  // Document type labels
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  // ========== CLEAR AND FILL DATA AREAS ==========
  // Positions are in PDF coordinates (origin bottom-left)
  
  // 1. Document type and number (top right box)
  page.drawRectangle({ x: 628, y: height - 78, width: 140, height: 55, color: rgb(1, 1, 1) });
  page.drawText(typeMap[doc.mode][doc.type], { x: 655, y: height - 48, size: 14, font: boldFont, color: darkColor });
  page.drawText("N. " + doc.code, { x: 645, y: height - 68, size: 10, font, color: darkColor });

  // 2. Date field (left info box)
  page.drawRectangle({ x: 68, y: height - 200, width: 180, height: 18, color: rgb(1, 1, 1) });
  page.drawText("Date: " + new Date(doc.date).toLocaleDateString('fr-FR'), { x: 72, y: height - 195, size: 10, font, color: darkColor });

  // 3. Client name (right info box)
  page.drawRectangle({ x: 420, y: height - 200, width: 200, height: 35, color: rgb(1, 1, 1) });
  page.drawText(clientName.substring(0, 30), { x: 480, y: height - 185, size: 11, font: boldFont, color: darkColor });

  // 4. Table rows - clear data area
  const tableY = height - 330;
  const rowH = 42;
  page.drawRectangle({ x: 55, y: tableY - (8 * rowH), width: 700, height: 8 * rowH, color: rgb(1, 1, 1) });

  // Draw table data
  doc.lines.forEach((l, idx) => {
    if (idx >= 8) return;
    
    const p = products.find((pr) => pr.id === l.productId);
    const priceTTC = l.unitPrice;
    const priceHT = priceTTC / 1.2;
    const remise = l.remiseAmount;
    const qty = l.qty;
    const totalLineHT = (priceHT - remise) * qty;
    const ref = p?.sku || "-";
    const designation = l.description || p?.name || "";
    
    const y = tableY - (idx * rowH) - 28;
    
    page.drawText(String(idx + 1), { x: 72, y, size: 10, font, color: darkColor });
    page.drawText(ref.substring(0, 12), { x: 115, y, size: 10, font, color: darkColor });
    page.drawText(designation.substring(0, 28), { x: 210, y, size: 10, font, color: darkColor });
    page.drawText(String(qty), { x: 420, y, size: 10, font, color: darkColor });
    page.drawText(formatMAD(priceHT), { x: 470, y, size: 9, font, color: darkColor });
    page.drawText(remise > 0 ? formatMAD(remise) : "-", { x: 565, y, size: 9, font, color: darkColor });
    page.drawText(formatMAD(totalLineHT), { x: 660, y, size: 9, font, color: darkColor });
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

  // 5. Amount in words (bottom left)
  const wordsY = height - 545;
  page.drawRectangle({ x: 55, y: wordsY - 20, width: 280, height: 35, color: rgb(1, 1, 1) });
  page.drawText("Arretee la presente facture a la somme de:", { x: 58, y: wordsY + 5, size: 9, font, color: darkColor });
  
  const words = amountToFrenchWords(finalTotal);
  page.drawText(words.substring(0, 45), { x: 58, y: wordsY - 10, size: 10, font: boldFont, color: darkColor });
  if (words.length > 45) {
    page.drawText(words.substring(45), { x: 58, y: wordsY - 22, size: 10, font: boldFont, color: darkColor });
  }

  // 6. Totals box (bottom right)
  const totX = 490;
  const totY = height - 530;
  page.drawRectangle({ x: totX, y: totY - 60, width: 200, height: 80, color: rgb(1, 1, 1) });

  page.drawText("Total H.T:", { x: totX + 10, y: totY + 10, size: 10, font, color: darkColor });
  page.drawText(formatMAD(totalHT), { x: totX + 120, y: totY + 10, size: 10, font, color: darkColor });

  if (remiseTotal > 0) {
    page.drawText("Remises:", { x: totX + 10, y: totY - 8, size: 10, font, color: darkColor });
    page.drawText("-" + formatMAD(remiseTotal), { x: totX + 120, y: totY - 8, size: 10, font, color: darkColor });
  }

  if (includeTVA) {
    page.drawText("TVA 20%:", { x: totX + 10, y: totY - 26, size: 10, font, color: darkColor });
    page.drawText(formatMAD(totalTVA), { x: totX + 120, y: totY - 26, size: 10, font, color: darkColor });
  }

  // Draw line before total
  page.drawLine({ start: { x: totX + 5, y: totY - 35 }, end: { x: totX + 195, y: totY - 35 }, thickness: 1.5, color: tealColor });

  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  page.drawText(totalLabel, { x: totX + 10, y: totY - 52, size: 12, font: boldFont, color: darkColor });
  page.drawText(formatMAD(finalTotal), { x: totX + 110, y: totY - 52, size: 12, font: boldFont, color: darkColor });

  // 7. Payment section (invoices only)
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    const payY = height - 600;
    page.drawRectangle({ x: 55, y: payY - 60, width: 280, height: 75, color: rgb(1, 1, 1) });
    
    // Payment header
    page.drawRectangle({ x: 55, y: payY + 8, width: 150, height: 18, color: rgb(0.95, 0.95, 0.95) });
    page.drawText("Mode de paiement", { x: 85, y: payY + 13, size: 10, font, color: darkColor });
    
    let pY = payY - 8;
    
    if (payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = finalTotal - totalPaid;
      
      const methodLabels: Record<string, string> = {
        especes: "Especes", cheque: "Cheque", virement: "Virement bancaire",
        carte: "Carte bancaire", versement: "Versement", traite: "Traite", autre: "Autre"
      };
      
      payments.slice(0, 3).forEach((payment) => {
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString('fr-FR');
        page.drawText("- " + method + ": " + formatMAD(payment.amount) + " (" + date + ")", { x: 60, y: pY, size: 9, font, color: darkColor });
        pY -= 14;
      });
      
      pY -= 5;
      if (remaining > 0) {
        page.drawText("Reste a payer: " + formatMAD(remaining), { x: 60, y: pY, size: 10, font: boldFont, color: redColor });
      } else {
        page.drawText("PAYE INTEGRALEMENT", { x: 60, y: pY, size: 10, font: boldFont, color: greenColor });
      }
    } else {
      page.drawText("- En attente de paiement", { x: 60, y: pY, size: 9, font, color: darkColor });
    }
  }

  // Save and download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = doc.code + ".pdf";
  link.click();
  URL.revokeObjectURL(url);
}
