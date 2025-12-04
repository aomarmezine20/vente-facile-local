import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Document } from "@/types";
import { getCompany, getClients, getProducts } from "@/store/localdb";

interface Certificate {
  id: string;
  clientName: string;
  clientType: "revendeur" | "particulier" | "entreprise";
  productTypes: string;
  quantity: number;
  date: string;
}

export async function generateCertificatePdf(
  doc: Document, 
  certificate: Certificate,
  templateDataUrl?: string
): Promise<string> {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;

  let pdfDoc: PDFDocument;
  let secondPage: any;

  // Check for uploaded template first
  const storedTemplates = localStorage.getItem("certificateTemplates");
  const templates = storedTemplates ? JSON.parse(storedTemplates) : [];
  const activeTemplate = templateDataUrl || (templates.length > 0 ? templates[0].dataUrl : null);

  if (activeTemplate) {
    // Load the uploaded template
    const templateBytes = await fetch(activeTemplate).then(res => res.arrayBuffer());
    const templateDoc = await PDFDocument.load(templateBytes);
    
    pdfDoc = await PDFDocument.create();
    const pageCount = templateDoc.getPageCount();
    
    if (pageCount >= 2) {
      const [firstPage, page2] = await pdfDoc.copyPages(templateDoc, [0, 1]);
      pdfDoc.addPage(firstPage);
      pdfDoc.addPage(page2);
      secondPage = pdfDoc.getPages()[1];
    } else {
      const [firstPage] = await pdfDoc.copyPages(templateDoc, [0]);
      pdfDoc.addPage(firstPage);
      secondPage = pdfDoc.getPages()[0];
    }
  } else {
    // Create a blank certificate if no template
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    secondPage = page;
  }

  const { width, height } = secondPage.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const clientName = certificate.clientName || client?.name || "";
  const productTypes = certificate.productTypes || doc.lines
    .map(line => products.find(p => p.id === line.productId)?.name)
    .filter((name, index, self) => name && self.indexOf(name) === index)
    .join(", ") || "";

  const productCount = certificate.quantity;
  const date = certificate.date || new Date(doc.date).toLocaleDateString('fr-FR');

  const textSize = 12;
  const blueColor = rgb(0.18, 0.31, 0.62);
  const centerX = width / 2;
  let yPosition = height / 2 + 70;

  // Main certificate text in blue - centered
  const line1 = `Ce certificat est destiné à Mr/Mme ${clientName} pour l'achat de`;
  const line1Width = font.widthOfTextAtSize(line1, textSize);
  secondPage.drawText(line1, {
    x: centerX - line1Width / 2,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 20;
  const line2 = `${productTypes} marque SCRIGNO, de type ${productTypes} et d'une quantité de`;
  const line2Width = font.widthOfTextAtSize(line2, textSize);
  secondPage.drawText(line2, {
    x: centerX - line2Width / 2,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 20;
  const line3 = `${productCount} unité(s).`;
  const line3Width = font.widthOfTextAtSize(line3, textSize);
  secondPage.drawText(line3, {
    x: centerX - line3Width / 2,
    y: yPosition,
    size: textSize,
    font: font,
    color: blueColor,
  });

  yPosition -= 80;

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
  const idText = `ID Certificat: ${certificate.id}`;
  const idWidth = boldFont.widthOfTextAtSize(idText, 10);
  secondPage.drawText(idText, {
    x: centerX - idWidth / 2,
    y: yPosition,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  // Add client type badge
  yPosition -= 20;
  const typeText = `Type: ${certificate.clientType.toUpperCase()}`;
  const typeWidth = font.widthOfTextAtSize(typeText, 9);
  secondPage.drawText(typeText, {
    x: centerX - typeWidth / 2,
    y: yPosition,
    size: 9,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Save and download the PDF
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Garantie_${certificate.id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);

  return certificate.id;
}

// Legacy function for backward compatibility
export async function generateWarrantyCertificate(doc: Document): Promise<string> {
  const clients = getClients();
  const products = getProducts();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;

  const productTypes = doc.lines
    .map(line => products.find(p => p.id === line.productId)?.name)
    .filter((name, index, self) => name && self.indexOf(name) === index)
    .join(", ") || "";

  const productCount = doc.lines.reduce((sum, line) => sum + line.qty, 0);
  const timestamp = Date.now();
  const certificateId = `SE-${doc.code}-${timestamp.toString().slice(-6)}`;

  const certificate = {
    id: certificateId,
    clientName: client?.name || "",
    clientType: "particulier" as const,
    productTypes,
    quantity: productCount,
    date: new Date(doc.date).toLocaleDateString('fr-FR'),
  };

  // Save certificate to registry
  const certificates = JSON.parse(localStorage.getItem("certificates") || "[]");
  certificates.push({
    ...certificate,
    documentId: doc.id,
    documentCode: doc.code,
    articlesPerCertificate: productCount,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem("certificates", JSON.stringify(certificates));

  return generateCertificatePdf(doc, certificate);
}
