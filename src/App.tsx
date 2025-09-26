import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import DocumentsList from "./pages/vente/DocumentsList";
import DocumentForm from "./pages/vente/DocumentForm";
import DocumentView from "./pages/vente/DocumentView";
import AchatDocumentsList from "./pages/achat/DocumentsList";
import AchatDocumentForm from "./pages/achat/DocumentForm";
import AdminPage from "./pages/admin/AdminPage";
import StockManager from "./pages/StockManager";
import ProductsCatalog from "./pages/ProductsCatalog";
import runSeed from "./seed";

const queryClient = new QueryClient();

runSeed();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<Dashboard />} />

                  {/* Ventes */}
                  <Route path="/ventes/devis" element={<DocumentsList mode="vente" type="DV" />} />
                  <Route path="/ventes/devis/nouveau" element={<DocumentForm mode="vente" />} />
                  <Route path="/ventes/bc" element={<DocumentsList mode="vente" type="BC" />} />
                  <Route path="/ventes/bl" element={<DocumentsList mode="vente" type="BL" />} />
                  <Route path="/ventes/br" element={<DocumentsList mode="vente" type="BR" />} />
                  <Route path="/ventes/factures" element={<DocumentsList mode="vente" type="FA" />} />

                  {/* Achats */}
                  <Route path="/achats/devis" element={<AchatDocumentsList type="DV" />} />
                  <Route path="/achats/devis/nouveau" element={<AchatDocumentForm />} />
                  <Route path="/achats/bc" element={<AchatDocumentsList type="BC" />} />
                  <Route path="/achats/bl" element={<AchatDocumentsList type="BL" />} />
                  <Route path="/achats/factures" element={<AchatDocumentsList type="FA" />} />

                  {/* Stock management & Products */}
                  <Route path="/stock" element={<StockManager />} />
                  <Route path="/products" element={<ProductsCatalog />} />

                  {/* Document detail (commun) */}
                  <Route path="/document/:id" element={<DocumentView />} />

                  {/* Admin */}
                  <Route path="/admin" element={<AdminPage />} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            }
          />
          {/* Fallbacks */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
