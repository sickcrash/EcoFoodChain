import {
  ForwardedRef,
  forwardRef,
  Fragment,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { OptionModel, SelectInputProps } from './types';

function SelectInner(
  {
    label,
    bottomLabel,
    className,
    submitted = false,
    required = false,
    name,
    placeholder,
    options,
  }: SelectInputProps,
  ref: ForwardedRef<HTMLSelectElement>
) {
  const inputRef = useRef<HTMLSelectElement>(null);

  useImperativeHandle(ref, () => inputRef.current as HTMLSelectElement, []);

  const optionsIsString = options?.every(
    option => typeof option === 'string'
  );

  const componentToRender = useMemo(() => {
    if (optionsIsString) {
      return (options as string[])?.map((option, index) => (
        <Fragment key={index}>
          <option key={index} value={option}>
            {option}
          </option>
        </Fragment>
      ));
    }

    return (options as OptionModel[])?.map((option, index) => (
      <Fragment key={index}>
        <option key={index} value={option.value}>
          {option.label}
        </option>
      </Fragment>
    ));
  }, [options, optionsIsString]);

  return (
    <label className={`form-control w-full ${className}`}>
      {label && (
        <div className="label">
          <span className="label-text">{label}</span>
        </div>
      )}
      <select
        ref={inputRef}
        name={name}
        className={`select select-bordered dark:bg-gray-600 w-full ${submitted && 'invalid:input-error'}`}
        required={required}
        defaultValue={placeholder}
      >
        <option disabled>{placeholder}</option>
        {componentToRender}
      </select>
      {bottomLabel && (
        <div className="label">
          <span className="label-text-alt">{bottomLabel}</span>
        </div>
      )}
    </label>
  );
}

const SelectInput = forwardRef(SelectInner);

export default SelectInput;
