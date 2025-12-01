import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";
import { Document } from "@/types";
import { getCompany, getClients, getProducts } from "@/store/localdb";
import warrantyTemplate from "@/assets/warranty-template.pdf";

export async function generateWarrantyCertificate(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;

  // Load the template PDF (both pages)
  const templateBytes = await fetch(warrantyTemplate).then(res => res.arrayBuffer());
  const templateDoc = await PDFDocument.load(templateBytes);
  
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Copy both pages from template
  const [firstPage, secondPage] = await pdfDoc.copyPages(templateDoc, [0, 1]);
  pdfDoc.addPage(firstPage);
  pdfDoc.addPage(secondPage);
  
  // Get page dimensions from the second page
  const { width, height } = secondPage.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  // Prepare client information
  const clientName = client?.name || "";
  
  // Get product types and quantity
  const productTypes = doc.lines
    .map(line => products.find(p => p.id === line.productId)?.name)
    .filter((name, index, self) => name && self.indexOf(name) === index)
    .join(", ") || "";
  
  const productCount = doc.lines.reduce((sum, line) => sum + line.qty, 0);
  
  const location = "Casablanca";
  const date = new Date(doc.date).toLocaleDateString('fr-FR');
  
  // Generate unique certificate ID
  const timestamp = Date.now();
  const certificateId = `SE-${doc.code}-${timestamp.toString().slice(-6)}`;

  // Draw text at the bottom of the second page in blue
  const textSize = 11;
  const blueColor = rgb(0.18, 0.31, 0.62); // Blue color for the text
  let yPosition = 180; // Position from bottom of page

  // Main certificate text in blue
  const certificateText = `Ce certificat est destiné à Mr/Mme ${clientName || "................................."} pour l'achat de`;
  secondPage.drawText(certificateText, {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 15;
  const productLine = `contre-châssis de marque SCRIGNO, de type ${productTypes || "................"} et d'une quantité de`;
  secondPage.drawText(productLine, {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 15;
  const quantityLine = `${productCount || "..............."} unité(s).`;
  secondPage.drawText(quantityLine, {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 60; // Add more space before "Fait à"

  // "Fait à" section
  const [day, month, year] = date.split('/');
  const faitLine = `Fait à : Casablanca                                                         Le     ${day}  /  ${month}  /  ${year}  .`;
  secondPage.drawText(faitLine, {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  // Add unique certificate ID at the bottom
  yPosition -= 30;
  secondPage.drawText(`ID Certificat: ${certificateId}`, {
    x: 50,
    y: yPosition,
    size: 9,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Save and download the PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Garantie_${doc.code}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
