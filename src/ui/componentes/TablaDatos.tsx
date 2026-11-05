/** Tabla de resultados con título y exportación a CSV. */
import type { ReactNode } from 'react';
import { descargarTexto } from '../simulacion/estudio';
import { IconoDescargar } from './Iconos';

interface Props {
  titulo: string;
  nota?: ReactNode;
  cabecera: readonly ReactNode[];
  /** Columnas numéricas (alineadas a la derecha). */
  derecha?: readonly number[];
  filas: readonly (readonly ReactNode[])[];
  /** Nombre y contenido del CSV (ya armado, con valores sin formato). */
  csv: { nombre: string; contenido: string };
  /** Filas destacadas (índices). */
  destacadas?: readonly number[];
}

export function TablaDatos({ titulo, nota, cabecera, derecha = [], filas, csv, destacadas = [] }: Props) {
  return (
    <div className="tabla-datos">
      <div className="tabla-datos-cabeza">
        <h3>{titulo}</h3>
        <button type="button" className="boton boton-fantasma boton-chico" onClick={() => descargarTexto(csv.nombre, csv.contenido)} aria-label={`Descargar ${titulo} como CSV`}>
          <IconoDescargar tam={16} /> CSV
        </button>
      </div>
      <div className="tabla-datos-scroll">
        <table className="tabla">
          <thead>
            <tr>
              {cabecera.map((c, i) => (
                <th key={i} scope="col" className={derecha.includes(i) ? 'der' : undefined}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i} className={destacadas.includes(i) ? 'destacada' : undefined}>
                {f.map((c, j) => (
                  <td key={j} className={derecha.includes(j) ? 'der num' : undefined}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {nota && <p className="nota">{nota}</p>}
    </div>
  );
}
