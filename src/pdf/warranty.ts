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
  const margin = 15;
  let currentY = 20;

  // ==================== PAGE 1 - TEMPLATE (EXACT COPY) ====================
  
  // Header with company logos
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("SMART EXIT", margin, currentY);
  pdf.text("SCRIGNO", pageWidth - margin - 35, currentY);
  
  currentY += 6;
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "italic");
  pdf.text("Be open be smart", margin, currentY);
  
  currentY += 15;
  
  // Main title
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("CERTIFICAT DE GARANTIE", pageWidth / 2, currentY, { align: "center" });
  
  currentY += 12;

  // First bullet point
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("• Les frais de transport du revendeur et d'installation du contre-châssis sont à la charge de l'acheteur.", margin, currentY);
  
  currentY += 10;

  // Section title
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  const title1 = "Garantie SCRIGNO sur les composants du contre-châssis pour portes et fenêtres coulissantes";
  pdf.text(title1, margin, currentY);
  currentY += 5;
  pdf.text("escamotables", margin, currentY);
  
  currentY += 8;

  // Intro text
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const introLines = pdf.splitTextToSize(
    "Outre aux garanties légales ordinairement prévues, Scrigno S.p.A. fournit des garanties supplémentaires au consommateur qui choisit les contre-châssis originaux Scrigno, et ce, tant sur les composants du caisson que sur le système de coulissement :",
    pageWidth - 2 * margin
  );
  introLines.forEach((line: string) => {
    pdf.text(line, margin, currentY);
    currentY += 4.5;
  });
  
  currentY += 3;

  // Warranty points
  const warrantyPoints = [
    "• Garantie à vie sur les composants du caisson pour intérieurs construits en tôle Aluzinc.",
    "Scrigno garantit que la tôle des contre-châssis pour intérieurs n'est pas sujette à la «corrosion traversante», et ce, pour toute la durée de vie du produit.",
    "• Garantie de 20 ans contre les ruptures du Kit du chariot.",
    "• Garantie de 20 ans relative à l'intégrité de la traverse de guidage en aluminium anodisé."
  ];

  warrantyPoints.forEach((point) => {
    const lines = pdf.splitTextToSize(point, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      pdf.text(line, margin, currentY);
      currentY += 4.5;
    });
    currentY += 2;
  });

  currentY += 5;

  // Garantie d'intégrité section
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Garantie d'intégrité", margin, currentY);
  currentY += 7;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const integrityPara1 = pdf.splitTextToSize(
    "Scrigno garantit que les contre-châssis pour portes, fenêtres, volets et grilles coulissantes sont réalisés conformément aux standards qualitatifs imposés dans le cadre du système de qualité certifié selon les normes UNI EN ISO 9001:2015.",
    pageWidth - 2 * margin
  );
  integrityPara1.forEach((line: string) => {
    pdf.text(line, margin, currentY);
    currentY += 4.5;
  });
  
  currentY += 3;

  const integrityPara2 = pdf.splitTextToSize(
    "Dans le cas où l'acheteur, d'après un premier examen effectué après l'ouverture de l'emballage du contre-châssis, remarque l'existence d'un vice et que Scrigno vérifie l'existence de ce même vice, il aura droit au remplacement gratuit du contre-châssis aux conditions suivantes :",
    pageWidth - 2 * margin
  );
  integrityPara2.forEach((line: string) => {
    pdf.text(line, margin, currentY);
    currentY += 4.5;
  });
  
  currentY += 3;

  // Bullet points for integrity
  const integrityBullets = [
    "• l'acheteur doit dénoncer l'existence de vices au Revendeur Autorisé Scrigno, auprès duquel il a effectué son achat, dans les vingt jours successifs à la livraison.",
    "Le revendeur autorisé Scrigno, après vérification de l'existence du vice, de l'exclusion de responsabilités de la part de tiers et sur présentation de la copie du certificat de garantie de la part de l'acheteur sous peine de déchéance de celle-ci, fera le nécessaire pour remplacer immédiatement le contre-châssis ou garantira le remplacement du produit dans les délais de livraison indiqués sur le catalogue de produits Scrigno."
  ];

  integrityBullets.forEach((bullet) => {
    const lines = pdf.splitTextToSize(bullet, pageWidth - 2 * margin);
    lines.forEach((line: string) => {
      pdf.text(line, margin, currentY);
      currentY += 4.5;
    });
    currentY += 2;
  });

  // ==================== PAGE 2 - CLIENT INFO ====================
  pdf.addPage();
  currentY = 40;

  // Title
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Certificat d'authenticité Scrigno", pageWidth / 2, currentY, { align: "center" });
  
  currentY += 20;

  // Intro text
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const introText = pdf.splitTextToSize(
    `Cher acheteur, ${company.name} vous garantis personnellement l'originalité du contre-châssis Scrigno que vous avez acheté, vous remerciant pour avoir choisi nos produits et vous souhaitant d'en obtenir entière satisfaction.`,
    pageWidth - 2 * margin
  );
  introText.forEach((line: string) => {
    pdf.text(line, margin, currentY);
    currentY += 6;
  });
  
  currentY += 10;

  // Client name line
  const clientName = client?.name || ".................................";
  const clientLine = `Ce certificat est destiné à Mr/Mme ${clientName}`;
  pdf.text(clientLine, margin, currentY);
  
  currentY += 8;

  // Product info line
  const productTypes = doc.lines
    .map(line => products.find(p => p.id === line.productId)?.name)
    .filter((name, index, self) => name && self.indexOf(name) === index)
    .join(", ") || "............";
  
  const productCount = doc.lines.reduce((sum, line) => sum + line.qty, 0);
  
  const productLine = `pour l'achat de contre-châssis de marque SCRIGNO, de type ${productTypes} et d'une quantité de ${productCount} unité(s).`;
  const productLines = pdf.splitTextToSize(productLine, pageWidth - 2 * margin);
  productLines.forEach((line: string) => {
    pdf.text(line, margin, currentY);
    currentY += 6;
  });
  
  currentY += 15;

  // Date and location
  const location = company.address || "..................";
  const date = new Date(doc.date).toLocaleDateString('fr-FR');
  pdf.text(`Fait à : ${location}`, margin, currentY);
  pdf.text(`Le ${date}`, pageWidth - margin - 40, currentY);

  pdf.save(`Garantie_${doc.code}.pdf`);
}
