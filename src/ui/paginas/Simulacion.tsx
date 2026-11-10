/**
 * Simulación del día: la planta animada reproduce la traza del modelo (no re-simula).
 * Modo comparación: dos escenarios con la misma semilla, mismo reloj, lado a lado: los mismos
 * pacientes de base en las dos agendas (números aleatorios comunes).
 */
import { useEffect, useMemo, useState } from 'react';
import { POLITICAS_SOBRETURNO, type MotivoPerdida, type PoliticaSobreturno } from '../../modelo';
import { escenarioComparado, NOMBRES_POLITICA, PRESETS_APP, setComparacion, useEstado } from '../app/estado';
import { enlace, navegar } from '../app/rutas';
import { indicadoresEn, seriesBC, type EstadoMedico } from '../animacion/indicadores';
import { prepararAnimacion, type DatosAnimacion } from '../animacion/preparar';
import { Reproductor, useReproductor, VELOCIDADES } from '../animacion/reproductor';
import { IconoComparar, IconoFlecha, IconoPausa, IconoPlay, IconoReiniciar, IconoTeclado } from '../componentes/Iconos';
import { NOMBRES_CLASE, Pictograma } from '../componentes/Pictograma';
import { PlanoCanvas } from '../componentes/PlanoCanvas';
import { decimal, entero, hora, leerHora, pesos, pesosCompacto } from '../formato';
import { useCorrida } from '../simulacion/cliente';

const MOTIVOS: Record<MotivoPerdida, string> = {
  abandono: 'Abandonaron',
  tardio_rechazado: 'Tardíos rechazados',
  fuera_de_horario: 'Fuera de horario',
  sin_profesional: 'Sin profesional',
};
const ESTADOS: Record<EstadoMedico, string> = { por_llegar: 'Por llegar', libre: 'Libre', atendiendo: 'Atendiendo', retirado: 'Se retiró' };

