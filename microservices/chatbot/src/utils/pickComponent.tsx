import {
  ComponentLoader,
  ComponentTypes,
  InputValues,
  SelectInputProps,
  TextInputProps,
} from '@components/index';

interface PickComponentArgs {
  name: ComponentTypes;
  props: TextInputProps | SelectInputProps;
  refs?: React.MutableRefObject<InputValues>;
}

export const pickComponent = ({ name, props, refs }: PickComponentArgs) => {
  switch (name) {
    case ComponentTypes.TextInput: {
      const TextInput = ComponentLoader[ComponentTypes.TextInput];
      return (
        <TextInput
          ref={element => {
            const item = props as TextInputProps;
            if (refs) {
              refs.current[item.name] = element as
                | HTMLInputElement
                | HTMLTextAreaElement;
            }
          }}
          {...(props as TextInputProps)}
        />
      );
    }
    case ComponentTypes.SelectInput: {
      const SelectInput = ComponentLoader[ComponentTypes.SelectInput];
      return (
        <SelectInput
          ref={element => {
            const item = props as TextInputProps;
            if (refs) {
              refs.current[item.name] = element as HTMLSelectElement;
            }
          }}
          {...(props as SelectInputProps)}
        />
      );
    }
    default:
      throw new Error('Component not found');
  }
};
