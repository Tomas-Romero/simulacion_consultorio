/**
 * Análisis complementarios del #5 en la pantalla de Experimentos: el mecanismo de las políticas
 * (sección b) y la regla corregida por demanda espontánea con validación dejando uno afuera (sección d).
 */
import { aCSV } from '../../../experimentos/csv';
import { NOMBRES_POLITICA } from '../../app/estado';
import { Figura } from '../../componentes/Figura';
import { TablaDatos } from '../../componentes/TablaDatos';
import { decimal, pesos } from '../../formato';
import { useComplementos } from '../../simulacion/estudio';
import { NOMBRE_PRESET, opcionPerfil } from './graficos';

const NOMBRE_REGLA = { ingenua: 'Ingenua: round(p̄·N̄)', alfa: 'Un α: round(α·p̄·N̄)', alfaBeta: 'Corregida: round(α·p̄·N̄ − β·ē)' } as const;

export function MecanismoPoliticas() {
  const c = useComplementos();
  if (!c) return <p className="cargando">Cargando el análisis del mecanismo…</p>;
  return (
    <div className="sub-seccion">
      <h3 className="subtitulo">Por qué gana cada política</h3>
      <p className="parrafo">
        Perfiles por franja de 30 minutos en el k recomendado de cada política ({c.mecanismo[0]!.configs[0]!.perfil.R} días con trazas y números aleatorios comunes). La apertura de cada turno tiene un ocio estructural: el médico llega con demora y el primer paciente puede
        faltar. Con un sobreturno por turno (centro), ponerlo al inicio llena ese hueco y el día termina antes; con dos (policonsultorio), el segundo ya forma una cola que se arrastra toda la mañana y conviene repartirlos donde más se falta.
      </p>
      {c.mecanismo.map((m, i) => (
        <div key={m.preset} className="figuras-par">
          <Figura
            numero={`8${"ac"[i]}`}
            titulo={`${NOMBRE_PRESET[m.preset]}: ocio de los médicos`}
            descripcion="Minutos por día, por franja de 30 min (todos los médicos)."
            opcion={opcionPerfil(m.configs.map((x) => ({ politica: x.politica, k: x.k, valores: x.perfil.ocio })), m.configs[0]!.perfil.t, 'min/día', (v) => decimal(v))}
            alto={260}
            archivo={`fig8${"ac"[i]}-mecanismo-ocio-${m.preset}`}
            resumen={m.configs.map((x) => `${NOMBRES_POLITICA[x.politica]}: ocio total ${decimal(x.perfil.totales.ocio.media)} min`).join('; ')}
          />
          <Figura
            numero={`8${"bd"[i]}`}
            titulo={`${NOMBRE_PRESET[m.preset]}: espera de los pacientes con turno`}
            descripcion="Espera media según la hora del turno."
            opcion={opcionPerfil(m.configs.map((x) => ({ politica: x.politica, k: x.k, valores: x.perfil.esperaTurno })), m.configs[0]!.perfil.t, 'min', (v) => decimal(v))}
            alto={260}
            archivo={`fig8${"bd"[i]}-mecanismo-espera-${m.preset}`}
            resumen={m.configs.map((x) => `${NOMBRES_POLITICA[x.politica]}: espera media ${decimal(x.perfil.totales.esperaTurno.media, 2)} min`).join('; ')}
          />
        </div>
      ))}
      <TablaDatos
        titulo="Totales por día (IC 95 %)"
        cabecera={['Escenario', 'Política (k)', 'Ocio [min]', 'Espera turno [min]', 'Horas extra [min]', 'Abandonos', 'Cupos usados', 'B']}
        derecha={[2, 3, 4, 5, 6, 7]}
        filas={c.mecanismo.flatMap((m) =>
          m.configs.map((x) => {
            const t = x.perfil.totales;
            return [NOMBRE_PRESET[m.preset], `${NOMBRES_POLITICA[x.politica]} (${x.k})`, `${decimal(t.ocio.media)} ± ${decimal(t.ocio.semi)}`, `${decimal(t.esperaTurno.media, 2)} ± ${decimal(t.esperaTurno.semi, 2)}`, `${decimal(t.horasExtra.media)} ± ${decimal(t.horasExtra.semi)}`, decimal(t.abandonos.media, 2), decimal(t.cuposUsados.media, 2), pesos(t.beneficio.media)];
          }),
        )}
        csv={{
          nombre: 'mecanismo.csv',
          contenido: aCSV(
            ['escenario', 'politica', 'k', 'franja_inicio_min', 'ocio_min', 'espera_turno_min', 'llegadas_espontaneos', 'abandonos', 'cupos_usados', 'sobreturnos_atendidos', 'ausentes'],
            c.mecanismo.flatMap((m) => m.configs.flatMap((x) => x.perfil.t.map((t, i) => [m.preset, x.politica, x.k, t, x.perfil.ocio[i]!, x.perfil.esperaTurno[i]!, x.perfil.llegadasEsp[i]!, x.perfil.abandonos[i]!, x.perfil.cuposUsados[i]!, x.perfil.sobreturnosAtendidos[i]!, x.perfil.ausentes[i]!]))),
          ),
        }}
        nota="Los cupos usados y los espontáneos son casi iguales entre políticas: la diferencia no pasa por la demanda espontánea, sino por cómo se reparten el ocio de la apertura, la espera y las horas extra."
      />
    </div>
  );
}

