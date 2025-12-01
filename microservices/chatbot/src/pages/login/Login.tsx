// import logo from '@assets/login/logo.png';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useDashboardsQuery, useUsersQuery } from '@/hooks/queries';
import { Form } from '@components/form/Form';
import { FormRef, ToastTypes, } from '@components/index';
import { AuthContext } from '@contexts/index';
import { useToast } from '@contexts/toast';
import { DashboardModel, FormModel, MenuModel } from '@models/index';
import LoginJson from '@models/login-model/login.json';
import MenuJson from '@models/menu-model/menu-items.json';
import { RouteName } from '@router/types';


export const Login = (): JSX.Element => {

  const loginJson = LoginJson as FormModel[];

  const menu = useMemo(() => MenuJson as unknown as MenuModel[], []);

  const formRef = useRef<FormRef>(null);

  const navigate = useNavigate();
  const { showToast } = useToast();
  const { login } = useUsersQuery();
  const { getDashboards } = useDashboardsQuery();
  const { user, onSetUser } = useContext(AuthContext);

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setUserMenu = useCallback((dashboards: DashboardModel[]) => {
    const items: MenuModel['subItems'] = [];

    const userDashboards = dashboards.filter(dashboard => dashboard.category);

    for (const element of userDashboards) {
      const item = items.find(item => item.label === element.category);

      const tempObj = {
        label: element.category,
        childrens: item ? [...item.childrens, element] : [element],
      };

      if (item) {
        items[items.indexOf(item)] = tempObj;
      } else {
        items.push(tempObj);
      }

    }

    const cleanedMenu = menu.filter(item => item.label !== 'Dashboards');

    cleanedMenu.push({
      label: 'Dashboards',
      collapsible: true,
      icon: 'Dashboard',
      subItems: items,
    }
    );

    return cleanedMenu;

  }, [menu]);

  const handleLogin = useCallback(async () => {
    const { email: username, password } = formRef.current?.inputValues || {};

    if (username.value && password.value) { // Controlla se username e password sono stati inseriti
      setIsLoading(true);

      try {
        const { data } = await login({ // Chiama la funzione login per effettuare il login
          username: username.value, // Passa username e password
          password: password.value,
        });

        if (!data) { // Se non ci sono dati, mostra un messaggio di errore
          return;
        }

        const { data: dashboards } = await getDashboards(data.jwt); // Chiama la funzione getDashboards per ottenere i dashboard

        if (!dashboards) { // Se non ci sono dati, mostra un messaggio di errore
          return;
        }

        onSetUser({ // Imposta l'utente
          ...data,
          email: username.value,
          menu: setUserMenu(dashboards),
        });

        navigate(RouteName.Home); // Reindirizza alla home
      } catch (error) {
        const err = error as Error;
        showToast({
          type: ToastTypes.ERROR, // Mostra un messaggio di errore
          message: `Error ${err.message}`,
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      showToast({ // Se username e password non sono stati inseriti, mostra un messaggio di errore
        type: ToastTypes.ERROR,
        message: 'Please enter your email and password',
      });
    }
  }, [getDashboards, login, navigate, onSetUser, setUserMenu, showToast]);

  useEffect(() => {
    if (user) { // Se l'utente è già loggato, reindirizza alla home
      navigate(RouteName.Home);
    }
  }, [navigate, user]);

  return (
    <section className="flex flex-col items-center justify-center h-dvh p-6">
      {/* Logo */}
      {/* <img className="object-cover pb-6" src={logo} alt="logo" /> */}

      {/* Messaggio di benvenuto */}
      <div className="text-center mb-8 max-w-xl">
        <h1 className="text-3xl font-bold mb-4">Benvenuto su SmartField</h1>
        <p className="text-lg mb-2">
          Visualizza i dati dei sensori nei tuoi campi agricoli, commentali e comprendili facilmente con l’aiuto del nostro chatbot intelligente.
        </p>
        <p className="text-md text-600">
          Per entrare, inserisci qui le credenziali di Databoom.
        </p>
      </div>

      {/* Form di login */}
      <Form
        ref={formRef}
        className="flex flex-col gap-6 w-full max-w-md"
        formBlocks={loginJson}
        alertModal={false}
        isLoading={isLoading}
        onSubmitCallback={handleLogin}
        submitButtonLabel="Accedi"
      />
    </section>
  );
};
