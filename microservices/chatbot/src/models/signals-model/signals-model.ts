 interface LastValueRule {
  rule: string;
  output: string;
  color: string;
}

 interface VirtualSignal {
  signal: string;
  signal_variable_name: string;
  description: string;
  device_description: string;
  device_id: number;
}

 interface Accumulator {
  active: boolean;
  start_date: string;
  offset: number;
  is_sum: boolean;
}

 interface CommandStatus {
  command: string;
  entered: string;
  status: string;
}

 interface CommandLimit {
  min: number;
  max: number;
}

 interface ChartScale {
  active: boolean;
  min_chart_scale: number;
  max_chart_scale: number;
}

 interface Rescale {
  active: boolean;
  min_value: number;
  max_value: number;
}

 interface ValuesFiltering {
  enable: boolean;
  min: number;
  max: number;
}

 interface CommandLabelRule {
  rule: string;
  output: string;
}

interface Unit {
  type: string;
  prefix: {
    abbreviation: string;
    name: string;
    value: string;
  };
  next_type: string;
}

 interface Pages {
  last: number;
  next: number;
  prev: number;
  first: number;
}

 interface Signal {
  _id: string;
  last_value_rules: LastValueRule[];
  virtual_signal_list: VirtualSignal[];
  notes: string;
  min_granularity: string;
  signal_token?: string;
  decimals: number;
  skip_log: boolean;
  unit: Unit[];
  last_recived_value: string;
  accumulator: Accumulator;
  command_status: CommandStatus;
  command_limit: CommandLimit;
  chart_scale: ChartScale;
  unit_readable: string;
  unit_prefix: string;
  values_filtering: ValuesFiltering;
  device_token: string;
  virtual_formula: string;
  status: string;
  device_description: string;
  last_conn: string;
  virtual_last_evaluated: string;
  device: string;
  showEvents: boolean;
  command_enable: boolean;
  rescale: Rescale;
  command_label_rules: CommandLabelRule[];
  type: string;
  chart_type: 'LINE' | 'DIGITAL' | 'BAR';
  virtual_signal: boolean;
  description: string;
}
export interface SignalEntity {
  data: Signal[];
  pages: Pages;
  total_items: number;
}

export type SignalModel = Signal;
