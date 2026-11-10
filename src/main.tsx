import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app/App';
import './ui/estilos/tokens.css';
import './ui/estilos/base.css';
import './ui/estilos/componentes.css';
import './ui/estilos/paginas.css';

// Después de publicar una versión nueva, una pestaña abierta pide pantallas (chunks) con el nombre
// viejo, que ya no existen: se recarga para tomar la versión nueva. Como mucho una vez cada 30 s, para
// no entrar en un bucle si el archivo falta de verdad.
window.addEventListener('vite:preloadError', (e) => {
  try {
    const ultima = Number(sessionStorage.getItem('sobreturnos.recarga') ?? 0);
    if (Date.now() - ultima < 30_000) return;
    sessionStorage.setItem('sobreturnos.recarga', String(Date.now()));
  } catch {
    return;
  }
  e.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
