/** Pictograma de clase de paciente en SVG: misma forma y color que en el canvas. */
import type { Clase } from '../../modelo';

export const NOMBRES_CLASE: Record<Clase, string> = {
  turno: 'Turno',
  sobreturno: 'Sobreturno',
  tardio: 'Tardío',
  espontaneo: 'Espontáneo',
  urgencia: 'Urgencia',
};

export const COLOR_CLASE: Record<Clase, string> = {
  turno: 'var(--clase-turno)',
  sobreturno: 'var(--clase-sobreturno)',
  tardio: 'var(--clase-tardio)',
  espontaneo: 'var(--clase-espontaneo)',
  urgencia: 'var(--clase-urgencia)',
};

export const FORMA_CLASE: Record<Clase, string> = {
  turno: 'círculo',
  sobreturno: 'rombo',
  tardio: 'triángulo',
  espontaneo: 'cuadrado',
  urgencia: 'cruz',
};

const RUTA: Record<Clase, string> = {
  turno: 'M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13z',
  sobreturno: 'M10 2.5 17.5 10 10 17.5 2.5 10z',
  tardio: 'M10 3 17 15.5H3z',
  espontaneo: 'M4 4h12v12H4z',
  urgencia: 'M7.5 3h5v4.5H17v5h-4.5V17h-5v-4.5H3v-5h4.5z',
};

export function Pictograma({ clase, tam = 16, titulo }: { clase: Clase; tam?: number; titulo?: string }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 20 20" role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : true} aria-label={titulo}>
      <path d={RUTA[clase]} fill={COLOR_CLASE[clase]} stroke="var(--panel)" strokeWidth={1.25} />
    </svg>
  );
}
