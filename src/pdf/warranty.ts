import jsPDF from "jspdf";
import { Document } from "@/types";
import { getCompany, getClients, getProducts } from "@/store/localdb";

export function generateWarrantyCertificate(doc: Document) {
  const company = getCompany();
  const clients = getClients();
  const products = getProducts();
  const client = doc.clientId ? clients.find((c) => c.id === doc.clientId) : null;

  const pdf = new jsPDF();
  const pageWidth = 210; // A4 width in mm
  let currentY = 25;

  // Header with company name and logo
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(company.name.toUpperCase(), 15, currentY);
  
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", pageWidth - 40, 15, 25, 25);
    } catch {}
  }
  
  currentY += 8;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "italic");
  pdf.text("Be open be smart", 15, currentY);
  
  currentY += 15;
  
  // Main title
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("CERTIFICAT DE GARANTIE", pageWidth / 2, currentY, { align: "center" });
  
  currentY += 15;

  // Company Information
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Informations du vendeur:", 15, currentY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  currentY += 7;
  pdf.text(company.name, 15, currentY);
  if (company.address) {
    currentY += 5;
    pdf.text(`Adresse: ${company.address}`, 15, currentY);
  }
  if (company.phone) {
    currentY += 5;
    pdf.text(`Téléphone: ${company.phone}`, 15, currentY);
  }
  if (company.email) {
    currentY += 5;
    pdf.text(`Email: ${company.email}`, 15, currentY);
  }

  currentY += 12;

  // Client Information
  if (client) {
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Informations du client:", 15, currentY);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    currentY += 7;
    pdf.text(`Nom: ${client.name}`, 15, currentY);
    currentY += 5;
    pdf.text(`Type: ${client.type === "entreprise" ? "Entreprise" : "Particulier"}`, 15, currentY);
    if (client.email) {
      currentY += 5;
      pdf.text(`Email: ${client.email}`, 15, currentY);
    }
    if (client.phone) {
      currentY += 5;
      pdf.text(`Téléphone: ${client.phone}`, 15, currentY);
    }
    if (client.address) {
      currentY += 5;
      pdf.text(`Adresse: ${client.address}`, 15, currentY);
    }
  }

  currentY += 12;

  // Document Information
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Détails de la facture:", 15, currentY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  currentY += 7;
  pdf.text(`Numéro: ${doc.code}`, 15, currentY);
  currentY += 5;
  pdf.text(`Date: ${new Date(doc.date).toLocaleDateString()}`, 15, currentY);

  currentY += 12;

  // Products List
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Produits couverts par la garantie:", 15, currentY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  currentY += 7;

  doc.lines.forEach((line, index) => {
    const product = products.find((p) => p.id === line.productId);
    if (product) {
      pdf.text(`${index + 1}. ${product.name} (Réf: ${product.sku})`, 20, currentY);
      currentY += 5;
      pdf.text(`   Quantité: ${line.qty} ${product.unit}`, 20, currentY);
      currentY += 7;
    }
  });

  currentY += 12;

  // Warranty Terms
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Conditions de garantie:", 15, currentY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  currentY += 7;

  const warrantyTerms = [
    "• Les frais de transport du revendeur et d'installation sont à la charge de l'acheteur.",
    "",
    "• Garantie à vie sur les composants pour intérieurs.",
    `  ${company.name} garantit que les produits ne sont pas sujets à la corrosion traversante,`,
    "  et ce, pour toute la durée de vie du produit.",
    "",
    "• Garantie de 20 ans contre les ruptures du système.",
    "",
    "• Garantie de 20 ans relative à l'intégrité des composants en aluminium anodisé.",
  ];

  warrantyTerms.forEach((term) => {
    if (term === "") {
      currentY += 3;
      return;
    }
    const lines = pdf.splitTextToSize(term, pageWidth - 30);
    pdf.text(lines, 15, currentY);
    currentY += 5 * lines.length;
  });
  
  currentY += 5;

  // Warranty integrity section
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Garantie d'intégrité", 15, currentY);
  currentY += 6;
  
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const integrityText = [
    `${company.name} garantit que les produits sont réalisés conformément aux standards`,
    "qualitatifs imposés. En cas de vice constaté lors de l'ouverture de l'emballage,",
    "l'acheteur dispose de 20 jours pour le signaler au revendeur autorisé.",
  ];
  
  integrityText.forEach(line => {
    pdf.text(line, 15, currentY);
    currentY += 5;
  });
  
  currentY += 10;
  
  // Certificate section
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Certificat d'authenticité", 15, currentY);
  currentY += 8;
  
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const certText = `${company.name} vous garantit personnellement l'originalité des produits que vous avez achetés,`;
  pdf.text(certText, 15, currentY);
  currentY += 5;
  pdf.text("vous remerciant pour avoir choisi nos produits et vous souhaitant d'en obtenir entière satisfaction.", 15, currentY);
  
  currentY += 12;
  
  pdf.setFontSize(10);
  const customerLine = `Ce certificat est destiné à Mr/Mme ${client?.name || "................................"}`;
  pdf.text(customerLine, 15, currentY);
  currentY += 6;
  
  const productCount = doc.lines.reduce((sum, line) => sum + line.qty, 0);
  const productLine = `pour l'achat de produits de marque ${company.name.toUpperCase()}, d'une quantité de ${productCount} unité(s).`;
  pdf.text(productLine, 15, currentY);
  
  currentY += 15;
  
  // Date and location
  pdf.setFontSize(10);
  const dateText = `Fait à: ${company.address || ".................."}    Le ${new Date(doc.date).toLocaleDateString()}`;
  pdf.text(dateText, 15, currentY);
  
  currentY += 20;

  // Signatures
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  
  // Company signature
  pdf.text("Le vendeur", 30, currentY);
  pdf.line(20, currentY + 15, 80, currentY + 15);
  pdf.setFontSize(8);
  pdf.text("(Signature et cachet)", 25, currentY + 20);

  // Client signature
  pdf.setFontSize(10);
  pdf.text("Le client", pageWidth - 60, currentY);
  pdf.line(pageWidth - 80, currentY + 15, pageWidth - 20, currentY + 15);
  pdf.setFontSize(8);
  pdf.text("(Signature)", pageWidth - 60, currentY + 20);

  pdf.save(`Garantie_${doc.code}.pdf`);
}
