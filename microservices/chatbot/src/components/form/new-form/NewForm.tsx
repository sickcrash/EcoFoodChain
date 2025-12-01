// import { zodResolver } from '@hookform/resolvers/zod';
// import {
//   ForwardedRef,
//   forwardRef,
//   Suspense,
//   useCallback,
//   useImperativeHandle,
//   useRef,
// } from 'react';
// import { useForm } from 'react-hook-form';
// import { z } from 'zod';

// import { NewFormProps } from './types';

// import {
//   Button,
//   Form,
//   FormControl,
//   FormDescription,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
//   InputProps,
// } from '@/components/ui';
// import { ComponentTypes, FormRef, InputValues } from '@components/index';
// import { FormItemModel, FormModel } from '@models/index';

// function FormInner(
//   {
//     formBlocks,
//     submitButtonLabel,
//     isLoading,
//     className,
//     onSubmitCallback,
//     onChangeCallback,
//   }: NewFormProps,
//   ref: ForwardedRef<FormRef>
// ) {
//   const refs = useRef<InputValues>({});
//   const timer = useRef<NodeJS.Timeout>();

//   useImperativeHandle(ref, () => ({
//     inputValues: refs.current,
//   }));

//   const generateFormSchema = (formBlocks: FormModel[]) => {

//     const schema: Record<string, any> = {};

//     formBlocks.forEach(blocks => {
//       blocks.items.forEach(item => {
//         switch (item.type) {
//           default:
//             if (item.required) {
//               schema[item.name] = z.string().min(1, {
//                 message: `${item.name} is required.`,
//               });
//             } else {
//               schema[item.name] = z.string();
//             }

//             break;
//         }
//       });
//     });

//     return z.object(schema);
//   };

//   const formSchema = generateFormSchema(formBlocks);

//   const form = useForm<z.infer<typeof formSchema>>({
//     resolver: zodResolver(formSchema),
//     defaultValues: formBlocks.map(block => {
//       const values: Record<string, FormItemModel['value']> = {};

//       block.items.forEach(item => {
//         values[item.name] = item.value ? item.value : '';
//       });

//       return values;
//     }),
//   });

//   const onChange = useCallback(() => {
//     clearTimeout(timer.current);

//     timer.current = setTimeout(() => {
//       onChangeCallback && onChangeCallback();
//     }, 500);
//   }, [onChangeCallback]);

//   const componentToRender = useCallback(
//     (item: FormItemModel, field: Record<string, unknown>) => {
//       switch (item.type) {
//         default: {
//           const props: InputProps = {
//             type: item.type,
//             autoComplete: item.autoComplete,
//             placeholder: item.placeholder,
//             required: item.required,
//             pattern: item.pattern,
//             ...field,
//             onChange: e => {
//               const onChangeField = field.onChange as (
//                 e: React.ChangeEvent<HTMLInputElement>
//               ) => void;
//               onChangeField(e);
//               onChange();
//             },
//           };
//           return newPickComponent({
//             name: ComponentTypes.NewTextInput,
//             props,
//           });
//         }
//       }
//     },
//     [onChange]
//   );

//   const onSubmit = useCallback(
//     (values: z.infer<typeof formSchema>) => {
//       onSubmitCallback && onSubmitCallback(values);
//     },
//     [onSubmitCallback]
//   );

//   return (
//     <Form {...form}>
//       <form
//         onSubmit={form.handleSubmit(onSubmit)}
//         className={className ? className : ''}
//       >
//         {formBlocks.map((blocks, index) => (
//           <section
//             key={index}
//             className={`
//                  px-2
//                  grid gap-4
//                  ${blocks.items.length === 1 && 'grid-cols-1'}
//                  ${blocks.items.length === 2 && 'grid-cols-2'}
//                  ${blocks.items.length > 2 && 'grid-cols-3'}
//                 `}
//           >
//             {blocks.items.map((item, idx) => (
//               <FormField
//                 key={idx}
//                 control={form.control}
//                 name={item.name}
//                 render={({ field }) => (
//                   <FormItem className="w-full">
//                     {item.label && <FormLabel>{item.label}</FormLabel>}
//                     <FormControl>
//                       <Suspense>{componentToRender(item, field)}</Suspense>
//                     </FormControl>
//                     {item.description && (
//                       <FormDescription>{item.description}</FormDescription>
//                     )}
//                     <FormMessage />
//                   </FormItem>
//                 )}
//               />
//             ))}
//           </section>
//         ))}
//         <Button onClick={e => e.currentTarget.blur()}>
//           <span className={isLoading ? 'loading loading-spinner' : ''} />
//           {submitButtonLabel}
//         </Button>
//       </form>
//     </Form>
//   );
// }

// export const NewForm = forwardRef(FormInner);
