import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Document } from "@/types";
import { getCompany, getClients, getProducts, getDB } from "@/store/localdb";

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
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return intPart + ',' + parts[1];
}

function drawFooter(pdf: jsPDF, company: any, teal: [number, number, number], darkGray: [number, number, number], fontSize: number) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerY = pageHeight - 18;

  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.5);
  pdf.line(12, footerY, pageWidth - 12, footerY);

  const fs = Math.max(fontSize, 7);
  pdf.setFontSize(fs);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(`S.A.R.L au capital de ${company?.capital || "200.000,00 DH"} • Siege: ${company?.address || "14 RUE EL HATIMI RIVIERA,CASABLANCA"}`, pageWidth / 2, footerY + 4, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.text(`Tel: ${company?.phone || "+212 522995252"} | Email: ${company?.email || "contact.smartexit@gmail.com"}`, pageWidth / 2, footerY + 8, { align: "center" });
  pdf.text(`RC: ${company?.rc || "487155"} | IF: ${company?.if || "48541278"} | TP: ${company?.tp || "32252429"} | ICE: ${company?.ice || "002726225000084"}`, pageWidth / 2, footerY + 12, { align: "center" });
}

function drawLogoPlaceholder(pdf: jsPDF, teal: [number, number, number], grayText: [number, number, number]) {
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(16, 12, 28, 32, 2, 2, 'S');
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...teal);
  pdf.text("SMART", 22, 24);
  pdf.setFontSize(10);
  pdf.text("EXIT", 24, 31);
  pdf.setFontSize(5);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(...grayText);
  pdf.text("be open be smart", 19, 38);
}

/**
 * Compute a scale factor (0.6 – 1.0) so every element fits on one A4 page.
 * The idea: we estimate total vertical space needed and shrink if necessary.
 */
function computeScale(lineCount: number, hasPayment: boolean, includeTVA: boolean): number {
  // Fixed zones (at scale=1)
  const headerH = 48;       // header block
  const infoH = 50;         // info + client block
  const tableHeaderH = 12;  // table head row
  const rowH = 10;          // per data row
  const totalsH = includeTVA ? 48 : 40;
  const paymentH = hasPayment ? 38 : 0;
  const wordsH = 18;
  const footerH = 20;
  const margins = 20;       // top + gaps

  const needed = headerH + infoH + tableHeaderH + (lineCount * rowH) + Math.max(totalsH, wordsH) + paymentH + footerH + margins;
  const available = 297; // A4 height in mm

  if (needed <= available) return 1.0;
  const s = available / needed;
  return Math.max(s, 0.55); // never go below 0.55
}

