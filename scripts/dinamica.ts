/**
 * Resultados de la dinámica de sistemas de la lista de espera (#5, cerrados en el #6): D₀ calibrado,
 * equilibrios, tres políticas ante el pico, convergencia y sensibilidad. Escribe
 * public/resultados/dinamica.json, dinamica-politicas.csv y dinamica-sensibilidad.csv.
 * Uso: npm run dinamica
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  analisisSensibilidad,
  anticipacionMediaTabla,
  capacidad,
  compararPoliticas,
  equilibrios,
  NOMBRES_PARAMETRO,
  parametrosBase,
  tablaConvergencia,
  tablaDesdeEstudio,
} from '../src/dinamica';
import { aCSV } from '../src/experimentos/csv';

const estudio = JSON.parse(readFileSync('public/resultados/estudio.json', 'utf8'));
const tb = tablaDesdeEstudio(estudio);
const kFijo = 2;
const prm = parametrosBase();
const C0 = capacidad(prm, 0);
const f = (x: number, d = 2): string => x.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

console.log('== 1.1 D₀ calibrado ==');
console.log(`anticipación media de la tabla: ${anticipacionMediaTabla(prm)} días`);
console.log(`C(0) = ${f(C0, 3)} turnos/día · D₀ = ${f(prm.demandaBase, 3)} pac/día · D₀/C(0) = ${f(prm.demandaBase / C0, 4)}`);
const eqs = [0, 1, 2, 3].map((k) => ({ k, C: capacidad(prm, k), eqs: equilibrios({ ...prm, pico: null }, k) }));
for (const e of eqs)
  for (const q of e.eqs)
    console.log(`k = ${e.k}: C = ${f(e.C, 2)} · a* = ${f(q.a, 3)} d · L* = ${f(q.L, 2)} · p* = ${f(100 * q.p, 2)} % · d* = ${f(100 * q.d, 2)} % · ${q.saturado ? 'saturado (S = C)' : 'no saturado'} · ${q.estable ? 'estable' : 'INESTABLE'} (g' = ${f(q.pendiente, 3)})`);

console.log('\n== Tres políticas ante el pico (RK4, dt = 0,25) ==');
const rs = compararPoliticas(prm, tb, kFijo);
console.log('política | L máx | a máx | p máx | aten. pico+6 | perd. pico+6 | B pico+6 | B 36 sem | perdidos 36 sem');
for (const r of rs)
  console.log(`${r.nombre} | ${f(r.Lmax, 1)} | ${f(r.amax, 2)} | ${f(100 * r.pmax, 2)} % | ${f(r.picoAtendidos, 0)} | ${f(r.picoPerdidos, 0)} | ${f(r.picoBeneficio, 0)} | ${f(r.beneficio, 0)} | ${f(r.perdidos, 0)}`);
console.log(`k adaptativo por semana: ${rs[2]!.trayectoria.semanas.map((s) => s.k).join('')}`);

console.log('\n== Convergencia (k fijo = 2) ==');
const conv = tablaConvergencia(prm, tb, kFijo);
console.log(`referencia RK4 dt 0,01: L máx ${f(conv.referencia.Lmax, 3)} · L final ${f(conv.referencia.Lfinal, 3)} · B ${f(conv.referencia.beneficio, 0)}`);
for (const c of conv.filas) console.log(`${c.metodo} dt ${c.dt}: L máx ${f(c.Lmax, 3)} (err ${c.errorLmax.toExponential(2)}) · L final ${f(c.Lfinal, 3)} (err ${c.errorLfinal.toExponential(2)}) · err B ${f(c.errorBeneficio, 0)}`);

console.log('\n== 1.2 Sensibilidad (de a un parámetro por vez; D₀ recalibrado al consultorio de hoy) ==');
const sens = analisisSensibilidad(prm, tb, kFijo);
const NOM: Record<number, string> = { [-1]: 'empate', 0: 'k = 0', 1: 'k fijo', 2: 'adaptativo' };
console.log('parámetro | valor | D₀/C | hoy estable | equilibrios | B k0 | B fijo | B adapt | ΔB adapt−fijo | perd k0 | perd fijo | perd adapt | ΔP | gana B | gana perdidos');
for (const s of sens)
  console.log(
    `${NOMBRES_PARAMETRO[s.parametro]} | ${s.valor}${s.esBase ? ' (base)' : ''} | ${f(s.demandaRelativa, 3)} | ${s.estable ? 'sí' : 'no'} | ${s.equilibrios} | ${s.politicas.map((p) => f(p.beneficio, 0)).join(' | ')} | ${f(s.difBeneficio, 0)} | ${s.politicas.map((p) => f(p.perdidos, 0)).join(' | ')} | ${f(s.difPerdidos, 0)} | ${NOM[s.ganaBeneficio]} | ${NOM[s.ganaPerdidos]}`,
  );

writeFileSync(
  'public/resultados/dinamica.json',
  JSON.stringify(
    {
      generado: 'npm run dinamica',
      kFijo,
      parametros: prm,
      capacidad0: C0,
      demandaRelativa: prm.demandaBase / C0,
      equilibrios: eqs,
      politicas: rs.map(({ trayectoria, ...r }) => ({ ...r, kSemanal: trayectoria.semanas.map((s) => s.k) })),
      convergencia: conv,
      sensibilidad: sens,
    },
    null,
    1,
  ),
);
writeFileSync(
  'public/resultados/dinamica-politicas.csv',
  aCSV(
    ['politica', 'L_max', 'a_max', 'p_max', 'atendidos_pico6', 'perdidos_pico6', 'beneficio_pico6', 'atendidos_36', 'perdidos_36', 'beneficio_36'],
    rs.map((r) => [r.nombre, r.Lmax, r.amax, r.pmax, r.picoAtendidos, r.picoPerdidos, r.picoBeneficio, r.atendidos, r.perdidos, r.beneficio]),
  ),
);
writeFileSync(
  'public/resultados/dinamica-sensibilidad.csv',
  aCSV(
    ['parametro', 'valor', 'base', 'D0_sobre_C0', 'hoy_estable', 'equilibrios', 'B_k0', 'B_fijo', 'B_adaptativo', 'dif_B_adapt_fijo', 'perdidos_k0', 'perdidos_fijo', 'perdidos_adaptativo', 'dif_perdidos_adapt_fijo', 'gana_beneficio', 'gana_perdidos'],
    sens.map((s) => [s.parametro, s.valor, s.esBase ? 1 : 0, s.demandaRelativa, s.estable ? 1 : 0, s.equilibrios, ...s.politicas.map((p) => p.beneficio), s.difBeneficio, ...s.politicas.map((p) => p.perdidos), s.difPerdidos, NOM[s.ganaBeneficio]!, NOM[s.ganaPerdidos]!]),
  ),
);
console.log('\nEscrito: public/resultados/dinamica.json, dinamica-politicas.csv, dinamica-sensibilidad.csv');
