/**
 * Experimentos (paso #4): el estudio Monte Carlo precalculado (public/resultados/estudio.json),
 * en seis secciones, y el laboratorio en vivo. Todo resultado declara IC, semilla y R.
 */
import { useMemo } from 'react';
import { PRESETS } from '../../../modelo';
import { tablasCSV } from '../../../experimentos/csv';
import { NOMBRES_POLITICA } from '../../app/estado';
import { leerPaleta } from '../../animacion/dibujo';
import { Figura } from '../../componentes/Figura';
import { TablaDatos } from '../../componentes/TablaDatos';
import { decimal, entero, pesos, porcentaje } from '../../formato';
import { useEstudio } from '../../simulacion/estudio';
import { useTema } from '../../app/tema';
import {
  lineasPoliticas,
  NOMBRE_PRESET,
  opcionBalance,
  opcionCostos,
  opcionCurvas,
  opcionKvsAusentismo,
  opcionMapa,
  opcionPoliticas,
  opcionPrecision,
  opcionRegla,
  opcionRiesgo,
} from './graficos';
import { Laboratorio } from './Laboratorio';

const SECCIONES = [
  ['curva', 'a', 'Curva B(k)'],
  ['politicas', 'b', 'Políticas'],
  ['sensibilidad', 'c', 'Sensibilidad'],
  ['regla', 'd', 'Regla práctica'],
  ['riesgo', 'e', 'Riesgo'],
  ['laboratorio', 'f', 'Laboratorio'],
] as const;

const conjuntoTexto = (c: number[]): string => `{${c.join(', ')}}`;
const icTexto = (x: { media: number; inf: number; sup: number }): string => `${pesos(x.media)} [${pesos(x.inf)}; ${pesos(x.sup)}]`;
const MEDICOS: Record<string, number> = { chico: PRESETS[0]!.profesionales.length, policonsultorio: PRESETS[1]!.profesionales.length, centro: PRESETS[2]!.profesionales.length };

