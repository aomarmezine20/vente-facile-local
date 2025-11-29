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
  let currentY = 20;

  // Header with logo
  if (company.logoDataUrl) {
    try {
      pdf.addImage(company.logoDataUrl, "PNG", 15, currentY, 25, 25);
    } catch {}
  }
  
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("CERTIFICAT DE GARANTIE", pageWidth / 2, currentY + 10, { align: "center" });
  
  currentY += 35;

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

  currentY += 8;

  // Warranty Terms
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Conditions de garantie:", 15, currentY);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  currentY += 7;

  const warrantyTerms = [
    "1. La garantie couvre les défauts de fabrication et les vices cachés.",
    "2. La durée de garantie est de 12 mois à compter de la date d'achat.",
    "3. La garantie ne couvre pas les dommages causés par une mauvaise utilisation.",
    "4. Pour bénéficier de la garantie, le client doit présenter ce certificat.",
    "5. Les réparations sous garantie sont effectuées dans un délai raisonnable.",
    "6. Les frais de transport aller-retour sont à la charge du client.",
  ];

  warrantyTerms.forEach((term) => {
    const lines = pdf.splitTextToSize(term, pageWidth - 30);
    pdf.text(lines, 15, currentY);
    currentY += 5 * lines.length;
  });

  currentY += 15;

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
