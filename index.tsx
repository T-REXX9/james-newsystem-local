import React from 'react';
import ReactDOM from 'react-dom/client';
import { LicenseInfo } from '@mui/x-license';
import App from './App';

LicenseInfo.setLicenseKey('e0d9bb8070ce0054c9d9ecb6e82cb58fTz0wLEU9MzI0NzIxNDQwMDAwMDAsUz1wcmVtaXVtLExNPXBlcnBldHVhbCxLVj0y');

if (typeof window !== 'undefined') {
  const expectedPort = String((import.meta as any)?.env?.VITE_APP_PORT || '8080').trim();
  const enforcePort =
    String((import.meta as any)?.env?.VITE_ENFORCE_APP_PORT || '').trim().toLowerCase() === 'true'
    || Boolean((import.meta as any)?.env?.DEV);
  const host = window.location.hostname;
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';
  const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  if (enforcePort && isLocalHost && expectedPort !== '' && currentPort !== expectedPort) {
    const corrected = `${window.location.protocol}//${host}:${expectedPort}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(corrected);
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
