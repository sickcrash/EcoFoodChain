export interface DeviceEntity {
    description: string;
    device_token: string;
    type: string;
    lastCommDate: string;
    tags: string[];
    com_status: 'INIT' | 'ACTIVE' | 'COM_ERROR';
    signals: string[];
    location:{
      coordinates: number[];
    };
    address: {
      street: string;
      postal_code: string;
      city: string;
      province: string;
      state: string;
    };
    full_address: string;
    notes: string;
    email: string;
    time_offset: {
      ntp_enable: boolean;
      device: number;
      view: string;
    };
    csv_options: {
      date_format: string;
      decimals_separator: '.' | ',';
      csv_signals: string[];
    };
  }

export type DeviceModel = DeviceEntity;
