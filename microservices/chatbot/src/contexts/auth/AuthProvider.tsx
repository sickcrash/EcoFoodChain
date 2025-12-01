import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { UserModel } from '@models/index';
import { Loading } from '@pages/index';

const TIMEOUT_DURATION = 1000 * 60 * 30; // tempo di inattività prima del logout di 30 minuti

interface AuthContextProps {
  children: React.ReactNode; // Quando richiamo AuthProvider, mi aspetto un figlio (contenuto) all'interno
}

export const AuthContext = createContext<{
  user: UserModel | null;
  onSetUser:(user: UserModel | null) => void;
    }>({
      user: null,
      onSetUser: () => {},
    });

export const AuthProvider = ({ children }: AuthContextProps): JSX.Element => {
  const [user, setUser] = useState<UserModel | null>(null); // Stato dell'utente
  const [isLoading, setIsLoading] = useState(true); // Stato di caricamento

  const logoutTimer = useRef<NodeJS.Timeout>();

  const persistUser = useMemo(() => {
    if (window.localStorage.getItem('user')) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return JSON.parse(window.localStorage.getItem('user')!) as UserModel;
    } // Se c'è un utente salvato nel localStorage, ritorna l'utente
    return null; // Altrimenti ritorna null
  }, []);

  const navigate = useNavigate(); // Hook per la navigazione tra le pagine

  const onSetUser = useCallback(
    (user: UserModel | null) => {
      if (!user) {
        navigate('/login');
        window.localStorage.removeItem('user');
      }

      setUser(user);
      window.localStorage.setItem('user', JSON.stringify(user));
    },
    [navigate]
  );

  const checkUser = useCallback(() => {
    if (!persistUser) {
      navigate('/login');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  }, [navigate, persistUser]);

  const startLogoutTimer = useCallback(() => {
    logoutTimer.current = setTimeout(() => {
      setUser(null);
    }, TIMEOUT_DURATION);
  }, []);

  const resetLogoutTimer = useCallback(() => {
    clearTimeout(logoutTimer.current);
    startLogoutTimer();
  }, [startLogoutTimer]);

  useEffect(() => {
    checkUser();
    document.addEventListener('click', resetLogoutTimer);

    return () => {
      checkUser();
      document.removeEventListener('click', resetLogoutTimer);
    };
  }, [checkUser, resetLogoutTimer]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        onSetUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
