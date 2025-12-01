import { useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { ToastContext } from './toast-context';

import { Toast, ToastTypes } from '@components/index';

export interface ToastModel {
  type: ToastTypes;
  message: string;
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toast, setToast] = useState<ToastModel | null>(null);

  const portalElement = useMemo(
    () => document.getElementById('portal-root'),
    []
  );

  const showToast = useCallback(({ type, message }: ToastModel) => {
    setToast({
      type,
      message,
    });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
      }}
    >
      {children}
      {portalElement
        && toast
        && createPortal(
          <Toast message={toast.message} type={toast.type} />,
          portalElement
        )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const showToast = useContext(ToastContext);
  if (!showToast) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return showToast;
};
