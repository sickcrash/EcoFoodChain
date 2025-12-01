import { createHashRouter } from 'react-router-dom';

import { RouteName } from './types';

export const router = createHashRouter([
  {
    path: '/',
    async lazy() {
      const { Root } = await import('@pages/root');
      return { Component: Root };
    },
    children: [
      {
        path: RouteName.Login,
        async lazy() {
          const { Login } = await import('@pages/login');
          return { Component: Login };
        },
      },
      {
        path: RouteName.Home,
        async lazy() {
          const { Home } = await import('@pages/home');
          return { Component: Home };
        },
      },
      {
        path: `${RouteName.Home}/:company/:device`,
        async lazy() {
          const { Coltures } = await import('@pages/coltures');
          return { Component: Coltures };
        },
      },
      {
        path: `${RouteName.Home}/chatbot/:company/:device`,
        async lazy() {
          const { Chatbot } = await import('@pages/chatbot');
          return { Component: Chatbot };
        },
      },
    ],
  },
]);
