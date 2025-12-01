import { useCallback } from 'react';

import { useErrorHandler } from './useErrorHandler';

import { UserModel } from '@/models';
import { DashboardModel } from '@/models/dashboards-model';

export const useDashboardsQuery = (): {
  getDashboards: (jwt: UserModel['jwt']) => Promise<{ // Ritorna una promessa con un oggetto che contiene i dati dell'utente e un eventuale errore
    data?: DashboardModel[];
    error?: Error;
  }>;
} => {
  const { handleError } = useErrorHandler();

  const getDashboards = useCallback(
    async (jwt: UserModel['jwt']) => {
      try {
        const response = await fetch('https://api.databoom.com/v1/dashboards?sort=description', {
          method: 'GET', // Chiama l'endpoint login con il metodo POST
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
        });

        if (!response.ok) {
          const { message } = await response.json(); // Se la risposta non è ok, ritorna un errore
          throw new Error(message);
        }

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

        const data: DashboardModel[] = await response.json();

        return { data };
      } catch (err) {
        const error = err as Error;
        handleError(error);
        return { error };
      }
    },
    [handleError]
  );

  return {
    getDashboards,
  };
};
