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

  // Draw text on the template's second page
  const textSize = 11;
  const lineHeight = 20;
  let yPosition = height - 240;

  // Skip title and intro - already on template
  // Position for the client name field

  // Fill in client name on the dotted line
  secondPage.drawText(clientName || "", {
    x: 265,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= lineHeight;

  // Fill in product type
  secondPage.drawText(productTypes || "", {
    x: 350,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= lineHeight;

  // Fill in quantity
  secondPage.drawText(productCount.toString(), {
    x: 165,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= 100;

  // Fill in location and date
  secondPage.drawText(location, {
    x: 105,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  const [day, month, year] = date.split('/');
  secondPage.drawText(day, {
    x: 365,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(month, {
    x: 395,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(year, {
    x: 425,
    y: yPosition,
    size: textSize,
    font: font,
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
