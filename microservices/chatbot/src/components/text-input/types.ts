import { FormItemModel } from '@models/login-model';

export interface TextInputProps {
  name: string;
  type: FormItemModel['type'];
  placeholder: string;
  autoComplete?: FormItemModel['autoComplete'];
  submitted?: boolean;
  required?: boolean;
  pattern?: string;
  className?: string;
  value?: React.InputHTMLAttributes<HTMLInputElement>['value'];
  label?: string;
  bottomLabel?: string;
  onChangeCallback?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
