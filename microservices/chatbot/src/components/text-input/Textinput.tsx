import { forwardRef, useImperativeHandle, useRef } from 'react';

import { TextInputProps } from './types';

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput(
    {
      label,
      placeholder,
      name,
      type,
      required = false,
      submitted = false,
      autoComplete = 'off',
      pattern,
      className,
      value,
      bottomLabel,
      onChangeCallback,
    },
    ref
  ): JSX.Element {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

    // const saveData = () => {
    //   if (inputRef.current && inputRef.current.value !== '') {
    //     console.log('inputRef.current.value', inputRef.current.value);
    //   }
    // };

    return (
      <label className={`form-control w-full ${className}`}>
        {label && (
          <div className="label">
            <span className="label-text">{label}</span>
          </div>
        )}
        <input
          ref={inputRef}
          name={name}
          type={type}
          required={required}
          pattern={pattern}
          placeholder={placeholder}
          // onBlur={saveData}
          defaultValue={value}
          autoComplete={autoComplete}
          onChange={onChangeCallback}
          className={`input input-bordered dark:bg-gray-600 w-full ${submitted && 'invalid:input-error'}`}
        />
        {bottomLabel && (
          <div className="label">
            <span className="label-text-alt">{bottomLabel}</span>
          </div>
        )}
      </label>
    );
  }
);

export default TextInput;
