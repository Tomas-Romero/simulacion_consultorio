/**
 * Campos del editor: rótulo, control, ayuda y error junto al campo (validación con zod en vivo).
 * Los números guardan el texto mientras se escribe, para no pelear con "0," o un campo vacío.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';

interface Base {
  etiqueta: string;
  error?: string | undefined;
  ayuda?: ReactNode;
  className?: string;
}

function Envoltura({ id, etiqueta, error, ayuda, className, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`campo${error ? ' con-error' : ''} ${className ?? ''}`}>
      <label htmlFor={id}>{etiqueta}</label>
      {children}
      {error ? (
        <p className="campo-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : ayuda ? (
        <p className="campo-ayuda" id={`${id}-ayuda`}>
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

const describir = (id: string, error?: string, ayuda?: ReactNode): string | undefined => (error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined);

export function CampoNumero({
  valor,
  alCambiar,
  min,
  max,
  paso = 1,
  sufijo,
  escala = 1,
  ...base
}: Base & { valor: number; alCambiar: (v: number) => void; min?: number; max?: number; paso?: number; sufijo?: string; escala?: number }) {
  const id = useId();
  // El esquema valida en las unidades del modelo (proporciones); el error se muestra en las del campo.
  const enUnidades = base.error?.replace(/(-?\d+(?:\.\d+)?)/g, (n) => {
    const v = (Number(n) * escala).toLocaleString('es-AR', { maximumFractionDigits: 3 });
    return sufijo === '$' ? `$ ${v}` : sufijo ? `${v} ${sufijo}` : v;
  });
  base = { ...base, error: enUnidades };
  const mostrar = (v: number): string => (Number.isFinite(v) ? String(Math.round(v * escala * 1e6) / 1e6) : '');
  const [texto, setTexto] = useState(mostrar(valor));
  useEffect(() => {
    // Si el valor cambió desde afuera (preset, restaurar), se refleja; si es el mismo número, se respeta lo escrito.
    setTexto((t) => (Number(t.replace(',', '.')) * (1 / escala) === valor || (t === '' && Number.isNaN(valor)) ? t : mostrar(valor)));
    // mostrar depende de escala, que no cambia
  }, [valor, escala]);
  return (
    <Envoltura id={id} {...base}>
      <div className="control-numero">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={texto}
          min={min}
          max={max}
          step={paso}
          aria-invalid={base.error ? true : undefined}
          aria-describedby={describir(id, base.error, base.ayuda)}
          onChange={(e) => {
            setTexto(e.target.value);
            const n = e.target.value === '' ? Number.NaN : Number(e.target.value.replace(',', '.'));
            alCambiar(n / escala);
          }}
        />
        {sufijo && <span className="sufijo">{sufijo}</span>}
      </div>
    </Envoltura>
  );
}

export function CampoSelect<T extends string | number>({
  valor,
  opciones,
  alCambiar,
  ...base
}: Base & { valor: T; opciones: readonly { valor: T; texto: string }[]; alCambiar: (v: T) => void }) {
  const id = useId();
  return (
    <Envoltura id={id} {...base}>
      <div className="control-select">
        <select
          id={id}
          value={String(valor)}
          aria-invalid={base.error ? true : undefined}
          aria-describedby={describir(id, base.error, base.ayuda)}
          onChange={(e) => {
            const o = opciones.find((x) => String(x.valor) === e.target.value);
            if (o) alCambiar(o.valor);
          }}
        >
          {opciones.map((o) => (
            <option key={String(o.valor)} value={String(o.valor)}>
              {o.texto}
            </option>
          ))}
        </select>
      </div>
    </Envoltura>
  );
}

export function CampoTexto({ valor, alCambiar, ...base }: Base & { valor: string; alCambiar: (v: string) => void }) {
  const id = useId();
  return (
    <Envoltura id={id} {...base}>
      <input id={id} type="text" className="control-texto" value={valor} onChange={(e) => alCambiar(e.target.value)} aria-invalid={base.error ? true : undefined} />
    </Envoltura>
  );
}

export function CampoCasilla({ etiqueta, valor, alCambiar, ayuda }: { etiqueta: string; valor: boolean; alCambiar: (v: boolean) => void; ayuda?: string }) {
  const id = useId();
  return (
    <div className="campo campo-casilla">
      <input id={id} type="checkbox" checked={valor} onChange={(e) => alCambiar(e.target.checked)} aria-describedby={ayuda ? `${id}-ayuda` : undefined} />
      <label htmlFor={id}>
        {etiqueta}
        {ayuda && (
          <span className="campo-ayuda" id={`${id}-ayuda`}>
            {ayuda}
          </span>
        )}
      </label>
    </div>
  );
}

/** Grupo de opciones excluyentes con aspecto de botones segmentados. */
export function Segmentado<T extends string>({ etiqueta, valor, opciones, alCambiar }: { etiqueta: string; valor: T; opciones: readonly { valor: T; texto: string }[]; alCambiar: (v: T) => void }) {
  const nombre = useId();
  return (
    <fieldset className="segmentado">
      <legend>{etiqueta}</legend>
      <div className="segmentado-opciones">
        {opciones.map((o) => (
          <label key={o.valor} className={o.valor === valor ? 'elegido' : undefined}>
            <input type="radio" name={nombre} value={o.valor} checked={o.valor === valor} onChange={() => alCambiar(o.valor)} />
            {o.texto}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
