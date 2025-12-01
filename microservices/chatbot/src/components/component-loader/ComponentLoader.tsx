import { lazy } from 'react';

import { ComponentTypes } from './types';

export const ComponentLoader = {
  [ComponentTypes.TextInput]: lazy(
    () => import('@components/text-input/Textinput')
  ),
  [ComponentTypes.SelectInput]: lazy(
    () => import('@components/select-input/SelectInput')
  ),
  [ComponentTypes.DynamicForm]: lazy(
    () => import('@components/dynamic-form/DynamicForm')
  ),
};
