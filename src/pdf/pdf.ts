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

  // Royal blue corporate color
  const teal: [number, number, number] = [46, 80, 144]; // #2E5090
  const darkGray: [number, number, number] = [51, 51, 51];
  const grayText: [number, number, number] = [100, 100, 100];
  const lightGray: [number, number, number] = [245, 245, 245]; // Light gray for backgrounds

  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  const includeTVA = doc.includeTVA === true;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ========== HEADER BORDER BOX (rounded) ==========
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(12, 8, pageWidth - 24, 40, 3, 3, 'S');

  // ========== LOGO (left) ==========
  if (company?.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, 'JPEG', 16, 12, 28, 32);
    } catch (e) {
      // Fallback logo box (rounded)
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
  } else {
    // Default logo placeholder (rounded)
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

  // ========== COMPANY NAME & ADDRESS ==========
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(company?.name || "SMART EXIT", 48, 24);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...grayText);
  pdf.text(company?.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", 48, 32);

  // ========== DOCUMENT TYPE (right, just text no box) ==========
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text(typeMap[doc.mode][doc.type], 172.5, 22, { align: "center" });

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("N° " + doc.code, 172.5, 29, { align: "center" });

  // ========== INFO SECTIONS ==========
  const infoY = 55;

  // INFORMATIONS DOCUMENT header (just blue text, no box)
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...teal);
  pdf.text("INFORMATIONS DOCUMENT", 57, infoY + 5.5, { align: "center" });

  // CLIENT header (just blue text, no box)
  pdf.text("CLIENT", 152, infoY + 5.5, { align: "center" });

  // Date box (rounded with gray fill)
  pdf.setFillColor(...lightGray);
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(12, infoY + 10, 90, 22, 2, 2, 'FD');
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkGray);
  pdf.text("Date: " + new Date(doc.date).toLocaleDateString('fr-FR'), 18, infoY + 22);

  // Client box (rounded with gray fill)
  pdf.setFillColor(...lightGray);
  pdf.roundedRect(107, infoY + 10, 90, 22, 2, 2, 'FD');
  pdf.setFont("helvetica", "bold");
  pdf.text(clientName.substring(0, 35), 152, infoY + 17, { align: "center" });
  
  // Show ICE for entreprise or phone for particulier
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  if (client?.type === "entreprise" && client?.ice) {
    pdf.text("ICE: " + client.ice, 152, infoY + 25, { align: "center" });
  } else if (client?.type === "particulier" && client?.phone) {
    pdf.text("Tel: " + client.phone, 152, infoY + 25, { align: "center" });
  }

  // ========== TABLE ==========
  const tableY = infoY + 50;

  // MANDATORY: All prices and remises are TTC - convert to HT for display
  const tableData = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    const priceHT = l.unitPrice / 1.2; // Convert price TTC to HT
    const remiseHT = (l.remiseAmount || 0) / 1.2; // Convert remise TTC to HT
    const totalLineHT = (priceHT - remiseHT) * l.qty; // Apply discount on HT

    return [
      String(idx + 1),
      p?.sku || "-",
      l.description || p?.name || "",
      String(l.qty),
      formatMAD(priceHT),
      remiseHT > 0 ? formatMAD(remiseHT) : "-", // Show remise HT
      formatMAD(totalLineHT)
    ];
  });


  const grayBorder: [number, number, number] = [180, 180, 180]; // Gray for borders

  autoTable(pdf, {
    startY: tableY,
    head: [["N°", "Réf.", "Désignation", "QTE", "P.U.H.T", "Remise H.T", "Total H.T"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [255, 255, 255], // White background for headers
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
      fillColor: lightGray // Gray for alternate rows
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14, overflow: 'visible' },
      1: { halign: "center", cellWidth: 22, overflow: 'visible' },
      2: { halign: "left", cellWidth: 50 },
      3: { halign: "center", cellWidth: 16, overflow: 'visible' },
      4: { halign: "right", cellWidth: 30, overflow: 'visible' },
      5: { halign: "center", cellWidth: 26, overflow: 'visible' },
      6: { halign: "right", cellWidth: 30, overflow: 'visible' }
    },
    styles: {
      lineColor: grayBorder, // Gray border
      lineWidth: 0.15 // Very thin border
    },
    margin: { left: 12, right: 12 }
  });

  // @ts-ignore
  const finalY = pdf.lastAutoTable.finalY + 12;

  // MANDATORY: Calculate totals with TTC->HT conversion
  const totalHT = doc.lines.reduce((s, l) => {
    const priceHT = l.unitPrice / 1.2; // Convert price TTC to HT
    const remiseHT = (l.remiseAmount || 0) / 1.2; // Convert remise TTC to HT
    return s + (priceHT - remiseHT) * l.qty;
  }, 0);

  const remiseTotalHT = doc.lines.reduce((s, l) => s + ((l.remiseAmount || 0) / 1.2) * l.qty, 0);
  const totalTVA = includeTVA ? totalHT * 0.2 : 0;
  const finalTotal = includeTVA ? totalHT + totalTVA : totalHT;

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

  // ========== TOTALS BOX (right, rounded with gray fill) ==========
  const totX = 130;
  const totY = finalY - 5;
  const totWidth = 67;
  const totHeight = includeTVA ? 42 : 32;

  // Gray fill first
  pdf.setFillColor(...lightGray);
  pdf.roundedRect(totX, totY, totWidth, totHeight, 3, 3, 'F');
  
  // Blue border
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(totX, totY, totWidth, totHeight, 3, 3, 'S');

  let currentY = totY + 9;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...darkGray);

  // Total H.T
  pdf.text("Total H.T:", totX + 5, currentY);
  pdf.text(formatMAD(totalHT), totX + totWidth - 5, currentY, { align: "right" });
  currentY += 8;

  // Remises (show HT)
  if (remiseTotalHT > 0) {
    pdf.text("Remises H.T:", totX + 5, currentY);
    pdf.setTextColor(180, 40, 40);
    pdf.text("-" + formatMAD(remiseTotalHT), totX + totWidth - 5, currentY, { align: "right" });
    pdf.setTextColor(...darkGray);
    currentY += 8;
  }

  // TVA
  if (includeTVA) {
    pdf.text("TVA 20%:", totX + 5, currentY);
    pdf.text(formatMAD(totalTVA), totX + totWidth - 5, currentY, { align: "right" });
    currentY += 10;
  }

  // Separator line
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.8);
  pdf.line(totX + 3, currentY - 3, totX + totWidth - 3, currentY - 3);
  currentY += 5;

  // TOTAL
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  const totalLabel = includeTVA ? "TOTAL TTC:" : "TOTAL H.T:";
  pdf.text(totalLabel, totX + 5, currentY);
  pdf.text(formatMAD(finalTotal), totX + totWidth - 5, currentY, { align: "right" });

  // ========== PAYMENT SECTION ==========
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    const payY = finalY + 18;

    // Mode de paiement box (rounded)
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
        pdf.text("• " + method + ": " + formatMAD(payment.amount) + " (" + date + ")", 12, pY);
        pY += 6;
      });

      pY += 4;
      if (remaining > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(180, 40, 40);
        pdf.text("Reste a payer: " + formatMAD(remaining), 12, pY);
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

  // ========== FOOTER (at bottom of page) ==========
  const footerY = pageHeight - 20;

  // Footer line
  pdf.setDrawColor(...teal);
  pdf.setLineWidth(0.5);
  pdf.line(12, footerY, pageWidth - 12, footerY);

  // Footer text - first line bold, others normal, slightly bigger
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...darkGray);
  pdf.text("S.A.R.L au capital de 200.000,00 DH • Siege: " + (company?.address || "14 RUE EL HATIMI RIVIERA,CASABLANCA"), pageWidth / 2, footerY + 4, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.text("Tel: " + (company?.phone || "+212 522995252") + " | Email: " + (company?.email || "contact.smartexit@gmail.com"), pageWidth / 2, footerY + 9, { align: "center" });
  pdf.text("RC: 487155 | IF: 48541278 | TP: 32252429 | ICE: 002726225000084", pageWidth / 2, footerY + 14, { align: "center" });

  pdf.save(doc.code + ".pdf");
}
