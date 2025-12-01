import { useContext, useMemo } from 'react';

import { UserModel } from '@/models';
import { ToastTypes } from '@components/toast';
import { AuthContext, useToast } from '@contexts/index';

// User component che mostra l'email dell'utente e un pulsante per il logout e lo utilizza in Root.tsx
export const User = (): JSX.Element => {
  const { onSetUser } = useContext(AuthContext); // Prende l'utente dal contesto
  const { showToast } = useToast(); // Prende il toast dal contesto

  const user: UserModel | null = useMemo(() => { //
    if (!localStorage.getItem('user')) {
      return; // Se non c'è un utente, ritorna null
    }
    return JSON.parse(localStorage.getItem('user') || ''); // Altrimenti ritorna l'utente
  }, []);

  const handleLogout = async () => { // Funzione per il logout
    try {
      onSetUser(null);
      showToast({
        type: ToastTypes.SUCCESS,
        message: 'Logged out successfully',
      });
    } catch (err) {
      const error = err as Error;
      showToast({
        type: ToastTypes.ERROR,
        message: `Error ${error.message}`, // Se c'è un errore, mostra un toast di errore
      });
    }
  };

  return (
    <div className="flex gap-2 items-center">
      <h5>{user?.email}</h5>
      <button className="btn btn-sm btn-primary" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );// Mostra l'email dell'utente e un pulsante per il logout
};
