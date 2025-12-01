import { FormModel } from '@models/index';

export interface InputValues {
  [key: string]: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

export interface FormRef {
  inputValues: InputValues;
}

export interface NewFormProps {
  formBlocks: FormModel[];
  submitButtonLabel: string;
  isLoading: boolean;
  alertModal?: boolean;
  className?: string;
  onSubmitCallback?: (values: Record<string, unknown>) => void;
  onChangeCallback?: () => void;
}