export async function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const db = getDB();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;
  const clientName = client?.name || doc.vendorName || "-";

  const teal: [number, number, number] = [46, 80, 144];
  const darkGray: [number, number, number] = [51, 51, 51];
  const grayText: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [245, 245, 245];
  const grayBorder: [number, number, number] = [180, 180, 180];

  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
    interne: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  const includeTVA = doc.includeTVA === true;
  const hasPayment = doc.type === "FA";
  const lineCount = doc.lines.length;
  const S = computeScale(lineCount, hasPayment, includeTVA);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // Scaled font sizes
  const fs = (base: number) => Math.max(Math.round(base * S), 6);

  // ========== HEADER ==========
  const headerH = Math.round(40 * S);
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(12, 8, pageWidth - 24, headerH, 3, 3, 'S');

  const logoH = Math.round(32 * S);
  const logoW = Math.round(28 * S);
  if (company?.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, 'JPEG', 16, 10, logoW, logoH);
    } catch (e) {
      drawLogoPlaceholder(pdf, teal, grayText);
    }
  } else {
    drawLogoPlaceholder(pdf, teal, grayText);
  }

  const textX = 16 + logoW + 4;
  pdf.setFontSize(fs(18));
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(company?.name || "SMART EXIT", textX, 8 + headerH * 0.4);

  pdf.setFontSize(fs(9));
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...grayText);
  pdf.text(company?.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", textX, 8 + headerH * 0.6);

  pdf.setFontSize(fs(14));
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(typeMap[doc.mode]?.[doc.type] || doc.type, 172.5, 8 + headerH * 0.35, { align: "center" });

  pdf.setFontSize(fs(9));
  pdf.setFont("helvetica", "normal");
  pdf.text("N° " + doc.code, 172.5, 8 + headerH * 0.55, { align: "center" });

  // ========== INFO SECTIONS ==========
  const infoY = 8 + headerH + Math.round(6 * S);
  const infoBoxH = Math.round(22 * S);
  const clientBoxH = Math.round(32 * S);

  pdf.setFontSize(fs(10));
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...teal);
  pdf.text("INFORMATIONS DOCUMENT", 57, infoY + Math.round(5 * S), { align: "center" });
  pdf.text("CLIENT", 152, infoY + Math.round(5 * S), { align: "center" });

  // Doc info box
  const infoBoxY = infoY + Math.round(8 * S);
  pdf.setFillColor(...lightGray);
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(12, infoBoxY, 90, infoBoxH, 2, 2, 'FD');
  pdf.setFontSize(fs(10));
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkGray);
  pdf.text("Date: " + new Date(doc.date).toLocaleDateString('fr-FR'), 18, infoBoxY + infoBoxH * 0.55);

  // Client box
  pdf.setFillColor(...lightGray);
  pdf.roundedRect(107, infoBoxY, 90, clientBoxH, 2, 2, 'FD');

  if (client?.code) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fs(8));
    pdf.setTextColor(...grayText);
    pdf.text("Code: " + client.code, 192, infoBoxY + Math.round(5 * S), { align: "right" });
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fs(10));
  pdf.setTextColor(...darkGray);
  pdf.text(clientName.substring(0, 40), 152, infoBoxY + Math.round(10 * S), { align: "center" });

  // Client address - always show full address
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fs(8));
  pdf.setTextColor(...grayText);
  if (client?.address) {
    const addressLines = pdf.splitTextToSize(client.address, 82);
    pdf.text(addressLines.slice(0, 3), 152, infoBoxY + Math.round(15 * S), { align: "center" });
  }

  pdf.setFontSize(fs(8));
  pdf.setTextColor(...darkGray);
  if (client?.type === "entreprise" && client?.ice) {
    pdf.text("ICE: " + client.ice, 152, infoBoxY + clientBoxH - Math.round(3 * S), { align: "center" });
  } else if (client?.type === "particulier" && client?.phone) {
    pdf.text("Tel: " + client.phone, 152, infoBoxY + clientBoxH - Math.round(3 * S), { align: "center" });
  }

  // ========== TABLE ==========
  const tableY = infoBoxY + Math.max(infoBoxH, clientBoxH) + Math.round(8 * S);

  const tableData = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    const priceHT = l.unitPrice / 1.2;
    const remiseHT = (l.remiseAmount || 0) / 1.2;
    const totalLineHT = (priceHT - remiseHT) * l.qty;
    return [
      String(idx + 1),
      p?.sku || "-",
      l.description || p?.name || "",
      String(l.qty),
      formatMAD(priceHT),
      formatMAD(totalLineHT)
    ];
  });

  // Dynamic cell padding based on scale
  const cellPad = Math.max(Math.round(5 * S), 2);
  const tableFontSize = fs(9);

  autoTable(pdf, {
    startY: tableY,
    head: [["N°", "Réf.", "Désignation", "QTE", "P.U.H.T", "Total H.T"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: darkGray,
      fontStyle: "bold",
      fontSize: tableFontSize,
      halign: "center",
      valign: "middle",
      cellPadding: cellPad
    },
    bodyStyles: {
      fontSize: tableFontSize,
      textColor: darkGray,
      cellPadding: cellPad,
      valign: "middle"
    },
    alternateRowStyles: {
      fillColor: lightGray
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14, overflow: 'visible' },
      1: { halign: "center", cellWidth: 25, overflow: 'visible' },
      2: { halign: "left", cellWidth: 70 },
      3: { halign: "center", cellWidth: 18, overflow: 'visible' },
      4: { halign: "right", cellWidth: 30, overflow: 'visible' },
      5: { halign: "right", cellWidth: 30, overflow: 'visible' }
    },
    styles: {
      lineColor: grayBorder,
      lineWidth: 0.15
    },
    margin: { left: 12, right: 12 },
    pageBreak: 'avoid' // Try to keep on one page
  });

  // @ts-ignore
  let finalY = pdf.lastAutoTable.finalY + Math.round(8 * S);

  // ========== CALCULATE TOTALS ==========
  const totalHTBrut = doc.lines.reduce((s, l) => {
    const priceHT = l.unitPrice / 1.2;
    return s + priceHT * l.qty;
  }, 0);

  const remiseTotalHT = doc.lines.reduce((s, l) => s + ((l.remiseAmount || 0) / 1.2) * l.qty, 0);
  const totalHTNet = totalHTBrut - remiseTotalHT;
  const totalTVA = includeTVA ? totalHTNet * 0.2 : 0;
  const finalTotal = includeTVA ? totalHTNet + totalTVA : totalHTNet;

  // Build totals rows
  const totalsData = [
    { label: "Total H.T(HR)", value: formatMAD(totalHTBrut), highlight: false },
    { label: "Remise H.T", value: formatMAD(remiseTotalHT), highlight: false },
    { label: "Total H.T(NET)", value: formatMAD(totalHTNet), highlight: false },
  ];
  if (includeTVA) {
    totalsData.push({ label: "T.V.A", value: formatMAD(totalTVA), highlight: false });
  }
  totalsData.push({ label: "NET A PAYER T.T.C", value: formatMAD(finalTotal), highlight: true });

  const rowHeight = Math.max(Math.round(8 * S), 5);

  // ========== AMOUNT IN WORDS (left) ==========
  pdf.setFontSize(fs(9));
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(...grayText);
  pdf.text("Arretee la presente facture a la somme de:", 12, finalY);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fs(9));
  pdf.setTextColor(...darkGray);
  const words = amountToFrenchWords(finalTotal);
  const wordLines = pdf.splitTextToSize(words, 85);
  pdf.text(wordLines, 12, finalY + Math.round(5 * S));

  // ========== TOTALS TABLE (right side) ==========
  const totX = 107;
  const totY = finalY - Math.round(6 * S);
  const colWidth1 = 45;
  const colWidth2 = 45;

  let currentY = totY;

  totalsData.forEach((row) => {
    if (row.highlight) {
      pdf.setFillColor(255, 255, 150);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    pdf.rect(totX, currentY, colWidth1, rowHeight, 'F');
    pdf.rect(totX + colWidth1, currentY, colWidth2, rowHeight, 'F');

    pdf.setDrawColor(...grayBorder);
    pdf.setLineWidth(0.2);
    pdf.rect(totX, currentY, colWidth1, rowHeight, 'S');
    pdf.rect(totX + colWidth1, currentY, colWidth2, rowHeight, 'S');

    pdf.setFontSize(fs(9));
    pdf.setFont("helvetica", row.highlight ? "bold" : "normal");
    pdf.setTextColor(...darkGray);
    pdf.text(row.label, totX + 2, currentY + rowHeight * 0.65);
    pdf.text(row.value, totX + colWidth1 + colWidth2 - 2, currentY + rowHeight * 0.65, { align: "right" });

    currentY += rowHeight;
  });

  // ========== PAYMENT SECTION ==========
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    const payY = currentY + Math.round(6 * S);

    pdf.setDrawColor(...teal);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(12, payY, 70, Math.round(8 * S), 2, 2, 'S');
    pdf.setFontSize(fs(9));
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...darkGray);
    pdf.text("Mode de paiement", 47, payY + Math.round(5.5 * S), { align: "center" });

    let pY = payY + Math.round(14 * S);
    const lineSpacing = Math.round(5 * S);

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
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(fs(8));
        pdf.setTextColor(...darkGray);
        pdf.text("• " + method + ": " + formatMAD(payment.amount) + " MAD (" + date + ")", 12, pY);
        pY += lineSpacing;
      });

      pY += Math.round(2 * S);
      if (remaining > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(180, 40, 40);
        pdf.text("Reste a payer: " + formatMAD(remaining) + " MAD", 12, pY);
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...teal);
        pdf.text("PAYE INTEGRALEMENT", 12, pY);
      }
    } else {
      pdf.setTextColor(...grayText);
      pdf.setFontSize(fs(8));
      pdf.text("• En attente de paiement", 12, pY);
    }
  }

  // ========== FOOTER ==========
  drawFooter(pdf, company, teal, darkGray, fs(8));

  pdf.save(doc.code + ".pdf");
}
