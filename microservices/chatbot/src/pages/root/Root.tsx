import { Outlet, useLocation } from 'react-router-dom';

import { SidebarProvider, SidebarTrigger } from '@/components/ui';
import { RouteName } from '@/router';
import { AppSidebar, ThemeToggle, User, ChatbotIcon } from '@components/index';
import { AuthProvider, ThemeProvider, ToastProvider } from '@contexts/index';

export const Root = () => {
  const location = useLocation();
  const isCulturePath = /^\/[^/]+\/[^/]+$/.test(location.pathname);

  

  return (
    <ThemeProvider defaultTheme="system" storageKey="efc-ui-theme">
      <AuthProvider>
        <ToastProvider>
          {location.pathname === RouteName.Login && <Outlet />}
          {location.pathname !== RouteName.Login && (
            <SidebarProvider>
              <AppSidebar />
              <main>
                <section className="flex justify-between">
                  <SidebarTrigger />
                  <div className="flex gap-4">
                    <User />
                    <ThemeToggle />
                  </div>
                </section>
                <section className="h-[calc(100dvh-3rem)] overflow-y-scroll overflow-x-hidden">
                  <Outlet />
                </section>
                {isCulturePath && ( // Mostra ChatbotIcon solo se siamo in una pagina delle culture
                  <section className="flex justify-end items-end">
                    <ChatbotIcon />
                  </section>
                )}
              </main>
            </SidebarProvider>
          )}
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};
