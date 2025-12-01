import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";
import { Document } from "@/types";
import { getCompany, getClients, getProducts } from "@/store/localdb";
import warrantyTemplate from "@/assets/warranty-template.pdf";

export async function generateWarrantyCertificate(doc: Document): Promise<string> {
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

  // Calculate center position for text on second page
  const textSize = 12;
  const blueColor = rgb(0.18, 0.31, 0.62); // Blue color for the text
  const centerX = width / 2;
  let yPosition = height / 2 + 50; // Start from center of page, slightly above

  // Main certificate text in blue - centered
  const line1 = `Ce certificat est destiné à Mr/Mme ${clientName || "................................."} pour l'achat de`;
  const line1Width = font.widthOfTextAtSize(line1, textSize);
  secondPage.drawText(line1, {
    x: centerX - line1Width / 2,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 20;
  const line2 = `contre-châssis de marque SCRIGNO, de type ${productTypes || "................"} et d'une quantité de`;
  const line2Width = font.widthOfTextAtSize(line2, textSize);
  secondPage.drawText(line2, {
    x: centerX - line2Width / 2,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 20;
  const line3 = `${productCount || "..............."} unité(s).`;
  const line3Width = font.widthOfTextAtSize(line3, textSize);
  secondPage.drawText(line3, {
    x: centerX - line3Width / 2,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 80; // Add more space before "Fait à"

  // "Fait à" section - centered
  const [day, month, year] = date.split('/');
  const faitLine = `Fait à : Casablanca                                                         Le     ${day}  /  ${month}  /  ${year}  .`;
  const faitWidth = font.widthOfTextAtSize(faitLine, textSize);
  secondPage.drawText(faitLine, {
    x: centerX - faitWidth / 2,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  // Add unique certificate ID at the bottom - centered
  yPosition -= 40;
  const idText = `ID Certificat: ${certificateId}`;
  const idWidth = boldFont.widthOfTextAtSize(idText, 10);
  secondPage.drawText(idText, {
    x: centerX - idWidth / 2,
    y: yPosition,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Save certificate to registry
  const certificates = JSON.parse(localStorage.getItem("certificates") || "[]");
  certificates.push({
    id: certificateId,
    documentId: doc.id,
    documentCode: doc.code,
    clientName: clientName,
    productTypes: productTypes,
    quantity: productCount,
    date: date,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem("certificates", JSON.stringify(certificates));

  // Save and download the PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Garantie_${doc.code}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
  
  return certificateId;
}
