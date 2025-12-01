import { useCallback, useMemo } from 'react';

import { useErrorHandler } from './useErrorHandler';

import { DeviceEntity, DeviceModel, UserModel } from '@models/index';

export const useDevicesQuery = (): {
  getDevice: (
   land: string
  ) => Promise<{ data?: DeviceModel; error?: Error }>;
} => {
  const { handleError } = useErrorHandler();

  const user: UserModel | null = useMemo(() => { //
    if (!localStorage.getItem('user')) {
      return; // Se non c'è un utente, ritorna null
    }
    return JSON.parse(localStorage.getItem('user') || ''); // Altrimenti ritorna l'utente
  }, []);

  const getDevice = useCallback(
    async (land: string) => {
      try {
        if (!user) {
          throw new Error('User not found');
        }

        const response = await fetch('https://api.databoom.com/v1/devices/all', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.jwt}`,
          },
        });

        if (!response.ok) {
          switch (response.status) {
            case 401:
              throw new Error('Unauthorized');
            case 403:
              throw new Error('Forbidden');
            case 404:
              throw new Error('Not found');
            default:
            {
              const { message } = await response.json();
              throw new Error(message);
            }
          }
        }

        const res: DeviceEntity[] = await response.json();

        const findDevice = res.find(signal => signal.description.toLowerCase().includes(land));

        return { data: findDevice as DeviceModel };
      } catch (err) {
        const error = err as Error;
        handleError(error);
        return { error };
      }
    },
    [handleError, user]
  );

  return { getDevice };
};
