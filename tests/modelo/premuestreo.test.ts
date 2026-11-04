/**
 * Pre-muestreo por identidad (base de los números aleatorios comunes del #4):
 * agregar sobreturnos no cambia ningún atributo de los demás pacientes.
 */
import { describe, expect, it } from 'vitest';
import { ESCENARIO_POR_DEFECTO, POLITICAS_SOBRETURNO, generarDia, prepararEscenario, type Escenario, type PacienteGenerado } from '../../src/modelo';

function conK(k: number, politica: (typeof POLITICAS_SOBRETURNO)[number]): Escenario {
  return { ...ESCENARIO_POR_DEFECTO, profesionales: ESCENARIO_POR_DEFECTO.profesionales.map((p) => ({ ...p, sobreturnos: { k, politica } })) };
}

/** Todos los atributos menos el id (que depende del orden de generación). */
const atributos = ({ id: _id, ...resto }: PacienteGenerado): Omit<PacienteGenerado, 'id'> => resto;

describe('pre-muestreo de atributos por identidad', () => {
  for (const politica of POLITICAS_SOBRETURNO) {
    it(`k = 0 vs k = 3 (${politica}): los pacientes comunes tienen exactamente los mismos atributos`, () => {
      for (let replica = 0; replica < 20; replica++) {
        const sin = generarDia(prepararEscenario(conK(0, politica)), 777, replica);
        const con = generarDia(prepararEscenario(conK(3, politica)), 777, replica);
        const mapa = new Map(con.pacientes.map((p) => [p.clave, p]));
        expect(con.pacientes.length - sin.pacientes.length).toBe(3 * ESCENARIO_POR_DEFECTO.profesionales.length);
        for (const p of sin.pacientes) expect(atributos(mapa.get(p.clave)!)).toEqual(atributos(p));
        expect(con.demoras).toEqual(sin.demoras);
        expect(con.pacientes.filter((p) => p.origen === 'sobreturno')).toHaveLength(9);
      }
    });
  }

  it('el sobreturno i tiene los mismos atributos aleatorios con k = 3 y k = 5 (solo cambia su hora)', () => {
    const a = generarDia(prepararEscenario(conK(3, 'intercalado')), 777, 0).pacientes.filter((p) => p.origen === 'sobreturno');
    const b = new Map(generarDia(prepararEscenario(conK(5, 'intercalado')), 777, 0).pacientes.map((p) => [p.clave, p]));
    for (const p of a) {
      const q = b.get(p.clave)!;
      for (const campo of ['ausente', 'primeraVez', 'desvioPuntualidad', 'tiempoAdmision', 'factorAtencion', 'tiempoAtencionTurno', 'paciencia'] as const) {
        expect(q[campo]).toEqual(p[campo]);
      }
    }
  });

  it('cambiar la política de tardíos o la cantidad de recepcionistas no cambia la agenda generada', () => {
    const base = prepararEscenario(ESCENARIO_POR_DEFECTO);
    const otro = prepararEscenario({
      ...ESCENARIO_POR_DEFECTO,
      puntualidad: { ...ESCENARIO_POR_DEFECTO.puntualidad, politicaTardios: 'pierde_turno' },
      admision: { ...ESCENARIO_POR_DEFECTO.admision, recepcionistas: 2 },
    });
    expect(generarDia(otro, 5, 3)).toEqual(generarDia(base, 5, 3));
  });

  it('otra réplica u otra semilla dan otro día', () => {
    const prep = prepararEscenario(ESCENARIO_POR_DEFECTO);
    expect(generarDia(prep, 5, 4)).not.toEqual(generarDia(prep, 5, 3));
    expect(generarDia(prep, 6, 3)).not.toEqual(generarDia(prep, 5, 3));
  });

  it('ubicación de sobreturnos según la política', () => {
    const horas = (politica: (typeof POLITICAS_SOBRETURNO)[number]) =>
      generarDia(prepararEscenario(conK(3, politica)), 1, 0)
        .pacientes.filter((p) => p.origen === 'sobreturno' && p.profesional === 0)
        .map((p) => p.horaTurno);
    // P1: clínica mañana, D = 15, 24 slots desde las 08:00 (480).
    expect(horas('inicio')).toEqual([480, 495, 510]);
    expect(horas('intercalado')).toEqual([480 + 6 * 15, 480 + 12 * 15, 480 + 18 * 15]);
    expect(horas('final')).toEqual([840, 855, 870]);
    // mayor ausentismo: los 3 slots con mayor P(no-show) predicha
    const dia = generarDia(prepararEscenario(conK(3, 'mayor_ausentismo')), 1, 0);
    const regulares = dia.pacientes.filter((p) => p.origen === 'turno' && p.profesional === 0);
    const esperado = [...regulares].sort((x, y) => y.pNoShow! - x.pNoShow! || x.slot - y.slot).slice(0, 3).map((p) => p.horaTurno);
    expect(horas('mayor_ausentismo')).toEqual(esperado);
  });
});
