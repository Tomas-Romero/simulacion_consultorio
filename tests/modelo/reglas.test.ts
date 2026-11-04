/**
 * Reglas del flujo del paciente, con días armados a mano (atención constante
 * de 15 min, sin admisión) para que cada resultado se pueda calcular de memoria.
 */
import { describe, expect, it } from 'vitest';
import { prepararEscenario, simularDia, type PacienteTraza } from '../../src/modelo';
import { conTurno, dia, escenarioReglas, espontaneo, h, profesionalPrueba } from './ayudantes-modelo';

const porClave = (pacientes: PacienteTraza[], i: number): PacienteTraza => pacientes.find((p) => p.id === i)!;

describe('selección del médico al quedar libre: (a) urgencia, (b) puntual por hora, (c) tardío, (d) espontáneo', () => {
  // El médico llega 09:00 (demora 60) y encuentra a los cinco esperando.
  const pacientes = [
    espontaneo('clinica', h(8, 10)), // 0
    conTurno(0, 'clinica', h(8, 0), h(8, 20)), // 1: tardío (llega 20 min después)
    conTurno(0, 'clinica', h(8, 30), h(8, 25)), // 2: puntual 08:30
    espontaneo('clinica', h(8, 40), { urgencia: true }), // 3: urgencia
    conTurno(0, 'clinica', h(8, 15), h(8, 14)), // 4: puntual 08:15
  ];

  it('atiende en el orden U, 08:15, 08:30, tardío, espontáneo', () => {
    const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 60)]));
    const res = simularDia(prep, { semilla: 1, dia: dia(pacientes, [60]) });
    const inicio = (i: number) => porClave(res.pacientes, i).inicioConsulta;
    expect([inicio(3), inicio(4), inicio(2), inicio(1), inicio(0)]).toEqual([h(9), h(9, 15), h(9, 30), h(9, 45), h(10)]);
    expect(porClave(res.pacientes, 1).claseFinal).toBe('tardio');
    expect(porClave(res.pacientes, 3).claseFinal).toBe('urgencia');
    // Espera desde max(llegada, hora del turno): la demora del médico se imputa.
    expect(porClave(res.pacientes, 4).espera).toBe(h(9, 15) - h(8, 15));
    expect(porClave(res.pacientes, 2).espera).toBe(h(9, 30) - h(8, 30));
    expect(porClave(res.pacientes, 1).espera).toBe(h(9, 45) - h(8, 20));
  });

  it('política "pierde_turno": el tardío se pierde con motivo tardio_rechazado', () => {
    const base = escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 60)]);
    const prep = prepararEscenario({ ...base, puntualidad: { ...base.puntualidad, politicaTardios: 'pierde_turno' } });
    const res = simularDia(prep, { semilla: 1, dia: dia(pacientes, [60]) });
    expect(porClave(res.pacientes, 1).motivoPerdida).toBe('tardio_rechazado');
    expect(res.metricas.perdidos.tardio_rechazado).toBe(1);
    expect(porClave(res.pacientes, 0).inicioConsulta).toBe(h(9, 45));
  });
});

describe('admisión de espontáneos', () => {
  const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 0)]));

  it('sin profesional de la especialidad → sin_profesional; últimos 30 min del turno → fuera_de_horario', () => {
    const res = simularDia(prep, {
      semilla: 1,
      dia: dia([espontaneo('pediatria', h(9)), espontaneo('clinica', h(13, 45)), espontaneo('clinica', h(15)), espontaneo('clinica', h(13, 29))], [0]),
    });
    expect(res.pacientes.map((p) => p.motivoPerdida)).toEqual(['sin_profesional', 'fuera_de_horario', 'sin_profesional', null]);
    expect(res.metricas.perdidos).toEqual({ tardio_rechazado: 0, abandono: 0, fuera_de_horario: 1, sin_profesional: 2 });
  });

  it('abandono al agotar la paciencia; las urgencias nunca abandonan', () => {
    const tarde = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 60)]));
    const res = simularDia(tarde, {
      semilla: 1,
      dia: dia([espontaneo('clinica', h(8, 10), { paciencia: 10 }), espontaneo('clinica', h(8, 10), { paciencia: 10, urgencia: true })], [60]),
    });
    expect(res.pacientes[0]!.motivoPerdida).toBe('abandono');
    expect(res.pacientes[0]!.salida).toBe(h(8, 20));
    expect(res.pacientes[1]!.inicioConsulta).toBe(h(9));
  });
});

describe('fin de turno y traspaso entre profesionales', () => {
  const pacientes = [
    conTurno(0, 'clinica', h(13), h(13)), // 13:00–13:30 (D = 30)
    conTurno(0, 'clinica', h(13, 30), h(13, 30)), // 13:30–14:00
    espontaneo('clinica', h(13, 25)), // admitido antes del cierre de las 13:30
  ];

  it('con un clínico de tarde en turno, el de mañana se va a las 14:00 y el espontáneo lo atiende el de tarde al llegar', () => {
    const prep = prepararEscenario(
      escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 0, 30), profesionalPrueba('P2', 'clinica', 'tarde', 30, 30)]),
    );
    const res = simularDia(prep, { semilla: 1, dia: dia(pacientes, [0, 30]) });
    expect(res.pacientes[2]!.atendidoPor).toBe('P2');
    expect(res.pacientes[2]!.inicioConsulta).toBe(h(14, 30));
    expect(res.metricas.porProfesional[0]!.salida).toBe(h(14));
    expect(res.metricas.porProfesional[0]!.horasExtra).toBe(0);
  });

  it('sin nadie más de la especialidad, el de mañana se queda y lo atiende (horas extra)', () => {
    const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 0, 30)]));
    const res = simularDia(prep, { semilla: 1, dia: dia(pacientes, [0]) });
    expect(res.pacientes[2]!.atendidoPor).toBe('P1');
    expect(res.pacientes[2]!.inicioConsulta).toBe(h(14));
    expect(res.metricas.porProfesional[0]!.horasExtra).toBe(30);
  });

  it('el médico espera a su paciente hasta hora + tolerancia antes de irse', () => {
    // Turno 14:00 (un sobreturno "final"), ausente: el médico espera hasta 14:15.
    const prep = prepararEscenario(escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 0)]));
    const res = simularDia(prep, { semilla: 1, dia: dia([conTurno(0, 'clinica', h(14), h(14), { ausente: true, origen: 'sobreturno' })], [0]) });
    expect(res.metricas.porProfesional[0]!.salida).toBe(h(14, 15));
    expect(res.metricas.ausentes).toBe(1);
  });
});

describe('adelantar turnos', () => {
  const pacientes = [conTurno(0, 'clinica', h(9, 30), h(9))];
  it('con adelanto se atiende al llegar; sin adelanto, a su hora (y el médico queda ocioso)', () => {
    const base = escenarioReglas([profesionalPrueba('P1', 'clinica', 'manana', 0)]);
    const con = simularDia(prepararEscenario(base), { semilla: 1, dia: dia(pacientes, [0]) });
    const sin = simularDia(prepararEscenario({ ...base, puntualidad: { ...base.puntualidad, adelantarTurnos: false } }), { semilla: 1, dia: dia(pacientes, [0]) });
    expect(con.pacientes[0]!.inicioConsulta).toBe(h(9));
    expect(con.pacientes[0]!.espera).toBe(0);
    expect(sin.pacientes[0]!.inicioConsulta).toBe(h(9, 30));
    expect(sin.metricas.ocio).toBeCloseTo(360 - 15, 9);
  });
});
