/**
 * Laboratorio: un experimento a medida sobre el escenario del editor, en vivo con el pool de
 * Web Workers (progreso y cancelación), y la reproducción del estudio completo en el navegador.
 */
import { useEffect, useRef, useState } from 'react';
import { POLITICAS_SOBRETURNO, type PoliticaSobreturno } from '../../../modelo';
import { aplicarNivel, Cancelado, compararEstudios, costosDe, crearSerie, curvaDe, extenderSeries, correrEstudio, type Comparacion, type CurvaSerie } from '../../../experimentos';
import { aCSV } from '../../../experimentos/csv';
import { crearPoolWeb, hilosDisponibles } from '../../../experimentos/pool-web';
import { NOMBRES_POLITICA, PRESETS_APP, useEstado } from '../../app/estado';
import { leerPaleta } from '../../animacion/dibujo';
import { Figura } from '../../componentes/Figura';
import { TablaDatos } from '../../componentes/TablaDatos';
import { decimal, entero, pesos } from '../../formato';
import type { EstudioPublicado } from '../../simulacion/estudio';
import { opcionCurvas, SIMBOLO_POLITICA } from './graficos';

interface ResultadoLab {
  ks: number[];
  R: number;
  semilla: number;
  segundos: number;
  hilos: number;
  curvas: { politica: PoliticaSobreturno; curva: CurvaSerie }[];
  escenario: string;
}

function Progreso({ texto, hechas, total, alCancelar }: { texto: string; hechas: number; total: number; alCancelar: () => void }) {
  const u = total > 0 ? hechas / total : 0;
  return (
    <div className="progreso" role="status" aria-live="polite">
      <div className="progreso-texto">
        <span>{texto}</span>
        <span className="num">{Math.round(u * 100)} %</span>
      </div>
      <div className="progreso-barra">
        <span style={{ transform: `scaleX(${u})` }} />
      </div>
      <button type="button" className="boton boton-secundario boton-chico" onClick={alCancelar}>
        Cancelar
      </button>
    </div>
  );
}

