import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { webApiBridge } from './services/apiBridge'

// Inyectar el puente de API para el modo Web (Railway)
;(window as any).electronAPI = webApiBridge;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registrado con éxito en scope:', reg.scope);
      })
      .catch((err) => {
        console.error('Error al registrar el Service Worker:', err);
      });
  });
}
