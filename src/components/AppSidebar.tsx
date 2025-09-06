import { NavLink, useLocation } from "react-router-dom";
import { FileText, ShoppingCart, Truck, RotateCcw, Receipt, Boxes, Warehouse, Users, Gauge, Settings as SettingsIcon, PackagePlus } from "lucide-react";
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
      { title: "Dashboard", url: "/dashboard", icon: Gauge },
    ],
  },
  {
    label: "Ventes",
    items: [
      { title: "Devis (DV)", url: "/ventes/devis", icon: FileText },
      { title: "Bon de commande (BC)", url: "/ventes/bc", icon: ShoppingCart },
      { title: "Bon de livraison (BL)", url: "/ventes/bl", icon: Truck },
      { title: "Bon de retour (BR)", url: "/ventes/br", icon: RotateCcw },
      { title: "Factures (FA)", url: "/ventes/factures", icon: Receipt },
    ],
  },
  {
    label: "Achats",
    items: [
      { title: "Devis (DV)", url: "/achats/devis", icon: FileText },
      { title: "Bon de commande (BC)", url: "/achats/bc", icon: ShoppingCart },
      { title: "Bon de réception (BL)", url: "/achats/bl", icon: PackagePlus },
      { title: "Factures (FA)", url: "/achats/factures", icon: Receipt },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Produits & Dépôts", url: "/admin", icon: Boxes },
      { title: "Clients", url: "/admin#clients", icon: Users },
      { title: "Paramètres", url: "/admin#societe", icon: SettingsIcon },
      { title: "Stocks", url: "/admin#depots", icon: Warehouse },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const currentFull = location.pathname + location.hash;
  const user = getCurrentUser();

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarContent>
        {sections
          .filter(
            (section) =>
              !(
                (section.label === "Tableau de bord" || section.label === "Administration") &&
                user?.role !== "admin"
              )
          )
          .map((section) => (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const active = currentFull === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={active}>
                          <NavLink to={item.url} end>
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
