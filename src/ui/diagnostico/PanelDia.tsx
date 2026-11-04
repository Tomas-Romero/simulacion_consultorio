/**
 * Panel del paso #2 (en #/diagnostico): simula un día con un preset y muestra sus
 * métricas y las primeras filas de la traza, para inspección.
 * Un día tarda menos de 1 ms, así que corre en el hilo principal.
 */
import { useMemo, useState } from 'react';
import { CLASES, MOTIVOS_PERDIDA, PRESETS, prepararEscenario, simularDia, type ResumenEspera } from '../../modelo';

const hhmm = (t: number): string => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const f = (x: number, d = 1): string => (Number.isNaN(x) ? '—' : x.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }));
const pesos = (x: number): string => `$ ${Math.round(x).toLocaleString('es-AR')}`;
const esp = (e: ResumenEspera): string => (e.n === 0 ? '—' : `${f(e.media)} / ${f(e.p90)} (n = ${e.n})`);

const celda = { borderBottom: '1px solid var(--borde)', padding: '6px 10px', textAlign: 'right' } as const;
const th = { borderBottom: '1px solid var(--borde-fuerte)', padding: '6px 10px', color: 'var(--texto-3)', fontWeight: 500, textAlign: 'right' } as const;
const tabla = { borderCollapse: 'collapse', margin: '8px 0 20px', fontVariantNumeric: 'tabular-nums', fontSize: 13 } as const;

function Tabla({ encabezados, filas }: { encabezados: string[]; filas: (string | number)[][] }) {
  return (
    <table style={tabla}>
      <thead>
        <tr>
          {encabezados.map((e, i) => (
            <th key={i} style={th}>
              {e}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((fila, i) => (
          <tr key={i}>
            {fila.map((v, j) => (
              <td key={j} style={j === 0 ? { ...celda, textAlign: 'left' } : celda}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function PanelDia() {
  const [iPreset, setIPreset] = useState(1);
  const [semilla, setSemilla] = useState(2026);
  const [filasTraza, setFilasTraza] = useState(40);

  const { res, ms } = useMemo(() => {
    const prep = prepararEscenario(PRESETS[iPreset]!);
    const t0 = performance.now();
    const res = simularDia(prep, { semilla, traza: true });
    return { res, ms: performance.now() - t0 };
  }, [iPreset, semilla]);
  const m = res.metricas;

  return (
    <section>
      <h2 style={{ fontSize: 20 }}>Modelo del consultorio · un día</h2>
      <p className="diag-controles">
        <label>
          Escenario{' '}
          <select value={iPreset} onChange={(e) => setIPreset(Number(e.target.value))}>
            {PRESETS.map((p, i) => (
              <option key={i} value={i}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Semilla <input type="number" value={semilla} onChange={(e) => setSemilla(Number(e.target.value))} style={{ width: 90 }} />
        </label>{' '}
        <button type="button" className="boton boton-secundario boton-chico" onClick={() => setSemilla((s) => s + 1)}>
          Otro día
        </button>{' '}
        <span>
          · {hhmm(m.inicioDia)} a {hhmm(m.finDia)} · {res.eventos} eventos · {f(ms, 2)} ms (con traza)
        </span>
      </p>

      <h3 style={{ fontSize: 16 }}>Por profesional</h3>
      <Tabla
        encabezados={['Profesional', 'Turno', 'Llega', 'Se va', 'Ocio [min]', 'Extra [min]', 'Utilización', 'Atendidos T/S/Td/E/U', 'Ausentes', 'Espera turno media/P90', 'Costo C', 'Beneficio B']}
        filas={m.porProfesional.map((p) => [
          `${p.id} · ${p.nombre}`,
          `${hhmm(p.inicioTurno)}–${hhmm(p.finTurno)}`,
          hhmm(p.llegada),
          hhmm(p.salida),
          f(p.ocio),
          f(p.horasExtra),
          `${f(100 * p.utilizacion)} %`,
          CLASES.map((c) => p.atendidos[c]).join('/'),
          p.ausentes,
          esp(p.espera.turno),
          pesos(p.costos.total),
          pesos(p.beneficio),
        ])}
      />

      <h3 style={{ fontSize: 16 }}>Totales</h3>
      <Tabla
        encabezados={['Clase', 'Atendidos', 'Espera media / P90 [min]']}
        filas={[
          ...CLASES.map((c) => [c, m.atendidos[c], esp(m.espera[c])]),
          ['todas', m.atendidosTotal, esp(m.espera.todas)],
          ['(cola de admisión)', '', esp(m.esperaAdmision)],
          ['(sala del consultorio)', '', esp(m.esperaSala)],
        ]}
      />
      <p>
        Generados {m.llegadas} = atendidos {m.atendidosTotal} + perdidos {m.perdidosTotal} (
        {MOTIVOS_PERDIDA.map((x) => `${x}: ${m.perdidos[x]}`).join(', ')}) + ausentes {m.ausentes}.
        <br />
        Ocio {f(m.ocio)} min · horas extra {f(m.horasExtra)} min · utilización médicos {f(100 * m.utilizacionMedicos)} % · admisión{' '}
        {f(100 * m.utilizacionAdmision)} %.
        <br />
        Costo clásico C: espera {pesos(m.costos.espera)} + ocio {pesos(m.costos.ocio)} + extra {pesos(m.costos.extra)} + perdidos {pesos(m.costos.perdidos)} ={' '}
        <strong>{pesos(m.costos.total)}</strong> · ingresos {pesos(m.ingresos)} · beneficio B <strong>{pesos(m.beneficio)}</strong>.
        <br />
        Little del día: L = {f(m.little.L, 3)}, λ·W = {f(m.little.lambda * m.little.W, 3)}.
      </p>

      {m.serie && (
        <>
          <h3 style={{ fontSize: 16 }}>Sala de espera (pacientes esperando al consultorio, cada 5 min)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 80, borderBottom: '1px solid var(--borde-fuerte)', overflowX: 'auto' }}>
            {m.serie.sala.map((n, i) => (
              <div key={i} title={`${hhmm(m.serie!.t[i]!)}: ${n} en sala`} style={{ width: 4, flex: '0 0 4px', height: n * 5, background: 'var(--dato-relleno)' }} />
            ))}
          </div>
          <p style={{ fontSize: 12 }}>
            {hhmm(m.serie.t[0]!)} → {hhmm(m.serie.t[m.serie.t.length - 1]!)} · máximo {Math.max(...m.serie.sala)} en sala
          </p>
        </>
      )}

      <h3 style={{ fontSize: 16 }}>
        Traza (primeras{' '}
        <input type="number" value={filasTraza} onChange={(e) => setFilasTraza(Number(e.target.value))} style={{ width: 60 }} /> de{' '}
        {res.traza!.registros.length} filas)
      </h3>
      <Tabla
        encabezados={['t', 'Hora', 'Paciente', 'Tipo', 'Etapa', 'Clase', 'Prioridad', 'Profesional', 'Detalle']}
        filas={res.traza!.registros.slice(0, filasTraza).map((r) => [f(r.t, 2), hhmm(r.t), r.entidad, r.tipo, r.etapa, r.clase, r.prioridad, r.profesional ?? '—', r.detalle ?? ''])}
      />
    </section>
  );
}
