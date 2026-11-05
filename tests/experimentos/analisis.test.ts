/**
 * Análisis sobre datos sintéticos de resultado conocido: diferencias pareadas, conjunto de óptimos
 * indistinguibles con Bonferroni, regla de duplicar R, reponderación de costos y CRN del ausentismo.
 */
import { describe, expect, it } from 'vitest';
import { generarDia, prepararEscenario, PRESET_CONSULTORIO_CHICO, PRESET_POLICONSULTORIO_3 } from '../../src/modelo';
import {
  aplicarNivel,
  analizarSerie,
  ajusteLogLog,
  ausentismoMedio,
  beneficioDiario,
  beta0ParaAusentismo,
  columna,
  correrConPrecision,
  costoDiario,
  costosDe,
  crearSerie,
  diferencia,
  EjecutorLocal,
  extenderSeries,
  KS,
  OPCIONES_ESTUDIO,
  requiereMasReplicas,
} from '../../src/experimentos';

const n = 100;
const ruido = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) * 50);
const serie = (medias: number[], extra: (k: number, r: number) => number = () => 0) => medias.map((mu, k) => Float64Array.from(ruido, (z, r) => mu + z + extra(k, r)));

describe('diferencias pareadas y conjunto de óptimos indistinguibles', () => {
  it('con ruido común, la diferencia pareada es exacta (semiancho 0) aunque cada B tenga mucha varianza', () => {
    const [a, b] = serie([100, 130]);
    const d = diferencia(b!, a!);
    expect(d.media).toBeCloseTo(30, 9);
    expect(d.semi).toBeCloseTo(0, 9);
  });

  it('empate exacto: el conjunto tiene los dos mejores y se recomienda el menor k', () => {
    const Bs = serie([100, 200, 200, 150, 120, 110, 90]);
    const a = analizarSerie(KS, Bs, Bs.map((x) => x.map((v) => -v)));
    expect(a.kHat).toBe(1);
    expect(a.conjunto).toEqual([1, 2]);
    expect(a.kRec).toBe(1);
  });

  it('Bonferroni: una diferencia significativa al 95 % individual queda indistinguible al nivel conjunto', () => {
    // D = 2,3 ± 10 (alternado): semiancho 95 % ≈ 1,99 (< 2,3) pero con nivel 1 − 0,05/6 ≈ 2,69 (> 2,3).
    const alt = (r: number): number => (r % 2 === 0 ? 10 : -10);
    const Bs = serie([0, 1000, 1000 - 2.3, 0, 0, 0, 0], (k, r) => (k === 2 ? alt(r) : 0));
    const ind = diferencia(Bs[1]!, Bs[2]!, 0.95);
    expect(ind.inf).toBeGreaterThan(0);
    const a = analizarSerie(KS, Bs, Bs);
    expect(a.nivelBonferroni).toBeCloseTo(1 - 0.05 / 6, 12);
    expect(a.conjunto).toEqual([1, 2]);
  });

  it('regla de duplicar R: se activa si una diferencia consecutiva junto al óptimo tiene semiancho > umbral', () => {
    const Bs = serie([0, 5000, 9000, 8000, 0, 0, 0], (k, r) => (k === 2 ? (r % 2 === 0 ? 30000 : -30000) : 0));
    const a = analizarSerie(KS, Bs, Bs);
    expect(a.kHat).toBe(2);
    expect(requiereMasReplicas(a, 3000)).toBe(true);
    expect(requiereMasReplicas(a, 1e9)).toBe(false);
    // Lejos del óptimo una diferencia ruidosa no cuenta.
    const b = analizarSerie(KS, serie([0, 5000, 9000, 8000, 0, 0, 0], (k, r) => (k === 6 ? (r % 2 === 0 ? 30000 : -30000) : 0)), Bs);
    expect(requiereMasReplicas(b, 3000)).toBe(false);
  });

  it('duplicar R en la práctica: con umbral imposible llega a Rmax; con umbral holgado se queda en R0', async () => {
    const mk = () => crearSerie('chico', KS.map((k) => aplicarNivel(PRESET_CONSULTORIO_CHICO, { k, politica: 'intercalado', ausentismo: null })));
    const costos = [costosDe(PRESET_CONSULTORIO_CHICO)];
    const estricta = mk();
    await correrConPrecision(new EjecutorLocal(), [estricta], costos, { ...OPCIONES_ESTUDIO, R0: 20, Rmax: 80, umbral: 0 }, 'prueba');
    expect(estricta.R).toBe(80);
    const holgada = mk();
    await correrConPrecision(new EjecutorLocal(), [holgada], costos, { ...OPCIONES_ESTUDIO, R0: 20, Rmax: 80, umbral: 1e12 }, 'prueba');
    expect(holgada.R).toBe(20);
  });

  it('ajuste log-log de un semiancho ∝ R^(−1/2): pendiente −0,5', () => {
    const R = [125, 250, 500, 1000, 2000];
    expect(ajusteLogLog(R, R.map((r) => 4000 / Math.sqrt(r))).pendiente).toBeCloseTo(-0.5, 12);
  });
});

