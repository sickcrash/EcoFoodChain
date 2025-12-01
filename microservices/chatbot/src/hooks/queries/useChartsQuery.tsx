import { useCallback, useMemo } from 'react';

import { useErrorHandler } from './useErrorHandler';

import { ChartsEntity, ChartsModel, UserModel } from '@models/index';

interface getChartsArgs {
  startDate: string;
  endDate: string;
  granularity: 'a' | '*'| 'h' | 'd' | 'm' ;
  signals: string[];
}

export const useChartsQuery = (): {
  getCharts: (
   {
     startDate,
     endDate,
     granularity,
     signals,
   }: getChartsArgs
  ) => Promise<{ data?: ChartsModel; error?: Error }>;
} => {
  const { handleError } = useErrorHandler();

  const user: UserModel | null = useMemo(() => { //
    if (!localStorage.getItem('user')) {
      return; // Se non c'è un utente, ritorna null
    }
    return JSON.parse(localStorage.getItem('user') || ''); // Altrimenti ritorna l'utente
  }, []);

  const getCharts = useCallback(
    async (
      {
        startDate,
        endDate,
        granularity,
        signals,
      }: getChartsArgs
    ) => {
      try {
        if (!user) {
          throw new Error('User not found');
        }

        const response = await fetch('https://api.databoom.com/v1/chart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.jwt}`,
          },
          body: JSON.stringify({
            startDate: startDate,
            endDate: endDate,
            granularity,
            signals,
          }),
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

        const res: ChartsEntity = await response.json();

        return { data: res as ChartsModel };
      } catch (err) {
        const error = err as Error;
        handleError(error);
        return { error };
      }
    },
    [handleError, user]
  );

  return { getCharts };
};
