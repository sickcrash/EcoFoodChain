import { useCallback, useContext } from 'react';

import { ToastTypes } from '@/components';
import { AuthContext, useToast } from '@/contexts';

export const useErrorHandler = (): {
    handleError: (err: Error) => void;
} => {
  const { showToast } = useToast();
  const { onSetUser } = useContext(AuthContext);

  const handleError = useCallback(
    (err: Error) => {
      switch (err.message) {
        case 'Unauthorized':
        case 'Forbidden':
          onSetUser(null);
          break;
        default:
          showToast({
            type: ToastTypes.ERROR,
            message: err.message,
          });
          break;
      }

      console.error('General error:', err);
    },
    [onSetUser, showToast]
  );

  return {
    handleError,
  };
};