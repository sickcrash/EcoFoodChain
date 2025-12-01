import { FormRef } from '@components/form';
import { FormModel } from '@models/index';

export interface DynamicFormProps {
  id: string;
  isLoading: boolean;
  formBlocks: FormModel[];
  formRefs: React.MutableRefObject<Record<string, FormRef>>;
  setFormList: React.Dispatch<
    React.SetStateAction<
      {
        id: string;
        key: string;
      }[]
    >
  >;
  submitCallback: () => void;
}
