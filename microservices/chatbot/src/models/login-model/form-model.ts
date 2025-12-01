import { HTMLInputTypeAttribute, InputHTMLAttributes } from 'react';

type InputType = HTMLInputTypeAttribute | 'text-area' | 'select';

export interface FormItemModel {
  name: string;
  placeholder: string;
  required: boolean;
  type: InputType;
  label?: string;
  description?: string;
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
  pattern?: string;
  value?: string | string[];
  options?: string[];
  showSelectedOptions?: boolean;
}

export interface FormModel {
  items: FormItemModel[];
  name?: string;
}
