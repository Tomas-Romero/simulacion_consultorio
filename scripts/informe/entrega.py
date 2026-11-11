"""Versión de ENTREGA del informe (#7c): centrada en los temas de la materia y en que se entiendan los cálculos.

Problema → solución y medio → temas de la materia con un cálculo resuelto paso a paso cada uno → resultados → conclusiones.
Los cálculos resueltos salen de calculos.resolver() (Python, independiente) y se verifican contra el código y los resultados del
proyecto antes de escribir (calculos.verificar_calculos). Las cifras de la recomendación salen de cifras_recomendacion().
"""

import math

import docx_utils as u
import figuras as fg
from datos_informe import CAPTURAS, DEMO, NOMBRE_POL, NOMBRE_POL_M, NOMBRE_PRESET_M, PRESETS, RAIZ, REPO, cifras_recomendacion, ent, f, ic, icp, pct, pesos
from generar_informe import DIR_FIG, ESPECIALIDAD, PLANTILLA, SALIDA, Informe, gan

FIG_E = ["flujo", "cap_comp", "bondad", "ds_diagramas", "fluido", "e1", "e3"]
TAB_E = ["calibracion", "empirica", "thinning", "chi2", "ic", "e6", "bonferroni", "mm3", "serie", "equilibrios", "recomendacion", "riesgo",
         "ds_pol", "supuestos", "presets"]


def hhmm(t: float) -> str:
    return f"{int(t // 60):02d}:{int(t % 60):02d}"


