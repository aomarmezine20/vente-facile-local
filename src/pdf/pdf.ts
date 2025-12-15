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
  return intPart + ',' + parts[1] + ' MAD';
}

export async function generateDocumentPdf(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const db = getDB();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;
  const clientName = client?.name || doc.vendorName || "-";

  // Professional color palette
  const primaryColor: [number, number, number] = [41, 98, 150]; // Deep blue
  const secondaryColor: [number, number, number] = [55, 65, 81]; // Dark gray
  const accentColor: [number, number, number] = [16, 185, 129]; // Green accent
  const lightBg: [number, number, number] = [249, 250, 251]; // Light gray bg

  const typeMap: Record<string, Record<string, string>> = {
    vente: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE LIVRAISON", BR: "BON DE RETOUR", FA: "FACTURE" },
    achat: { DV: "DEVIS", BC: "BON DE COMMANDE", BL: "BON DE RECEPTION", BR: "BON DE RETOUR", FA: "FACTURE" },
  };

  const includeTVA = doc.includeTVA === true;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ========== TINY BLUE RECTANGLE AT TOP ==========
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, pageWidth, 4, "F");

  // ========== HEADER SECTION ==========
  // Company logo area
  if (company?.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, 'JPEG', 15, 12, 30, 30);
    } catch (e) {
      // Fallback
      pdf.setFillColor(...primaryColor);
      pdf.roundedRect(15, 12, 30, 30, 3, 3, "F");
      pdf.setFontSize(12);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.text("LOGO", 30, 30, { align: "center" });
    }
  } else {
    pdf.setFillColor(...primaryColor);
    pdf.roundedRect(15, 12, 30, 30, 3, 3, "F");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.text("SMART", 30, 25, { align: "center" });
    pdf.text("EXIT", 30, 32, { align: "center" });
  }

  // Company info
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...secondaryColor);
  pdf.text(company?.name || "SMART EXIT", 50, 20);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(107, 114, 128);
  pdf.text(company?.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA", 50, 27);
  pdf.text("Tel: " + (company?.phone || "+212 522995252"), 50, 33);
  pdf.text("Email: " + (company?.email || "contact.smartexit@gmail.com"), 50, 39);

  // Document type badge (top right)
  const docType = typeMap[doc.mode][doc.type];
  pdf.setFillColor(...primaryColor);
  pdf.roundedRect(140, 12, 55, 18, 2, 2, "F");
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(255, 255, 255);
  pdf.text(docType, 167.5, 23, { align: "center" });

  // Document number
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...secondaryColor);
  pdf.text("N° " + doc.code, 167.5, 38, { align: "center" });

  // Separator line
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(15, 50, pageWidth - 15, 50);

  // ========== DOCUMENT INFO & CLIENT ==========
  const infoY = 58;

  // Document info box
  pdf.setFillColor(...lightBg);
  pdf.roundedRect(15, infoY, 85, 30, 2, 2, "F");
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...primaryColor);
  pdf.text("INFORMATIONS", 20, infoY + 8);
  
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...secondaryColor);
  pdf.text("Date:", 20, infoY + 17);
  pdf.text(new Date(doc.date).toLocaleDateString('fr-FR'), 45, infoY + 17);
  pdf.text("Reference:", 20, infoY + 24);
  pdf.text(doc.code, 45, infoY + 24);

  // Client box
  pdf.setFillColor(...lightBg);
  pdf.roundedRect(110, infoY, 85, 30, 2, 2, "F");
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...primaryColor);
  pdf.text("CLIENT", 115, infoY + 8);
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...secondaryColor);
  pdf.text(clientName.substring(0, 28), 115, infoY + 18);
  
  if (client?.phone) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(client.phone, 115, infoY + 25);
  }

  // ========== TABLE ==========
  const tableY = infoY + 40;

  const tableData = doc.lines.map((l, idx) => {
    const p = products.find((pr) => pr.id === l.productId);
    const priceHT = includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
    const remise = l.remiseAmount || 0;
    const totalLineHT = (priceHT * l.qty) - (remise * l.qty);
    
    return [
      String(idx + 1),
      p?.sku || "-",
      l.description || p?.name || "",
      String(l.qty),
      formatMAD(priceHT),
      remise > 0 ? formatMAD(remise) : "-",
      formatMAD(totalLineHT)
    ];
  });

  autoTable(pdf, {
    startY: tableY,
    head: [["#", "Réf.", "Désignation", "Qté", "Prix U. HT", "Remise", "Total HT"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
      halign: "center",
      cellPadding: 4
    },
    bodyStyles: {
      fontSize: 9,
      textColor: secondaryColor,
      cellPadding: 4
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 20 },
      2: { halign: "left", cellWidth: 55 },
      3: { halign: "center", cellWidth: 15 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "center", cellWidth: 22 },
      6: { halign: "right", cellWidth: 28 }
    },
    styles: {
      lineColor: [229, 231, 235],
      lineWidth: 0.2
    },
    margin: { left: 15, right: 15 }
  });

  // @ts-ignore
  const finalY = pdf.lastAutoTable.finalY + 15;

  // Calculate totals
  const totalHT = doc.lines.reduce((s, l) => {
    const priceHT = includeTVA ? l.unitPrice / 1.2 : l.unitPrice;
    const remise = l.remiseAmount || 0;
    return s + (priceHT * l.qty) - (remise * l.qty);
  }, 0);
  
  const remiseTotal = doc.lines.reduce((s, l) => s + (l.remiseAmount || 0) * l.qty, 0);
  const totalTVA = includeTVA ? totalHT * 0.2 : 0;
  const finalTotal = includeTVA ? totalHT + totalTVA : totalHT;

  // ========== AMOUNT IN WORDS ==========
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "italic");
  pdf.setTextColor(107, 114, 128);
  pdf.text("Arretee la presente facture a la somme de:", 15, finalY);
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...secondaryColor);
  const words = amountToFrenchWords(finalTotal);
  const wordLines = pdf.splitTextToSize(words, 90);
  pdf.text(wordLines, 15, finalY + 5);

  // ========== TOTALS BOX ==========
  const totX = 125;
  const totY = finalY - 8;
  const totWidth = 70;

  // Background
  pdf.setFillColor(...lightBg);
  pdf.roundedRect(totX, totY, totWidth, includeTVA ? 48 : 35, 2, 2, "F");

  let currentY = totY + 10;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...secondaryColor);

  // Total HT
  pdf.text("Total HT", totX + 5, currentY);
  pdf.text(formatMAD(totalHT), totX + totWidth - 5, currentY, { align: "right" });
  currentY += 8;

  // Remise
  if (remiseTotal > 0) {
    pdf.text("Remises", totX + 5, currentY);
    pdf.setTextColor(220, 38, 38);
    pdf.text("-" + formatMAD(remiseTotal), totX + totWidth - 5, currentY, { align: "right" });
    pdf.setTextColor(...secondaryColor);
    currentY += 8;
  }

  // TVA
  if (includeTVA) {
    pdf.text("TVA (20%)", totX + 5, currentY);
    pdf.text(formatMAD(totalTVA), totX + totWidth - 5, currentY, { align: "right" });
    currentY += 10;
  }

  // Separator
  pdf.setDrawColor(...primaryColor);
  pdf.setLineWidth(0.8);
  pdf.line(totX + 5, currentY - 3, totX + totWidth - 5, currentY - 3);
  currentY += 5;

  // Final Total
  pdf.setFillColor(...primaryColor);
  pdf.roundedRect(totX + 3, currentY - 6, totWidth - 6, 14, 2, 2, "F");
  
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  const label = includeTVA ? "TOTAL TTC" : "TOTAL HT";
  pdf.text(label, totX + 8, currentY + 2);
  pdf.text(formatMAD(finalTotal), totX + totWidth - 8, currentY + 2, { align: "right" });

  // ========== PAYMENT (Invoices) ==========
  if (doc.type === "FA") {
    const payments = db.payments.filter(p => p.documentId === doc.id);
    const payY = finalY + 20;
    
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(15, payY, 75, 10, 2, 2);
    
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...secondaryColor);
    pdf.text("Mode de paiement", 52.5, payY + 7, { align: "center" });
    
    let pY = payY + 18;
    
    if (payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = finalTotal - totalPaid;
      
      const methodLabels: Record<string, string> = {
        especes: "Especes", cheque: "Cheque", virement: "Virement",
        carte: "Carte", versement: "Versement", traite: "Traite", autre: "Autre"
      };
      
      payments.slice(0, 3).forEach((payment) => {
        const method = methodLabels[payment.method] || payment.method;
        const date = new Date(payment.date).toLocaleDateString('fr-FR');
        pdf.text("• " + method + ": " + formatMAD(payment.amount) + " (" + date + ")", 15, pY);
        pY += 5;
      });
      
      pY += 3;
      if (remaining > 0) {
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(220, 38, 38);
        pdf.text("Reste a payer: " + formatMAD(remaining), 15, pY);
      } else {
        pdf.setFillColor(...accentColor);
        pdf.roundedRect(15, pY - 4, 45, 8, 2, 2, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text("PAYE INTEGRALEMENT", 37.5, pY + 1, { align: "center" });
      }
    } else {
      pdf.setTextColor(107, 114, 128);
      pdf.text("En attente de paiement", 15, pY);
    }
  }

  // ========== FOOTER ==========
  const footerY = pageHeight - 28;
  
  // Footer line
  pdf.setFillColor(...primaryColor);
  pdf.rect(15, footerY, pageWidth - 30, 1.5, "F");
  
  // Footer text - BOLD and bigger
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...secondaryColor);
  
  const footerLine1 = "S.A.R.L au capital de 200.000,00 DH";
  const footerLine2 = "Siege: " + (company?.address || "14 RUE EL HATIMI RIVIERA, CASABLANCA");
  const footerLine3 = "Tel: " + (company?.phone || "+212 522995252") + " | Email: " + (company?.email || "contact.smartexit@gmail.com");
  const footerLine4 = "RC: 487155 | IF: 48541278 | TP: 32252429 | ICE: 002726225000084";
  
  pdf.text(footerLine1 + " • " + footerLine2, pageWidth / 2, footerY + 7, { align: "center" });
  pdf.text(footerLine3, pageWidth / 2, footerY + 13, { align: "center" });
  pdf.text(footerLine4, pageWidth / 2, footerY + 19, { align: "center" });

  pdf.save(doc.code + ".pdf");
}
