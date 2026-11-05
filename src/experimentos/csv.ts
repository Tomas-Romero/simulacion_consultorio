/**
 * Tablas del estudio en CSV (coma como separador y punto decimal, para que las lea cualquier
 * herramienta). Las usan el script del estudio y los botones "CSV" de la interfaz.
 */
import type { CurvaSerie, ResultadoEstudio } from './estudio';

export function aCSV(cabecera: readonly string[], filas: readonly (readonly (string | number | boolean)[])[]): string {
  const celda = (v: string | number | boolean): string => {
    const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cabecera, ...filas].map((f) => f.map(celda).join(',')).join('\n') + '\n';
}

const filasCurva = (prefijo: (string | number)[], c: CurvaSerie): (string | number | boolean)[][] =>
  c.puntos.map((p) => [
    ...prefijo,
    c.R,
    p.k,
    p.B.media,
    p.B.inf,
    p.B.sup,
    p.C.media,
    p.C.inf,
    p.C.sup,
    p.atendidos,
    p.esperaPorAtendido,
    p.ocio,
    p.horasExtra,
    p.perdidos,
    p.abandonos,
    p.utilizacion,
    c.conjunto.includes(p.k),
    c.kHat,
    c.kRec,
    c.kC,
  ]);
const CAB_CURVA = ['R', 'k', 'B_media', 'B_ic_inf', 'B_ic_sup', 'C_media', 'C_ic_inf', 'C_ic_sup', 'atendidos', 'espera_por_atendido_min', 'ocio_min', 'horas_extra_min', 'perdidos', 'abandonos', 'utilizacion', 'en_conjunto_optimo', 'k_hat', 'k_rec', 'k_C'];

export function tablasCSV(r: ResultadoEstudio): Record<string, string> {
  return {
    'e1-curvas.csv': aCSV(['preset', 'politica', ...CAB_CURVA], r.e1.flatMap((x) => filasCurva([x.preset, x.politica], x.curva))),
    'e1-diferencias.csv': aCSV(
      ['preset', 'politica', 'R', 'tipo', 'k_de', 'k_a', 'media', 'ic_inf', 'ic_sup'],
      r.e1.flatMap((x) => [
        ...x.curva.consecutivas.map((d) => [x.preset, x.politica, x.curva.R, 'consecutiva', d.de, d.a, d.ic.media, d.ic.inf, d.ic.sup]),
        ...x.curva.contraCero.map((d) => [x.preset, x.politica, x.curva.R, 'contra_k0', 0, d.k, d.ic.media, d.ic.inf, d.ic.sup]),
        ...x.curva.contraMejor.map((d) => [x.preset, x.politica, x.curva.R, 'mejor_menos_k_bonferroni', x.curva.kHat, d.k, d.ic.media, d.ic.inf, d.ic.sup]),
      ]),
    ),
    'e2-politicas.csv': aCSV(
      ['preset', 'R_comun', 'politica', 'k_hat', 'k_rec', 'B_media', 'B_ic_inf', 'B_ic_sup', 'espera_por_atendido_min', 'ocio_min', 'horas_extra_min', 'ganadora', 'empatada_con_ganadora'],
      r.e2.flatMap((x) => x.politicas.map((p) => [x.preset, x.Rcomun, p.politica, p.k, p.kRec, p.B.media, p.B.inf, p.B.sup, p.esperaPorAtendido, p.ocio, p.horasExtra, p.politica === x.ganadora, x.empatadas.includes(p.politica)])),
    ),
    'e2-pares.csv': aCSV(
      ['preset', 'politica_a', 'politica_b', 'dif_media', 'ic_inf', 'ic_sup', 'nivel_bonferroni', 'distinguible'],
      r.e2.flatMap((x) => x.pares.map((p) => [x.preset, p.a, p.b, p.ic.media, p.ic.inf, p.ic.sup, x.nivelBonferroni, p.distinguible])),
    ),
    'e3-ausentismo.csv': aCSV(['ausentismo', 'beta0', ...CAB_CURVA], r.e3.ausentismo.flatMap((x) => filasCurva([x.p, x.beta0], x.curva))),
    'e3-costos.csv': aCSV(['factor', 'nivel', ...CAB_CURVA], [
      ...r.e3.factorExtra.flatMap((x) => filasCurva(['factor_c_extra', x.factor], x.curva)),
      ...r.e3.cEspera.flatMap((x) => filasCurva(['c_espera', x.cEspera], x.curva)),
    ]),
    'e3-mapa.csv': aCSV(['ausentismo', 'factor_c_extra', 'k_hat', 'k_rec', 'conjunto_optimo'], r.e3.mapa.map((m) => [m.p, m.factor, m.kHat, m.kRec, m.conjunto.join(' ')])),
    'e4-regla.csv': aCSV(
      ['preset', 'politica', 'ausentismo', 'N', 'pN', 'k_hat', 'conjunto_optimo', 'k_ingenua', 'perdida_ingenua', 'perdida_ingenua_inf', 'perdida_ingenua_sup', 'ingenua_en_conjunto', 'k_ajustada', 'perdida_ajustada', 'perdida_ajustada_inf', 'perdida_ajustada_sup', 'ajustada_en_conjunto', 'alfa'],
      r.e4.configuraciones.map((c) => [
        c.preset, c.politica, c.p, c.N, c.pN, c.kHat, c.conjunto.join(' '),
        c.ingenua.k, c.ingenua.perdida.media, c.ingenua.perdida.inf, c.ingenua.perdida.sup, c.ingenua.dentro,
        c.ajustada.k, c.ajustada.perdida.media, c.ajustada.perdida.inf, c.ajustada.perdida.sup, c.ajustada.dentro, r.e4.alfa,
      ]),
    ),
    'e5-riesgo.csv': aCSV(['k', 'media', 'p5', 'p25', 'p50', 'p75', 'p95', 'prob_B_menor_que_B0'], r.e5.porK.map((x) => [x.k, x.media, x.p5, x.p25, x.p50, x.p75, x.p95, x.pNegativo])),
    'e6-precision.csv': aCSV(['R', 'semiancho', 'media'], r.e6.puntos.map((p) => [p.R, p.semiancho, p.media])),
  };
}