export function Laboratorio({ estudio }: { estudio: EstudioPublicado | null }) {
  const { valido, semilla, preset } = useEstado();
  const [kMin, setKMin] = useState(0);
  const [kMax, setKMax] = useState(6);
  const [R, setR] = useState(500);
  const [politicas, setPoliticas] = useState<PoliticaSobreturno[]>(['intercalado', 'mayor_ausentismo']);
  const [estado, setEstado] = useState<{ tipo: 'quieto' } | { tipo: 'corriendo'; texto: string; hechas: number; total: number } | { tipo: 'error'; mensaje: string }>({ tipo: 'quieto' });
  const [resultado, setResultado] = useState<ResultadoLab | null>(null);
  const [reproduccion, setReproduccion] = useState<{ segundos: number; huella: string; hilos: number; comparacion: Comparacion | null } | null>(null);
  const control = useRef<AbortController | null>(null);
  const pool = useRef<ReturnType<typeof crearPoolWeb> | null>(null);
  useEffect(() => () => pool.current?.cerrar(), []);
  const obtenerPool = () => (pool.current ??= crearPoolWeb());
  const nombreEsc = preset ? PRESETS_APP[preset].corto : valido.nombre || 'Escenario personalizado';
  const corriendo = estado.tipo === 'corriendo';

  const correr = async (): Promise<void> => {
    const ks = Array.from({ length: kMax - kMin + 1 }, (_, i) => kMin + i);
    control.current = new AbortController();
    const t0 = performance.now();
    const series = politicas.map((politica) => ({ politica, serie: crearSerie(politica, ks.map((k) => aplicarNivel(valido, { k, politica, ausentismo: null }))) }));
    setEstado({ tipo: 'corriendo', texto: `Simulando ${entero(ks.length * politicas.length * R)} días`, hechas: 0, total: 1 });
    try {
      await extenderSeries(
        obtenerPool(),
        series.map(({ serie }) => ({ serie, R })),
        semilla,
        { senal: control.current.signal, alAvanzar: (hechas, total) => setEstado({ tipo: 'corriendo', texto: `Simulando ${entero(ks.length * politicas.length * R)} días`, hechas, total }) },
      );
      const c = costosDe(valido);
      setResultado({ ks, R, semilla, segundos: (performance.now() - t0) / 1000, hilos: obtenerPool().hilos, curvas: series.map(({ politica, serie }) => ({ politica, curva: curvaDe(serie, ks, c).curva })), escenario: nombreEsc });
      setEstado({ tipo: 'quieto' });
    } catch (e) {
      setEstado(e instanceof Cancelado ? { tipo: 'quieto' } : { tipo: 'error', mensaje: e instanceof Error ? e.message : String(e) });
    }
  };

  const reproducirEstudio = async (): Promise<void> => {
    control.current = new AbortController();
    const t0 = performance.now();
    setEstado({ tipo: 'corriendo', texto: 'Estudio completo', hechas: 0, total: 1 });
    try {
      const r = await correrEstudio(obtenerPool(), { senal: control.current.signal, progreso: (fase, hechas, total) => setEstado({ tipo: 'corriendo', texto: fase, hechas, total }) });
      setReproduccion({ segundos: (performance.now() - t0) / 1000, huella: r.huella, hilos: obtenerPool().hilos, comparacion: estudio ? compararEstudios(estudio, r) : null });
      setEstado({ tipo: 'quieto' });
    } catch (e) {
      setEstado(e instanceof Cancelado ? { tipo: 'quieto' } : { tipo: 'error', mensaje: e instanceof Error ? e.message : String(e) });
    }
  };
  if (import.meta.env.DEV) (window as unknown as { __reproducirEstudio: () => Promise<void> }).__reproducirEstudio = reproducirEstudio;

  const p = leerPaleta();
  return (
    <div className="laboratorio">
      <div className="lab-form">
        <p className="parrafo">
          Corre sobre el escenario del editor (<strong>{nombreEsc}</strong>, semilla <span className="num">{semilla}</span>) con {hilosDisponibles()} Web Workers. Cada día usa la misma semilla en todas las configuraciones.
        </p>
        <div className="fila-campos">
          <label className="campo">
            <span>k desde</span>
            <select value={kMin} onChange={(e) => setKMin(Math.min(Number(e.target.value), kMax))} disabled={corriendo}>
              {Array.from({ length: 9 }, (_, k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>k hasta</span>
            <select value={kMax} onChange={(e) => setKMax(Math.max(Number(e.target.value), kMin))} disabled={corriendo}>
              {Array.from({ length: 9 }, (_, k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="campo">
            <span>Días por configuración (R)</span>
            <select value={R} onChange={(e) => setR(Number(e.target.value))} disabled={corriendo}>
              {[100, 200, 500, 1000, 2000, 4000].map((r) => (
                <option key={r} value={r}>
                  {entero(r)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="lab-politicas" disabled={corriendo}>
          <legend>Políticas</legend>
          {POLITICAS_SOBRETURNO.map((pol) => (
            <label key={pol}>
              <input type="checkbox" checked={politicas.includes(pol)} onChange={(e) => setPoliticas((ps) => (e.target.checked ? POLITICAS_SOBRETURNO.filter((x) => x === pol || ps.includes(x)) : ps.filter((x) => x !== pol)))} />
              {NOMBRES_POLITICA[pol]}
            </label>
          ))}
        </fieldset>
        <div className="lab-acciones">
          <button type="button" className="boton boton-primario" onClick={correr} disabled={corriendo || politicas.length === 0}>
            Correr el experimento
          </button>
          <button type="button" className="boton boton-secundario" onClick={reproducirEstudio} disabled={corriendo || !estudio}>
            Reproducir el estudio completo en este navegador
          </button>
        </div>
        {estado.tipo === 'corriendo' && <Progreso texto={estado.texto} hechas={estado.hechas} total={estado.total} alCancelar={() => control.current?.abort()} />}
        {estado.tipo === 'error' && (
          <p className="aviso-error" role="alert">
            {estado.mensaje}
          </p>
        )}
        {reproduccion && estudio && reproduccion.comparacion && (
          <p className={`verificacion ${reproduccion.comparacion.decisionesIguales === reproduccion.comparacion.decisiones ? 'ok' : 'mal'}`} role="status">
            Estudio reproducido en {decimal(reproduccion.segundos)} s con {reproduccion.hilos} Web Workers.{' '}
            {reproduccion.comparacion.huellaIgual
              ? `Huella ${reproduccion.huella}: idéntica bit a bit a la del JSON precalculado en Node.`
              : `Huella ${reproduccion.huella} (en Node: ${estudio.huella}). Este navegador redondea Math.exp y Math.log distinto en el último bit que el motor de Node con que se generó el JSON; ${reproduccion.comparacion.decisionesIguales} de ${reproduccion.comparacion.decisiones} decisiones idénticas (k̂, conjuntos, recomendados, política ganadora, α) y las medias de B difieren a lo sumo en ${reproduccion.comparacion.maxDifRelativa.toExponential(1)} relativo.`}
          </p>
        )}
      </div>

      {resultado && (
        <div className="lab-resultado">
          <Figura
            numero={15}
            titulo={`Laboratorio: B(k) en ${resultado.escenario}`}
            descripcion={`R = ${entero(resultado.R)} días por configuración · semilla ${resultado.semilla} · ${decimal(resultado.segundos)} s con ${resultado.hilos} workers. Símbolo relleno: conjunto de óptimos indistinguibles.`}
            opcion={opcionCurvas(resultado.curvas.map((c) => ({ nombre: NOMBRES_POLITICA[c.politica], color: p.politicas[c.politica], simbolo: SIMBOLO_POLITICA[c.politica], curva: c.curva })))}
            archivo="laboratorio-curvas"
            resumen={resultado.curvas.map((c) => `${NOMBRES_POLITICA[c.politica]}: k̂ = ${c.curva.kHat}, conjunto {${c.curva.conjunto.join(', ')}}`).join('; ')}
          />
          <TablaDatos
            titulo="Laboratorio: mejor k por política"
            cabecera={['Política', 'k̂', 'Conjunto óptimo', 'Recomendado', 'B en k̂ (IC 95 %)', 'k según C']}
            derecha={[1, 3, 4, 5]}
            filas={resultado.curvas.map(({ politica, curva }) => {
              const b = curva.puntos.find((x) => x.k === curva.kHat)!.B;
              return [NOMBRES_POLITICA[politica], curva.kHat, `{${curva.conjunto.join(', ')}}`, curva.kRec, `${pesos(b.media)} ± ${pesos(b.semi)}`, curva.kC];
            })}
            csv={{
              nombre: 'laboratorio.csv',
              contenido: aCSV(
                ['politica', 'R', 'k', 'B_media', 'B_ic_inf', 'B_ic_sup', 'en_conjunto', 'k_hat', 'k_rec', 'k_C'],
                resultado.curvas.flatMap(({ politica, curva }) => curva.puntos.map((x) => [politica, curva.R, x.k, x.B.media, x.B.inf, x.B.sup, curva.conjunto.includes(x.k), curva.kHat, curva.kRec, curva.kC])),
              ),
            }}
          />
        </div>
      )}
    </div>
  );
}