class InformeEntrega(Informe):
    FIGURAS = FIG_E
    TABLAS = TAB_E
    SALIDA = SALIDA

    def __init__(self, d, r):
        super().__init__(d)
        self.r = r

    # ------------------------------------------------------------------ resumen
    def resumen(self):
        d = self.d
        cr = cifras_recomendacion(d)
        rmin, rmax = min(x["curva"]["R"] for x in d.est["e1"]), max(x["curva"]["R"] for x in d.est["e1"])
        fl = d.comp["fluido"]
        t = [
            "En un consultorio con turnos, una parte de los pacientes no se presenta y el médico queda ocioso. El **sobreturno** "
            "(agendar pacientes de más) recupera esas horas, pero si vienen todos aumentan la espera y las horas extra. Este trabajo "
            "decide, por simulación, cuántos sobreturnos dar por profesional y dónde ubicarlos en la agenda, con el criterio de "
            "maximizar el beneficio neto esperado por día.",
            f"Se construyó un modelo de eventos discretos del día de atención, se lo validó contra la teoría de colas (Erlang C, "
            f"Pollaczek-Khinchine, Ley de Little, Burke y Jackson) y se lo usó en experimentos Monte Carlo con números aleatorios "
            f"comunes, intervalos de confianza y comparaciones de Bonferroni, con {ent(rmin)} a {ent(rmax)} días simulados por "
            f"configuración. La recomendación es {cr['chico']['k']} sobreturnos {NOMBRE_POL[cr['chico']['politica']]} en un "
            f"consultorio de un médico, {cr['policonsultorio']['k']} {NOMBRE_POL[cr['policonsultorio']['politica']]} en un "
            f"policonsultorio de tres y {cr['centro']['k']} {NOMBRE_POL[cr['centro']['politica']]} del turno en un centro de seis, "
            f"con ganancias por día de {pesos(cr['chico']['ganancia'])}, {pesos(cr['policonsultorio']['ganancia'])} y "
            f"{pesos(cr['centro']['ganancia'])} frente a no darlos. Un modelo de dinámica de sistemas muestra que los sobreturnos "
            f"también acortan la lista de espera, y un modelo de medias subestima la espera entre "
            f"{f(min(c['desEspera']['media'] / c['fluidoEspera'] for c in fl), 1)} y {f(max(c['desEspera']['media'] / c['fluidoEspera'] for c in fl), 1)} "
            f"veces: es la variabilidad la que genera la cola.",
        ]
        u.titulo_fuera_del_indice(self.doc, "Resumen").paragraph_format.page_break_before = True
        for x in t:
            self.p(x)
        self.textos["Resumen"] = t

    # ------------------------------------------------------------------ 1
    def problema(self):
        self.h1("1. Problema y objetivo")
        self.p("Un policonsultorio atiende con turnos programados: cada profesional tiene una agenda de intervalos de duración fija "
               "(D = 15, 20 o 30 minutos) y cada intervalo se reserva con días de anticipación. Una parte de los pacientes no se "
               "presenta, y cuanto más lejano es el turno, más probable es que falte. Cada ausencia es tiempo médico que no se usa. "
               "La práctica habitual es dar **sobreturnos**: pacientes adicionales superpuestos a la agenda. Si se dan pocos, el médico "
               "queda ocioso; si se dan muchos, o se ubican mal, crece la espera, el médico termina después de hora y algunos pacientes "
               "sin turno se van sin ser atendidos (Cayirli y Veral, 2003; LaGanga y Lawrence, 2007).")
        self.p("**Objetivo:** determinar cuántos sobreturnos dar por profesional y por día (k) y dónde ubicarlos (al inicio, "
               "intercalados, en los intervalos con más probabilidad de ausencia o al final), con el criterio de maximizar el "
               "**beneficio neto esperado por día**:")
        self.ec("B = honorario · atendidos − c_espera · Σ espera − c_extra · horas extra − c_perdido · perdidos")
        self.p("Se estudian tres escenarios de ejemplo con datos ficticios: un consultorio de un médico, un policonsultorio de tres "
               "profesionales y un centro de seis. La respuesta depende de la variabilidad de la atención, de la puntualidad y de la "
               "demanda sin turno que compite por los mismos huecos, por lo que no tiene una solución analítica cerrada: se resuelve "
               "por simulación.")

    # ------------------------------------------------------------------ 2
    def solucion(self):
        self.h1("2. Solución y medio utilizado")
        self.p("Se simula un día de atención, de 08:00 a 20:00, minuto a minuto. Los pacientes con turno pueden faltar o llegar "
               "tarde; los pacientes sin turno (espontáneos) llegan durante el día y se van si esperan demasiado; todos pasan por la "
               "admisión y luego por la sala de espera, y cada médico, al quedar libre, elige al siguiente con un orden de prioridad "
               f"fijo. La {self.F('flujo')} muestra el recorrido.")
        self.p("La solución combina tres herramientas de la materia:")
        self.lista([
            "**Simulación de eventos discretos con Monte Carlo** (Cap. 1 a 3): el modelo del día se repite miles de veces con "
            "números aleatorios, y las decisiones se toman con intervalos de confianza y comparaciones pareadas.",
            "**Teoría de colas** (Cap. 3 y 5): fórmulas exactas para casos simplificados, que se usan para validar que el simulador "
            "calcula bien las esperas, y para entender por qué se forma la cola.",
            "**Dinámica de sistemas** (Cap. 7): un modelo de la lista de espera semana a semana, para ver el efecto de los "
            "sobreturnos a más largo plazo.",
        ])
        self.figura("flujo", fg.flujo_paciente(DIR_FIG / "flujo.png"), "Flujo del paciente en el modelo", ancho=14.5)
        self.p(f"El medio utilizado es una aplicación web propia que corre en el navegador y está publicada en {DEMO} (código en "
               f"{REPO}). Permite editar el escenario, ver la animación de un día y comparar el mismo día con y sin sobreturnos "
               f"({self.F('cap_comp')}), consultar los resultados de los experimentos y explorar el modelo de la lista de espera."
               ).paragraph_format.keep_with_next = True
        self.figura("cap_comp", fg.recortar_captura(CAPTURAS / "09-comparacion-policonsultorio-claro.png", DIR_FIG / "cap_comp.png"),
                    "La aplicación: el mismo día sin sobreturnos (izquierda) y con sobreturnos (derecha), con los mismos pacientes")

    # ------------------------------------------------------------------ 3
    def temas(self):
        self.h1("3. Temas de la materia aplicados")
        self.p("Cada tema se presenta con el concepto, dónde se usó en el proyecto y un cálculo resuelto paso a paso con números del "
               "proyecto. Los valores intermedios se muestran redondeados; los cálculos se hicieron con los mismos datos que usa el "
               "simulador y se controlaron contra sus resultados.")
        self.metodologia()
        self.aleatorios()
        self.montecarlo()
        self.colas()
        self.serie()
        self.dinamica_sistemas()

    def metodologia(self):
        d = self.d
        self.h2("3.1 Metodología de la simulación (Cap. 1)")
        self.p("Simular es construir un modelo del sistema y experimentar con él (Law, 2015). Se siguieron las etapas de la "
               "metodología:")
        self.lista([
            "**Formulación:** pregunta (cuántos sobreturnos y dónde) y medida de desempeño (beneficio neto B por día).",
            "**Modelo conceptual:** entidades (pacientes de cinco clases), recursos (médicos y admisión), reglas de atención y "
            "supuestos, escritos antes de programar (Anexo).",
            "**Verificación:** el programa hace lo que dice el modelo. Por ejemplo, sin ausentismo, sin demoras, sin espontáneos y con "
            "la atención igual a D, cada consulta empieza exactamente a su hora y la espera, el ocio y las horas extra dan cero; y en "
            "todo día simulado los pacientes generados son los atendidos más los perdidos más los ausentes.",
            "**Validación:** el modelo reproduce resultados conocidos de la teoría de colas (Secciones 3.4 y 3.5) y una operación "
            "plausible (calibración).",
            "**Experimentación:** réplicas Monte Carlo con números aleatorios comunes (Sección 3.3) y análisis de resultados "
            "(Capítulo 4).",
        ])
        cal = d.calibracion
        m = cal["metas"]
        nombres = [p["nombre"].split(" (")[0] for p in cal["presets"]]
        ind = [p["indicadores"] for p in cal["presets"]]
        filas = [
            ["Utilización de los médicos", f"{pct(m['utilizacion']['min'], 0)} a {pct(m['utilizacion']['max'], 0)}"] + [pct(i["utilizacion"]) for i in ind],
            ["Ausentismo", f"{pct(m['ausentismo']['min'], 0)} a {pct(m['ausentismo']['max'], 0)}"] + [pct(i["ausentismo"]) for i in ind],
            ["Espera de los turnos [min]", f"{f(m['esperaTurno']['min'], 0)} a {f(m['esperaTurno']['max'], 0)}"] + [f(i["esperaTurno"], 1) for i in ind],
            ["Horas extra por médico [min]", f"< {f(m['horasExtraPorMedico']['max'], 0)}"] + [f(i["horasExtraPorMedico"], 1) for i in ind],
            ["Abandono de espontáneos", f"< {pct(m['abandono']['max'], 0)}"] + [pct(i["abandono"]) for i in ind],
        ]
        self.p(f"Como los datos son ficticios, los escenarios se **calibraron** para que la situación sin sobreturnos sea plausible. Las "
               f"metas se fijaron antes de calibrar y no se miró el resultado de k durante la calibración ({self.T('calibracion')}, "
               f"{ent(cal['dias'])} días simulados).")
        self.tabla("calibracion", "Metas fijadas de antemano y situación lograda sin sobreturnos", ["Indicador", "Meta"] + nombres, filas,
                   anchos=[4.4, 2.4, 3, 3, 3])
        self.p("Cuatro de las cinco metas se cumplen. El abandono de los pacientes sin turno queda por encima de la meta: con la agenda "
               "llena, el espontáneo solo entra en los huecos que dejan los ausentes, y su espera depende de cada cuánto aparece un "
               "hueco. Se dejó documentado como limitación; los abandonos se cuentan como pacientes perdidos en B.")

    def aleatorios(self):
        r = self.r["transformada"]
        self.h2("3.2 Números aleatorios y generación de variables (Cap. 2)")
        self.p("Toda la aleatoriedad sale de un generador pseudoaleatorio con semilla, que entrega números U uniformes en (0, 1); con la "
               "misma semilla se repite exactamente el mismo día. Cada fuente de azar (llegadas, atención, ausentismo, paciencia…) "
               "tiene su propio flujo de números, y cada paciente usa siempre los mismos: así, agregar un sobreturno no cambia a los "
               "demás pacientes (base de los números aleatorios comunes, Sección 3.3).")
        self.h3("Transformada inversa")
        self.p("Si F es la función de distribución acumulada de una variable X, entonces X = F⁻¹(U) tiene distribución F. Cada valor "
               "aleatorio consume un solo número uniforme.")
        self.p(f"**Ejemplo 1: duración de una consulta.** La duración es D × factor de la clase × un factor aleatorio lognormal de media "
               f"1 y coeficiente de variación cv = {f(r['cv'], 1)}. Para una lognormal de media m y coeficiente cv:")
        self.ec(f"σ² = ln(1 + cv²) = ln(1 + {f(r['cv'], 1)}²) = {f(r['s2'], 4)},   σ = {f(r['sigma'], 4)}")
        self.ec(f"μ = ln(m) − σ²/2 = ln(1) − {f(r['s2'] / 2, 4)} = {f(r['mu'], 4)}")
        self.p(f"El generador entregó u = {f(r['u']['atencion'], 4)}. Con la inversa de la normal estándar, z = Φ⁻¹({f(r['u']['atencion'], 4)}) = "
               f"{f(r['z'], 4)}, y")
        self.ec(f"factor = e^{{μ + σ·z}} = e^{{{f(r['mu'], 4)} + {f(r['sigma'], 4)} · ({f(r['z'], 4)})}} = {f(r['factor'], 4)}")
        self.p(f"Para un control (factor de clase {f(r['factorControl'], 1)}) con D = {r['D']} min, la consulta dura "
               f"{f(r['factor'], 4)} × {f(r['factorControl'], 1)} × {r['D']} = **{f(r['duracion'], 2)} min**. Es una consulta corta: "
               f"u cayó en la cola izquierda (percentil {f(100 * r['u']['atencion'], 1)}).")
        self.p(f"**Ejemplo 2: paciencia de un espontáneo** (lognormal de media {f(r['pacMedia'], 0)} min y cv {f(r['pacCv'], 1)}): "
               f"σ² = ln(1 + {f(r['pacCv'], 1)}²) = {f(r['s2p'], 4)}, σ = {f(r['sigmap'], 4)}, μ = ln {f(r['pacMedia'], 0)} − {f(r['s2p'] / 2, 4)} = "
               f"{f(r['mup'], 4)}. Con u = {f(r['u']['paciencia'], 4)}, z = {f(r['zp'], 4)} y la paciencia es "
               f"e^{{{f(r['mup'], 4)} + {f(r['sigmap'], 4)}·({f(r['zp'], 4)})}} = **{f(r['paciencia'], 1)} min**: si espera más que eso, "
               f"abandona.")
        self.h3("Tabla empírica discreta (como en el TP5)")
        tabla, acum = r["tabla"], r["acum"]
        tot = sum(x["frecuencia"] for x in tabla)
        self.p(f"La anticipación con que se reservó cada turno sale de una tabla de frecuencias, igual que los tiempos de las tareas del "
               f"TP5: se calcula la frecuencia relativa acumulada y se elige el primer valor cuya acumulada alcanza a u "
               f"({self.T('empirica')}).")
        self.tabla("empirica", f"Tabla empírica de la anticipación y su acumulada (u = {f(r['u']['anticipacion'], 4)})",
                   ["Días de anticipación", "Frecuencia", "Relativa", "Acumulada", "¿Acumulada ≥ u?"],
                   [[str(x["valor"]), str(x["frecuencia"]), f(x["frecuencia"] / tot, 2), f(a, 2),
                     ("sí → elegido" if x["valor"] == r["anticipacion"] else ("sí" if a >= r["u"]["anticipacion"] else "no"))] for x, a in zip(tabla, acum)],
                   anchos=[3.2, 2.4, 2.4, 2.4, 3.2], resaltar_filas=tuple(i for i, x in enumerate(tabla) if x["valor"] == r["anticipacion"]))
        self.h3("Ausentismo según la anticipación (distribución de Bernoulli con probabilidad logística)")
        self.p("La probabilidad de faltar crece con la anticipación d del turno:")
        self.ec("p(d) = 1 / (1 + e^{−(β₀ + β₁·d)})")
        self.p(f"con β₀ = {f(r['beta0'], 4)} y β₁ = {f(r['beta1'], 3)}, elegidos para que p(1) = {f(r['p1'], 2)} y p(30) = {f(r['p30'], 2)}. "
               f"Para el turno del ejemplo, reservado con {r['anticipacion']} días: β₀ + β₁·d = {f(r['beta0'], 4)} + {f(r['beta1'], 3)} × "
               f"{r['anticipacion']} = {f(r['zlog'], 4)}, y p = 1 / (1 + e^{{{f(-r['zlog'], 4)}}}) = **{f(r['pAnt'], 4)}**. El paciente falta si "
               f"su uniforme es menor que p; salió u = {f(r['u']['falta'], 4)}, así que {'falta' if r['falta'] else 'viene'}.")
        th = self.r["thinning"]
        self.h3("Llegadas espontáneas: proceso de Poisson no homogéneo")
        hmax = max(range(len(th["tasasPorHora"])), key=lambda i: th["tasasPorHora"][i])
        h0 = int(th["inicio"] // 60) + hmax
        self.p(f"Los pacientes sin turno llegan con una tasa λ(t) que cambia hora a hora (máxima de {f(th['lmaxHora'], 1)} por hora entre "
               f"las {h0} y las {h0 + 1}). Se generan por **adelgazamiento** (Lewis y Shedler, 1979): se generan candidatos como si la tasa fuera "
               f"siempre la máxima λ* (tiempo entre candidatos exponencial, −ln(u₁)/λ*), y cada candidato en el instante t se acepta "
               f"solo si u₂ < λ(t)/λ*. La {self.T('thinning')} muestra los primeros seis candidatos de un día.")
        self.tabla("thinning", f"Adelgazamiento: primeros candidatos (λ* = {f(th['lmaxHora'], 1)} por hora)",
                   ["Candidato", "u₁", "Salto [min]", "Hora", "λ(t) [por hora]", "λ(t)/λ*", "u₂", "¿Se acepta?"],
                   [[str(i + 1), f(x["u1"], 3), f(x["salto"], 1), hhmm(x["t"]), f(60 * x["lambda"], 1), f(x["cociente"], 2), f(x["u2"], 3),
                     "sí" if x["acepta"] else "no"] for i, x in enumerate(th["candidatos"])],
                   anchos=[1.8, 1.4, 1.8, 1.4, 2.2, 1.6, 1.4, 1.8])
        acept = sum(x["acepta"] for x in th["candidatos"])
        rech = next(i for i, x in enumerate(th["candidatos"]) if not x["acepta"])
        cr = th["candidatos"][rech]
        self.p(f"El candidato {rech + 1} se rechaza porque llega en un horario de menor demanda (λ(t)/λ* = {f(cr['cociente'], 2)}) y su "
               f"u₂ = {f(cr['u2'], 3)} es mayor. De los seis candidatos se aceptan {acept}. En el día completo se esperan Σλ = "
               f"{f(th['esperado'], 1)} llegadas; en este día llegaron {th['totalMotor']}.")
        b = self.r["bondad"]
        self.h3("Bondad de ajuste: Kolmogorov-Smirnov y χ²")
        self.p(f"Para comprobar si unos datos siguen una distribución se usan dos pruebas (apuntes de cátedra, Cap. 2). Se aplicaron a "
               f"{b['n']} duraciones de controles de un profesional, generadas con el modelo, ajustadas a una lognormal (μ = "
               f"{f(b['mu'], 4)}, σ = {f(b['sigma'], 4)}, media {f(b['media'], 2)} min; {self.F('bondad')}).")
        self.figura("bondad", fg.ajuste_tiempos(self.d.grupo("P1", "control"), DIR_FIG / "bondad.png"),
                    "Duraciones de los controles: histograma con las densidades ajustadas y gráfico QQ contra la lognormal")
        self.p(f"**Kolmogorov-Smirnov** mide la mayor distancia entre la distribución empírica Fₙ y la teórica F: D = máx |Fₙ(x) − F(x)|. "
               f"La mayor distancia aparece en x = {f(b['xD'], 1)} min, donde Fₙ = {f(b['Fn'], 3)} y F = {f(b['F'], 3)}: "
               f"D = {f(b['D'], 4)}. El valor crítico al 5 % es 1,358/√n = 1,358/√{b['n']} = {f(b['critico'], 4)}; como D es menor, no se "
               f"rechaza la lognormal (valor p = {f(b['pKS'], 3)}). Con los parámetros estimados de la misma muestra este valor p es "
               f"conservador.")
        self.p(f"**χ²** agrupa los datos en k clases y compara las frecuencias observadas Oᵢ con las esperadas Eᵢ. Se usaron k = {b['k']} "
               f"clases equiprobables bajo la lognormal ajustada, de modo que en cada una se esperan E = {b['n']}/{b['k']} = "
               f"{f(b['E'], 2)} datos ({self.T('chi2')}):")
        bordes = [0] + b["bordes"] + [math.inf]
        self.tabla("chi2", "Prueba χ²: clases equiprobables, frecuencias observadas y aporte de cada clase",
                   ["Clase", "Desde [min]", "Hasta [min]", "Oᵢ", "Eᵢ", "(Oᵢ − Eᵢ)²/Eᵢ"],
                   [[str(i + 1), f(bordes[i], 2), "∞" if math.isinf(bordes[i + 1]) else f(bordes[i + 1], 2), str(o), f(b["E"], 2),
                     f((o - b["E"]) ** 2 / b["E"], 3)] for i, o in enumerate(b["obs"])] + [["Total", "", "", str(sum(b["obs"])), f(b["n"], 0), f(b["chi2"], 3)]],
                   anchos=[1.4, 2.2, 2.2, 1.4, 1.6, 2.6], tam=8.5, resaltar_filas=(len(b["obs"]),))
        self.ec(f"χ² = Σ (Oᵢ − Eᵢ)² / Eᵢ = {f(b['chi2'], 3)},   grados de libertad = k − 1 − 2 = {b['gl']}")
        self.p(f"Se restan dos grados de libertad por los dos parámetros estimados (μ y σ). El valor crítico χ²₀,₉₅ con {b['gl']} grados de "
               f"libertad es {f(b['chi2crit'], 2)}; como {f(b['chi2'], 2)} es menor, tampoco se rechaza (valor p = {f(b['pchi2'], 3)}). Con la "
               f"distribución exponencial, en cambio, las dos pruebas rechazan con p < 0,001.")

    def montecarlo(self):
        d = self.d
        ic_ = self.r["ic"]
        self.h2("3.3 Monte Carlo, intervalos de confianza y comparaciones (Cap. 3)")
        self.p("Un día simulado es una observación aleatoria. Para estimar el beneficio esperado se simulan R días independientes "
               "(réplicas) y se calcula la media con un **intervalo de confianza** basado en la t de Student:")
        self.ec("B̄ ± t₍R−1; 0,975₎ · S / √R")
        b2, b0 = ic_["b2"], ic_["b0"]
        R = ic_["R"]
        self.h3("Intervalo de confianza del beneficio")
        self.p(f"Para el policonsultorio con 2 sobreturnos donde más se falta se simularon R = {ent(R)} días. La media del beneficio diario "
               f"fue B̄ = {pesos(b2['media'])} y el desvío estándar de los días, S = {pesos(b2['S'])}. Con t₍{R - 1}; 0,975₎ = {f(ic_['t'], 4)}:")
        self.ec(f"semiancho = {f(ic_['t'], 4)} × {f(b2['S'], 0)} / √{R} = {f(ic_['t'], 4)} × {f(b2['S'], 0)} / {f(math.sqrt(R), 2)} = {pesos(b2['semi'])}")
        self.p(f"El intervalo es {icp(b2['media'] - b2['semi'], b2['media'] + b2['semi'])}: con 95 % de confianza, el beneficio esperado "
               f"por día está en ese rango. La {self.T('ic')} resume el mismo cálculo para no dar sobreturnos y para la diferencia "
               f"pareada entre ambos.")
        dif = ic_["dif"]
        self.tabla("ic", f"Intervalos de confianza al 95 % (policonsultorio, R = {ent(R)} días, t = {f(ic_['t'], 4)})",
                   ["Medida por día", "Media", "Desvío S", "Semiancho t·S/√R", "IC 95 %"],
                   [["B con k = 0", pesos(b0["media"]), pesos(b0["S"]), pesos(b0["semi"]), icp(b0["media"] - b0["semi"], b0["media"] + b0["semi"])],
                    ["B con k = 2", pesos(b2["media"]), pesos(b2["S"]), pesos(b2["semi"]), icp(b2["media"] - b2["semi"], b2["media"] + b2["semi"])],
                    ["Diferencia pareada B(2) − B(0)", pesos(dif["media"]), pesos(dif["S"]), pesos(dif["semi"]), icp(dif["media"] - dif["semi"], dif["media"] + dif["semi"])]],
                   anchos=[4.4, 2.6, 2.4, 2.8, 4.4], resaltar_filas=(2,))
        e6 = self.r["e6"]
        pts = e6["puntos"]
        self.h3("El error decrece como 1/√R")
        self.p(f"El semiancho es proporcional a 1/√R: para reducirlo a la mitad hay que cuadruplicar los días simulados. Se comprobó "
               f"simulando una misma configuración con R creciente ({self.T('e6')}): cada vez que R se duplica, el semiancho se divide "
               f"por aproximadamente √2 = {f(math.sqrt(2), 3)}. La pendiente de log(semiancho) contra log(R) es {f(e6['pendiente'], 3)}, "
               f"cercana al −0,5 teórico.")
        self.tabla("e6", "Semiancho del IC 95 % del beneficio según la cantidad de días simulados",
                   ["R [días]", "Semiancho", "Semiancho anterior / actual"],
                   [[ent(p["R"]), pesos(p["semi"]), "—" if i == 0 else f(pts[i - 1]["semi"] / p["semi"], 3)] for i, p in enumerate(pts)],
                   anchos=[3, 3.5, 4.5])
        self.h3("Diferencia pareada con números aleatorios comunes")
        var_rel = b0["S"] ** 2 + b2["S"] ** 2 - 2 * ic_["corr"] * b0["S"] * b2["S"]
        self.p(f"Para comparar k = 2 con k = 0 se usan los **mismos días** (las mismas llegadas, ausencias y duraciones) en las dos "
               f"configuraciones y se calcula la diferencia día por día, Dᵣ = B(2)ᵣ − B(0)ᵣ. Como un día malo es malo para las dos, los "
               f"resultados están muy correlacionados (correlación = {f(ic_['corr'], 3)}), y la varianza de la diferencia es mucho menor "
               f"que la suma de las varianzas:")
        self.ec("S_{D}² = S_{0}² + S_{2}² − 2·ρ·S_{0}·S_{2}")
        self.ec(f"S_{{D}}² = {f(b0['S'], 0)}² + {f(b2['S'], 0)}² − 2 × {f(ic_['corr'], 3)} × {f(b0['S'], 0)} × {f(b2['S'], 0)}   →   S_{{D}} = {f(math.sqrt(var_rel), 0)}")
        self.p(f"El desvío de la diferencia (S_{{D}} = {pesos(dif['S'])}) es menor que el de cada serie ({pesos(b0['S'])} y {pesos(b2['S'])}). Con "
               f"días independientes el semiancho de la diferencia sería t·√(S₀²/R + S₂²/R) = {pesos(ic_['semiIndep'])}; pareado es "
               f"{pesos(dif['semi'])}, {f(ic_['semiIndep'] / dif['semi'], 1)} veces más angosto. Por eso la ganancia de dar 2 sobreturnos "
               f"({pesos(dif['media'])} por día) se puede afirmar con precisión con «solo» {ent(R)} días.")
        bo = self.r["bonferroni"]
        self.h3("Bonferroni y el conjunto de óptimos indistinguibles")
        self.p(f"Para elegir k se compara el mejor estimado (k̂ = {bo['kHat']}) contra los otros {bo['m']} valores de k. Hacer muchas "
               f"comparaciones a la vez aumenta la probabilidad de declarar una diferencia que no existe. La **corrección de Bonferroni** "
               f"reparte el error: cada intervalo se construye con α/m = 0,05/{bo['m']} = {f(bo['alfaInd'], 5)}, es decir, al nivel "
               f"{pct(bo['nivel'], 2)}, con t₍{bo['R'] - 1}; 1 − α/(2m)₎ = {f(bo['t'], 4)} en lugar de {f(bo['tInd'], 4)}. Así, el nivel "
               f"conjunto de las {bo['m']} comparaciones es al menos 95 %. Los valores de k cuya diferencia con k̂ contiene al cero no se "
               f"pueden distinguir del mejor ({self.T('bonferroni')}).")
        self.tabla("bonferroni", f"Policonsultorio, donde más se falta: B(k̂ = {bo['kHat']}) − B(k) con intervalos de Bonferroni",
                   ["k", "Diferencia media", "Intervalo de Bonferroni", "¿Contiene al 0?", "¿En el conjunto?"],
                   [[str(x["k"]), pesos(x["ic"]["media"]), icp(x["ic"]["inf"], x["ic"]["sup"]), "sí" if x["ic"]["inf"] <= 0 <= x["ic"]["sup"] else "no",
                     "sí" if x["k"] in bo["conjunto"] else "no"] for x in bo["contraMejor"]],
                   anchos=[1.2, 3, 5, 2.6, 2.6])
        self.p(f"El conjunto de óptimos indistinguibles es {{{', '.join(str(k) for k in bo['conjunto'])}}}. Se recomienda el menor, "
               f"k = {min(bo['conjunto'])}: logra el mismo beneficio esperado con menos espera y menos horas extra.")

    def colas(self):
        mm = self.r["mm3"]
        self.h2("3.4 Teoría de colas (Cap. 3)")
        self.p("Para casos simplificados la teoría de colas da resultados exactos. Se usaron para **validar** el simulador: si reproduce "
               "esos valores, se gana confianza en que calcula bien colas y esperas.")
        self.h3("M/M/3 resuelto a mano (Erlang C)")
        lam, mu, c = mm["lambda"], mm["mu"], mm["c"]
        self.p(f"Llegadas de Poisson con λ = {f(lam, 0)} por hora, atención exponencial con μ = {f(mu, 0)} por hora (15 min de media) y "
               f"c = {c} servidores.")
        t = mm["terminos"]
        pasos = [
            f"Carga ofrecida: a = λ/μ = {f(lam, 0)}/{f(mu, 0)} = {f(mm['a'], 2)};   utilización ρ = a/c = {f(mm['a'], 2)}/{c} = {f(mm['rho'], 4)}",
            f"Σ aⁿ/n! (n = 0 a {c - 1}) = {' + '.join(f(x, 4) for x in t)} = {f(mm['suma'], 4)}",
            f"Término de la cola: a^{{c}} / (c!·(1 − ρ)) = {f(mm['a'] ** c, 4)} / ({math.factorial(c)} × {f(1 - mm['rho'], 4)}) = {f(mm['ultimo'], 4)}",
            f"P₀ = 1 / ({f(mm['suma'], 4)} + {f(mm['ultimo'], 4)}) = {f(mm['P0'], 5)}",
            f"Probabilidad de esperar (Erlang C): C = {f(mm['ultimo'], 4)} × {f(mm['P0'], 5)} = {f(mm['C'], 4)}",
            f"Cola media: Lq = C·ρ/(1 − ρ) = {f(mm['C'], 4)} × {f(mm['rho'], 4)} / {f(1 - mm['rho'], 4)} = {f(mm['Lq'], 4)} clientes",
            f"Espera media en cola: Wq = Lq/λ = {f(mm['Lq'], 4)}/{f(lam, 0)} h = {f(mm['Wq'], 2)} min",
            f"Tiempo en el sistema: W = Wq + 1/μ = {f(mm['Wq'], 2)} + 15 = {f(mm['W'], 2)} min;   L = λ·W = {f(mm['L'], 4)} clientes",
        ]
        for x in pasos:
            self.ec(x)
        sim = mm["sim"]
        filas = [[n, f(mm[k], 4 if k not in ("Wq", "W") else 2), f(sim[s]["media"], 4 if k not in ("Wq", "W") else 2),
                  ic(sim[s]["infSim"], sim[s]["supSim"], 4 if k not in ("Wq", "W") else 2), "sí" if sim[s]["dentroSim"] else "no"]
                 for n, k, s in [("ρ", "rho", "ρ"), ("P(esperar)", "C", "P(espera"), ("Lq [clientes]", "Lq", "Lq"), ("L [clientes]", "L", "L"),
                                 ("Wq [min]", "Wq", "Wq"), ("W [min]", "W", "W")]]
        self.p(f"La {self.T('mm3')} compara el cálculo con la simulación ({mm['replicas']} réplicas, intervalo simultáneo al 95 % con "
               f"Bonferroni sobre las seis medidas).")
        self.tabla("mm3", "M/M/3: valores calculados contra simulados", ["Medida", "Calculado", "Simulado", "IC simultáneo 95 %", "¿Lo contiene?"],
                   filas, anchos=[3, 2.4, 2.4, 4, 2.4])
        li = self.r["little"]
        self.h3("Ley de Little")
        self.p("En cualquier sistema estable, el número medio de entidades L es igual a la tasa de entrada λ por el tiempo medio de "
               "permanencia W: L = λ·W (Little, 1961). Vale para cualquier distribución y disciplina de cola. Se verificó sobre un día "
               f"simulado del policonsultorio: en {f(li['T'], 1)} minutos pasaron n = {li['n']} pacientes por el edificio.")
        self.ec(f"λ = n/T = {li['n']} / {f(li['T'], 1)} = {f(li['lambda'], 5)} por min ({f(li['lambdaHora'], 2)} por hora);   W = {f(li['W'], 2)} min")
        self.ec(f"λ·W = {f(li['lambda'], 5)} × {f(li['W'], 2)} = {f(li['lambdaW'], 4)}   y   L medido = ∫N(t)dt / T = {f(li['L'], 4)}")
        self.p("Las dos cantidades coinciden: es una prueba de que el simulador lleva bien la cuenta de los pacientes. La misma ley se usa "
               "en la dinámica de sistemas (Sección 3.6) para pasar de la lista de espera a la anticipación de los turnos.")
        pk = self.r["pk"]
        self.h3("M/G/1 y Pollaczek-Khinchine")
        self.p(f"Con un solo servidor, llegadas de Poisson y atención con distribución general de media E[S] y coeficiente de variación "
               f"cₛ, la espera media en cola es (fórmula de Pollaczek-Khinchine):")
        self.ec("Wq = ρ · E[S] · (1 + cₛ²) / (2 · (1 − ρ))")
        self.p(f"Para un médico con λ = {f(pk['lambdaHora'], 1)} pacientes por hora y atención lognormal de media E[S] = {f(pk['ES'], 0)} min y "
               f"cₛ = {f(pk['cv'], 1)}: ρ = λ·E[S] = {f(pk['lambdaHora'] / 60, 5)} × {f(pk['ES'], 0)} = {f(pk['rho'], 2)}, y")
        self.ec(f"Wq = {f(pk['rho'], 2)} × {f(pk['ES'], 0)} × (1 + {f(pk['cv'], 1)}²) / (2 × {f(1 - pk['rho'], 2)}) = {f(pk['Wq'], 2)} min")
        s = pk["sim"]
        self.p(f"La simulación dio {f(s['media'], 2)} min, con un intervalo simultáneo de {ic(s['infSim'], s['supSim'], 2)}, que contiene el "
               f"valor teórico. La fórmula muestra que la espera depende de la **variabilidad** de la atención, no solo de su media: con "
               f"atención exponencial (cₛ = 1) la misma carga daría Wq = {f(pk['WqExp'], 1)} min.")

    def serie(self):
        sr = self.r["serie"]
        jk = sr["sim"]
        total = next(v for k, v in jk.items() if k.startswith("Espera total"))
        self.h2("3.5 Línea en serie y cuello de botella (Cap. 5)")
        self.p("El paciente atraviesa una línea en serie: primero la admisión y después el consultorio. Por el **teorema de Burke** "
               "(1956), la salida de una cola M/M/c estable es un proceso de Poisson con la misma tasa que la entrada; por eso cada "
               "estación de una red de colas exponenciales se analiza por separado (**red de Jackson**, 1957) y la espera total es la "
               "suma de las esperas.")
        self.p(f"Caso de validación: λ = {f(sr['lambda'], 0)} pacientes por hora; admisión con un recepcionista y atención media "
               f"{f(sr['Eadm'], 0)} min (μ = 30 por hora); {sr['c']} consultorios con atención media {f(sr['Econs'], 0)} min (μ = 5 por hora).")
        self.ec(f"Admisión M/M/1: ρ = λ/μ = {f(sr['lambda'], 0)}/30 = {f(sr['rhoAdm'], 2)};   Wq = ρ/(μ − λ) = {f(sr['rhoAdm'], 2)}/(30 − {f(sr['lambda'], 0)}) h = {f(sr['WqAdm'], 3)} min")
        self.ec(f"Consultorios M/M/3: ρ = λ/(c·μ) = {f(sr['lambda'], 0)}/15 = {f(sr['rhoCons'], 2)};   C = {f(sr['Ccons'], 4)};   Wq = C/(c·μ − λ) = {f(sr['WqCons'], 3)} min")
        self.ec(f"Espera total = Wq adm + E[S adm] + Wq cons = {f(sr['WqAdm'], 3)} + {f(sr['Eadm'], 0)} + {f(sr['WqCons'], 3)} = {f(sr['total'], 3)} min")
        filas = [["Espera en la admisión", f(sr["WqAdm"], 3), f(jk["Wq admisión [min]"]["media"], 3), ic(jk["Wq admisión [min]"]["infSim"], jk["Wq admisión [min]"]["supSim"], 3)],
                 ["Espera en el consultorio", f(sr["WqCons"], 3), f(jk["Wq consultorio [min]"]["media"], 3), ic(jk["Wq consultorio [min]"]["infSim"], jk["Wq consultorio [min]"]["supSim"], 3)],
                 ["Espera total", f(sr["total"], 3), f(total["media"], 3), ic(total["infSim"], total["supSim"], 3)]]
        self.tabla("serie", "Línea en serie: espera calculada (Burke y Jackson) contra simulada [min]", ["Medida", "Calculada", "Simulada", "IC simultáneo 95 %"],
                   filas, anchos=[4.4, 2.6, 2.6, 4.4])
        self.p(f"La estación con mayor utilización es el **cuello de botella**: el consultorio (ρ = {f(sr['rhoCons'], 2)}) frente a la "
               f"admisión (ρ = {f(sr['rhoAdm'], 2)}), y por eso concentra casi toda la espera. En el policonsultorio pasa lo mismo: agregar "
               f"sobreturnos aumenta la cola en la sala de espera, no en la admisión, y cuando la carga extra se concentra en un momento "
               f"del día, la cola se arrastra hasta que aparece un hueco que la absorba (Capítulo 4).")

    def dinamica_sistemas(self):
        d = self.d
        ds = self.r["ds"]
        din = d.din
        self.h2("3.6 Dinámica de sistemas (Cap. 7)")
        self.p("La dinámica de sistemas (Sterman, 2000) estudia sistemas con realimentación a partir de **stocks** (acumulaciones) y "
               "**flujos** (tasas de cambio). Se usó para la lista de espera de turnos, a escala de semanas: la lista determina con "
               "cuánta anticipación se dan los turnos, y la anticipación determina el ausentismo.")
        self.p(f"El diagrama causal ({self.F('ds_diagramas')}) tiene un bucle de **refuerzo** R1 (lista más larga → turnos más lejanos → "
               f"más ausentes → parte de ellos vuelve a pedir turno → lista más larga) y bucles de **balance**: B1, el desaliento (con "
               f"esperas largas parte de la demanda se va a otro lado), B2, el consumo de turnos, y B3, la política que ajusta k según el "
               f"ausentismo observado.")
        ruta = fg.diagramas_apilados(CAPTURAS / "28-ds-estructura-claro.png", DIR_FIG / "ds_diagramas.png")
        self.figura("ds_diagramas", ruta, "Diagrama causal y diagrama de stocks y flujos de la lista de espera", ancho=10.5)
        self.p("Ecuaciones principales (t en días):").paragraph_format.keep_with_next = True
        self.lista([
            "Capacidad: C = n · (N̄ + k) · dh / 7  [turnos/día], con n profesionales, N̄ turnos por profesional, k sobreturnos y dh días "
            "hábiles por semana.",
            "Anticipación (Ley de Little: tiempo de permanencia = stock / tasa de salida): a = L / C  [días].",
            "Turnos que se dan: S = mín(C, L/τ)  [turnos/día], con τ = 1 día de anticipación mínima.",
            "Stock: dL/dt = D·(1 − d(a)) + r·p(a)·S − S  [pacientes/día], donde D es la demanda, d(a) el desaliento, p(a) el ausentismo "
            "y r la fracción de ausentes que vuelve a pedir turno.",
        ])
        self.h3("Equilibrio y demanda base")
        self.p(f"La demanda base D₀ se eligió para que, sin sobreturnos, la lista esté en equilibrio (dL/dt = 0) con la anticipación media "
               f"del modelo del día, a* = {f(ds['amedia'], 2)} días. Con n = {ds['n']}, N̄ = {f(ds['N'], 2)} y dh = {ds['dh']}:")
        self.ec(f"C = {ds['n']} × {f(ds['N'], 2)} × {ds['dh']} / 7 = {f(ds['C0'], 2)} turnos/día;   L* = a*·C = {f(ds['amedia'], 2)} × {f(ds['C0'], 2)} = {f(ds['L0'], 2)} pacientes")
        des = ds["desaliento"]
        self.ec(f"p(a*) = {f(ds['p'], 4)};   d(a*) = {f(des['maximo'], 1)} × ({f(ds['amedia'], 2)} − {f(des['umbral'], 0)})/{f(des['ancho'], 0)} = {f(ds['d'], 4)}")
        self.ec(f"D₀ = C·(1 − r·p)/(1 − d) = {f(ds['C0'], 2)} × (1 − {f(ds['r'], 1)} × {f(ds['p'], 4)}) / (1 − {f(ds['d'], 4)}) = {f(ds['D0'], 2)} pacientes/día")
        self.h3("Un paso de Euler")
        self.p(f"El modelo se integra numéricamente. El método de Euler avanza con la derivada al inicio del paso: L(t + Δt) = L(t) + "
               f"Δt·dL/dt. Primer paso del pico de demanda (día {ds['t0']}, la demanda sube {pct(ds['aumento'], 0)}), desde el equilibrio, "
               f"con Δt = {f(ds['dt'], 2)} día:")
        self.ec(f"D = {f(ds['D0'], 2)} × {f(1 + ds['aumento'], 1)} = {f(ds['Dpico'], 2)};   a = {f(ds['L0'], 2)}/{f(ds['C0'], 2)} = {f(ds['a'], 2)};   S = mín({f(ds['C0'], 2)}; {f(ds['L0'], 2)}) = {f(ds['S'], 2)}")
        self.ec(f"dL/dt = {f(ds['Dpico'], 2)} × (1 − {f(ds['d'], 4)}) + {f(ds['r'], 1)} × {f(ds['p'], 4)} × {f(ds['S'], 2)} − {f(ds['S'], 2)} = {f(ds['dL'], 3)} pacientes/día")
        self.ec(f"L({ds['t0']} + {f(ds['dt'], 2)}) = {f(ds['L0'], 2)} + {f(ds['dt'], 2)} × {f(ds['dL'], 3)} = {f(ds['L1'], 2)} pacientes")
        conv = din["convergencia"]["filas"]
        e1, e4 = next(x for x in conv if x["metodo"] == "euler" and x["dt"] == 1), next(x for x in conv if x["metodo"] == "euler" and x["dt"] == 0.25)
        r1 = next(x for x in conv if x["metodo"] == "rk4" and x["dt"] == 0.25)
        self.p(f"Euler tiene error proporcional a Δt: en la lista al final del horizonte, el error pasa de {f(e1['errorLfinal'], 3)} con "
               f"Δt = 1 a {f(e4['errorLfinal'], 3)} con Δt = 0,25 (cuatro veces menos). El método de Runge-Kutta de orden 4, que se usó para "
               f"los resultados, da {f(r1['errorLfinal'], 4)} con Δt = 0,25.")
        self.h3("Estabilidad del equilibrio")
        bi = d.dinamica_extra["biestabilidad"]
        eq0 = next(x for x in din["equilibrios"] if x["k"] == 0)["eqs"][0]
        self.p(f"Un equilibrio es **estable** si, al alejarse un poco, el sistema vuelve: con dL/dt = g(a), hace falta g′(a*) < 0. Con el "
               f"desaliento desde los {f(des['umbral'], 0)} días, g′ = {f(eq0['pendiente'], 2)} y el equilibrio es único y estable. Si el "
               f"desaliento empezara recién a los {bi['umbral']} días, entre 1 y {bi['umbral']} días solo actuaría el bucle de refuerzo R1 y "
               f"aparecerían tres equilibrios ({self.T('equilibrios')}): el del consultorio de hoy sería inestable, y el sistema se iría a "
               f"una lista casi vacía o a una lista larga (**biestabilidad**). Como el estado observado tiene que ser estable, se usó el "
               f"umbral de {f(des['umbral'], 0)} días.")
        self.tabla("equilibrios", f"Equilibrios sin sobreturnos si el desaliento empieza a los {bi['umbral']} días",
                   ["a* [días]", "L* [pacientes]", "Ausentismo p*", "g′(a*)", "Tipo"],
                   [[f(q["a"], 2), f(q["L"], 1), pct(q["p"], 1), f(q["pendiente"], 3), "estable" if q["estable"] else "inestable"] for q in bi["equilibrios"]],
                   anchos=[2.6, 2.8, 2.8, 2.4, 2.8])
        fl = d.comp["fluido"]
        self.h3("Modelo de medias contra eventos discretos")
        self.p(f"Un modelo fluido del día (la sala como un stock continuo, con entradas y salidas medias) se comparó con la media de "
               f"{fl[0]['R']} días simulados ({self.F('fluido')}). El modelo de medias predice cola casi nula fuera de la apertura de cada "
               f"turno, porque la capacidad media alcanza; en la simulación la variabilidad genera cola igual. La espera por paciente es "
               f"{f(fl[0]['fluidoEspera'], 2)} min en el modelo fluido contra {f(fl[0]['desEspera']['media'], 2)} min simulados sin "
               f"sobreturnos ({f(fl[0]['desEspera']['media'] / fl[0]['fluidoEspera'], 1)} veces), y {f(fl[1]['fluidoEspera'], 2)} contra "
               f"{f(fl[1]['desEspera']['media'], 2)} min con k = {fl[1]['k']}. Es la misma lección de Pollaczek-Khinchine: la decisión de "
               f"sobreturnos no se puede tomar con un modelo de medias.")
        self.figura("fluido", fg.fluido(d.comp, DIR_FIG / "fluido.png"), "Pacientes en sala: modelo fluido contra la media de la simulación (banda: IC 95 %)")

    # ------------------------------------------------------------------ 4
    def resultados(self):
        d = self.d
        e = d.est
        self.h1("4. Resultados")
        self.p(f"El estudio simuló los tres escenarios con las cuatro políticas y k = 0 a 6 sobreturnos por profesional, con números "
               f"aleatorios comunes y entre {ent(min(x['curva']['R'] for x in e['e1']))} y {ent(max(x['curva']['R'] for x in e['e1']))} días "
               f"por configuración (se duplicaron los días donde las diferencias entre k vecinos eran poco precisas). La "
               f"{self.F('e1')} muestra la curva del beneficio según k.")
        self.figura("e1", fg.curvas_bk(e, DIR_FIG / "e1.png"),
                    "Beneficio neto medio por día según los sobreturnos por profesional, por política (banda: IC 95 %; marcador vacío: mejor k)")
        cr = cifras_recomendacion(d)
        self.p(f"Las curvas son cóncavas: los primeros sobreturnos recuperan horas que se perderían por ausencias y los siguientes cuestan "
               f"más espera y horas extra de lo que facturan. Poner los sobreturnos al final de la agenda nunca conviene. La "
               f"{self.T('recomendacion')} resume la recomendación de cada escenario; la ganancia es la diferencia pareada contra no dar "
               f"sobreturnos, sobre los mismos días.")
        self.tabla("recomendacion", "Recomendación por escenario (B por día; ganancia = diferencia pareada contra k = 0, IC 95 %)",
                   ["Escenario", "Política", "k", "Días", "B sin sobreturnos", "B recomendado", "Ganancia por día (IC 95 %)"],
                   [[NOMBRE_PRESET_M[p], NOMBRE_POL_M[cr[p]["politica"]], str(cr[p]["k"]), ent(cr[p]["R"]), pesos(cr[p]["b0"]),
                     f"{pesos(cr[p]['brec'])} ± {f(cr[p]['brecSemi'], 0)}", gan(cr[p])] for p in PRESETS],
                   anchos=[2.4, 2.3, 0.8, 1.2, 2.3, 2.9, 5.1], tam=8)
        ci, cm = d.mec("centro", "inicio")["perfil"]["totales"], d.mec("centro", "mayor_ausentismo")["perfil"]["totales"]
        pi, pm = d.mec("policonsultorio", "inicio")["perfil"]["totales"], d.mec("policonsultorio", "mayor_ausentismo")["perfil"]["totales"]
        self.p(f"**Por qué gana cada política.** Al comienzo de cada turno el médico suele quedar ocioso: llega con algo de demora y el "
               f"primer paciente puede faltar. Ese hueco absorbe un sobreturno. En el centro, donde conviene uno solo, ponerlo al inicio "
               f"llena el hueco y el día termina antes (horas extra {f(ci['horasExtra']['media'], 1)} min contra {f(cm['horasExtra']['media'], 1)} "
               f"donde más se falta). En el policonsultorio, con dos, el segundo al inicio ya forma una cola que se arrastra toda la mañana "
               f"(espera de los turnos {f(pi['esperaTurno']['media'], 2)} min contra {f(pm['esperaTurno']['media'], 2)}), y conviene "
               f"repartirlos en los intervalos donde más se falta.")
        a0, a1 = e["e3"]["ausentismo"][0], e["e3"]["ausentismo"][-1]
        ce = e["e3"]["cEspera"]
        mapa = e["e3"]["mapa"]
        ps = sorted({m["p"] for m in mapa})
        for p_ in ps:  # con la hora extra más cara el k recomendado nunca sube (afirmación del texto)
            ks = [m["kRec"] for m in sorted((m for m in mapa if m["p"] == p_), key=lambda m: m["factor"])]
            assert all(a >= b for a, b in zip(ks, ks[1:])), f"el k recomendado sube con el costo de la hora extra (p = {p_})"
        self.p(f"**Sensibilidad.** El número recomendado crece con el ausentismo: en el policonsultorio va de "
               f"{a0['curva']['kRec']} con {pct(a0['p'], 0)} de ausentismo a {a1['curva']['kRec']} con {pct(a1['p'], 0)} ({self.F('e3')}), por "
               f"lo que el ausentismo es el dato que más conviene medir en un consultorio real. Con la hora extra más cara el k "
               f"recomendado nunca sube, y el costo que se le asigna a la espera también mueve la decisión: con {pesos(ce[0]['cEspera'])} "
               f"por minuto el k recomendado es {ce[0]['curva']['kRec']}, y con {pesos(ce[-1]['cEspera'])}, {ce[-1]['curva']['kRec']}.")
        self.figura("e3", fg.sensibilidad_ausentismo(e, DIR_FIG / "e3.png"),
                    "k recomendado según el ausentismo medio (barras: conjunto de óptimos) y según ausentismo y costo de la hora extra (policonsultorio)")
        e5 = e["e5"]
        kr = cr["policonsultorio"]["k"]
        filas = [[str(x["k"]), pesos(x["media"]), pesos(x["p50"]), pct(x["pNegativo"], 1)] for x in e5["porK"] if x["k"] > 0]
        r5 = next(x for x in e5["porK"] if x["k"] == kr)
        self.p(f"**Riesgo diario.** La ganancia es un promedio: en algunos días los sobreturnos rinden menos que no darlos (vienen todos y la "
               f"sala se llena). Con el k recomendado del policonsultorio ({kr}), eso ocurre en {pct(r5['pNegativo'], 0)} de los días "
               f"({self.T('riesgo')}); con más sobreturnos la proporción crece.")
        self.tabla("riesgo", "Policonsultorio: ganancia diaria frente a k = 0 y probabilidad de un día peor", ["k", "Ganancia media", "Mediana", "P(B(k) < B(0))"],
                   filas, anchos=[1.5, 3.5, 3.5, 3.5], resaltar_filas=(kr - 1,))
        din = d.din
        pols = din["politicas"]
        prm = din["parametros"]
        nombres = ["Sin sobreturnos", f"k fijo = {din['kFijo']}", "k ajustado cada semana"]
        self.p(f"**Lista de espera.** En el modelo de dinámica de sistemas, ante un pico de demanda de +{pct(prm['pico']['aumento'], 0)} durante "
               f"{prm['pico']['duracion']} semanas, dar sobreturnos acorta la lista y baja el ausentismo ({self.T('ds_pol')}). Ajustar k cada "
               f"semana según el ausentismo observado nunca rinde menos que el k fijo, pero la diferencia es chica.")
        self.tabla("ds_pol", f"Tres políticas ante el pico de demanda ({prm['horizonteSemanas']} semanas)", ["Política", "Lista máxima", "Ausentismo máximo",
                   "Perdidos en el pico", f"Beneficio en {prm['horizonteSemanas']} semanas"],
                   [[n, f(x["Lmax"], 0), pct(x["pmax"], 1), ent(x["picoPerdidos"]), pesos(x["beneficio"])] for n, x in zip(nombres, pols)],
                   anchos=[4, 2.4, 2.8, 3, 3.8])

    # ------------------------------------------------------------------ 5
    def conclusiones(self):
        d = self.d
        cr = cifras_recomendacion(d)
        e3 = d.est["e3"]["ausentismo"]
        self.h1("5. Conclusiones y limitaciones")
        t = [
            f"La simulación permitió responder la pregunta que la teoría de colas sola no puede: con turnos programados, ausentismo que "
            f"depende de la anticipación, demanda sin turno y abandono, la cantidad y la ubicación de los sobreturnos se decide comparando "
            f"configuraciones con Monte Carlo. En los escenarios estudiados conviene dar {cr['chico']['k']} sobreturnos "
            f"{NOMBRE_POL[cr['chico']['politica']]} en un consultorio de un médico, {cr['policonsultorio']['k']} "
            f"{NOMBRE_POL[cr['policonsultorio']['politica']]} en un policonsultorio de tres y {cr['centro']['k']} "
            f"{NOMBRE_POL[cr['centro']['politica']]} del turno en un centro de seis, nunca al final de la agenda. Ninguna regla simple "
            f"reemplaza a la simulación: el resultado depende de la interacción entre ausentismo, cupos y demanda sin turno, y cada "
            f"consultorio se tiene que simular con sus datos.",
            "Los temas de la materia se usaron de forma complementaria: la generación de variables por transformada inversa, tablas "
            "empíricas y procesos de Poisson construye el día; la teoría de colas (Erlang C, Pollaczek-Khinchine, Little, Burke y "
            "Jackson) valida el simulador y explica por qué la variabilidad genera espera; los intervalos de confianza, los números "
            "aleatorios comunes y Bonferroni permiten decidir con precisión; y la dinámica de sistemas muestra el efecto de los "
            "sobreturnos sobre la lista de espera y la importancia de la estabilidad de un equilibrio.",
            f"Como recomendación práctica, un consultorio debería medir el ausentismo según la anticipación del turno (es el dato que más "
            f"mueve la decisión: el k recomendado va de {e3[0]['curva']['kRec']} a {e3[-1]['curva']['kRec']} entre {pct(e3[0]['p'], 0)} y "
            f"{pct(e3[-1]['p'], 0)} de ausentismo) y los tiempos de atención, ajustar sus distribuciones y simular antes de decidir.",
            "**Limitaciones.** Los datos son ficticios. El abandono de los pacientes sin turno queda por encima de la meta de "
            "calibración. El costo de la hora extra (1,5 veces el del tiempo ocioso) y el costo de la espera son valoraciones, y la "
            "decisión es sensible a ellos. En la lista de espera, el reingreso de los ausentes, el desaliento y el pico de demanda son "
            "supuestos sin datos, analizados de a uno.",
        ]
        for x in t:
            self.p(x)
        self.textos["Conclusiones"] = t

    def referencias(self):
        self.h1("Referencias")
        refs = [
            "Burke, P. J. (1956). The output of a queuing system. ~~Operations Research~~, 4(6), 699–704.",
            "Cayirli, T. y Veral, E. (2003). Outpatient scheduling in health care: a review of literature. ~~Production and Operations Management~~, 12(4), 519–549.",
            "Jackson, J. R. (1957). Networks of waiting lines. ~~Operations Research~~, 5(4), 518–521.",
            "LaGanga, L. R. y Lawrence, S. R. (2007). Clinic overbooking to improve patient access and increase provider productivity. ~~Decision Sciences~~, 38(2), 251–276.",
            "Law, A. M. (2015). ~~Simulation Modeling and Analysis~~ (5.ª ed.). McGraw-Hill Education.",
            "Lewis, P. A. W. y Shedler, G. S. (1979). Simulation of nonhomogeneous Poisson processes by thinning. ~~Naval Research Logistics Quarterly~~, 26(3), 403–413.",
            "Little, J. D. C. (1961). A proof for the queuing formula: L = λW. ~~Operations Research~~, 9(3), 383–387.",
            "Sterman, J. D. (2000). ~~Business Dynamics: Systems Thinking and Modeling for a Complex World~~. McGraw-Hill.",
            "Universidad Tecnológica Nacional, Facultad Regional San Rafael. Simulación: apuntes de cátedra, Capítulos 1, 2, 3, 5 y 7.",
        ]
        for x in refs:
            par = self.p(x, alinear=u.IZQUIERDA, despues=6)
            par.paragraph_format.left_indent = u.Cm(0.8)
            par.paragraph_format.first_line_indent = u.Cm(-0.8)

    def anexo(self):
        d = self.d
        self.h1("Anexo. Supuestos principales y parámetros de los escenarios")
        claves = ["S1", "S2", "S5", "S7", "S8", "S9", "S10", "S11", "S14", "S15", "S26", "S32"]
        sup = [(a, b.replace(" (S25)", "")) for a, b in d.supuestos if a in claves]
        self.tabla("supuestos", "Supuestos principales del modelo", ["N.º", "Supuesto"], [[a, b] for a, b in sup],
                   anchos=[1.2, 14.8], alinear=[u.CENTRO, u.JUSTIFICADO], tam=8.5, mantener_junta=False)
        filas = []
        for pr in d.presets:
            for prof in pr["profesionales"]:
                filas.append([pr["nombre"].split(" (")[0], prof["nombre"], ESPECIALIDAD[prof["especialidad"]], "mañana" if prof["turno"] == "manana" else "tarde",
                              str(prof["D"]), f"{prof['slots']} ({prof['slotsCupo']})", f(pr["espontaneos"]["totalDia"], 1)])
        self.tabla("presets", "Profesionales de los escenarios (intervalos de agenda: total y reservados a pacientes sin turno)",
                   ["Escenario", "Profesional", "Especialidad", "Turno", "D [min]", "Intervalos", "Espontáneos por día"], filas,
                   anchos=[2.6, 2.8, 2.4, 1.4, 1.2, 1.8, 2.2], tam=8.5, mantener_junta=False)

    def construir(self):
        self.caratula()
        self.indice()
        self.resumen()
        self.problema()
        self.solucion()
        self.temas()
        self.resultados()
        self.conclusiones()
        self.referencias()
        self.anexo()
        self.guardar()
