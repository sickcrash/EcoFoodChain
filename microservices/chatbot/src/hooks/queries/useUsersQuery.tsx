import { useCallback } from 'react';

import { useErrorHandler } from './useErrorHandler';

import { LoginRequestBody, UserEntity, UserModel } from '@models/index';

export const useUsersQuery = (): {
  login: ({
    username,
    password,
  }: {
    username: string;
    password: string;
  }) => Promise<{ //
    data?: UserModel;
    error?: Error;
  }>;
} => {
  const { handleError } = useErrorHandler();

  const login = useCallback(
    async ({ username, password }: { username: string; password: string }) => {
      const body: LoginRequestBody = {
        username,
        password,
      }; // Crea un oggetto body con username e password
      try {
        const response = await fetch('https://api.databoom.com/v1/auth/signin', {
          method: 'POST', // Chiama l'endpoint login con il metodo POST
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const { message } = await response.json();
          throw new Error(message);
        }

        const user: UserEntity = await response.json();

        return { data: user as UserModel };
      } catch (err) {
        const error = err as Error;
        handleError(error); // Se c'è un errore, chiama la funzione handleError
        return { error };
      }
    },
    [handleError]
  );

  return {
    login,
  };
};
