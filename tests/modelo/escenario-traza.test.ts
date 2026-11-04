import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ESCENARIO_POR_DEFECTO, EsquemaEscenario, EsquemaTrazaDia, PRESETS, prepararEscenario, simularDia } from '../../src/modelo';

describe('esquema de escenario', () => {
  it('los presets son válidos y sobreviven a JSON ida y vuelta', () => {
    expect(PRESETS).toHaveLength(3);
    for (const e of PRESETS) expect(EsquemaEscenario.parse(JSON.parse(JSON.stringify(e)))).toEqual(e);
    expect(PRESETS.map((e) => e.profesionales.length)).toEqual([1, 3, 6]);
  });

  it('rechaza escenarios inválidos', () => {
    const e = ESCENARIO_POR_DEFECTO;
    expect(() => EsquemaEscenario.parse({ ...e, profesionales: [] })).toThrow();
    expect(() => EsquemaEscenario.parse({ ...e, profesionales: Array.from({ length: 7 }, (_, i) => ({ ...e.profesionales[0]!, id: `X${i}` })) })).toThrow();
    expect(() => EsquemaEscenario.parse({ ...e, profesionales: [e.profesionales[0]!, e.profesionales[0]!] })).toThrow(); // ids repetidos
    expect(() => EsquemaEscenario.parse({ ...e, profesionales: [{ ...e.profesionales[0]!, duracionTurno: 25 }] })).toThrow();
    expect(() => EsquemaEscenario.parse({ ...e, admision: { ...e.admision, recepcionistas: 3 } })).toThrow();
    expect(() => EsquemaEscenario.parse({ ...e, jornada: { inicio: 600, cambioTurno: 500, fin: 1200 } })).toThrow();
  });
});

describe('traza del día', () => {
  const prep = prepararEscenario(ESCENARIO_POR_DEFECTO);
  const res = simularDia(prep, { semilla: 2026, traza: true });
  const traza = res.traza!;

  it('es autocontenida y válida según su esquema (JSON ida y vuelta)', () => {
    expect(EsquemaTrazaDia.parse(JSON.parse(JSON.stringify(traza)))).toEqual(traza);
    expect(traza.escenario).toEqual(ESCENARIO_POR_DEFECTO);
    expect(traza.pacientes).toHaveLength(res.metricas.llegadas);
    expect(traza.profesionales).toHaveLength(3);
  });

  it('la misma semilla reproduce la misma traza; otra réplica, otra', () => {
    expect(simularDia(prep, { semilla: 2026, traza: true }).traza).toEqual(traza);
    expect(simularDia(prep, { semilla: 2026, replica: 1, traza: true }).traza).not.toEqual(traza);
  });

  it('registros en orden temporal; cada atendido recorre llegada → … → consultorio → salida', () => {
    for (let i = 1; i < traza.registros.length; i++) expect(traza.registros[i]!.t).toBeGreaterThanOrEqual(traza.registros[i - 1]!.t);
    const porPaciente = new Map<number, typeof traza.registros>();
    for (const r of traza.registros) porPaciente.set(r.entidad, [...(porPaciente.get(r.entidad) ?? []), r]);
    for (const p of traza.pacientes.filter((x) => x.resultado === 'atendido')) {
      const regs = porPaciente.get(p.id)!;
      expect(regs[0]!.tipo).toBe('llegada');
      expect(regs[regs.length - 1]!.tipo).toBe('salida');
      const consulta = regs.find((r) => r.tipo === 'inicio_servicio' && r.etapa === 'consultorio')!;
      expect(consulta.profesional).toBe(p.atendidoPor);
      expect(consulta.t).toBe(p.inicioConsulta);
    }
  });

  it('desactivar la traza no cambia las métricas', () => {
    const sin = simularDia(prep, { semilla: 2026 });
    expect(sin.traza).toBeNull();
    expect(sin.metricas).toEqual(res.metricas);
  });
});

describe('arquitectura del modelo', () => {
  const dir = fileURLToPath(new URL('../../src/modelo', import.meta.url));
  it.each(readdirSync(dir).filter((f) => f.endsWith('.ts')))('%s solo depende del motor, de zod y del propio modelo', (archivo) => {
    const codigo = readFileSync(join(dir, archivo), 'utf-8');
    for (const [, imp] of codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      expect(imp === 'zod' || imp === '../motor' || imp!.startsWith('./'), `import no permitido: ${imp}`).toBe(true);
    }
    expect(/\b(window|document|localStorage)\./.test(codigo)).toBe(false);
  });
});
