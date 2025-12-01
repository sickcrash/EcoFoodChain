import { DashboardModel } from '../dashboards-model';

type MenuModelWithoutSubItems = Omit<MenuModel, 'subItems'>;

interface SubItemModel extends MenuModelWithoutSubItems {
  childrens: DashboardModel[];
}

export interface MenuModel {
  label: string;
  icon?: string;
  link?: string;
  roleVisibility?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  subItems?: SubItemModel[];
}
