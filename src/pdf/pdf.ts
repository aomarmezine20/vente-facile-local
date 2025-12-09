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

// Format number with French locale (spaces as thousand separator, comma as decimal)
function formatMAD(num: number): string {
  return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

export async function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const db = getDB();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;
  const clientName = client?.name || doc.vendorName || "-";
  const companyAny = company as any;

  // Load the PDF template
  const templateBytes = await fetch(invoiceTemplate).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  // Get the first page (template)
  const pages = pdfDoc.getPages();
  const page = pages[0];
  const { width, height } = page.getSize();
  
  // Embed fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Colors
  const darkColor = rgb(0.2, 0.2, 0.2);
  const grayColor = rgb(0.4, 0.4, 0.4);
  const blueColor = rgb(0, 0.4, 0.6);
  
  // TVA Calculation: Price in system is TTC, so HT = TTC / 1.2
  const includeTVA = doc.includeTVA === true;

  // Document type labels
  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RÉCEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  // Clear template text areas by drawing white rectangles
  // Document type area (top right)
  page.drawRectangle({
    x: width - 130,
    y: height - 60,
    width: 120,
    height: 50,
    color: rgb(1, 1, 1),
  });
  
  // Document type
  page.drawText(typeMap[doc.mode][doc.type], {
    x: width - 85,
    y: height - 38,
    size: 14,
    font: boldFont,
    color: darkColor,
  });
  
  // Document number
  page.drawText(`N° ${doc.code}`, {
    x: width - 95,
    y: height - 55,
    size: 10,
    font: font,
    color: grayColor,
  });

  // Clear date area and write date
  page.drawRectangle({
    x: 70,
    y: height - 163,
    width: 100,
    height: 15,
    color: rgb(1, 1, 1),
  });
  
  page.drawText(`Date: ${new Date(doc.date).toLocaleDateString('fr-FR')}`, {
    x: 72,
    y: height - 160,
    size: 10,
    font: font,
    color: darkColor,
  });

  // Clear client area and write client name
  page.drawRectangle({
    x: width / 2 + 60,
    y: height - 163,
    width: 120,
    height: 15,
    color: rgb(1, 1, 1),
  });
  
  page.drawText(clientName.substring(0, 30), {
    x: width / 2 + 62,
    y: height - 160,
    size: 10,
    font: boldFont,
    color: darkColor,
  });

  // Clear table body area
  const tableStartY = height - 205;
  const tableHeight = 180;
  page.drawRectangle({
    x: 38,
    y: tableStartY - tableHeight,
    width: width - 76,
    height: tableHeight,
    color: rgb(1, 1, 1),
  });

  // Draw table lines
  let currentY = tableStartY;
  const rowHeight = 18;
  const colX = [38, 65, 95, 290, 315, 378, 438, width - 38]; // Column positions

  // Draw products
  doc.lines.forEach((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    const priceTTC = l.unitPrice;
    const priceHT = priceTTC / 1.2; // HT = TTC / 1.2
    const remise = l.remiseAmount;
    const qty = l.qty;
    const totalLineHT = (priceHT - remise) * qty;
    const ref = p?.sku || "-";
    const designation = l.description || p?.name || "";
    
    const y = currentY - (idx + 1) * rowHeight;
    
    // N°
    page.drawText(String(idx + 1), {
      x: colX[0] + 10,
      y: y,
      size: 9,
      font: font,
      color: darkColor,
    });
    
    // Réf
    page.drawText(ref.substring(0, 10), {
      x: colX[1] + 2,
      y: y,
      size: 8,
      font: font,
      color: darkColor,
    });
    
    // Désignation
    page.drawText(designation.substring(0, 35), {
      x: colX[2] + 2,
      y: y,
      size: 8,
      font: font,
      color: darkColor,
    });
    
    // QTE
    page.drawText(String(qty), {
      x: colX[3] + 5,
      y: y,
      size: 9,
      font: font,
      color: darkColor,
    });
    
    // P.U.H.T
    page.drawText(formatMAD(priceHT), {
      x: colX[4] + 2,
      y: y,
      size: 8,
      font: font,
      color: darkColor,
    });
    
    // Remise
    page.drawText(remise > 0 ? formatMAD(remise) : "-", {
      x: colX[5] + 2,
      y: y,
      size: 8,
      font: font,
      color: darkColor,
    });
    
    // Total H.T
    page.drawText(formatMAD(totalLineHT), {
      x: colX[6] + 2,
      y: y,
      size: 8,
      font: font,
      color: darkColor,
    });
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

  // Clear amount in words area
  const amountWordsY = height - 420;
  page.drawRectangle({
    x: 38,
    y: amountWordsY - 25,
    width: 250,
    height: 40,
    color: rgb(1, 1, 1),
  });

  // Amount in words
  page.drawText("Arrêtée la présente facture à la somme de:", {
    x: 40,
    y: amountWordsY,
    size: 9,
    font: font,
    color: grayColor,
  });
  
  const amountWords = amountToFrenchWords(finalTotal);
  const words1 = amountWords.substring(0, 50);
  const words2 = amountWords.length > 50 ? amountWords.substring(50) : "";
  
  page.drawText(words1, {
    x: 40,
    y: amountWordsY - 12,
    size: 10,
    font: boldFont,
    color: darkColor,
  });
  
  if (words2) {
    page.drawText(words2, {
      x: 40,
      y: amountWordsY - 24,
      size: 10,
      font: boldFont,
      color: darkColor,
    });
  }

  // Clear totals area (right side)
  const totalsX = width / 2 + 60;
  const totalsY = height - 420;
  page.drawRectangle({
    x: totalsX,
    y: totalsY - 50,
    width: 130,
    height: 70,
    color: rgb(1, 1, 1),
  });

  // Total H.T
  page.drawText("Total H.T:", {
    x: totalsX,
    y: totalsY,
    size: 10,
    font: font,
    color: darkColor,
  });
  page.drawText(formatMAD(totalHT), {
    x: totalsX + 85,
    y: totalsY,
    size: 10,
    font: font,
    color: darkColor,
  });

  // Remise (if any)
  let lineY = totalsY - 12;
  if (remiseTotal > 0) {
    page.drawText("Remises:", {
      x: totalsX,
      y: lineY,
      size: 10,
      font: font,
      color: darkColor,
    });
    page.drawText(`-${formatMAD(remiseTotal)}`, {
      x: totalsX + 85,
      y: lineY,
      size: 10,
      font: font,
      color: darkColor,
    });
    lineY -= 12;
  }

  // TVA (if included)
  if (includeTVA) {
    page.drawText("TVA 20%:", {
      x: totalsX,
      y: lineY,
      size: 10,
      font: font,
      color: darkColor,
    });
    page.drawText(formatMAD(totalTVA), {
      x: totalsX + 85,
      y: lineY,
      size: 10,
      font: font,
      color: darkColor,
    });
    lineY -= 12;
  }

  // Final total
  lineY -= 5;
  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  page.drawText(totalLabel, {
    x: totalsX,
    y: lineY,
    size: 11,
    font: boldFont,
    color: darkColor,
  });
  page.drawText(formatMAD(finalTotal), {
    x: totalsX + 75,
    y: lineY,
    size: 11,
    font: boldFont,
    color: darkColor,
  });

  // Payment section (for invoices)
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    
    const paymentY = height - 480;
    page.drawRectangle({
      x: 38,
      y: paymentY - 50,
      width: 200,
      height: 70,
      color: rgb(1, 1, 1),
    });
    
    page.drawRectangle({
      x: 38,
      y: paymentY + 5,
      width: 100,
      height: 15,
      color: rgb(0.95, 0.95, 0.95),
    });
    
    page.drawText("Mode de paiement", {
      x: 42,
      y: paymentY + 10,
      size: 9,
      font: font,
      color: darkColor,
    });
    
    let payY = paymentY - 8;
    
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
      
      payments.forEach((payment) => {
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString('fr-FR');
        page.drawText(`• ${method}: ${formatMAD(payment.amount)} (${date})`, {
          x: 42,
          y: payY,
          size: 9,
          font: font,
          color: darkColor,
        });
        payY -= 12;
      });
      
      payY -= 5;
      if (remaining > 0) {
        page.drawText(`Reste à payer: ${formatMAD(remaining)}`, {
          x: 42,
          y: payY,
          size: 10,
          font: boldFont,
          color: rgb(0.8, 0.2, 0.2),
        });
      } else {
        page.drawText("PAYÉ INTÉGRALEMENT", {
          x: 42,
          y: payY,
          size: 10,
          font: boldFont,
          color: rgb(0, 0.6, 0.3),
        });
      }
    } else {
      page.drawText("• En attente de paiement", {
        x: 42,
        y: payY,
        size: 9,
        font: font,
        color: darkColor,
      });
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
