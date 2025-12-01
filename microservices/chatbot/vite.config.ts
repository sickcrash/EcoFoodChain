/* eslint-disable camelcase */

import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { VitePWA } from 'vite-plugin-pwa';

const aliases = [
  {
    find: '@',
    replacement: path.resolve(__dirname, 'src'),
  },
  {
    find: '@router',
    replacement: path.resolve(__dirname, 'src/router'),
  },
  {
    find: '@pages',
    replacement: path.resolve(__dirname, 'src/pages'),
  },
  {
    find: '@components',
    replacement: path.resolve(__dirname, 'src/components'),
  },
  {
    find: '@models',
    replacement: path.resolve(__dirname, 'src/models'),
  },
  {
    find: '@utils',
    replacement: path.resolve(__dirname, 'src/utils'),
  },
  {
    find: '@assets',
    replacement: path.resolve(__dirname, 'src/assets'),
  },
  {
    find: '@hooks',
    replacement: path.resolve(__dirname, 'src/hooks'),
  },
  {
    find: '@contexts',
    replacement: path.resolve(__dirname, 'src/contexts'),
  },
];

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'eco-food-chain',
        short_name: 'eco-food-chain',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Search',
            url: '/#/search',
            icons: [
              {
                src: '/pwa-512x512.png',
                type: 'image/png',
                sizes: '512x512',
              },
            ],
          },
          {
            name: 'Search',
            url: '/#/box-manager',
            icons: [
              {
                src: '/pwa-512x512.png',
                type: 'image/png',
                sizes: '512x512',
              },
            ],
          },
        ],
      },
    }),
    checker({
      typescript: true,
    }),
  ],
  resolve: {
    alias: aliases,
  },
  server: {
    host: '0.0.0.0',
    port: 5713,
    proxy: {
      // Inoltra tutte le chiamate che iniziano con /api verso il backend Flask
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  base: '/chatbot/',
});
