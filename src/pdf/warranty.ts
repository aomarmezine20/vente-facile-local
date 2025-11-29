import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Document } from "@/types";
import { getCompany, getClients, getProducts } from "@/store/localdb";
import warrantyTemplate from "@/assets/warranty-template.pdf";

export async function generateWarrantyCertificate(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;

  // Load the template PDF
  const templateBytes = await fetch(warrantyTemplate).then(res => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  
  // Get the second page (index 1) where we need to fill client info
  const pages = pdfDoc.getPages();
  const secondPage = pages[1];
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;

  // Prepare client information
  const clientName = client?.name || ".................................";
  
  // Get product types and quantity
  const productTypes = doc.lines
    .map(line => products.find(p => p.id === line.productId)?.name)
    .filter((name, index, self) => name && self.indexOf(name) === index)
    .join(", ") || "............";
  
  const productCount = doc.lines.reduce((sum, line) => sum + line.qty, 0);
  
  const location = company.address || "..................";
  const date = new Date(doc.date).toLocaleDateString('fr-FR');

  // Fill in the client name (approximate position)
  secondPage.drawText(clientName, {
    x: 160,
    y: 490,
    size: fontSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Fill in the product type
  secondPage.drawText(productTypes.substring(0, 40), {
    x: 180,
    y: 475,
    size: fontSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Fill in the quantity
  secondPage.drawText(productCount.toString(), {
    x: 385,
    y: 475,
    size: fontSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Fill in the location
  secondPage.drawText(location.substring(0, 50), {
    x: 75,
    y: 440,
    size: fontSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  // Fill in the date
  secondPage.drawText(date, {
    x: 265,
    y: 440,
    size: fontSize,
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
