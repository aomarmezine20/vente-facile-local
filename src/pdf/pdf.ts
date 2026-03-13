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

function drawFooter(pdf: jsPDF, company: any, teal: [number, number, number], darkGray: [number, number, number]) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerY = pageHeight - 20;

  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.5);
  pdf.line(12, footerY, pageWidth - 12, footerY);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(`S.A.R.L au capital de ${company?.capital || "200.000,00 DH"} • Siege: ${company?.address || "14 RUE EL HATIMI RIVIERA,CASABLANCA"}`, pageWidth / 2, footerY + 4, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.text(`Tel: ${company?.phone || "+212 522995252"} | Email: ${company?.email || "contact.smartexit@gmail.com"}`, pageWidth / 2, footerY + 9, { align: "center" });
  pdf.text(`RC: ${company?.rc || "487155"} | IF: ${company?.if || "48541278"} | TP: ${company?.tp || "32252429"} | ICE: ${company?.ice || "002726225000084"}`, pageWidth / 2, footerY + 14, { align: "center" });
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

  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
    interne: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  const includeTVA = doc.includeTVA === true;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerZoneTop = pageHeight - 25; // Nothing should go below this

  // ========== HEADER ==========
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(12, 8, pageWidth - 24, 40, 3, 3, 'S');

  if (company?.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, 'JPEG', 16, 12, 28, 32);
    } catch (e) {
      drawLogoPlaceholder(pdf, teal, grayText);
    }
  } else {
    drawLogoPlaceholder(pdf, teal, grayText);
  }

  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(company?.name || "SMART EXIT", 48, 24);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...grayText);
  pdf.text(company?.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", 48, 32);

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(typeMap[doc.mode][doc.type], 172.5, 22, { align: "center" });

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("N° " + doc.code, 172.5, 29, { align: "center" });

  // ========== INFO SECTIONS ==========
  const infoY = 55;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...teal);
  pdf.text("INFORMATIONS DOCUMENT", 57, infoY + 5.5, { align: "center" });
  pdf.text("CLIENT", 152, infoY + 5.5, { align: "center" });

  pdf.setFillColor(...lightGray);
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(12, infoY + 10, 90, 22, 2, 2, 'FD');
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkGray);
  pdf.text("Date: " + new Date(doc.date).toLocaleDateString('fr-FR'), 18, infoY + 22);

  pdf.setFillColor(...lightGray);
  pdf.roundedRect(107, infoY + 10, 90, 32, 2, 2, 'FD');

  if (client?.code) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...grayText);
    pdf.text("Code: " + client.code, 192, infoY + 16, { align: "right" });
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...darkGray);
  pdf.text(clientName.substring(0, 35), 152, infoY + 22, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...grayText);
  if (client?.address) {
    const addressLines = pdf.splitTextToSize(client.address, 80);
    pdf.text(addressLines.slice(0, 2), 152, infoY + 28, { align: "center" });
  }

  pdf.setFontSize(9);
  pdf.setTextColor(...darkGray);
  if (client?.type === "entreprise" && client?.ice) {
    pdf.text("ICE: " + client.ice, 152, infoY + 38, { align: "center" });
  } else if (client?.type === "particulier" && client?.phone) {
    pdf.text("Tel: " + client.phone, 152, infoY + 38, { align: "center" });
  }

  // ========== TABLE ==========
  const tableY = infoY + 58;

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

  const grayBorder: [number, number, number] = [180, 180, 180];

  autoTable(pdf, {
    startY: tableY,
    head: [["N°", "Réf.", "Désignation", "QTE", "P.U.H.T", "Total H.T"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: darkGray,
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      valign: "middle",
      cellPadding: 5
    },
    bodyStyles: {
      fontSize: 9,
      textColor: darkGray,
      cellPadding: 5,
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
    margin: { left: 12, right: 12, bottom: 30 }, // Reserve space for footer
    didDrawPage: function () {
      // Draw footer on EVERY page generated by autoTable
      drawFooter(pdf, company, teal, darkGray);
    }
  });

  // @ts-ignore
  let finalY = pdf.lastAutoTable.finalY + 12;

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

  const rowHeight = 8;
  const totalsHeight = totalsData.length * rowHeight;
  const wordsHeight = 20;
  const paymentHeight = doc.type === "FA" ? 40 : 0;
  const neededSpace = Math.max(totalsHeight, wordsHeight) + paymentHeight + 10;

  // Check if totals + payment fit before the footer zone
  if (finalY + neededSpace > footerZoneTop) {
    pdf.addPage();
    drawFooter(pdf, company, teal, darkGray);
    finalY = 20;
  }

  // ========== AMOUNT IN WORDS (left) ==========
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(...grayText);
  pdf.text("Arretee la presente facture a la somme de:", 12, finalY);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...darkGray);
  const words = amountToFrenchWords(finalTotal);
  const wordLines = pdf.splitTextToSize(words, 85);
  pdf.text(wordLines, 12, finalY + 6);

  // ========== TOTALS TABLE (right side) ==========
  const totX = 107;
  const totY = finalY - 8;
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

    pdf.setFontSize(9);
    pdf.setFont("helvetica", row.highlight ? "bold" : "normal");
    pdf.setTextColor(...darkGray);
    pdf.text(row.label, totX + 3, currentY + 5.5);
    pdf.text(row.value, totX + colWidth1 + colWidth2 - 3, currentY + 5.5, { align: "right" });

    currentY += rowHeight;
  });

  // ========== PAYMENT SECTION ==========
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    const payY = currentY + 10;

    pdf.setDrawColor(...teal);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(12, payY, 70, 10, 2, 2, 'S');
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...darkGray);
    pdf.text("Mode de paiement", 47, payY + 7, { align: "center" });

    let pY = payY + 18;

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
        pdf.setTextColor(...darkGray);
        pdf.text("• " + method + ": " + formatMAD(payment.amount) + " MAD (" + date + ")", 12, pY);
        pY += 6;
      });

      pY += 4;
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
      pdf.text("• En attente de paiement", 12, pY);
    }
  }

  // Footer is already drawn on table pages via didDrawPage.
  // Draw footer on the current (last) page if it wasn't drawn by autoTable
  // (this handles the case where totals moved to a new page)
  const totalPages = pdf.getNumberOfPages();
  // @ts-ignore
  const autoTablePages = pdf.lastAutoTable ? Math.ceil((pdf.lastAutoTable.finalY - tableY) / (footerZoneTop - tableY)) + 1 : 1;
  // Always ensure footer is on the last page
  drawFooter(pdf, company, teal, darkGray);

  pdf.save(doc.code + ".pdf");
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