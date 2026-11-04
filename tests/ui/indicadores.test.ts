/**
 * La animación no re-simula: los indicadores en vivo se calculan desde la traza y, al final
 * del día, tienen que coincidir con las métricas del modelo para los tres presets.
 */
import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../src/modelo';
import { indicadoresEn, seriesBC } from '../../src/ui/animacion/indicadores';
import { prepararAnimacion } from '../../src/ui/animacion/preparar';
import { ejecutarCorrida } from '../../src/ui/simulacion/corrida';

describe('indicadores en vivo de la animación', () => {
  for (const preset of PRESETS) {
    it(`al final del día coinciden con las métricas del modelo (${preset.nombre})`, () => {
      for (const replica of [0, 1, 2]) {
        const corrida = ejecutarCorrida(preset, 2026, replica);
        const d = prepararAnimacion(corrida);
        const m = corrida.metricas;
        const fin = indicadoresEn(d, d.tFin + 1e6);
        expect(fin.atendidos).toBe(m.atendidosTotal);
        expect(fin.ausentes).toBe(m.ausentes);
        expect(fin.perdidos).toEqual(m.perdidos);
        expect(fin.llegadas).toBe(m.llegadas - m.ausentes);
        expect(fin.enSala + fin.enColaAdmision + fin.enAdmision + fin.enConsulta).toBe(0);
        expect(fin.ingresos).toBeCloseTo(m.ingresos, 6);
        expect(fin.costoEspera).toBeCloseTo(m.costos.espera, 6);
        expect(fin.costoOcio).toBeCloseTo(m.costos.ocio, 6);
        expect(fin.costoExtra).toBeCloseTo(m.costos.extra, 6);
        expect(fin.B).toBeCloseTo(m.beneficio, 6);
        expect(fin.C).toBeCloseTo(m.costos.total, 6);
        fin.medicos.forEach((med, i) => {
          expect(med.ocio).toBeCloseTo(m.porProfesional[i]!.ocio, 9);
          expect(med.extra).toBeCloseTo(m.porProfesional[i]!.horasExtra, 9);
          expect(med.atendidos).toBe(m.porProfesional[i]!.atendidosTotal);
          expect(med.estado).toBe('retirado');
        });
      }
    });
  }

  it('cada paciente presente tiene una etapa coherente y las sillas no se comparten', () => {
    const d = prepararAnimacion(ejecutarCorrida(PRESETS[2]!, 7, 0));
    const ocupacion = new Map<number, [number, number][]>();
    for (const p of d.pacientes) {
      if (p.silla < 0) continue;
      const desde = p.finAdmision!;
      const hasta = p.inicioConsulta ?? p.salida!;
      for (const [a, b] of ocupacion.get(p.silla) ?? []) expect(hasta <= a || desde >= b).toBe(true);
      ocupacion.set(p.silla, [...(ocupacion.get(p.silla) ?? []), [desde, hasta]]);
    }
    expect(d.sillasMax).toBeGreaterThan(0);
    // Los espontáneos no urgentes traen su paciencia; los demás no.
    for (const p of d.pacientes) expect(p.paciencia !== null).toBe(p.origen === 'espontaneo' && !p.urgencia);
  });

  it('B y C acumulados empiezan en 0 y la serie termina en el valor del modelo', () => {
    const corrida = ejecutarCorrida(PRESETS[1]!, 11, 0);
    const d = prepararAnimacion(corrida);
    const s = seriesBC(d, 5);
    expect(s.B[0]).toBe(0);
    expect(s.B[s.B.length - 1]).toBeCloseTo(corrida.metricas.beneficio, 6);
    expect(s.C[s.C.length - 1]).toBeCloseTo(corrida.metricas.costos.total, 6);
  });
});
