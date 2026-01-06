import { NavLink, useLocation } from "react-router-dom";
import {
  FileText,
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Warehouse,
  Settings,
  ShoppingBag,
  TrendingUp,
  Calculator,
  Database,
  Award,
  AlertTriangle,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getCurrentUser } from "@/store/localdb";

const sections = [
  {
    label: "Tableau de bord",
    items: [
      { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
      { title: "Rapports", url: "/reports", icon: TrendingUp },
      { title: "Comptabilité", url: "/comptabilite", icon: Calculator },
    ],
  },
  {
    label: "Ventes",
    items: [
      { title: "Devis (DV)", url: "/ventes/devis", icon: FileText },
      { title: "Bon de commande (BC)", url: "/ventes/bc", icon: ShoppingCart },
      { title: "Bon de livraison (BL)", url: "/ventes/bl", icon: Package },
      { title: "Bon de retour (BR)", url: "/ventes/br", icon: Package },
      { title: "Factures (FA)", url: "/ventes/factures", icon: FileText },
    ],
  },
  {
    label: "Interne (Non déclaré)",
    items: [
      { title: "Devis (DV)", url: "/interne/devis", icon: AlertTriangle },
      { title: "Bon de commande (BC)", url: "/interne/bc", icon: AlertTriangle },
      { title: "Bon de livraison (BL)", url: "/interne/bl", icon: AlertTriangle },
      { title: "Bon de retour (BR)", url: "/interne/br", icon: AlertTriangle },
      { title: "Factures (FA)", url: "/interne/factures", icon: AlertTriangle },
    ],
  },
  {
    label: "Achats",
    items: [
      { title: "Devis (DV)", url: "/achats/devis", icon: FileText },
      { title: "Bon de commande (BC)", url: "/achats/bc", icon: ShoppingCart },
      { title: "Bon de réception (BL)", url: "/achats/bl", icon: Package },
      { title: "Factures (FA)", url: "/achats/factures", icon: FileText },
    ],
  },
  {
    label: "Stocks",
    items: [
      { title: "Catalogue", url: "/products", icon: ShoppingBag },
      { title: "Gestion des stocks", url: "/stock", icon: Warehouse, adminOnly: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Clients", url: "/clients", icon: Users },
      { title: "Certificats", url: "/certificates", icon: Award },
      { title: "Sauvegarde", url: "/backup", icon: Database },
      { title: "Paramètres", url: "/admin", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const user = getCurrentUser();

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarContent>
        {sections
          .map((section) => {
            // Filter out admin-only items for non-admin users
            const filteredItems = section.items.filter((item) => {
              if ((item as any).adminOnly && user?.role !== "admin") {
                return false;
              }
              return true;
            });
            return { ...section, items: filteredItems };
          })
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={active}>
                          <NavLink to={item.url}>
                            <item.icon className="mr-2 h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
      </SidebarContent>
    </Sidebar>
  );
}
