import { FormEvent } from 'react';

import { FormModel } from '@models/index';

export interface InputValues {
  [key: string]: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
}

export interface FormRef {
  inputValues: InputValues;
}

export interface FormProps {
  formBlocks: FormModel[];
  submitButtonLabel: string;
  isLoading: boolean;
  alertModal?: boolean;
  className?: string;
  onSubmitCallback?: (e: FormEvent) => void;
  onChangeCallback?: () => void;
}
