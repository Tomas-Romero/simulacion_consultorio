import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/app/App';
import './ui/estilos/tokens.css';
import './ui/estilos/base.css';
import './ui/estilos/componentes.css';
import './ui/estilos/paginas.css';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
