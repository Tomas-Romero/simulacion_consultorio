/** Íconos propios en SVG: trazo 1,75 px, esquinas redondeadas, 20 × 20. */
import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { tam?: number };

function Icono({ tam = 20, children, ...resto }: P & { children: ReactNode }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...resto}>
      {children}
    </svg>
  );
}

export const IconoPlay = (p: P) => (
  <Icono {...p}>
    <path d="M6.5 4.5v11l9-5.5z" fill="currentColor" stroke="none" />
  </Icono>
);
export const IconoPausa = (p: P) => (
  <Icono {...p}>
    <path d="M6.5 4.5v11M13.5 4.5v11" strokeWidth={2.5} />
  </Icono>
);
export const IconoReiniciar = (p: P) => (
  <Icono {...p}>
    <path d="M4 10a6 6 0 1 0 1.8-4.3" />
    <path d="M4 3.5v3.2h3.2" />
  </Icono>
);
export const IconoFlecha = (p: P) => (
  <Icono {...p}>
    <path d="M4 10h12M11 5l5 5-5 5" />
  </Icono>
);
export const IconoFlechaAbajo = (p: P) => (
  <Icono {...p}>
    <path d="M10 4v12M5 11l5 5 5-5" />
  </Icono>
);
export const IconoSol = (p: P) => (
  <Icono {...p}>
    <circle cx="10" cy="10" r="3.2" />
    <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3 6 14M14 6l1.3-1.3" />
  </Icono>
);
export const IconoLuna = (p: P) => (
  <Icono {...p}>
    <path d="M15.5 12.4A6 6 0 0 1 7.6 4.5 6 6 0 1 0 15.5 12.4z" />
  </Icono>
);
export const IconoAuto = (p: P) => (
  <Icono {...p}>
    <rect x="3" y="4" width="14" height="10" rx="1.5" />
    <path d="M7.5 17h5M10 14v3" />
  </Icono>
);
export const IconoMas = (p: P) => (
  <Icono {...p}>
    <path d="M10 4.5v11M4.5 10h11" />
  </Icono>
);
export const IconoQuitar = (p: P) => (
  <Icono {...p}>
    <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
  </Icono>
);
export const IconoDescargar = (p: P) => (
  <Icono {...p}>
    <path d="M10 3.5v9M6 9l4 4 4-4M4 16h12" />
  </Icono>
);
export const IconoMenu = (p: P) => (
  <Icono {...p}>
    <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
  </Icono>
);
export const IconoCerrar = (p: P) => (
  <Icono {...p}>
    <path d="M5 5l10 10M15 5 5 15" />
  </Icono>
);
export const IconoComparar = (p: P) => (
  <Icono {...p}>
    <rect x="2.5" y="4" width="6.5" height="12" rx="1" />
    <rect x="11" y="4" width="6.5" height="12" rx="1" />
  </Icono>
);
export const IconoExterno = (p: P) => (
  <Icono {...p}>
    <path d="M8 4.5H4.5v11h11V12M11 4.5h4.5V9M15.5 4.5 9 11" />
  </Icono>
);
export const IconoValido = (p: P) => (
  <Icono {...p}>
    <circle cx="10" cy="10" r="7" />
    <path d="M6.8 10.2l2.2 2.2 4.2-4.6" />
  </Icono>
);
export const IconoAviso = (p: P) => (
  <Icono {...p}>
    <path d="M10 3 17.5 16h-15z" />
    <path d="M10 8.5v3.2M10 14v.01" />
  </Icono>
);
export const IconoTeclado = (p: P) => (
  <Icono {...p}>
    <rect x="2.5" y="5" width="15" height="10" rx="1.5" />
    <path d="M5.5 8h.01M8.5 8h.01M11.5 8h.01M14.5 8h.01M6.5 12h7" />
  </Icono>
);
