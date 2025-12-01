import { ChevronDown, Home } from 'lucide-react';
import { Fragment, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui';
import { UserModel } from '@/models';

export const AppSidebar = () => {
  const user: UserModel | null = useMemo(() => {
    if (!localStorage.getItem('user')) {
      return; // Se non c'è un utente, ritorna null
    }
    return JSON.parse(localStorage.getItem('user') || ''); // Altrimenti ritorna l'utente
  }, []);

  const setIcon = useCallback((icon: string): JSX.Element => {
    switch (icon) {
      case 'Home':
        return <Home className="h-4 w-4" />;
      default:
        return <Home className="h-4 w-4" />;
    }
  }, []);

  const createHandle = useCallback((item: string) => {
    return item.trim().replace(/ /g, '-').toLowerCase(); // Sostituisce gli spazi con i trattini e mette tutto in minuscolo
  }, []);

  return (
    <Sidebar>
      <SidebarHeader>
        <h1 className="text-2xl font-bold text-primary">EcoFoodChain</h1>
      </SidebarHeader>
      <Separator className="my-3" />
      <SidebarContent>
        {user?.menu.map((item, idx) => (
          <Fragment key={idx}>
            {item.collapsible && (
              <Collapsible
                defaultOpen={item.defaultOpen}
                className="group/collapsible"
              >
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger>
                      <div className="pl-2">{item.label}</div>
                      {/* Icona per aprire e chiudere il menu */}
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {item.subItems
                          && item.subItems.map((item, idx) => (
                            <Fragment key={idx}>
                              {item.childrens.length > 0 && (
                                <Collapsible
                                  className={'group/subitem'}>
                                  <SidebarGroup>
                                    <SidebarGroupLabel asChild>
                                      <CollapsibleTrigger>
                                        <div className="pl-2 text-left">{item.label}</div>
                                        {/* Icona per aprire e chiudere il menu */}
                                        <ChevronDown className={'ml-auto transition-transform group-data-[state=open]/subitem:rotate-180'} />
                                      </CollapsibleTrigger>
                                    </SidebarGroupLabel>
                                    <CollapsibleContent>
                                      <SidebarGroupContent>
                                        <SidebarMenu className='flex flex-col gap-4'>
                                          {item.childrens
                                            && item.childrens.map((item, idx) => (
                                              <SidebarMenuItem key={idx} className="px-2">
                                                <Link to={`/${createHandle(item.category)}/${item.description}`}>
                                                  <SidebarMenuButton className='text-xs font-medium'>
                                                    {item.description}
                                                  </SidebarMenuButton>
                                                </Link>
                                              </SidebarMenuItem>
                                            ))}
                                        </SidebarMenu>
                                      </SidebarGroupContent>
                                    </CollapsibleContent>
                                  </SidebarGroup>
                                </Collapsible>
                              )}
                            </Fragment>
                          ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )}
            {!item.collapsible && (
              <SidebarMenu>
                <SidebarMenuItem className="px-2">
                  <Link to={`/${item.link}`}>
                    <SidebarMenuButton>
                      {item.icon && setIcon(item.icon)}
                      {item.label}
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
          </Fragment>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};
