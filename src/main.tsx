import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PaginaDiagnostico } from './ui/diagnostico/PaginaDiagnostico';

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <PaginaDiagnostico />
  </StrictMode>,
);