export function ReglaCorregida() {
  const c = useComplementos();
  if (!c) return <p className="cargando">Cargando la validación cruzada…</p>;
  const { loo, excedentes } = c.regla;
  const promedio = (nombre: 'ingenua' | 'alfa' | 'alfaBeta') => {
    const ev = loo.pliegues.map((p) => p.reglas.find((r) => r.nombre === nombre)!.evaluacion);
    return { perdida: ev.reduce((s, e) => s + e.perdida.media, 0) / ev.length, aciertos: ev.reduce((s, e) => s + e.aciertos, 0), total: ev.reduce((s, e) => s + e.total, 0) };
  };
  const desc = (r: (typeof loo.pliegues)[number]['reglas'][number]['evaluacion']['regla']): string =>
    r.tipo === 'ingenua' ? '—' : r.tipo === 'alfa' ? `α = ${decimal(r.alfa, 2)}` : `α = ${decimal(r.alfa, 2)}, β = ${decimal(r.beta, 2)}`;
  return (
    <div className="sub-seccion">
      <h3 className="subtitulo">¿Y si se corrige por la demanda espontánea?</h3>
      <p className="parrafo">
        Hipótesis: la regla falla en el centro porque los espontáneos ya llenan parte de los huecos de los ausentes. Regla corregida: k = round(α·p̄·N̄ − β·ē), con ē los espontáneos esperados por profesional y por día que exceden sus cupos (chico{' '}
        {decimal(excedentes.chico!.media, 2)}, policonsultorio {decimal(excedentes.policonsultorio!.media, 2)}, centro {decimal(excedentes.centro!.media, 2)}). Validación dejando un escenario afuera: cada regla se ajusta con dos escenarios y se evalúa en el tercero.
      </p>
      <TablaDatos
        titulo="Validación dejando un escenario afuera"
        cabecera={['Escenario evaluado', 'Regla', 'Ajuste con los otros dos', 'Pérdida media por día (IC 95 %)', 'Aciertos']}
        derecha={[3, 4]}
        filas={loo.pliegues.flatMap((p) =>
          p.reglas.map((r) => [NOMBRE_PRESET[p.afuera], NOMBRE_REGLA[r.nombre], desc(r.evaluacion.regla), r.evaluacion.perdida.media === 0 ? '$ 0' : `${pesos(r.evaluacion.perdida.media)} [${pesos(r.evaluacion.perdida.inf)}; ${pesos(r.evaluacion.perdida.sup)}]`, `${r.evaluacion.aciertos} de ${r.evaluacion.total}`]),
        )}
        destacadas={loo.pliegues.flatMap((p, i) => p.reglas.map((r, j) => (r.nombre === 'alfaBeta' ? i * 3 + j : -1))).filter((x) => x >= 0)}
        csv={{
          nombre: 'regla-loo.csv',
          contenido: aCSV(
            ['escenario_afuera', 'regla', 'alfa', 'beta', 'perdida_media', 'perdida_ic_inf', 'perdida_ic_sup', 'aciertos', 'total'],
            loo.pliegues.flatMap((p) => p.reglas.map((r) => { const g = r.evaluacion.regla; return [p.afuera, r.nombre, g.tipo === 'ingenua' ? '' : g.alfa, g.tipo === 'alfaBeta' ? g.beta : '', r.evaluacion.perdida.media, r.evaluacion.perdida.inf, r.evaluacion.perdida.sup, r.evaluacion.aciertos, r.evaluacion.total]; })),
          ),
        }}
        nota={`Promedio de los tres pliegues: ingenua ${pesos(promedio('ingenua').perdida)} y ${promedio('ingenua').aciertos} de ${promedio('ingenua').total} aciertos; un α ${pesos(promedio('alfa').perdida)} y ${promedio('alfa').aciertos} de ${promedio('alfa').total}; corregida ${pesos(promedio('alfaBeta').perdida)} y ${promedio('alfaBeta').aciertos} de ${promedio('alfaBeta').total}.`}
      />
      <p className="conclusion">
        <strong>Conclusión:</strong> la corrección va en la dirección de la hipótesis (β &gt; 0 cuando el centro entra en el ajuste, y entonces predice perfecto al consultorio chico), pero <strong>no generaliza al centro</strong>: sin él, los otros dos escenarios tienen casi el
        mismo ē y β no se puede estimar. Con tres escenarios no hay regla universal validable; round(p̄·N̄) sirve como primera aproximación cuando los cupos cubren la demanda espontánea, y <strong>hay que simular cada consultorio</strong>.
      </p>
    </div>
  );
}
