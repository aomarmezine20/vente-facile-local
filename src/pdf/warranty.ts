import { PDFDocument, rgb, StandardFonts, PageSizes } from "pdf-lib";
import { Document } from "@/types";
import { getCompany, getClients, getProducts } from "@/store/localdb";
import warrantyTemplate from "@/assets/warranty-template.pdf";

export async function generateWarrantyCertificate(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;

  // Load the template PDF (we'll only use page 1)
  const templateBytes = await fetch(warrantyTemplate).then(res => res.arrayBuffer());
  const templateDoc = await PDFDocument.load(templateBytes);
  
  // Create a new PDF document
  const pdfDoc = await PDFDocument.create();
  
  // Copy the first page from template
  const [firstPage] = await pdfDoc.copyPages(templateDoc, [0]);
  pdfDoc.addPage(firstPage);
  
  // Get page dimensions from the first page
  const { width, height } = firstPage.getSize();
  
  // Create second page with same dimensions
  const secondPage = pdfDoc.addPage([width, height]);
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
  
  const location = company.address || "";
  const date = new Date(doc.date).toLocaleDateString('fr-FR');

  // Draw text on second page matching the new design
  const textSize = 11;
  const lineHeight = 20;
  let yPosition = height - 120;

  // Title
  secondPage.drawText("Certificat d'authenticité Scrigno", {
    x: width / 2 - 110,
    y: yPosition,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= 50;

  // Introduction paragraph
  const introLines = [
    "Cher acheteur, Smart Exit vous garantis personnellement l'originalité du contre-châssis",
    "Scrigno que vous avez acheté, vous remerciant pour avoir choisi nos produits et vous",
    "souhaitant d'en obtenir entière satisfaction."
  ];
  
  introLines.forEach(line => {
    secondPage.drawText(line, {
      x: 50,
      y: yPosition,
      size: textSize,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= lineHeight;
  });

  yPosition -= 20;

  // Client certificate section with filled data
  secondPage.drawText("Ce certificat est destiné à Mr/Mme ", {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(clientName || ".................................", {
    x: 260,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(" pour", {
    x: 430,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  yPosition -= lineHeight;

  // Product type line
  secondPage.drawText("l'achat de contre-châssis de marque SCRIGNO, de type ", {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(productTypes || "................", {
    x: 350,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(" et", {
    x: 470,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  yPosition -= lineHeight;

  // Quantity line
  secondPage.drawText("d'une quantité de ", {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(productCount.toString() || "...........", {
    x: 170,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(" unité(s).", {
    x: 220,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  yPosition -= 100;

  // Location and date line (simplified format)
  secondPage.drawText(`Fait à : ${location || "                                    "}`, {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  const [day, month, year] = date.split('/');
  secondPage.drawText(`Le    ${day}  /  ${month}  /  ${year}  .`, {
    x: 350,
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
