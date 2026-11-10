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

/**
 * Pictograma de la clase. Con `placa`, va sobre una placa oscura de señalética (la misma en claro y
 * en oscuro): los cinco colores de clase contrastan ≥ 3:1 sobre zinc-900.
 */
export function Pictograma({ clase, tam = 16, titulo, placa = false }: { clase: Clase; tam?: number; titulo?: string; placa?: boolean }) {
  const svg = (
    <svg width={tam} height={tam} viewBox="0 0 20 20" role={titulo ? 'img' : undefined} aria-hidden={titulo ? undefined : true} aria-label={titulo}>
      <path d={RUTA[clase]} fill={COLOR_CLASE[clase]} stroke={placa ? '#18181b' : 'var(--panel)'} strokeWidth={1.25} />
    </svg>
  );
  return placa ? <span className="placa-picto">{svg}</span> : svg;
}

/** Fila de placas con las cinco clases (leyendas y encabezados). */
export function PlacasClases({ clases = ['turno', 'sobreturno', 'tardio', 'espontaneo', 'urgencia'], tam = 16, className = 'leyenda-clases' }: { clases?: readonly Clase[]; tam?: number; className?: string }) {
  return (
    <ul className={className} aria-label="Clases de paciente">
      {clases.map((c) => (
        <li key={c}>
          <Pictograma clase={c} tam={tam} placa /> {NOMBRES_CLASE[c]}
        </li>
      ))}
    </ul>
  );
}