describe('reponderación de costos y CRN del ausentismo', () => {
  it('con los costos del escenario, B y C reponderados coinciden con los del modelo', async () => {
    const s = crearSerie('poli', [aplicarNivel(PRESET_POLICONSULTORIO_3, { k: 3, politica: 'intercalado', ausentismo: null })]);
    await extenderSeries(new EjecutorLocal(), [{ serie: s, R: 60 }], 7);
    const c = costosDe(PRESET_POLICONSULTORIO_3);
    const B = beneficioDiario(s.datos[0]!, 60, c);
    const C = costoDiario(s.datos[0]!, 60, c);
    const Bm = columna(s.datos[0]!, 60, 'beneficio');
    const Cm = columna(s.datos[0]!, 60, 'costo');
    for (let r = 0; r < 60; r++) {
      expect(B[r]).toBeCloseTo(Bm[r]!, 4);
      expect(C[r]).toBeCloseTo(Cm[r]!, 4);
    }
    // Con otro factor de c_extra cambia solo la parte de horas extra.
    const B2 = beneficioDiario(s.datos[0]!, 60, { ...c, factorExtra: 2 });
    const extraOcio = columna(s.datos[0]!, 60, 'extraOcio');
    for (let r = 0; r < 60; r++) expect(B[r]! - B2[r]!).toBeCloseTo(0.5 * extraOcio[r]!, 4);
  });

  it('el β₀ calculado da el ausentismo medio pedido', () => {
    for (const p of [0.05, 0.15, 0.3]) expect(ausentismoMedio({ ...PRESET_POLICONSULTORIO_3, ausentismo: { ...PRESET_POLICONSULTORIO_3.ausentismo, beta0: beta0ParaAusentismo(PRESET_POLICONSULTORIO_3, p) } })).toBeCloseTo(p, 9);
  });

  it('cambiar β₀ preserva los atributos de los pacientes (CRN): solo cambia quién falta, y con más ausentismo faltan los mismos y algunos más', () => {
    const bajo = prepararEscenario(aplicarNivel(PRESET_POLICONSULTORIO_3, { k: 2, politica: 'intercalado', ausentismo: 0.1 }));
    const alto = prepararEscenario(aplicarNivel(PRESET_POLICONSULTORIO_3, { k: 2, politica: 'intercalado', ausentismo: 0.25 }));
    let masAusentes = 0;
    for (let r = 0; r < 20; r++) {
      const a = generarDia(bajo, 99, r);
      const b = generarDia(alto, 99, r);
      expect(b.pacientes.length).toBe(a.pacientes.length);
      expect(b.demoras).toEqual(a.demoras);
      a.pacientes.forEach((p, i) => {
        const q = b.pacientes[i]!;
        const { ausente: _a, pNoShow: _p, ...restoA } = p;
        const { ausente: _b, pNoShow: _q, ...restoB } = q;
        expect(restoB).toEqual(restoA);
        if (p.ausente) expect(q.ausente).toBe(true);
        if (q.ausente && !p.ausente) masAusentes++;
      });
    }
    expect(masAusentes).toBeGreaterThan(0);
  });
});
