import {
  FormEvent,
  ForwardedRef,
  forwardRef,
  Fragment,
  Suspense,
  useCallback,
  useImperativeHandle,
  useRef,
} from 'react';

import {
  ComponentTypes,
  FormProps,
  FormRef,
  InputValues,
  SelectInputProps,
  TextInputProps,
} from '@components/index';
import { FormItemModel } from '@models/index';
import { pickComponent } from '@utils/pickComponent';

function FormInner( 
  {
    formBlocks,
    submitButtonLabel,
    isLoading,
    className,
    onSubmitCallback,
    onChangeCallback,
  }: FormProps,
  ref: ForwardedRef<FormRef>
) {
  const refs = useRef<InputValues>({});
  const timer = useRef<NodeJS.Timeout>();

  useImperativeHandle(ref, () => ({
    inputValues: refs.current,
  })); 

  const onSumbit = useCallback( 
    (e: FormEvent) => {
      e.preventDefault(); 
      onSubmitCallback && onSubmitCallback(e); 
    },
    [onSubmitCallback]
  ); 

  const onChange = useCallback(() => {
    clearTimeout(timer.current); 

    timer.current = setTimeout(() => { //Imposta un timer per chiamare onChangeCallback dopo 500ms
      onChangeCallback && onChangeCallback(); 
    }, 500);
  }, [onChangeCallback]); 

  const componentToRender = useCallback(
    (item: FormItemModel) => {
      switch (item.type) {
        case 'select': {
          const props: SelectInputProps = {
            name: item.name,
            type: item.type,
            placeholder: item.placeholder,
            required: item.required,
            options: item.options,
          };

          return pickComponent({
            name: ComponentTypes.SelectInput,
            props,
            refs,
          });
        }
        default: {
          const props: TextInputProps = {
            type: item.type,
            name: item.name,
            autoComplete: item.autoComplete,
            placeholder: item.placeholder,
            required: item.required,
            pattern: item.pattern,
            onChangeCallback: onChange,
          };
          return pickComponent({
            name: ComponentTypes.TextInput,
            props,
            refs,
          });
        }
      }
    },
    [onChange]
  );

  return (
    <form onSubmit={onSumbit} className={className ? className : ''}> 
    {/* Crea un form con l'evento onSubmit */}
      {formBlocks.map((blocks, index) => (
        <section key={index} className="flex flex-col gap-y-5 flex-grow">
          {blocks.items.map((item, index) => (
            <Fragment key={index}>
              <Suspense fallback={<div>Loading...</div>}>
                {componentToRender(item)}
              </Suspense>
            </Fragment>
          ))}
        </section>
      ))}
      <button
        className="btn btn-primary"
        onClick={e => e.currentTarget.blur()}
      >
        <span className={isLoading ? 'loading loading-spinner' : ''} />
        {submitButtonLabel}
      </button>
    </form>
  );
} //Ritorna il form con i campi da compilare e il pulsante di submit

export const Form = forwardRef(FormInner); //Esporta il form
