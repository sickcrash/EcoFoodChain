export interface OptionModel {
  value: string;
  label: string;
}

export interface SelectInputProps {
  name: string;
  type: string;
  label?: string;
  bottomLabel?: string;
  className?: string;
  submitted?: boolean;
  required?: boolean;
  placeholder?: string;
  options?: string[] | OptionModel[];
}
