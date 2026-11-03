import { describe, expect, it } from 'vitest';
import { EsquemaTraza, MonticuloBinario, Recurso, Simulador, simularMMc, type Entidad } from '../../src/motor';

describe('montículo binario', () => {
  it('extrae en orden', () => {
    const h = new MonticuloBinario<number>((a, b) => a < b);
    for (const x of [5, 3, 9, 1, 7, 3, 0]) h.insertar(x);
    const salida: number[] = [];
    while (h.tamano) salida.push(h.extraerMinimo()!);
    expect(salida).toEqual([0, 1, 3, 3, 5, 7, 9]);
  });
});

describe('simulador de eventos discretos', () => {
  it('procesa por tiempo, después prioridad y después orden de programación', () => {
    const sim = new Simulador();
    const orden: string[] = [];
    sim.programarEn(5, () => orden.push('t5-a'));
    sim.programarEn(2, () => orden.push('t2'));
    sim.programarEn(5, () => orden.push('t5-b'));
    sim.programarEn(5, () => orden.push('t5-prio'), '', -1);
    sim.programarEn(1, () => sim.programar(4, () => orden.push('t5-desde-t1')));
    sim.ejecutar();
    expect(orden).toEqual(['t2', 't5-prio', 't5-a', 't5-b', 't5-desde-t1']);
    expect(sim.reloj).toBe(5);
  });

  it('cancelar un evento evita que se ejecute', () => {
    const sim = new Simulador();
    let ejecutado = false;
    const ev = sim.programarEn(3, () => (ejecutado = true));
    sim.programarEn(1, () => sim.cancelar(ev));
    sim.ejecutar();
    expect(ejecutado).toBe(false);
  });

  it('no permite programar en el pasado', () => {
    const sim = new Simulador();
    sim.programarEn(10, () => {
      expect(() => sim.programarEn(5, () => {})).toThrow();
    });
    sim.ejecutar();
  });

  it('ejecutarHasta deja el reloj en el horizonte y conserva los eventos futuros', () => {
    const sim = new Simulador();
    sim.programarEn(3, () => {});
    sim.programarEn(30, () => {});
    sim.ejecutarHasta(10);
    expect(sim.reloj).toBe(10);
    expect(sim.eventosPendientes).toBe(1);
  });
});

