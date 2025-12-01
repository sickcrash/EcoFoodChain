import { createContext } from 'react';

import { ToastModel } from './ToastProvider';

type ToastContextType = {
  showToast: ({ type, message }: ToastModel) => void;
};

export const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});
