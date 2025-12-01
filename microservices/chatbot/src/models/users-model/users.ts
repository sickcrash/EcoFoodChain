/* eslint-disable @typescript-eslint/no-explicit-any */
import { MenuModel } from '../menu-model';

export interface OAuthToken {
  activated: string;
  scope: {
    meta: any[];
    _id: string;
  }[];
  _id: string;
  token: string;
  description: string;
}

export interface OAuth {
  client_id: string;
  secret_key: string;
  active_tokens: OAuthToken[];
  device_tokens: any[];
  deleted_tokens: any[];
}

export interface TimeOffset {
  device: string;
  view: string;
  type: string;
}

export interface Quote {
  shares: {
    active: boolean;
    max: number;
    current: number;
  };
  teams: {
    active: boolean;
    max: number;
    current: number;
  };
  rules: {
    max: number;
    current: number;
  };
  widgets: {
    max: number;
    current: number;
  };
  dashboards: {
    max: number;
    current: number;
  };
  devices: {
    max: number;
    current: number;
  };
  signals: {
    max: number;
    current: number;
  };
  virtual_signals: {
    max: number;
    current: number;
  };
  charts: {
    max: number;
  };
  level: string;
}

export interface Team {
  _id: string;
  id: string;
  role: string;
}

export interface Settings {
  menu: string[];
  submenu: string[];
  hideSupportLinks: boolean;
  hideZendeskWebWidget: boolean;
  hidePersonalInfo: boolean;
  dontEditPersonalInfo: boolean;
  onlyPersonalInfoInProfile: boolean;
  hidePoweredBy: boolean;
  bodyshakeMaster: boolean;
  hidePermissions: boolean;
  hideDevicePlugin: boolean;
  actualizeTemplateFromCsv: boolean;
  updateTemplateManyDevices: boolean;
  hideTemplateButtonsInDevice: boolean;
  hideCloneButtonInDevice: boolean;
  hideCreatorAndLastEditor: boolean;
  onlyChartInSignalDetail: boolean;
  secondsGranEnabled: boolean;
  log_sec: boolean;
  isRealTimeEnabled: boolean;
  realTimeWidgets: any[];
  canEditUserSettings: boolean;
  exportDeviceSignalsCsv: boolean;
  export: {
    simple: boolean;
  };
  dashboard: {
    signalDetailInView: boolean;
    editPositionInView: boolean;
    titleInView: boolean;
    shareInView: boolean;
    exportInView: boolean;
    ordersInView: boolean;
    manualEditInView: boolean;
    hideShares: boolean;
    hideCreatorInShare: boolean;
    showManageDashHierarchy: boolean;
    showShareNoClone: boolean;
    showCopyReplaceDash: boolean;
    allowShareUnderIndex: string;
    shareModalText: string;
    autoUnshareDevicesAndSignals: boolean;
    datesDisabled: boolean;
    hideGeneralDates: boolean;
    fullHours: boolean;
  };
}

export interface UserEntity {
  oauth: OAuth;
  time_offset: TimeOffset;
  telegram: {
    username: string[];
    oauth_token: string;
  };
  quote: Quote;
  active: boolean;
  blocked: boolean;
  firstName: string;
  lastName: string;
  email: string;
  profileImageURL: string;
  roles: string[];
  pagination_per_page: number;
  language: string;
  currency: string;
  decimal_digits: number;
  groupSharedDash: boolean;
  sharedDashOrder: any[];
  allDashOrder: any[];
  canCreateUsers: boolean;
  subUserRoles: any[];
  redisPubSub: any[];
  bookmark: any[];
  hideItem: any[];
  _id: string;
  username: string;
  privacy_accepted: boolean;
  created: string;
  usages: any[];
  device_subscription: any[];
  teams: Team[];
  settings: Settings;
  provider: string;
  displayName: string;
  orders_token: string;
  settingsKey: string;
  namespace: string;
  clean_email: string;
  billing_mail: string;
  datetime_format: string;
  number_format: {
    thousands: string;
    decimals: string;
  };
  user_api_key: string;
  revision: number;
  __v: number;
  last_login_date: string;
  favDash: string;
  updated: string;
  jwt: string;
  imAdmin: boolean;
}

export interface UserModel {
  oauth: OAuth;
  time_offset: TimeOffset;
  telegram: {
    username: string[];
    oauth_token: string;
  };
  quote: Quote;
  active: boolean;
  blocked: boolean;
  firstName: string;
  lastName: string;
  email: string;
  profileImageURL: string;
  roles: string[];
  pagination_per_page: number;
  language: string;
  currency: string;
  decimal_digits: number;
  groupSharedDash: boolean;
  sharedDashOrder: any[];
  allDashOrder: any[];
  canCreateUsers: boolean;
  subUserRoles: any[];
  redisPubSub: any[];
  bookmark: any[];
  hideItem: any[];
  _id: string;
  username: string;
  privacy_accepted: boolean;
  created: string;
  usages: any[];
  device_subscription: any[];
  teams: Team[];
  settings: Settings;
  provider: string;
  displayName: string;
  orders_token: string;
  settingsKey: string;
  namespace: string;
  clean_email: string;
  billing_mail: string;
  datetime_format: string;
  number_format: {
    thousands: string;
    decimals: string;
  };
  user_api_key: string;
  revision: number;
  __v: number;
  last_login_date: string;
  favDash: string;
  updated: string;
  jwt: string;
  imAdmin: boolean;
  menu: MenuModel[];
}

export interface LoginRequestBody {
  username: string;
  password: string;
}
