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

  // Draw text on second page matching first page design
  const textSize = 11;
  const lineHeight = 20;
  let yPosition = height - 150;

  // Title
  secondPage.drawText("Certificat de Garantie SCRIGNO", {
    x: width / 2 - 120,
    y: yPosition,
    size: 16,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= 60;

  // Client info line
  secondPage.drawText("Ce certificat est destiné à Mr/Mme ", {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(clientName.substring(0, 35), {
    x: 250,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(" pour", {
    x: 250 + clientName.substring(0, 35).length * 6,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  yPosition -= lineHeight;

  // Product line
  secondPage.drawText("l'achat de contre-châssis de marque SCRIGNO, de type ", {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(productTypes.substring(0, 30), {
    x: 350,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  yPosition -= lineHeight;

  // Quantity line
  secondPage.drawText("et d'une quantité de ", {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(productCount.toString(), {
    x: 180,
    y: yPosition,
    size: textSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });

  secondPage.drawText(" unité(s).", {
    x: 200,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  yPosition -= 40;

  // Location and date line
  secondPage.drawText(`Fait à ${location.substring(0, 30)}, le ${date}`, {
    x: 50,
    y: yPosition,
    size: textSize,
    font: font,
    color: rgb(0, 0, 0),
  });

  yPosition -= 60;

  // Warranty terms
  const warrantyText = [
    "CONDITIONS DE GARANTIE :",
    "",
    "Ce produit est garanti contre tout défaut de fabrication pour une durée de 10 ans",
    "à compter de la date d'achat mentionnée ci-dessus.",
    "",
    "La garantie couvre les vices cachés et les défauts de matériaux ou de fabrication",
    "dans des conditions normales d'utilisation et d'installation conforme.",
    "",
    "La garantie ne couvre pas l'usure normale, les dommages causés par une mauvaise",
    "installation, un usage inapproprié, un entretien inadéquat ou des modifications",
    "non autorisées du produit.",
  ];

  warrantyText.forEach(line => {
    const fontSize = line.startsWith("CONDITIONS") ? 12 : 10;
    const textFont = line.startsWith("CONDITIONS") ? boldFont : font;
    
    secondPage.drawText(line, {
      x: 50,
      y: yPosition,
      size: fontSize,
      font: textFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 18;
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
