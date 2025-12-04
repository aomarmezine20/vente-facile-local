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
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const centerX = width / 2;
  const blueColor = rgb(0.18, 0.31, 0.62);
  
  // Only write ID and Type on the certificate - centered in second page
  let yPosition = height / 2 + 50;

  // Certificate ID - bold and prominent
  const idText = `ID: ${certificate.id}`;
  const idWidth = boldFont.widthOfTextAtSize(idText, 14);
  secondPage.drawText(idText, {
    x: centerX - idWidth / 2,
    y: yPosition,
    size: 14,
    font: boldFont,
    color: blueColor,
  });

  // Client type badge
  yPosition -= 25;
  const typeText = `Type: ${certificate.clientType.toUpperCase()}`;
  const typeWidth = font.widthOfTextAtSize(typeText, 11);
  secondPage.drawText(typeText, {
    x: centerX - typeWidth / 2,
    y: yPosition,
    size: 11,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
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
