import { Input, InputProps } from '@/components/ui';

const TextInput = ({
  textInputProps,
}: {
  textInputProps: InputProps;
}): JSX.Element => {
  const { value = '', ...restProps } = textInputProps;

  return <Input value={value} {...restProps} />;
};

export default TextInput;
