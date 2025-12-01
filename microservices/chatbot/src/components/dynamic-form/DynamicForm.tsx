import { useCallback } from 'react';

import { DynamicFormProps } from './types';

import { Form, FormRef } from '@components/form';

const DynamicForm = ({
  id,
  isLoading,
  formBlocks,
  formRefs,
  submitCallback,
}: DynamicFormProps): JSX.Element => {
  const addFormRef = useCallback(
    (element: FormRef | null, formId: string) => {
      if (!element) {
        return;
      }

      // Controlla se l'elemento con questo formId è già presente
      const index = formRefs.current[formId];
      if (!index) {
        // Se non è presente, aggiungi l'elemento e l'identificativo al ref
        formRefs.current[formId] = element;
      } else {
        // Se è già presente, aggiorna solo la referenza
        formRefs.current[formId] = element;
      }
    },
    [formRefs]
  );

  return (
    <section key={id} className="flex gap-2 items-center mt-7">
      <Form
        ref={element => addFormRef(element, id)}
        className="flex gap-2 items-center w-full"
        formBlocks={formBlocks}
        isLoading={isLoading}
        alertModal={false}
        onSubmitCallback={submitCallback}
        submitButtonLabel="Search"
      />
    </section>
  );
};

export default DynamicForm;