function Controles({ rep, comparar, alComparar }: { rep: Reproductor; comparar: boolean; alComparar: () => void }) {
  const e = useReproductor(rep);
  const horas: number[] = [];
  for (let h = Math.ceil(e.tInicio / 60) * 60; h <= e.tFin; h += 60) horas.push(h);
  const rango = e.tFin - e.tInicio;
  return (
    <div className="controles" role="toolbar" aria-label="Controles de la animación">
      <div className="controles-botones">
        <button type="button" className="boton boton-primario boton-play" onClick={() => rep.alternar()} aria-label={e.reproduciendo ? 'Pausar (espacio)' : 'Reproducir (espacio)'}>
          {e.reproduciendo ? <IconoPausa /> : <IconoPlay />}
          <span>{e.reproduciendo ? 'Pausa' : 'Reproducir'}</span>
        </button>
        <button type="button" className="boton-icono" onClick={() => rep.ir(e.tInicio)} aria-label="Volver al principio del día (Inicio)" title="Volver al principio (Inicio)">
          <IconoReiniciar />
        </button>
        <label className="control-velocidad">
          <span>Velocidad</span>
          <select value={e.velocidad} onChange={(ev) => rep.setVelocidad(Number(ev.target.value))}>
            {VELOCIDADES.map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <output className="reloj num" aria-live="off">
        {hora(e.t)}
      </output>
      <div className="linea-tiempo">
        <input
          type="range"
          min={e.tInicio}
          max={e.tFin}
          step={0.5}
          value={e.t}
          onChange={(ev) => rep.ir(Number(ev.target.value))}
          aria-label="Hora del día"
          aria-valuetext={hora(e.t)}
          style={{ ['--avance' as string]: `${((e.t - e.tInicio) / Math.max(rango, 1)) * 100}%` }}
        />
        <div className="marcas-hora" aria-hidden="true">
          {horas.map((h) => (
            <span key={h} style={{ left: `${((h - e.tInicio) / Math.max(rango, 1)) * 100}%` }}>
              {String(Math.floor(h / 60)).padStart(2, '0')}
            </span>
          ))}
        </div>
      </div>
      <button type="button" className={`boton boton-secundario${comparar ? ' activo' : ''}`} aria-pressed={comparar} onClick={alComparar}>
        <IconoComparar tam={18} /> Comparar
      </button>
    </div>
  );
}

function MiniBC({ datos, t }: { datos: DatosAnimacion; t: number }) {
  const s = useMemo(() => seriesBC(datos, 5), [datos]);
  const W = 280, H = 84;
  const min = Math.min(0, ...s.C, ...s.B), max = Math.max(1, ...s.B, ...s.C);
  const x = (ti: number): number => ((ti - datos.tInicio) / (datos.tFin - datos.tInicio)) * W;
  const y = (v: number): number => H - 4 - ((v - min) / (max - min)) * (H - 8);
  const linea = (arr: Float64Array, hasta: number): string => {
    const pts: string[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (s.t[i]! > hasta) break;
      pts.push(`${x(s.t[i]!).toFixed(1)},${y(arr[i]!).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  return (
    <svg className="mini-bc" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={linea(s.B, datos.tFin)} className="bc-b fantasma" />
      <polyline points={linea(s.C, datos.tFin)} className="bc-c fantasma" />
      <polyline points={linea(s.B, t)} className="bc-b" />
      <polyline points={linea(s.C, t)} className="bc-c" />
      <line x1={x(t)} x2={x(t)} y1={0} y2={H} className="bc-ahora" />
    </svg>
  );
}

function Fila({ k, v, tono }: { k: string; v: string; tono?: 'dato' | 'positivo' | 'alerta' | 'accion' }) {
  return (
    <div className={`fila-ind${tono ? ` tono-${tono}` : ''}`}>
      <span>{k}</span>
      <b className="num">{v}</b>
    </div>
  );
}

function PanelVivo({ datos, rep, compacto = false }: { datos: DatosAnimacion; rep: Reproductor; compacto?: boolean }) {
  const { t } = useReproductor(rep);
  const ind = indicadoresEn(datos, t);
  const perdidos = (Object.keys(MOTIVOS) as MotivoPerdida[]).filter((m) => ind.perdidos[m] > 0 || m === 'abandono');
  const extraTotal = ind.medicos.reduce((s, m) => s + m.extra, 0);
  return (
    <aside className={`panel-vivo${compacto ? ' compacto' : ''}`} aria-label="Indicadores en vivo">
      <div className="grupo-ind">
        <h2>Pacientes</h2>
        <Fila k="Llegaron" v={entero(ind.llegadas)} />
        <Fila k="Atendidos" v={entero(ind.atendidos)} tono="positivo" />
        <Fila k="Ausentes" v={entero(ind.ausentes)} />
        {compacto ? (
          <Fila k="Perdidos" v={entero(ind.perdidosTotal)} tono="alerta" />
        ) : (
          perdidos.map((m) => <Fila key={m} k={MOTIVOS[m]} v={entero(ind.perdidos[m])} tono={ind.perdidos[m] > 0 ? 'alerta' : undefined} />)
        )}
      </div>
      <div className="grupo-ind">
        <h2>Ahora</h2>
        {!compacto && <Fila k="En cola de admisión" v={entero(ind.enColaAdmision + ind.enAdmision)} />}
        <Fila k="En sala de espera" v={entero(ind.enSala)} tono="dato" />
        {!compacto && <Fila k="En consulta" v={entero(ind.enConsulta)} />}
        {compacto && <Fila k="Horas extra" v={`${decimal(extraTotal)} min`} tono={extraTotal > 0 ? 'accion' : undefined} />}
      </div>
      {!compacto && (
        <div className="grupo-ind">
          <h2>Médicos</h2>
          <table className="tabla-medicos">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visualmente-oculto">Consultorio</span>
                </th>
                <th scope="col">Estado</th>
                <th scope="col" className="der">
                  Ocio
                </th>
                <th scope="col" className="der">
                  Extra
                </th>
              </tr>
            </thead>
            <tbody>
              {ind.medicos.map((m, i) => (
                <tr key={i}>
                  <th scope="row">
                    <span className="placa-mini">{i + 1}</span>
                  </th>
                  <td className={`estado-med ${m.estado}`}>{ESTADOS[m.estado]}</td>
                  <td className="der num">{entero(m.ocio)}′</td>
                  <td className={`der num${m.extra > 0 ? ' tono-accion' : ''}`}>{entero(m.extra)}′</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="grupo-ind grupo-economia">
        <h2>Acumulado del día</h2>
        <div className="cifra-b">
          <span>Beneficio neto B</span>
          <strong className="num">{compacto ? pesosCompacto(ind.B) : pesos(ind.B)}</strong>
        </div>
        <Fila k="Costo clásico C" v={compacto ? pesosCompacto(ind.C) : pesos(ind.C)} />
        <MiniBC datos={datos} t={t} />
        <p className="leyenda-bc">
          <span className="trazo trazo-b" /> B <span className="trazo trazo-c" /> C · al final: {pesosCompacto(datos.corrida.metricas.beneficio)}
        </p>
      </div>
    </aside>
  );
}

function Leyenda() {
  return (
    <div className="leyenda-plano" aria-label="Referencias de la planta">
      <ul>
        {(['turno', 'sobreturno', 'tardio', 'espontaneo', 'urgencia'] as const).map((c) => (
          <li key={c}>
            <Pictograma clase={c} placa /> {NOMBRES_CLASE[c]}
          </li>
        ))}
      </ul>
      <ul>
        <li>
          <span className="ref-anillo" aria-hidden="true" /> Anillo: paciencia consumida
        </li>
        <li>
          <span className="ref-ausente" aria-hidden="true" /> Agenda: turno ausente
        </li>
        <li>
          <span className="ref-cupo" aria-hidden="true" /> Cupo espontáneo
        </li>
        <li>
          <span className="ref-medico atendiendo" aria-hidden="true" /> Atendiendo
          <span className="ref-medico libre" aria-hidden="true" /> Libre
        </li>
      </ul>
      <p className="nota">Posiciones interpoladas; los tiempos de cada evento son exactos de la traza del modelo.</p>
    </div>
  );
}

function Atajos() {
  return (
    <details className="atajos">
      <summary>
        <IconoTeclado tam={18} /> Atajos de teclado
      </summary>
      <dl>
        <div>
          <dt>
            <kbd>Espacio</kbd>
          </dt>
          <dd>Reproducir o pausar</dd>
        </div>
        <div>
          <dt>
            <kbd>←</kbd> <kbd>→</kbd>
          </dt>
          <dd>5 minutos (con Shift, 30)</dd>
        </div>
        <div>
          <dt>
            <kbd>↑</kbd> <kbd>↓</kbd>
          </dt>
          <dd>Velocidad</dd>
        </div>
        <div>
          <dt>
            <kbd>Inicio</kbd> <kbd>Fin</kbd>
          </dt>
          <dd>Principio o final del día</dd>
        </div>
      </dl>
    </details>
  );
}

function useAtajos(rep: Reproductor): void {
  useEffect(() => {
    const alTeclear = (ev: KeyboardEvent): void => {
      const el = ev.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) && !(el instanceof HTMLInputElement && el.type === 'range')) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const paso = ev.shiftKey ? 30 : 5;
      switch (ev.key) {
        case ' ':
          if (el?.tagName === 'BUTTON') return;
          ev.preventDefault();
          rep.alternar();
          break;
        case 'ArrowRight':
          ev.preventDefault();
          rep.mover(paso);
          break;
        case 'ArrowLeft':
          ev.preventDefault();
          rep.mover(-paso);
          break;
        case 'ArrowUp':
          ev.preventDefault();
          rep.cambiarVelocidad(1);
          break;
        case 'ArrowDown':
          ev.preventDefault();
          rep.cambiarVelocidad(-1);
          break;
        case 'Home':
          ev.preventDefault();
          rep.ir(rep.instantanea.tInicio);
          break;
        case 'End':
          ev.preventDefault();
          rep.ir(rep.instantanea.tFin);
          break;
      }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [rep]);
}

function ParametrosComparacion() {
  const { comparacion } = useEstado();
  return (
    <div className="param-comparacion">
      <label>
        <span>Sobreturnos en B</span>
        <select value={comparacion.k} onChange={(e) => setComparacion({ k: Number(e.target.value) })}>
          {Array.from({ length: 9 }, (_, k) => (
            <option key={k} value={k}>
              k = {k}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Ubicación</span>
        <select value={comparacion.politica} onChange={(e) => setComparacion({ politica: e.target.value as PoliticaSobreturno })}>
          {POLITICAS_SOBRETURNO.map((p) => (
            <option key={p} value={p}>
              {NOMBRES_POLITICA[p]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function describirK(d: DatosAnimacion): string {
  const ks = [...new Set(d.corrida.escenario.profesionales.map((p) => p.sobreturnos.k))];
  const pol = d.corrida.escenario.profesionales[0]!.sobreturnos.politica;
  if (ks.length > 1) return `k = ${ks.join('/')}`;
  return ks[0] === 0 ? 'sin sobreturnos (k = 0)' : `k = ${ks[0]} · ${NOMBRES_POLITICA[pol].toLowerCase()}`;
}

function DiferenciaNAC({ a, b, rep }: { a: DatosAnimacion; b: DatosAnimacion; rep: Reproductor }) {
  const { t } = useReproductor(rep);
  const claves = new Set(b.corrida.traza.pacientes.map((p) => p.clave));
  const base = a.corrida.traza.pacientes.filter((p) => p.origen !== 'sobreturno');
  const comunes = base.filter((p) => claves.has(p.clave)).length;
  const extra = b.corrida.traza.pacientes.filter((p) => p.origen === 'sobreturno').length - a.corrida.traza.pacientes.filter((p) => p.origen === 'sobreturno').length;
  const dB = indicadoresEn(b, t).B - indicadoresEn(a, t).B;
  const dFin = b.corrida.metricas.beneficio - a.corrida.metricas.beneficio;
  return (
    <div className="diferencia">
      <p>
        <strong className="num">{entero(comunes)}</strong> pacientes de base idénticos en A y B (misma semilla, mismos atributos)
        {extra !== 0 && (
          <>
            {' '}
            · B suma <strong className="num">{entero(extra)}</strong> sobreturnos
          </>
        )}
      </p>
      <p className="diferencia-cifras">
        <span>
          ΔB ahora <strong className={`num ${dB >= 0 ? 'tono-positivo' : 'tono-alerta'}`}>{(dB >= 0 ? '+' : '') + pesos(dB)}</strong>
        </span>
        <span>
          ΔB al final del día <strong className={`num ${dFin >= 0 ? 'tono-positivo' : 'tono-alerta'}`}>{(dFin >= 0 ? '+' : '') + pesos(dFin)}</strong>
        </span>
      </p>
      <p className="nota">Un solo día: la decisión sale del promedio de muchos días (paso #4).</p>
    </div>
  );
}

export function Simulacion({ params }: { params: URLSearchParams }) {
  const { valido, semilla, comparacion, preset } = useEstado();
  const comparar = params.get('comparar') === '1';
  const eB = useMemo(() => escenarioComparado(valido, comparacion), [valido, comparacion]);
  const cA = useCorrida(valido, semilla);
  const cB = useCorrida(comparar ? eB : null, semilla);
  const dA = useMemo(() => (cA.estado === 'listo' ? prepararAnimacion(cA.resultado) : null), [cA]);
  const dB = useMemo(() => (comparar && cB.estado === 'listo' ? prepararAnimacion(cB.resultado) : null), [cB, comparar]);

  const [rep] = useState(() => {
    const t0 = leerHora(params.get('t') ?? '') ?? 8 * 60;
    const v = Number(params.get('vel'));
    return new Reproductor(7 * 60, 21 * 60, t0, VELOCIDADES.includes(v as (typeof VELOCIDADES)[number]) ? v : 120);
  });
  useEffect(() => () => rep.destruir(), [rep]);
  useEffect(() => {
    if (!dA) return;
    const inicio = Math.min(dA.tInicio, dB?.tInicio ?? Infinity);
    const fin = Math.max(dA.tFin, dB?.tFin ?? -Infinity);
    rep.setRango(inicio, fin);
  }, [dA, dB, rep]);
  useAtajos(rep);
  if (import.meta.env.DEV) (window as unknown as { __reproductor: Reproductor }).__reproductor = rep;

  const alComparar = (): void => {
    const p = Object.fromEntries(params.entries());
    if (comparar) delete p.comparar;
    else p.comparar = '1';
    navegar('simulacion', p);
  };

  const nombre = preset ? PRESETS_APP[preset].corto : valido.nombre || 'Escenario personalizado';
  const error = cA.estado === 'error' ? cA.mensaje : cB.estado === 'error' ? cB.mensaje : null;

  return (
    <div className={`pagina pagina-simulacion${comparar ? ' comparando' : ''}`}>
      <header className="cabeza-pagina">
        <div>
          <h1 className="titulo-pagina">Simulación del día</h1>
          <p className="bajada">
            {nombre} · semilla <span className="num">{semilla}</span> · {dA ? describirK(dA) : '…'}
          </p>
          <p className="marca-supuestos">Datos ficticios · supuestos del modelo</p>
        </div>
        <div className="cabeza-acciones">
          <a className="boton boton-fantasma" href={enlace('escenario')}>
            Editar escenario
          </a>
          <a className="boton boton-secundario" href={enlace('resultados')}>
            Resultados del día <IconoFlecha tam={18} />
          </a>
        </div>
      </header>

      <Controles rep={rep} comparar={comparar} alComparar={alComparar} />
      {comparar && <ParametrosComparacion />}

      {error && (
        <p className="aviso-error" role="alert">
          No se pudo simular el día: {error}
        </p>
      )}

      {!comparar ? (
        <div className="escena">
          {dA ? <PlanoCanvas datos={dA} reproductor={rep} etiqueta={`Planta animada del día: ${nombre}`} /> : <div className="plano plano-esqueleto" role="status" aria-label="Simulando el día…" />}
          {dA ? <PanelVivo datos={dA} rep={rep} /> : <aside className="panel-vivo esqueleto" />}
        </div>
      ) : (
        <>
          <div className="escena-doble">
            {[
              { d: dA, rotulo: 'A', titulo: 'Escenario actual' },
              { d: dB, rotulo: 'B', titulo: `Con k = ${comparacion.k}` },
            ].map(({ d, rotulo, titulo }) => (
              <section key={rotulo} className="escena-lado" aria-label={`Escenario ${rotulo}`}>
                <h2 className="lado-titulo">
                  <span className="placa-mini placa-letra">{rotulo}</span> {titulo} <span className="lado-detalle">{d ? describirK(d) : '…'}</span>
                </h2>
                {d ? <PlanoCanvas datos={d} reproductor={rep} etiqueta={`Planta animada, escenario ${rotulo}`} /> : <div className="plano plano-esqueleto" role="status" aria-label="Simulando el día…" />}
                {d ? <PanelVivo datos={d} rep={rep} compacto /> : <aside className="panel-vivo compacto esqueleto" />}
              </section>
            ))}
          </div>
          {dA && dB && <DiferenciaNAC a={dA} b={dB} rep={rep} />}
        </>
      )}

      <div className="pie-escena">
        <Leyenda />
        <Atajos />
      </div>
    </div>
  );
}
