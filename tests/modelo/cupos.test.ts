/**
 * Cupos de demanda espontánea (#2c): no se reservan para turnos, no reciben sobreturnos
 * superpuestos y, durante su ventana, el espontáneo que espera pasa antes que el puntual.
 */
import { describe, expect, it } from 'vitest';
import { ESCENARIO_POR_DEFECTO, POLITICAS_SOBRETURNO, esSlotCupo, generarDia, prepararEscenario, simularDia, ubicarSobreturnos, type Escenario } from '../../src/modelo';
import { conTurno, dia, escenarioReglas, espontaneo, h, profesionalPrueba } from './ayudantes-modelo';

function conCupos(cadaN: number, k: number, politica: (typeof POLITICAS_SOBRETURNO)[number]): Escenario {
  return {
    ...ESCENARIO_POR_DEFECTO,
    profesionales: ESCENARIO_POR_DEFECTO.profesionales.map((p) => ({ ...p, cuposEspontaneos: { cadaN }, sobreturnos: { k, politica } })),
  };
}

describe('cupos en la agenda', () => {
  it('ubicación equiespaciada: 1 de cada N, en j mod N = ⌊N/2⌋', () => {
    expect(Array.from({ length: 12 }, (_, j) => j).filter((j) => esSlotCupo(j, 4))).toEqual([2, 6, 10]);
    expect(Array.from({ length: 9 }, (_, j) => j).filter((j) => esSlotCupo(j, 3))).toEqual([1, 4, 7]);
    expect(esSlotCupo(5, 0)).toBe(false);
  });

  for (const politica of POLITICAS_SOBRETURNO) {
    it(`un cupo nunca tiene paciente con turno ni sobreturno superpuesto (${politica}, k = 6)`, () => {
      for (const cadaN of [2, 3, 4, 6]) {
        const prep = prepararEscenario(conCupos(cadaN, 6, politica));
        for (let r = 0; r < 20; r++) {
          for (const p of generarDia(prep, 9, r).pacientes) {
            if (p.origen === 'espontaneo' || p.slot < 0) continue;
            expect(prep.esCupo[p.profesional]![p.slot], `${p.clave} en un cupo`).toBe(false);
          }
        }
      }
    });
  }

  it('los sobreturnos se reparten sobre los slots para turnos', () => {
    // 6 slots, cupos en 1 y 4 → candidatos [0, 2, 3, 5]
    const candidatos = [0, 2, 3, 5];
    expect(ubicarSobreturnos('inicio', 3, candidatos, [])).toEqual([0, 2, 3]);
    expect(ubicarSobreturnos('intercalado', 1, candidatos, [])).toEqual([3]);
    expect(ubicarSobreturnos('mayor_ausentismo', 2, candidatos, [0.1, 1, 0.3, 0.2, 1, 0.3])).toEqual([2, 5]);
    expect(ubicarSobreturnos('final', 2, candidatos, [])).toEqual([-1, -1]);
  });

  it('con cupos hay menos turnos reservados que sin cupos, y los demás conservan sus atributos', () => {
    const sin = generarDia(prepararEscenario(conCupos(0, 0, 'intercalado')), 4, 0).pacientes.filter((p) => p.origen === 'turno');
    const con = generarDia(prepararEscenario(conCupos(4, 0, 'intercalado')), 4, 0).pacientes.filter((p) => p.origen === 'turno');
    expect(con.length).toBeLessThan(sin.length);
    const mapa = new Map(sin.map((p) => [p.clave, p]));
    for (const p of con) expect({ ...mapa.get(p.clave)!, id: 0 }).toEqual({ ...p, id: 0 });
  });
});

describe('regla de selección durante un cupo', () => {
  // D = 15 y cupos cada 8 slots → cupos en los slots 4, 12, 20: el slot 4 es 09:00–09:15.
  const pacientes = [conTurno(0, 'clinica', h(8, 45), h(8, 40)), espontaneo('clinica', h(8, 30))];

  it('dentro de la ventana del cupo, el espontáneo que espera pasa antes que el puntual', () => {
    const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 60, 15, 8)]));
    const res = simularDia(prep, { semilla: 1, dia: dia(pacientes, [60]) }); // el médico llega 09:00
    expect(res.pacientes[1]!.inicioConsulta).toBe(h(9));
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(9, 15));
  });

  it('fuera de la ventana rige el orden normal: primero el puntual', () => {
    const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 75, 15, 8)]));
    const res = simularDia(prep, { semilla: 1, dia: dia(pacientes, [75]) }); // llega 09:15, ya terminó el cupo
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(9, 15));
    expect(res.pacientes[1]!.inicioConsulta).toBe(h(9, 30));
  });

  it('si no hay espontáneos esperando, el cupo no se desperdicia: atiende al puntual', () => {
    const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 60, 15, 8)]));
    const res = simularDia(prep, { semilla: 1, dia: dia([pacientes[0]!], [60]) });
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(9));
  });

  it('las urgencias siguen primero, también durante el cupo', () => {
    const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 60, 15, 8)]));
    const res = simularDia(prep, { semilla: 1, dia: dia([...pacientes, espontaneo('clinica', h(8, 50), { urgencia: true })], [60]) });
    expect(res.pacientes[2]!.inicioConsulta).toBe(h(9));
    // La urgencia usó el cupo; a las 09:15 la ventana terminó y rige el orden normal.
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(9, 15));
    expect(res.pacientes[1]!.inicioConsulta).toBe(h(9, 30));
  });
});
