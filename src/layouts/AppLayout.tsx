import { PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getCompany, getCurrentUser, setCurrentUser } from "@/store/localdb";
import { Button } from "@/components/ui/button";

export default function AppLayout({ children }: PropsWithChildren) {
  const company = getCompany();
  const user = getCurrentUser();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger />
          <div className="flex flex-1 items-center justify-between">
            <div className="font-semibold">{company.name}</div>
            <div className="flex items-center gap-2 text-sm">
              <span>{user ? `${user.username} (${user.role})` : "Non connecté"}</span>
              {user ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCurrentUser(undefined);
                    navigate("/login");
                  }}
                >
                  Déconnexion
                </Button>
              ) : (
                <Button variant="default" size="sm" onClick={() => navigate("/login")}>
                  Connexion
                </Button>
              )}
            </div>
          </div>
        </header>
        <main className="p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