describe('recurso con cola', () => {
  /** 4 entidades llegan en t = 0, 1, 2, 3 con prioridades 2, 2, 0, 1; servicio de 10. */
  function escenario(disciplina: 'FIFO' | 'PRIORIDAD'): { atendidos: number[]; sim: Simulador; r: Recurso } {
    const sim = new Simulador({ traza: true });
    const r = new Recurso(sim, 'consultorio', 1, disciplina);
    const atendidos: number[] = [];
    [2, 2, 0, 1].forEach((prioridad, i) => {
      sim.programarEn(i, () => {
        const e = sim.crearEntidad('paciente');
        sim.registrar(e, 'llegada');
        r.solicitar(
          e,
          () => {
            atendidos.push(e.id);
            sim.programar(10, () => {
              r.liberar(e);
              sim.registrar(e, 'salida');
            });
          },
          { prioridad },
        );
      });
    });
    sim.ejecutar();
    return { atendidos, sim, r };
  }

  /** Servicio de duración fija para los tests de cola. */
  function servir(sim: Simulador, r: Recurso, e: Entidad, atendidos: number[], duracion = 10): () => void {
    return () => {
      atendidos.push(e.id);
      sim.programar(duracion, () => r.liberar(e));
    };
  }

  it('FIFO atiende por orden de llegada', () => {
    expect(escenario('FIFO').atendidos).toEqual([0, 1, 2, 3]);
  });

  it('PRIORIDAD atiende primero la menor prioridad (el 0 sería una urgencia)', () => {
    expect(escenario('PRIORIDAD').atendidos).toEqual([0, 2, 3, 1]);
  });

  it('a igual prioridad ordena por `orden` (p. ej. hora del turno) y después por llegada', () => {
    const sim = new Simulador();
    const r = new Recurso(sim, 'consultorio', 1, 'PRIORIDAD');
    const atendidos: number[] = [];
    for (const orden of [0, 30, 10, 10]) {
      const e = sim.crearEntidad('p');
      r.solicitar(e, servir(sim, r, e, atendidos, 1), { prioridad: 1, orden });
    }
    sim.ejecutar();
    expect(atendidos).toEqual([0, 2, 3, 1]);
  });

  it('estadísticas: espera, ocupación y largo de cola ponderado por tiempo', () => {
    const { r, sim } = escenario('FIFO');
    // Inicios en 0, 10, 20, 30 → esperas 0, 9, 18, 27 (media 13,5). Ocupado todo [0, 40].
    expect(sim.reloj).toBe(40);
    expect(r.esperas.media).toBeCloseTo(13.5, 12);
    expect(r.ocupados.media(40)).toBeCloseTo(1, 12);
    // En cola: 1 en [1,2), 2 en [2,3), 3 en [3,10), 2 en [10,20), 1 en [20,30) → ∫ = 1 + 2 + 21 + 20 + 10 = 54
    expect(r.enCola.integral(40)).toBeCloseTo(54, 12);
  });

  it('retirar (abandono) saca de la cola sin atender', () => {
    const sim = new Simulador({ traza: true });
    const r = new Recurso(sim, 'consultorio', 1);
    const atendidos: number[] = [];
    const [a, b, c] = [sim.crearEntidad('p'), sim.crearEntidad('p'), sim.crearEntidad('p')];
    r.solicitar(a, servir(sim, r, a, atendidos));
    const sb = r.solicitar(b, servir(sim, r, b, atendidos));
    r.solicitar(c, servir(sim, r, c, atendidos));
    sim.programarEn(5, () => expect(r.retirar(sb)).toBe(true));
    sim.ejecutar();
    expect(atendidos).toEqual([a.id, c.id]);
    expect(r.retirar(sb)).toBe(false);
    expect(r.enCola.actual).toBe(0);
    expect(sim.traza.deEntidad(b.id).map((x) => x.tipo)).toEqual(['entra_cola', 'abandono']);
  });

  it('cambiarCapacidad: sin médico no se atiende; al llegar empieza la cola', () => {
    const sim = new Simulador();
    const r = new Recurso(sim, 'consultorio', 0);
    const inicios: number[] = [];
    r.solicitar(sim.crearEntidad('p'), () => inicios.push(sim.reloj));
    sim.programarEn(12, () => r.cambiarCapacidad(1));
    sim.ejecutar();
    expect(inicios).toEqual([12]);
  });
});

describe('traza y determinismo', () => {
  const cfg = { lambdaPorHora: 10, muPorHora: 4, c: 3, calentamiento: 0, duracion: 8 * 60, semilla: 42, replica: 0, traza: true };

  it('la misma semilla reproduce exactamente la misma traza', () => {
    const a = simularMMc(cfg);
    const b = simularMMc(cfg);
    expect(a.traza.length).toBeGreaterThan(100);
    expect(a.traza).toEqual(b.traza);
  });

  it('otra réplica da otra traza', () => {
    expect(simularMMc({ ...cfg, replica: 1 }).traza).not.toEqual(simularMMc(cfg).traza);
  });

  it('la traza es serializable y válida según el esquema', () => {
    const { traza } = simularMMc(cfg);
    expect(EsquemaTraza.parse(JSON.parse(JSON.stringify(traza)))).toEqual(traza);
  });

  it('cada entidad recorre llegada → (cola) → inicio → fin → salida, en orden temporal', () => {
    const { traza } = simularMMc(cfg);
    const porEntidad = new Map<number, string[]>();
    for (const r of traza) porEntidad.set(r.entidad, [...(porEntidad.get(r.entidad) ?? []), r.tipo]);
    const validos = ['llegada', 'llegada,inicio_servicio', 'llegada,inicio_servicio,fin_servicio,salida'];
    for (const tipos of porEntidad.values()) {
      expect(validos).toContain(tipos.filter((t) => t !== 'entra_cola').join(','));
    }
    for (let i = 1; i < traza.length; i++) expect(traza[i]!.t).toBeGreaterThanOrEqual(traza[i - 1]!.t);
  });
});
