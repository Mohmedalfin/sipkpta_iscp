import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import ServerDataProvider from './context/ServerDataProvider.jsx';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ServerDataProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
        </ServerDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
