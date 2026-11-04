/**
 * Cupos de demanda espontánea: no se reservan para turnos, no reciben sobreturnos
 * superpuestos y son acumulables (#2d): mientras el profesional tenga cupos adeudados,
 * el espontáneo que espera pasa antes que el puntual.
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

describe('regla de selección con cupos acumulables', () => {
  // D = 15 y cupos cada 8 slots → cupos en los slots 4, 12, 20: el primero empieza a las 09:00 y el segundo a las 11:00.
  const prof = (demora: number) => prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', demora, 15, 8)]));
  const pacientes = [conTurno(0, 'clinica', h(8, 45), h(8, 40)), espontaneo('clinica', h(8, 30))];

  it('con deuda de cupos (el de 09:00 ya empezó), el espontáneo que espera pasa antes que el puntual', () => {
    const res = simularDia(prof(60), { semilla: 1, dia: dia(pacientes, [60]) }); // el médico llega 09:00
    expect(res.pacientes[1]!.inicioConsulta).toBe(h(9));
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(9, 15));
  });

  it('sin deuda (antes del primer cupo) rige el orden normal: primero el puntual', () => {
    const res = simularDia(prof(45), { semilla: 1, dia: dia(pacientes, [45]) }); // llega 08:45
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(8, 45));
    // A las 09:00 empieza el cupo: deuda 1 y el espontáneo lo usa.
    expect(res.pacientes[1]!.inicioConsulta).toBe(h(9));
  });

  it('si la ventana de un cupo pasa sin espontáneos, el que llega después pasa antes que los puntuales siguientes', () => {
    const ps = [
      conTurno(0, 'clinica', h(8, 45), h(8, 45)),
      conTurno(0, 'clinica', h(9, 15), h(8, 50)),
      conTurno(0, 'clinica', h(9, 30), h(8, 50)),
      conTurno(0, 'clinica', h(9, 45), h(8, 50)),
      espontaneo('clinica', h(9, 10)),
      espontaneo('clinica', h(9, 20)),
    ];
    const res = simularDia(prof(0), { semilla: 1, dia: dia(ps, [0]) });
    const inicio = res.pacientes.map((p) => p.inicioConsulta);
    // 09:00 (cupo sin espontáneos): no se desperdicia, atiende al puntual de 09:15 adelantado.
    expect(inicio[0]).toBe(h(8, 45));
    expect(inicio[1]).toBe(h(9));
    // El cupo de 09:00 sigue adeudado: el espontáneo de 09:10 pasa antes que el puntual de 09:30.
    expect(inicio[4]).toBe(h(9, 15));
    expect(inicio[2]).toBe(h(9, 30));
    expect(inicio[3]).toBe(h(9, 45));
    // Ese espontáneo consumió el cupo: el de 09:20 espera a los puntuales.
    expect(inicio[5]).toBe(h(10));
  });

  it('atender a un espontáneo en un hueco normal (sin deuda) no consume cupo', () => {
    const ps = [
      espontaneo('clinica', h(8, 5)),
      conTurno(0, 'clinica', h(9), h(8, 55)),
      espontaneo('clinica', h(9, 5)),
      conTurno(0, 'clinica', h(9, 15), h(9, 5)),
    ];
    const res = simularDia(prof(0), { semilla: 1, dia: dia(ps, [0]) });
    const inicio = res.pacientes.map((p) => p.inicioConsulta);
    expect(inicio[0]).toBe(h(8, 5)); // hueco normal, regla (d) sin deuda
    expect(inicio[1]).toBe(h(8, 55));
    // A las 09:10 la deuda es 1 (el espontáneo de 08:05 no usó cupo): el espontáneo va primero.
    expect(inicio[2]).toBe(h(9, 10));
    expect(inicio[3]).toBe(h(9, 25));
  });

  it('si no hay espontáneos esperando, el cupo no se desperdicia: atiende al puntual', () => {
    const res = simularDia(prof(60), { semilla: 1, dia: dia([pacientes[0]!], [60]) });
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(9));
  });

  it('las urgencias siguen primero y no consumen cupo', () => {
    const res = simularDia(prof(60), { semilla: 1, dia: dia([...pacientes, espontaneo('clinica', h(8, 50), { urgencia: true })], [60]) });
    expect(res.pacientes[2]!.inicioConsulta).toBe(h(9));
    // El cupo de 09:00 sigue adeudado: el espontáneo pasa antes que el puntual.
    expect(res.pacientes[1]!.inicioConsulta).toBe(h(9, 15));
    expect(res.pacientes[0]!.inicioConsulta).toBe(h(9, 30));
  });
});