function Seccion({ id, letra, titulo, bajada, children }: { id: string; letra: string; titulo: string; bajada: string; children: React.ReactNode }) {
  return (
    <section id={id} className="seccion-exp" aria-labelledby={`t-${id}`}>
      <header className="seccion-exp-cabeza">
        <span className="placa-mini placa-seccion" aria-hidden="true">
          {letra}
        </span>
        <div>
          <h2 id={`t-${id}`} className="subtitulo-grande">
            {titulo}
          </h2>
          <p className="seccion-bajada">{bajada}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export default function Experimentos() {
  const { estudio, error } = useEstudio();
  const { efectivo } = useTema();
  // La paleta se relee al cambiar el tema (los colores de las políticas son tokens CSS).
  const p = useMemo(() => leerPaleta(), [efectivo]);
  const csv = useMemo(() => (estudio ? tablasCSV(estudio) : null), [estudio]);

  return (
    <div className="pagina pagina-experimentos">
      <header className="cabeza-pagina">
        <div>
          <h1 className="titulo-pagina">Experimentos</h1>
          <p className="bajada">Cuántos sobreturnos dar y dónde, con muchos días simulados y comparaciones pareadas.</p>
          {estudio && (
            <p className="ficha-estudio">
              Semilla <b className="num">{estudio.semilla}</b> · R inicial <b className="num">{entero(estudio.R0)}</b> días (hasta {entero(estudio.Rmax)} si hace falta) · IC 95 % · {estudio.entorno.hilos} hilos, {decimal(estudio.entorno.segundos)} s en {estudio.entorno.motor} · huella{' '}
              <code>{estudio.huella}</code> · presets <code>{estudio.hashPresets}</code> · generado {new Date(estudio.generado).toLocaleString('es-AR')}
            </p>
          )}
          <p className="marca-supuestos">Datos ficticios · supuestos del modelo · decide B; C es contraste</p>
        </div>
      </header>

      <nav className="subnav" aria-label="Secciones de Experimentos">
        {SECCIONES.map(([id, letra, t]) => (
          <a key={id} href="#/experimentos" onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <span className="placa-mini">{letra}</span> {t}
          </a>
        ))}
      </nav>

      {error && (
        <p className="aviso-error" role="alert">
          No se pudo cargar el estudio: {error}
        </p>
      )}
      {!estudio && !error && (
        <p className="cargando" role="status">
          Cargando el estudio…
        </p>
      )}

      {estudio && csv && (
        <>
          <Seccion id="curva" letra="a" titulo="Curva B(k)" bajada="Beneficio neto esperado por día según los sobreturnos por profesional, para cada política y cada escenario. Banda: IC 95 %. Símbolo relleno: conjunto de óptimos indistinguibles (Bonferroni contra el mejor).">
            <div className="multiples">
              {(['chico', 'policonsultorio', 'centro'] as const).map((id, i) => (
                <Figura
                  key={id}
                  numero={1 + i}
                  titulo={NOMBRE_PRESET[id]!}
                  opcion={opcionCurvas(lineasPoliticas(estudio.e1, id, p))}
                  alto={340}
                  archivo={`fig${1 + i}-curva-${id}`}
                  resumen={estudio.e1.filter((x) => x.preset === id).map((x) => `${NOMBRES_POLITICA[x.politica]}: k̂ = ${x.curva.kHat}, conjunto ${conjuntoTexto(x.curva.conjunto)}`).join('; ')}
                />
              ))}
            </div>
            <TablaDatos
              titulo="Mejor k por escenario y política"
              cabecera={['Escenario', 'Política', 'k̂ (B)', 'Conjunto óptimo', 'Recomendado', 'B en k̂', 'ΔB recomendado − k = 0 (IC 95 %)', 'k según C', 'R final']}
              derecha={[2, 4, 5, 6, 7, 8]}
              filas={estudio.e1.map((x) => {
                const c = x.curva;
                const b = c.puntos.find((q) => q.k === c.kHat)!.B;
                const d = c.contraCero.find((q) => q.k === c.kRec);
                return [NOMBRE_PRESET[x.preset], NOMBRES_POLITICA[x.politica], c.kHat, conjuntoTexto(c.conjunto), c.kRec, `${pesos(b.media)} ± ${pesos(b.semi)}`, d ? icTexto(d.ic) : '— (k = 0)', c.kC, entero(c.R)];
              })}
              destacadas={estudio.e1.flatMap((x, i) => (estudio.e2.find((y) => y.preset === x.preset)!.ganadora === x.politica ? [i] : []))}
              csv={{ nombre: 'e1-curvas.csv', contenido: csv['e1-curvas.csv']! }}
              nota={`Recomendado = el menor k del conjunto óptimo (mismo beneficio esperado, menos espera). Fila destacada: política ganadora del escenario (E2). R final: días por configuración después de la regla de precisión (semiancho de las diferencias consecutivas junto al óptimo ≤ ${pesos(estudio.umbral)}).`}
            />
            <Figura
              numero={4}
              titulo="Precisión: el semiancho del IC baja como 1/√R"
              descripcion={`Policonsultorio, ${NOMBRES_POLITICA[estudio.e6.politica].toLowerCase()}, k = ${estudio.e6.k}: semiancho del IC 95 % de B con los primeros R días (escalas logarítmicas). Pendiente ajustada ${decimal(estudio.e6.pendiente, 2)} (R² = ${decimal(estudio.e6.r2, 2)}).`}
              opcion={opcionPrecision(estudio.e6)}
              alto={300}
              archivo="fig4-precision"
              resumen={`Pendiente log-log ${decimal(estudio.e6.pendiente, 2)}, cercana a −0,5.`}
            />
          </Seccion>

          <Seccion id="politicas" letra="b" titulo="Políticas de ubicación" bajada="Cada política en su mejor k, comparadas con diferencias pareadas (mismos días). Nivel de Bonferroni sobre los 6 pares.">
            <div className="multiples">
              {estudio.e2.map((x, i) => (
                <Figura
                  key={x.preset}
                  numero={5 + i}
                  titulo={`${NOMBRE_PRESET[x.preset]}: gana ${NOMBRES_POLITICA[x.ganadora].toLowerCase()}`}
                  descripcion={x.empatadas.length ? `Empatada con: ${x.empatadas.map((q) => NOMBRES_POLITICA[q].toLowerCase()).join(', ')}` : 'Distinguible de las otras tres'}
                  opcion={opcionPoliticas(x)}
                  alto={220}
                  archivo={`fig${5 + i}-politicas-${x.preset}`}
                  resumen={x.politicas.map((q) => `${NOMBRES_POLITICA[q.politica]} en k = ${q.k}: ${pesos(q.B.media)}`).join('; ')}
                />
              ))}
            </div>
            <div className="figuras-par">
              <Figura
                numero={8}
                titulo="Balance entre espera y ocio"
                descripcion="Cada punto: una política en su mejor k (color y forma de la política; forma del contorno: escenario). Abajo a la izquierda es mejor en los dos."
                opcion={opcionBalance(estudio.e2, MEDICOS)}
                alto={320}
                archivo="fig8-balance"
                resumen="Espera por atendido contra ocio por médico, por política y escenario."
              />
              <TablaDatos
                titulo="Diferencias pareadas entre políticas"
                cabecera={['Escenario', 'A − B', 'Diferencia (IC Bonferroni)', '¿Distinguible?']}
                derecha={[2]}
                filas={estudio.e2.flatMap((x) => x.pares.map((q) => [NOMBRE_PRESET[x.preset], `${NOMBRES_POLITICA[q.a]} − ${NOMBRES_POLITICA[q.b]}`, icTexto(q.ic), q.distinguible ? 'Sí' : 'No']))}
                csv={{ nombre: 'e2-pares.csv', contenido: csv['e2-pares.csv']! }}
                nota={`R común por escenario: ${estudio.e2.map((x) => `${NOMBRE_PRESET[x.preset]} ${entero(x.Rcomun)}`).join(' · ')} días. Nivel individual ${porcentaje(estudio.e2[0]!.nivelBonferroni)}.`}
              />
            </div>
          </Seccion>

          <Seccion id="sensibilidad" letra="c" titulo="Sensibilidad" bajada={`Policonsultorio con la política ganadora (${NOMBRES_POLITICA[estudio.e3.politica].toLowerCase()}). El ausentismo se cambia desplazando β₀ con β₁ fijo: faltan los mismos pacientes y algunos más (números aleatorios comunes). Los costos se reponderan sobre los mismos días.`}>
            <div className="figuras-par">
              <Figura numero={9} titulo="k óptimo según el ausentismo" opcion={opcionKvsAusentismo(estudio.e3.ausentismo)} alto={320} archivo="fig9-k-ausentismo" resumen={estudio.e3.ausentismo.map((a) => `${porcentaje(a.p)}: k̂ = ${a.curva.kHat}`).join('; ')} />
              <Figura
                numero={10}
                titulo="k recomendado: ausentismo × costo de hora extra"
                descripcion="Número: k recomendado; entre llaves, el rango del conjunto óptimo cuando hay más de un k."
                opcion={opcionMapa(estudio.e3.mapa)}
                alto={360}
                archivo="fig10-mapa"
                resumen="Mapa de calor del k recomendado según ausentismo y factor de c_extra."
              />
            </div>
            <div className="figuras-par">
              <Figura
                numero={11}
                titulo="Efecto del costo de hora extra"
                descripcion="B(k) con c_extra = factor × c_ocio; color más intenso = factor mayor."
                opcion={opcionCostos(estudio.e3.factorExtra.map((f) => ({ etiqueta: `× ${decimal(f.factor, 2)}`, curva: f.curva })))}
                alto={300}
                archivo="fig11-factor-extra"
                resumen={estudio.e3.factorExtra.map((f) => `factor ${f.factor}: k̂ = ${f.curva.kHat}`).join('; ')}
              />
              <Figura
                numero={12}
                titulo="Efecto del costo de espera"
                descripcion="B(k) con c_espera de 75, 150 y 300 $/min; color más intenso = más caro."
                opcion={opcionCostos(estudio.e3.cEspera.map((f) => ({ etiqueta: `$ ${f.cEspera}/min`, curva: f.curva })))}
                alto={300}
                archivo="fig12-c-espera"
                resumen={estudio.e3.cEspera.map((f) => `c_espera ${f.cEspera}: k̂ = ${f.curva.kHat}`).join('; ')}
              />
            </div>
            <TablaDatos
              titulo="k óptimo por nivel"
              cabecera={['Factor', 'Nivel', 'k̂', 'Conjunto óptimo', 'Recomendado', 'k según C', 'R']}
              derecha={[2, 4, 5, 6]}
              filas={[
                ...estudio.e3.ausentismo.map((a) => ['Ausentismo', `${porcentaje(a.p)} (β₀ = ${decimal(a.beta0, 2)})`, a.curva.kHat, conjuntoTexto(a.curva.conjunto), a.curva.kRec, a.curva.kC, entero(a.curva.R)]),
                ...estudio.e3.factorExtra.map((f) => ['Factor de c_extra', `× ${decimal(f.factor, 2)}`, f.curva.kHat, conjuntoTexto(f.curva.conjunto), f.curva.kRec, f.curva.kC, entero(f.curva.R)]),
                ...estudio.e3.cEspera.map((f) => ['c_espera', `$ ${f.cEspera}/min`, f.curva.kHat, conjuntoTexto(f.curva.conjunto), f.curva.kRec, f.curva.kC, entero(f.curva.R)]),
              ]}
              csv={{ nombre: 'e3-ausentismo-y-costos.csv', contenido: csv['e3-ausentismo.csv']! + '\n' + csv['e3-costos.csv']! }}
            />
          </Seccion>

          <Seccion id="regla" letra="d" titulo="Regla práctica" bajada="¿Se puede elegir k sin simular? Se compara reponer exactamente a los que se espera que falten con una versión ajustada, sobre los 3 escenarios × 6 niveles de ausentismo.">
            <div className="formula">
              <div>
                <span>Ingenua</span>
                <strong>
                  k = round(<var className="barra">p</var> · <var className="barra">N</var>)
                </strong>
              </div>
              <div>
                <span>Ajustada</span>
                <strong>
                  k = round({decimal(estudio.e4.alfa, 2)} · <var className="barra">p</var> · <var className="barra">N</var>)
                </strong>
              </div>
              <p className="nota">
                p̄: ausentismo medio de los turnos; N̄: turnos reservados por profesional por día. α minimiza la pérdida esperada total (grilla 0–3); la pendiente de mínimos cuadrados por el origen es {decimal(estudio.e4.pendienteMinCuadrados, 2)}.
              </p>
            </div>
            <div className="figuras-par">
              <Figura numero={13} titulo="k óptimo contra p̄·N̄" descripcion="Barra gris: rango del conjunto óptimo. Escalones: las dos reglas." opcion={opcionRegla(estudio.e4)} alto={340} archivo="fig13-regla" resumen={`α = ${estudio.e4.alfa}`} />
              <TablaDatos
                titulo="Pérdida esperada por usar cada regla"
                cabecera={['Regla', 'Pérdida media por día', 'Pérdida máxima', 'Dentro del conjunto óptimo']}
                derecha={[1, 2, 3]}
                filas={estudio.e4.resumen.map((r) => [r.regla === 'ingenua' ? 'Ingenua' : `Ajustada (α = ${decimal(estudio.e4.alfa, 2)})`, pesos(r.perdidaMedia), pesos(r.perdidaMaxima), `${r.dentro} de ${r.total}`])}
                csv={{ nombre: 'e4-regla.csv', contenido: csv['e4-regla.csv']! }}
                nota="Pérdida = B(k̂) − B(k de la regla), pareada por día. Es levemente optimista para k̂, que se elige con los mismos días."
              />
            </div>
            <TablaDatos
              titulo="Detalle por configuración"
              cabecera={['Escenario', 'Ausentismo', 'p̄·N̄', 'k̂', 'Conjunto', 'k ingenua', 'Pérdida ingenua (IC 95 %)', 'k ajustada', 'Pérdida ajustada (IC 95 %)']}
              derecha={[2, 3, 5, 6, 7, 8]}
              filas={estudio.e4.configuraciones.map((c) => [
                `${NOMBRE_PRESET[c.preset]} (${NOMBRES_POLITICA[c.politica].toLowerCase()})`,
                porcentaje(c.p),
                decimal(c.pN, 2),
                c.kHat,
                conjuntoTexto(c.conjunto),
                c.ingenua.dentro ? `${c.ingenua.k} · en el conjunto` : `${c.ingenua.k}`,
                c.ingenua.perdida.media === 0 ? '$ 0' : icTexto(c.ingenua.perdida),
                c.ajustada.dentro ? `${c.ajustada.k} · en el conjunto` : `${c.ajustada.k}`,
                c.ajustada.perdida.media === 0 ? '$ 0' : icTexto(c.ajustada.perdida),
              ])}
              csv={{ nombre: 'e4-regla.csv', contenido: csv['e4-regla.csv']! }}
              nota="“En el conjunto”: el k de la regla está dentro del conjunto de óptimos indistinguibles."
            />
          </Seccion>

          <Seccion id="riesgo" letra="e" titulo="Riesgo día a día" bajada={`Policonsultorio, ${NOMBRES_POLITICA[estudio.e5.politica].toLowerCase()}: cuánto cambia el beneficio de un día dado respecto de no dar sobreturnos (R = ${entero(estudio.e5.R)} días pareados).`}>
            <div className="figuras-par">
              <Figura numero={14} titulo="Distribución diaria de B(k) − B(0)" descripcion="Caja: percentiles 25–75; bigotes: 5–95; rombo: media. Arriba, la probabilidad de que un día rinda menos que con k = 0." opcion={opcionRiesgo(estudio.e5)} alto={340} archivo="fig14-riesgo" resumen={estudio.e5.porK.map((x) => `k = ${x.k}: P(B < B0) = ${porcentaje(x.pNegativo)}`).join('; ')} />
              <TablaDatos
                titulo="Percentiles de B(k) − B(0) por día"
                cabecera={['k', 'p5', 'p25', 'Mediana', 'p75', 'p95', 'Media', 'P(B(k) < B(0))']}
                derecha={[0, 1, 2, 3, 4, 5, 6, 7]}
                filas={estudio.e5.porK.filter((x) => x.k > 0).map((x) => [x.k, pesos(x.p5), pesos(x.p25), pesos(x.p50), pesos(x.p75), pesos(x.p95), pesos(x.media), porcentaje(x.pNegativo)])}
                csv={{ nombre: 'e5-riesgo.csv', contenido: csv['e5-riesgo.csv']! }}
              />
            </div>
          </Seccion>
        </>
      )}

      <Seccion id="laboratorio" letra="f" titulo="Laboratorio" bajada="Un experimento a medida sobre el escenario del editor, en vivo. Con los mismos gráficos y el mismo criterio de selección.">
        <Laboratorio estudio={estudio} />
      </Seccion>
    </div>
  );
}
