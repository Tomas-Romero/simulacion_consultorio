"""Genera el informe final del proyecto integrador (informe/Proyecto_Integrador_Simulacion_Romero.docx).

Todos los números del texto y de las tablas se leen de public/resultados/*.json, informe/datos/*.json y
docs/*.md (ver datos_informe.py). Antes de escribir, verificar_narrativa() comprueba que los resultados
sigan respaldando cada afirmación del texto; si alguna dejó de valer, la generación se detiene.

Uso: npm run informe   (o: python scripts/informe/generar_informe.py, con informe/datos/ ya calculado)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import docx_utils as u  # noqa: E402
import figuras as fg  # noqa: E402
from datos_informe import (CAPTURAS, DEMO, NOMBRE_POL, NOMBRE_POL_M, NOMBRE_PRESET, NOMBRE_PRESET_M, POLITICAS, PRESETS,  # noqa: E402
                           RAIZ, REPO, Datos, cient, conjunto, ent, f, ic, icp, pct, pesos, verificar_narrativa)

PLANTILLA = RAIZ.parent / "Capitulo 4 - Practica TP3" / "TP4_Romero Tomas_Caminante_al_Azar.docx"
SALIDA = RAIZ / "informe" / "Proyecto_Integrador_Simulacion_Romero.docx"
DIR_FIG = RAIZ / "informe" / "figuras"
TEXTOS = RAIZ / "informe" / "textos_respuesta.md"

FIGURAS = ["flujo", "e1", "e3", "e4", "e56", "mec", "fluido", "ds_diagramas", "lista", "tornado", "conv", "ajuste", "logit",
           "cap_inicio", "cap_sim", "cap_comp", "cap_datos"]
TABLAS = ["entrada", "costos", "mmc", "modelo_val", "mutacion", "metas", "cal_hist", "cal_vigente", "diseno", "e1", "e2",
          "e3_costos", "e4", "mec", "loo", "fluido", "ds_param", "ds_eq", "ds_pol", "ds_sens", "ds_conv", "aj_grupo", "aj_recup",
          "aj_aplic", "logit", "arquitectura", "supuestos", "supuestos_ds", "presets", "tests"]
ESPECIALIDAD = {"clinica": "Clínica médica", "pediatria": "Pediatría", "cardiologia": "Cardiología", "traumatologia": "Traumatología",
                "ginecologia": "Ginecología", "dermatologia": "Dermatología"}
TIPO = {"primera_vez": "primera vez", "control": "control", "espontaneo": "espontáneo", "urgencia": "urgencia"}


class Informe:
    def __init__(self, d: Datos):
        self.d = d
        self.doc = u.crear_documento(PLANTILLA)
        self.fig = 0
        self.tab = 0
        self.textos = {}

    # ---------------------------------------------------------------- utilidades con verificación de orden
    def F(self, id_):
        return f"Figura {FIGURAS.index(id_) + 1}"

    def T(self, id_):
        return f"Tabla {TABLAS.index(id_) + 1}"

    def h1(self, texto, salto=True):
        self.doc.add_heading(texto, level=1).paragraph_format.page_break_before = salto

    def h2(self, texto):
        self.doc.add_heading(texto, level=2)

    def h3(self, texto):
        self.doc.add_heading(texto, level=3)

    def p(self, texto, **kw):
        kw.setdefault("interlineado", 1.15)
        return u.parrafo(self.doc, texto, **kw)

    def lista(self, items, numerada=False):
        u.lista(self.doc, items, numerada)

    def ec(self, texto):
        u.ecuacion(self.doc, texto)

    def figura(self, id_, ruta, texto, ancho=u.ANCHO_TEXTO_CM):
        self.fig += 1
        assert FIGURAS[self.fig - 1] == id_, f"orden de figuras: se esperaba {FIGURAS[self.fig - 1]}, llegó {id_}"
        u.figura(self.doc, ruta, self.fig, texto, ancho)

    def tabla(self, id_, texto, enc, filas, **kw):
        self.tab += 1
        assert TABLAS[self.tab - 1] == id_, f"orden de tablas: se esperaba {TABLAS[self.tab - 1]}, llegó {id_}"
        u.tabla_datos(self.doc, self.tab, texto, enc, filas, **kw)

    # ---------------------------------------------------------------- carátula, índice y resumen
    def caratula(self):
        doc = self.doc
        u.parrafo(doc, "", antes=60, despues=0, interlineado=None)
        u.parrafo(doc, "Universidad Tecnológica Nacional", alinear=u.CENTRO, despues=0, interlineado=None, tam=13, negrita=True, color=u.GRIS)
        u.parrafo(doc, "Facultad Regional San Rafael", alinear=u.CENTRO, despues=30, interlineado=None, tam=12, color=u.GRIS)
        u.parrafo(doc, "Simulación", alinear=u.CENTRO, antes=30, despues=10, interlineado=None, color=u.GRIS)
        u.parrafo(doc, "Proyecto Integrador", alinear=u.CENTRO, despues=20, interlineado=None, tam=22, negrita=True, color=u.OSCURO)
        u.parrafo(doc, "Sobreturnos: simulación de un policonsultorio", alinear=u.CENTRO, despues=5, interlineado=None, tam=17, negrita=True, color=u.NARANJA)
        u.parrafo(doc, "Cuántos sobreturnos dar y dónde ubicarlos en la agenda", alinear=u.CENTRO, despues=0, interlineado=None, tam=12, color=u.GRIS)
        linea = u.parrafo(doc, " ", alinear=u.CENTRO, antes=10, despues=0, interlineado=None)
        linea._p.get_or_add_pPr().append(u.parse_xml(
            f'<w:pBdr {u.nsdecls("w")}><w:bottom w:val="single" w:sz="8" w:space="8" w:color="{u.NARANJA}"/></w:pBdr>'))
        u.parrafo(doc, "", antes=70, despues=0, interlineado=None)
        for texto in ["Alumno: Tomás Agustín Romero", "N° Legajo: 10289", "Cátedra: Simulación", "Año 2026"]:
            u.parrafo(doc, texto, alinear=u.CENTRO, despues=4, interlineado=None, tam=12)
        u.parrafo(doc, f"Aplicación: {DEMO}", alinear=u.CENTRO, antes=40, despues=2, interlineado=None, tam=9.5, color=u.GRIS)
        u.parrafo(doc, f"Repositorio: {REPO}", alinear=u.CENTRO, despues=0, interlineado=None, tam=9.5, color=u.GRIS)

    def indice(self):
        u.titulo_fuera_del_indice(self.doc, "Índice").paragraph_format.page_break_before = True
        u.indice(self.doc)

    def resumen(self):
        d = self.d
        g = {p: d.ganadora(p) for p in PRESETS}
        k = {p: d.pol_e2(p, g[p])["kRec"] for p in PRESETS}
        b = {p: d.pol_e2(p, g[p])["B"] for p in PRESETS}
        b0 = {p: d.punto(d.e1(p, g[p]), 0)["B"]["media"] for p in PRESETS}
        din = d.din
        base = next(s for s in din["sensibilidad"] if s["esBase"])
        dentro, total, _ = d.recuperacion()
        parrafos = [
            "En la agenda de un consultorio, una parte de los pacientes con turno no se presenta. Dar **sobreturnos** "
            "recupera esas horas médicas, pero cuando vienen todos la sala se llena, crece la espera y el profesional "
            "termina en horas extra. Este trabajo construye una simulación de eventos discretos de un policonsultorio, "
            "propia y validada, para decidir cuántos sobreturnos dar por profesional y en qué lugar de la agenda, con el "
            "criterio de maximizar el beneficio neto esperado por día (ingresos menos los costos de espera, horas extra y "
            "pacientes perdidos).",
            f"El motor se validó contra la teoría de colas (M/M/c y Erlang C, M/G/1 y Pollaczek-Khinchine, una red de "
            f"Jackson y la Ley de Little) y el modelo, con casos deterministas, casos límite y una prueba de mutación. Tres "
            f"escenarios ficticios (un consultorio de un médico, un policonsultorio de tres profesionales y un centro de "
            f"seis) se calibraron contra metas fijadas de antemano en tres iteraciones; cuatro de las cinco metas se "
            f"cumplen y el abandono de la demanda espontánea queda como limitación documentada.",
            f"Con {ent(d.est['R0'])} días simulados por configuración, números aleatorios comunes y selección del mejor "
            f"con Bonferroni, la recomendación es **{k['chico']} sobreturnos {NOMBRE_POL[g['chico']]}** en el consultorio "
            f"chico, **{k['policonsultorio']} {NOMBRE_POL[g['policonsultorio']]}** en el policonsultorio y "
            f"**{k['centro']} {NOMBRE_POL[g['centro']]}** del turno en el centro. Frente a no dar sobreturnos, el beneficio "
            f"medio por día sube de {pesos(b0['chico'])} a {pesos(b['chico']['media'])}, de {pesos(b0['policonsultorio'])} "
            f"a {pesos(b['policonsultorio']['media'])} y de {pesos(b0['centro'])} a {pesos(b['centro']['media'])}. La política "
            f"importa tanto como la cantidad: poner los sobreturnos al final de la agenda nunca conviene. Ninguna regla "
            f"simple del tipo «reponer a los que se espera que falten» generaliza a los tres escenarios cuando se la valida "
            f"dejando un escenario afuera: cada consultorio se tiene que simular.",
            f"Un modelo de dinámica de sistemas de la lista de espera, calibrado para reproducir la anticipación media del "
            f"modelo del día, muestra que dar sobreturnos acorta la lista y baja el ausentismo; ajustar k cada semana al "
            f"ausentismo observado nunca pierde contra el k fijo, pero gana poco ({pesos(base['difBeneficio'])} en "
            f"{din['parametros']['horizonteSemanas']} semanas en el caso base). Con el desaliento demorado aparecen equilibrios "
            f"múltiples e histéresis. Un modelo fluido de la jornada subestima la espera entre "
            f"{f(min(c['desEspera']['media'] / c['fluidoEspera'] for c in d.comp['fluido']), 1)} y "
            f"{f(max(c['desEspera']['media'] / c['fluidoEspera'] for c in d.comp['fluido']), 1)} veces: la variabilidad es "
            f"la que genera la cola.",
            f"La herramienta es una aplicación web que corre entera en el navegador ({DEMO}), reproducible con semilla, con "
            f"animación del día, experimentos en Web Workers y una pantalla para usar datos reales: ajuste de tiempos de "
            f"atención por máxima verosimilitud con Kolmogorov-Smirnov y χ², y regresión logística del ausentismo, que sobre "
            f"datos de ejemplo recuperan los parámetros conocidos ({dentro} de {total} dentro de su intervalo de confianza).",
        ]
        u.titulo_fuera_del_indice(self.doc, "Resumen").paragraph_format.page_break_before = True
        for t in parrafos:
            self.p(t)
        self.p("**Palabras clave:** simulación de eventos discretos, agendamiento de turnos, sobreturnos, ausentismo, Monte Carlo, "
               "teoría de colas, dinámica de sistemas.", antes=6)
        self.textos["Resumen"] = parrafos

    # ---------------------------------------------------------------- 1. Introducción
    def introduccion(self):
        d = self.d
        self.h1("1. Introducción")
        self.h2("1.1 El problema")
        self.p("Un policonsultorio organiza su atención con turnos programados: cada profesional tiene una agenda de "
               "intervalos de duración fija y cada intervalo se reserva para un paciente con días de anticipación. Una "
               "fracción de esos pacientes no se presenta (ausentismo o ~~no-show~~), y la probabilidad de faltar crece con "
               "la anticipación del turno. Cada ausencia es un intervalo en el que el médico queda ocioso y no factura. La "
               "práctica habitual para compensarlo es el **sobreturno**: agendar pacientes adicionales sobre los "
               "intervalos ya reservados, o al final de la agenda.")
        self.p("El sobreturno tiene un costo. Si faltan menos pacientes que los previstos, la sala se llena, la espera crece, "
               "algunos pacientes sin turno se van sin ser atendidos y el profesional termina después de hora. La pregunta de "
               "decisión tiene dos partes: **cuántos** sobreturnos dar por profesional y por día (k) y **dónde** ubicarlos "
               "en la agenda (al inicio, intercalados, en los intervalos con más probabilidad de ausencia o al final). La "
               "respuesta depende de la variabilidad de los tiempos de atención, de la puntualidad, de la demanda "
               "espontánea que compite por los mismos huecos y de la estructura de costos; por eso no tiene una solución "
               "analítica cerrada y se estudia por simulación.")
        self.h2("1.2 Objetivos")
        self.lista([
            "Construir y validar un modelo de simulación de eventos discretos de un policonsultorio con turnos, sobreturnos, "
            "ausentismo dependiente de la anticipación, demanda espontánea con abandono y admisión.",
            "Determinar, para escenarios representativos, el número de sobreturnos y la política de ubicación que maximizan el "
            "beneficio neto esperado por día, con intervalos de confianza y comparaciones múltiples controladas.",
            "Explicar el mecanismo por el que gana cada política y evaluar si existe una regla práctica que evite simular.",
            "Estudiar con dinámica de sistemas el efecto de los sobreturnos sobre la lista de espera a escala de semanas.",
            "Permitir el uso con datos reales: ajuste de distribuciones y estimación del ausentismo a partir de registros.",
            "Entregar una herramienta reproducible y publicada que cualquier persona pueda usar desde el navegador.",
        ], numerada=True)
        self.h2("1.3 Alcance")
        self.p("El modelo representa un día de atención (jornada de 08:00 a 20:00 con turnos de mañana y de tarde) de uno a seis "
               "profesionales. Se trabaja con tres escenarios de ejemplo: un **consultorio chico** con un médico clínico, un "
               "**policonsultorio** con tres profesionales (escenario por defecto) y un **centro completo** con seis. Todos los "
               "datos son ficticios y se marcan como supuestos; la calibración se hizo contra metas de plausibilidad fijadas "
               "antes de mirar los resultados. Quedan fuera del alcance la reprogramación de turnos en el día, la "
               "interrupción de consultas por urgencias y la heterogeneidad entre profesionales de una misma especialidad.")
        self.h2("1.4 La herramienta")
        self.p(f"El trabajo se materializa en una aplicación web, **Sobreturnos**, que corre entera en el navegador y está "
               f"publicada en {DEMO}. El código fuente es público en {REPO}. La aplicación permite editar el escenario, ver la "
               f"animación de un día simulado, comparar un día con y sin sobreturnos usando los mismos pacientes, consultar el "
               f"estudio Monte Carlo precalculado, correr experimentos a medida, explorar el modelo de la lista de espera e "
               f"importar datos reales. El Capítulo 8 describe su arquitectura.")
        self.p("El informe sigue el orden de la cátedra: fundamentos teóricos (Capítulo 2), el modelo y su validación (Capítulos 3 y "
               "4), la resolución del problema (Capítulos 5 a 7), la herramienta (Capítulo 8) y las conclusiones (Capítulo 9).")

    # ---------------------------------------------------------------- 2. Fundamentos teóricos
    def fundamentos(self):
        d = self.d
        self.h1("2. Fundamentos teóricos")
        self.h2("2.1 Metodología de la simulación")
        self.p("Simular es construir un modelo de un sistema y experimentar con él para inferir cómo se comportaría el sistema real "
               "ante distintas decisiones (Law, 2015; apuntes de cátedra, Cap. 1). La metodología seguida tiene las etapas "
               "clásicas: formulación del problema y de la medida de desempeño, construcción del modelo conceptual, recolección "
               "o supuesto de datos de entrada, implementación, **verificación** (el programa hace lo que el modelo dice), "
               "**validación** (el modelo representa al sistema con la precisión necesaria para la decisión), diseño de "
               "experimentos, corrida y análisis de resultados, y documentación.")
        self.p("El modelo del consultorio es de **eventos discretos**: el estado cambia solo en instantes puntuales (llegada de un "
               "paciente, fin de una admisión, fin de una consulta, abandono) que se procesan en orden cronológico desde una "
               "lista de eventos futuros. Es además **terminante**: cada réplica es un día que empieza con el edificio vacío y "
               "termina cuando sale el último paciente o profesional, de modo que no hace falta eliminar un período de "
               "calentamiento; el transitorio de la mañana forma parte de lo que se quiere medir.")
        self.h2("2.2 Números aleatorios y generación de variables")
        self.p("Toda la aleatoriedad proviene de un generador pseudoaleatorio con semilla. Se usa **xoshiro128∗∗** "
               "(Blackman y Vigna, 2021), un generador lineal de 128 bits de estado con una función de salida no lineal que "
               "elimina los artefactos lineales en los bits bajos y supera las baterías de pruebas estadísticas habituales. "
               "La reproducibilidad exige que la misma semilla produzca exactamente la misma secuencia; por eso el proyecto "
               "prohíbe cualquier otra fuente de azar.")
        self.p("Para comparar escenarios conviene que las diferencias entre ellos no se confundan con diferencias de azar. Se usa un "
               "**flujo independiente por fuente de aleatoriedad** (llegadas, servicio, ausentismo, puntualidad, etc.), cada uno con "
               "una semilla derivada de la semilla maestra, la réplica y el nombre del flujo. Además, cada paciente obtiene "
               "todos sus atributos de un flujo propio identificado por su identidad (por ejemplo, el intervalo 5 de la agenda "
               "del profesional P1), y consume siempre la misma cantidad de uniformes en el mismo orden. Así, agregar un "
               "sobreturno no altera ningún atributo de los demás pacientes: es la condición para usar **números aleatorios "
               "comunes** (Sección 2.3).")
        self.p("Las variables aleatorias se generan por **transformada inversa**: si U es uniforme en (0, 1) y F es la función de "
               "distribución acumulada, X = F⁻¹(U) tiene distribución F. Cada muestra consume un solo uniforme, lo que mantiene la "
               "sincronización de los números aleatorios comunes. Para la exponencial de media m:")
        self.ec("X = −m · ln(U)")
        self.p("Para la lognormal parametrizada por su media m y su coeficiente de variación cv, con Φ⁻¹ la inversa de la normal "
               "estándar:")
        self.ec("σ² = ln(1 + cv²),   μ = ln(m) − σ²/2,   X = exp(μ + σ · Φ⁻¹(U))")
        self.p("Las distribuciones triangular, uniforme y normal truncada se invierten de forma analítica o numérica, y la "
               "**discreta empírica** (como en el TP5) busca el primer valor cuya frecuencia acumulada supera a U.")
        self.p("La demanda espontánea es un **proceso de Poisson no homogéneo** con tasa λ(t) constante por hora. Se genera por "
               "**adelgazamiento** (~~thinning~~, Lewis y Shedler, 1979): se generan candidatos de un Poisson homogéneo con la "
               "tasa máxima λ* y cada candidato en t se acepta con probabilidad λ(t)/λ*. Es la única fuente que usa dos uniformes "
               "por candidato.")
        self.p("Para contrastar datos observados con una distribución teórica se usan dos pruebas de bondad de ajuste (apuntes de "
               "cátedra, Cap. 2). La de **Kolmogorov-Smirnov** compara la función de distribución empírica Fₙ con la teórica F:")
        self.ec("D = sup |Fₙ(x) − F(x)|")
        self.p("y rechaza para valores grandes de √n·D según la distribución de Kolmogorov. La **χ²** agrupa los datos en k clases "
               "y compara las frecuencias observadas Oᵢ con las esperadas Eᵢ:")
        self.ec("χ² = Σ (Oᵢ − Eᵢ)² / Eᵢ,   con k − 1 − m grados de libertad")
        self.p("donde m es la cantidad de parámetros estimados de los datos. Cuando los parámetros se estiman de la misma muestra, el "
               "valor p de Kolmogorov-Smirnov resulta conservador (corrección de Lilliefors); en este trabajo se lo informa para "
               "comparar familias, no como prueba exacta.")
        self.h2("2.3 Monte Carlo, intervalos de confianza y selección del mejor")
        self.p("Una corrida produce una sola observación del desempeño de un día, que es aleatoria. Para estimar el valor esperado "
               "se simulan R réplicas independientes y se usa la media muestral con un **intervalo de confianza** basado en la t "
               "de Student (apuntes de cátedra, Cap. 3; Law, 2015):")
        self.ec("X̄ ± t₍R−1; 1−α/2₎ · S / √R")
        self.p("El semiancho decrece como 1/√R: para reducirlo a la mitad hay que cuadruplicar las réplicas. Es la base de la "
               "**regla de precisión**: duplicar R hasta que el semiancho de las diferencias relevantes quede por debajo de un "
               "umbral fijado de antemano.")
        self.p("Para comparar dos configuraciones 1 y 2 se usa la **diferencia pareada** día a día, Dᵣ = B₁,ᵣ − B₂,ᵣ, con los "
               "mismos números aleatorios en las dos (números aleatorios comunes). Como las dos medidas de un mismo día están "
               "correlacionadas positivamente, la varianza de la diferencia es menor que la suma de las varianzas:")
        self.ec("Var(X − Y) = Var(X) + Var(Y) − 2 · Cov(X, Y)")
        self.p("Al comparar muchas configuraciones a la vez, la probabilidad de declarar al menos una diferencia falsa crece. La "
               "**corrección de Bonferroni** construye cada uno de los c intervalos al nivel 1 − α/c, con lo que el nivel conjunto "
               "es al menos 1 − α. Con ella se define el **conjunto de óptimos indistinguibles**: el mejor estimado k̂ más todos los k "
               "cuya diferencia pareada con k̂ tiene un intervalo de Bonferroni que contiene al cero. Dentro de ese conjunto, que no "
               "se puede separar con los datos disponibles, se recomienda el menor k, que logra el mismo beneficio esperado con "
               "menos espera, menos horas extra y menos variabilidad.")
        self.h2("2.4 Teoría de colas")
        self.p("La teoría de colas da resultados exactos para modelos simplificados, que sirven para **validar** el simulador: si el "
               "motor reproduce los valores teóricos en esos casos, se gana confianza en que implementa bien las colas, los "
               "recursos y las estadísticas (apuntes de cátedra, Cap. 3).")
        self.p("**M/M/c y Erlang C.** Con llegadas de Poisson de tasa λ, servicio exponencial de tasa μ y c servidores, la "
               "utilización es ρ = λ/(cμ) y la probabilidad de esperar está dada por la fórmula de Erlang C, a partir de la cual se "
               "obtienen la cola media Lq y la espera media Wq = Lq/λ.")
        self.p("**M/G/1 y Pollaczek-Khinchine.** Con un servidor, llegadas de Poisson y servicio de distribución general con media "
               "E[S] y coeficiente de variación cₛ, la espera media en cola es:")
        self.ec("Wq = ρ · E[S] · (1 + cₛ²) / (2 · (1 − ρ))")
        self.p("La fórmula muestra que la espera depende de la variabilidad del servicio, no solo de su media: con cₛ = 0 la espera "
               "es la mitad que con servicio exponencial. Esa observación reaparece en el Capítulo 6, al comparar el modelo fluido "
               "con la simulación. Para colas G/G/1 con carga alta, la aproximación de **Kingman** (1961) generaliza esta idea "
               "sumando la variabilidad de las llegadas y la del servicio.")
        self.p("**Ley de Little.** En cualquier sistema estable, el número medio de entidades L, la tasa de entrada λ y el tiempo medio "
               "de permanencia W cumplen L = λ·W (Little, 1961). No depende de las distribuciones ni de la disciplina de la cola, y "
               "se cumple también sobre un horizonte finito si se mide de forma consistente. El proyecto la usa como prueba de "
               "consistencia de las estadísticas en cada réplica, y la dinámica de sistemas la usa para relacionar el tamaño de la "
               "lista de espera con la anticipación de los turnos.")
        self.p("**Redes de Jackson y teorema de Burke.** El teorema de Burke (1956) establece que la salida de una cola M/M/c estable "
               "es un proceso de Poisson con la misma tasa que la entrada. En consecuencia, en una red de colas exponenciales en "
               "serie cada estación se comporta como una M/M/c independiente (Jackson, 1957), y la espera total es la suma de las "
               "esperas de cada estación.")
        self.h2("2.5 Líneas en serie y cuello de botella")
        self.p("El paciente atraviesa una línea en serie: admisión y luego consultorio (apuntes de cátedra, Cap. 5). En una línea así, "
               "la estación de menor capacidad es el **cuello de botella**: fija la tasa máxima de salida y acumula la cola. En el "
               "policonsultorio la admisión trabaja con utilización baja y el cuello de botella es el profesional. Por eso agregar "
               "sobreturnos aumenta la cola en la sala de espera y no en la admisión, y por eso la ubicación de los sobreturnos en "
               "el tiempo importa: una carga extra concentrada al inicio de la jornada se propaga como cola hasta que aparece un "
               "hueco que la absorba.")
        self.h2("2.6 Dinámica de sistemas")
        self.p("La dinámica de sistemas (Sterman, 2000; apuntes de cátedra, Cap. 7) estudia sistemas con realimentación a partir de "
               "**stocks** (acumulaciones) y **flujos** (tasas de cambio). Un stock S cambia según sus flujos de entrada y salida:")
        self.ec("dS/dt = entradas(t) − salidas(t)")
        self.p("Las relaciones causales forman **bucles de realimentación**: un bucle de refuerzo (R) amplifica las desviaciones y uno "
               "de balance (B) las corrige. Un **equilibrio** es un estado en el que los flujos se compensan (dS/dt = 0). Es "
               "**estable** si, ante una perturbación, el sistema vuelve a él: para un modelo de un solo stock con dS/dt = g(S), el "
               "equilibrio S* es estable si g′(S*) < 0. Cuando hay varios equilibrios, el estado final depende de la historia "
               "(histéresis).")
        self.p("Las ecuaciones se integran numéricamente. El método de **Euler** avanza con la derivada al inicio del paso, "
               "S(t + Δt) = S(t) + Δt·g(S(t)), y tiene error global de orden Δt. El método de **Runge-Kutta de orden 4** (RK4) "
               "combina cuatro evaluaciones de la derivada por paso y, para funciones suaves, tiene error de orden Δt⁴. Con "
               "funciones definidas por tramos (mínimos, rampas, escalones) los quiebres reducen ese orden.")
        self.h2("2.7 Agendamiento con sobreturnos en la bibliografía")
        self.p("El agendamiento de turnos en consultorios externos tiene una bibliografía extensa. La revisión de Cayirli y Veral (2003) "
               "clasifica los sistemas de turnos según las reglas de agenda, el ausentismo, la puntualidad, la demanda sin turno y las "
               "medidas de desempeño, y señala que la mayoría de los estudios usa simulación porque los modelos analíticos no "
               "admiten la variedad de factores reales. La función objetivo habitual es un **costo ponderado** de la espera de los "
               "pacientes, el ocio del profesional y las horas extra.")
        self.p("LaGanga y Lawrence (2007) estudian específicamente el sobreturno como respuesta al ausentismo. Con un modelo de "
               "simulación muestran que sobrerreservar mejora el acceso de los pacientes y la productividad del profesional a "
               "costa de más espera y horas extra, y que conviene más cuanto mayor es el volumen de pacientes y el ausentismo y "
               "cuanto menor es la variabilidad de la atención. Este trabajo parte de esa formulación clásica, pero la usa como "
               "contraste y decide con un beneficio neto que incluye los ingresos (Sección 3.4), y agrega lo que en ese planteo "
               "queda fuera: la demanda espontánea que compite por los huecos, el abandono, la ubicación de los sobreturnos y el "
               "efecto de la lista de espera sobre el propio ausentismo.")

    # ---------------------------------------------------------------- 3. Modelo
    def modelo(self):
        d = self.d
        pre = {p["nombre"].split(" (")[0]: p for p in d.presets}
        poli = pre["Policonsultorio"]
        self.h1("3. Modelo del consultorio")
        self.h2("3.1 Entidades, recursos y flujo")
        self.p("Las entidades son los **pacientes**, con cinco clases: con turno, sobreturno, tardío, espontáneo y urgencia. Los "
               "recursos son los **profesionales** (un consultorio cada uno, con un turno de mañana o de tarde) y la **admisión** "
               "(uno o dos recepcionistas). Cada profesional tiene una agenda de intervalos de duración D (15, 20 o 30 minutos); "
               "una parte de los intervalos son **cupos** reservados para la demanda espontánea. La "
               f"{self.F('flujo')} resume el recorrido de un paciente.")
        self.figura("flujo", fg.flujo_paciente(DIR_FIG / "flujo.png"),
                    "Flujo del paciente en el modelo: fuentes (izquierda), recorrido (centro) y resultados (derecha). Elaboración propia.")
        self.p("Las reglas principales son:")
        self.lista([
            "Un paciente con turno falta con probabilidad logística en la anticipación d del turno: p(d) = 1 / (1 + e^{−(β₀ + β₁·d)}). "
            "Si viene, llega en la hora del turno más un desvío normal truncado; si llega más de 15 minutos tarde pasa a la clase "
            "tardío.",
            "Un espontáneo entra si hay un profesional de su especialidad en turno y faltan más de 30 minutos para el cierre; si no, "
            "se pierde. Los no urgentes abandonan cuando la espera supera su paciencia (lognormal, media 60 min).",
            "Al quedar libre, el profesional atiende en orden: urgencias, sus pacientes puntuales por hora de turno, sus tardíos y, "
            "por último, espontáneos de su especialidad. Si debe cupos (ya pasó la hora de un cupo y no lo usó un espontáneo), el "
            "espontáneo pasa antes que los puntuales (**cupos acumulables**).",
            "La duración de la consulta es un factor aleatorio de media 1 (lognormal con cv 0,4) por un factor de la clase (1,3 "
            "para primera vez, 0,8 para control y espontáneos) por la D del profesional.",
            "El profesional no se retira antes de atender a todos los que le corresponden: lo que hace después de su horario son "
            "horas extra.",
        ])
        self.h2("3.2 Sobreturnos y políticas de ubicación")
        self.p("Los k sobreturnos de cada profesional se ubican con una de cuatro políticas: **al inicio** (superpuestos a los primeros "
               "intervalos), **intercalados** (equiespaciados en la jornada), **donde más se falta** (en los intervalos con mayor "
               "probabilidad predicha de quedar vacíos, según la anticipación de cada turno) y **al final** (k turnos adicionales "
               "después del cierre). Los sobreturnos nunca se superponen a cupos y tienen un día de anticipación, de modo que también "
               "pueden faltar.")
        self.h2("3.3 Datos de entrada y supuestos principales")
        self.p(f"La {self.T('entrada')} resume las distribuciones de entrada. Todos los valores son ficticios y se marcan como supuestos; "
               f"el Anexo A lista los {len(d.supuestos)} supuestos del modelo.")
        a = poli["pacientes"]["atencion"]
        tabla_ant = poli["pacientes"]["anticipacion"]
        filas = [
            ["Demora del médico al iniciar", "Triangular", self._dist(poli["profesionales"][0]["demora"])],
            ["Primera vez", "Bernoulli", pct(poli["pacientes"]["proporcionPrimeraVez"], 0)],
            ["Tiempo de atención", f"Factor {a['familia']} × clase × D",
             f"cv {f(a['cv'], 1)}; factores {f(a['factorPrimeraVez'], 1)} (primera vez) y {f(a['factorControl'], 1)} (control)"],
            ["Puntualidad", "Normal truncada", self._dist(poli["puntualidad"]["desvio"]) + f"; tolerancia {f(poli['puntualidad']['tolerancia'], 0)} min"],
            ["Anticipación del turno", "Discreta empírica", ", ".join(f"{int(x['valor'])}" for x in tabla_ant) + " días (frec. "
             + ", ".join(f"{int(x['frecuencia'])}" for x in tabla_ant) + ")"],
            ["Ausentismo", "Bernoulli logística", f"β₀ = {f(poli['ausentismo']['beta0'], 4)}; β₁ = {f(poli['ausentismo']['beta1'], 3)}"],
            ["Llegadas espontáneas", "Poisson no homogéneo", f"{f(poli['espontaneos']['totalDia'], 1)} por día (policonsultorio)"],
            ["Urgencias", "Bernoulli", pct(poli["espontaneos"]["proporcionUrgencias"], 0) + " de los espontáneos"],
            ["Paciencia", self._dist(poli["espontaneos"]["paciencia"]).split(";")[0], "solo espontáneos no urgentes"],
            ["Admisión", "Triangular", self._dist(poli["admision"]["tiempo"])],
        ]
        self.tabla("entrada", "Datos de entrada del modelo (escenario por defecto, policonsultorio)", ["Fuente", "Modelo", "Parámetros"],
                   filas, anchos=[3.2, 3.3, 6], alinear=[u.IZQUIERDA] * 3)
        self.p("Los supuestos con más peso en los resultados son: los días son independientes e idénticamente distribuidos; el "
               "ausentismo de cada paciente es independiente de los demás; las urgencias tienen prioridad pero no interrumpen una "
               "consulta en curso; los sobreturnos tienen la misma mezcla de primera vez y control que los turnos; y la paciencia "
               "corre desde la llegada al edificio.")
        self.h2("3.4 Criterio de decisión: beneficio neto contra costo clásico")
        self.p("El criterio único de decisión es el **beneficio neto esperado por día**:")
        self.ec("B = honorario · atendidos − c_espera · Σ espera − c_extra · horas extra − c_perdido · perdidos")
        self.p("El ocio del profesional no se resta en B: ya está reflejado en las consultas que no se facturan, y restarlo lo contaría "
               "dos veces. El **costo clásico** de la bibliografía se informa como contraste:")
        self.ec("C = c_espera · Σ espera + c_ocio · ocio + c_extra · horas extra + c_perdido · perdidos")
        cs = sorted({(p["D"], p["cOcio"], p["cExtra"]) for pr in d.presets for p in pr["profesionales"]})
        self.p(f"El costo de ocio se deriva del honorario: es lo que deja de facturar un minuto ocioso, honorario dividido por la "
               f"duración media de la consulta con turno de cada profesional. El costo de hora extra es 1,5 veces el de ocio, con el "
               f"principio de coherencia c_extra ≥ c_ocio: un minuto fuera de hora no puede costar menos que uno del turno normal. "
               f"La {self.T('costos')} muestra los valores derivados.")
        c0 = d.presets[0]["costos"]
        self.tabla("costos", "Costos derivados por duración del intervalo de agenda (ARS ficticios)",
                   ["D [min]", "c_ocio [$/min]", "c_extra [$/min]"], [[str(D), f(co, 0), f(cx, 0)] for D, co, cx in cs], anchos=[2, 3, 3])
        self.p(f"Los demás costos son constantes: honorario {pesos(c0['honorario'])} por consulta, espera {pesos(c0['espera'])} por "
               f"minuto y {pesos(c0['perdido'])} por paciente perdido. Sumando las dos expresiones se obtiene C + B = ingresos + "
               f"c_ocio · ocio. Esa suma sería constante, y los dos criterios recomendarían lo mismo, solo si cada consulta adicional "
               f"ocurriera dentro del turno y con la duración media. Las consultas hechas en horas extra suman ingreso sin reducir el "
               f"ocio, y las más cortas que la media suman más ingreso del que descuentan de ocio: por eso B y C pueden recomendar k "
               f"distintos, y el estudio informa los dos.")

    @staticmethod
    def _dist(dd):
        t = dd["tipo"]
        if t == "triangular":
            return f"mín {f(dd['min'], 0)}, moda {f(dd['moda'], 0)}, máx {f(dd['max'], 0)} min"
        if t == "normal_truncada":
            return f"media {f(dd['media'], 0)}, desvío {f(dd['desvio'], 0)}, en [{f(dd['min'], 0)}; {f(dd['max'], 0)}] min"
        if t == "lognormal":
            return f"Lognormal; media {f(dd['media'], 0)} min, cv {f(dd['cv'], 1)}"
        if t == "exponencial":
            return f"Exponencial; media {f(dd['media'], 0)} min"
        return t

    # ---------------------------------------------------------------- 4. Verificación y validación
    def validacion(self):
        d = self.d
        v = d.validacion
        self.h1("4. Verificación y validación")
        self.p("La confianza en los resultados se construyó en capas: primero el motor contra resultados exactos de la teoría de "
               "colas, después el modelo del consultorio con casos de solución conocida, casos límite y una prueba de mutación, y "
               "por último la calibración de los escenarios contra metas de plausibilidad. Todas las pruebas están automatizadas "
               f"({d.tests['total']} tests, Anexo C) y se ejecutan en cada publicación.")
        self.h2("4.1 Validación del motor contra la teoría de colas")
        mmc = v["mmc"]
        self.p(f"El motor se configuró como una cola M/M/c y se comparó con las fórmulas exactas, con {mmc['replicas']} réplicas "
               f"independientes por caso, calentamiento justificado con el método de Welch y un intervalo simultáneo al 95 % "
               f"(Bonferroni sobre las medidas de cada caso). La {self.T('mmc')} muestra los resultados.")
        filas = []
        for c in mmc["casos"]:
            for m in c["comparaciones"]:
                if m["nombre"] in ("ρ (utilización)", "Lq", "Wq", "W") or m["nombre"].startswith("Lq") or m["nombre"].startswith("Wq"):
                    filas.append([c["nombre"].split(",")[0] + " (ρ = " + f(c["lambda"] / (c["c"] * c["mu"]), 3).rstrip("0").rstrip(",") + ")", m["nombre"] + (f" [{m['unidad']}]" if m["unidad"] else ""), f(m["teorico"], 3),
                                  f(m["media"], 3), ic(m["infSim"], m["supSim"], 3), "sí" if m["dentroSim"] else "no"])
        self.tabla("mmc", "Motor contra M/M/c (Erlang C): valor teórico, media simulada e IC simultáneo al 95 %",
                   ["Caso", "Medida", "Teórico", "Simulado", "IC simultáneo", "¿Lo contiene?"], filas, anchos=[2.6, 2.4, 1.5, 1.5, 3.0, 1.8],
                   mantener_junta=False)
        maxL = max(c["maxErrorL"] for c in mmc["casos"])
        maxLq = max(c["maxErrorLq"] for c in mmc["casos"])
        todas = [m for c in mmc["casos"] for m in c["comparaciones"]]
        fuera = [(c["nombre"].split(",")[0], m["nombre"]) for c in mmc["casos"] for m in c["comparaciones"] if not m["dentro"]]
        casos_fuera = sorted({c for c, _ in fuera})
        self.p(f"Las {len(todas)} medidas comparadas (incluidas L y P(espera > 0), que la tabla omite) quedan dentro de su intervalo "
               f"simultáneo. Con el intervalo individual al 95 % quedan fuera {len(fuera)}, en {len(casos_fuera)} de los "
               f"{len(mmc['casos'])} casos y todas por exceso. Las medidas de un mismo caso salen de las mismas réplicas y están muy "
               f"correlacionadas (la utilización, la probabilidad de esperar y las colas suben juntas), así que se desvían en bloque: por "
               f"eso el criterio de aprobación es el intervalo simultáneo, fijado antes de correr. La **Ley de Little** se verificó en cada "
               f"réplica de cada caso: el mayor error relativo entre L y λ̂·W fue {pct(maxL, 3)} y entre Lq y λ̂·Wq, {pct(maxLq, 3)}, con "
               f"una tolerancia de 1 %.")
        self.h2("4.2 Validación del modelo del consultorio")
        mo = v["modelo"]
        self.p(f"El modelo completo se redujo a configuraciones con solución conocida ({mo['replicas']} réplicas, semilla "
               f"{mo['semilla']}, Bonferroni sobre {mo['comparacionesBonferroni']} comparaciones). La {self.T('modelo_val')} muestra "
               f"un profesional con llegadas de Poisson y atención lognormal (M/G/1, contra Pollaczek-Khinchine) y una red de "
               f"admisión M/M/1 seguida de consultorios M/M/3 (contra Jackson y Burke).")
        filas = [[c["caso"].split("(")[0].strip(), m["medida"], f(m["teorico"], 3), f(m["media"], 3), ic(m["infSim"], m["supSim"], 3),
                  "sí" if m["dentroSim"] else "no"] for c in mo["casos"] for m in c["comparaciones"]]
        self.tabla("modelo_val", "Modelo del consultorio contra M/G/1 y una red en serie (esperas en minutos)",
                   ["Caso", "Medida", "Teórico", "Simulado", "IC simultáneo", "¿Lo contiene?"], filas, anchos=[2.4, 4.4, 1.5, 1.5, 2.8, 1.8])
        self.p("Además se verificaron con tests automatizados:")
        self.lista([
            "**Caso determinista:** sin ausentismo, sin desvío de puntualidad, sin demora del médico, sin espontáneos y con la "
            "atención igual a D, cada consulta empieza exactamente a su hora y la espera, el ocio y las horas extra son cero.",
            "**Conservación:** pacientes generados = atendidos + perdidos + ausentes, sin eventos pendientes ni médicos sin "
            "retirarse al final del día, y la Ley de Little del día se cumple exactamente.",
            "**Casos límite:** k = 0; ausentismo del 100 % (el ocio es el turno completo); uno y seis profesionales; paciencia nula; "
            "sin espontáneos; política al final con k creciente (las horas extra crecen).",
            "**Reglas:** días armados a mano para comprobar el orden de atención, los tardíos, los rechazos, el traspaso entre "
            "turnos y el adelanto de turnos.",
            "**Números aleatorios comunes:** con la misma semilla, pasar de k = 0 a k = 3 no cambia ningún atributo de ningún otro "
            "paciente.",
        ])
        self.h2("4.3 Prueba de mutación")
        mut = d.mutacion
        det = sum(m["fallan"] > 0 for m in mut["mutantes"])
        self.p(f"Que los tests pasen no prueba que detecten errores. Para medirlo se introdujeron, de a uno, errores deliberados "
               f"(mutantes) en las reglas del modelo y se corrió la suite del modelo ({mut['control']['total']} tests) con cada uno. "
               f"El código se restauró después de cada mutante y la suite original pasó entera. La {self.T('mutacion')} muestra el "
               f"resultado.")
        self.tabla("mutacion", "Prueba de mutación sobre las reglas del modelo",
                   ["Mutante", "Tests que fallan", "¿Detectado?"],
                   [[m["descripcion"], f"{m['fallan']} de {m['total']}", "sí" if m["fallan"] else "no (equivalente)"] for m in mut["mutantes"]],
                   anchos=[8, 2.4, 2.4], alinear=[u.IZQUIERDA, u.CENTRO, u.CENTRO])
        sobrevive = next(m for m in mut["mutantes"] if m["fallan"] == 0)
        self.p(f"Se detectan {det} de los {len(mut['mutantes'])} mutantes. El que sobrevive («{sobrevive['descripcion'].lower()}») es un "
               f"**mutante equivalente**: el manejador del evento de abandono ya ignora a los pacientes que están en consulta, de modo "
               f"que cancelar el evento solo ahorra trabajo al calendario y no cambia ningún resultado. Ningún test puede "
               f"distinguirlo, y no indica una falta de cobertura.")
        self.h2("4.4 Calibración de los escenarios")
        self.p("Los parámetros de los escenarios no provienen de datos reales, así que se calibraron para que la situación inicial, "
               "sin sobreturnos, represente una operación plausible. Las **metas se fijaron antes** de calibrar y durante la "
               "calibración no se corrió ningún experimento sobre k, para no ajustar los escenarios al resultado buscado. La "
               f"{self.T('metas')} las muestra.")
        m = d.calibracion["metas"]
        self.tabla("metas", "Metas de calibración fijadas a priori (media sobre 1.000 días, sin sobreturnos)",
                   ["Indicador", "Meta"], [
                       ["Utilización de los médicos", f"{pct(m['utilizacion']['min'], 0)} a {pct(m['utilizacion']['max'], 0)}"],
                       ["Ausentismo de los pacientes con turno", f"{pct(m['ausentismo']['min'], 0)} a {pct(m['ausentismo']['max'], 0)}"],
                       ["Espera media de los pacientes con turno", f"{f(m['esperaTurno']['min'], 0)} a {f(m['esperaTurno']['max'], 0)} min"],
                       ["Horas extra por médico y por día", f"menos de {f(m['horasExtraPorMedico']['max'], 0)} min"],
                       ["Abandono de la demanda espontánea", f"menos de {pct(m['abandono']['max'], 0)}"],
                   ], anchos=[6, 4])
        self.p("La calibración necesitó tres iteraciones de validación. Cada una se originó en algo que la simulación dejó a la "
               "vista y que no era un error de programación sino un supuesto poco realista:")
        hist = d.cal_historia
        self.lista([
            "**Primera calibración (#2b).** Con las palancas permitidas (proporción de primera vez, tasa de espontáneos, ocupación "
            "de la agenda) se cumplieron cuatro metas, pero el abandono quedó entre "
            f"{f(min(r['abandono'] for r in hist if r['etapa'] == '#2b'), 1)} % y {f(max(r['abandono'] for r in hist if r['etapa'] == '#2b'), 1)} %. "
            "El barrido de control mostró además que, con esa función de costo, el óptimo era trivialmente k = 0.",
            "**Segunda iteración (#2c).** Se corrigieron tres supuestos: "
            + "; ".join(f"{a.lower()}" for a, _, _ in d.supuestos_2c)
            + ". Se reemplazaron por una paciencia lognormal, cupos para la demanda espontánea y un costo de ocio derivado del "
              "honorario, con el beneficio neto como criterio. El abandono bajó a "
            f"{f(min(r['abandono'] for r in hist if r['etapa'] == '#2c'), 1)}–{f(max(r['abandono'] for r in hist if r['etapa'] == '#2c'), 1)} %.",
            "**Tercera iteración (#2d), la última.** Se corrigió una incoherencia de costos (la hora extra valía menos que un minuto "
            "ocioso), se hicieron acumulables los cupos (antes se perdían si en su ventana no había espontáneos) y se fijaron "
            "límites de plausibilidad: la misma política de cupos en los tres escenarios, una escala de la demanda espontánea entre "
            "0,5 y 1,5 veces la base y ocupación de agenda entre 0,85 y 1. Con esto los escenarios quedaron **congelados**.",
        ], numerada=True)
        filas = [[r["preset"], r["etapa"], f(r["util"], 1) + " %", f(r["aus"], 1) + " %", f(r["espera"], 1), f(r["extra"], 1), f(r["abandono"], 1) + " %"]
                 for r in sorted(hist, key=lambda r: (["Consultorio chico", "Policonsultorio", "Centro completo"].index(r["preset"]), r["etapa"]))]
        self.tabla("cal_hist", "Evolución de la calibración (1.000 días, semilla 2026200; registro de docs/calibracion.md)",
                   ["Escenario", "Iteración", "Utilización", "Ausentismo", "Espera [min]", "Extra/médico [min]", "Abandono"], filas,
                   anchos=[3, 2.4, 1.8, 1.8, 1.7, 1.9, 1.7])
        cal = d.calibracion
        self.p(f"Los escenarios congelados se volvieron a medir para este informe con el código vigente ({ent(cal['dias'])} días, "
               f"semilla {cal['semilla']}); la {self.T('cal_vigente')} coincide con el registro de la última iteración.")
        filas = []
        for pr in cal["presets"]:
            i, c = pr["indicadores"], pr["cumple"]
            ok = lambda b: "✔" if b else "✘"  # noqa: E731
            filas.append([pr["nombre"].split(" (")[0], f"{pct(i['utilizacion'])} {ok(c['utilizacion'])}", f"{pct(i['ausentismo'])} {ok(c['ausentismo'])}",
                          f"{f(i['esperaTurno'], 1)} {ok(c['esperaTurno'])}", f"{f(i['horasExtraPorMedico'], 1)} {ok(c['horasExtraPorMedico'])}",
                          f"{pct(i['abandono'])} {ok(c['abandono'])}"])
        self.tabla("cal_vigente", "Situación inicial de los escenarios congelados contra las metas",
                   ["Escenario", "Utilización", "Ausentismo", "Espera [min]", "Extra/médico [min]", "Abandono"], filas,
                   anchos=[3.2, 2, 2, 2, 2.4, 2])
        pac = d.paciencia
        self.p("**La meta de abandono no se alcanza y queda como limitación del modelo.** La causa es estructural: con la agenda llena, "
               "casi siempre hay un paciente con turno esperando, y el espontáneo solo entra en los huecos que dejan los ausentes, las "
               "consultas cortas o los cupos. Su espera depende de cada cuánto aparece un hueco, no de la carga total. La prueba más "
               f"clara la dio una sensibilidad informativa en la primera calibración: llevando la paciencia media de {pac[0]['media'].split(' ')[0]} "
               f"a {pac[-1]['media'].split(' ')[0]} minutos el abandono bajaba de {f(pac[0]['abandono'], 1)} % a {f(pac[-1]['abandono'], 1)} %, "
               "todavía lejos del 5 %. Bajarlo al 5 % exige cupos tan frecuentes que la agenda pierde la mitad de los turnos y la "
               "utilización cae por debajo de la meta. Se decidió documentarlo y no seguir iterando: los abandonos entran en el "
               "beneficio como pacientes perdidos, de modo que el criterio de decisión los tiene en cuenta.")

    # ---------------------------------------------------------------- 5. Experimentos
    def experimentos(self):
        d = self.d
        e = d.est
        self.h1("5. Experimentos y resultados")
        self.h2("5.1 Diseño")
        self.p(f"El estudio Monte Carlo usa la semilla {e['semilla']}, distinta de todas las usadas en la calibración. Cada configuración "
               f"arranca con R = {ent(e['R0'])} días y se duplica R en toda la serie (para mantener el pareo) mientras el semiancho de "
               f"las diferencias pareadas alrededor del mejor k supere {pesos(e['umbral'])}, hasta {ent(e['Rmax'])} días. La "
               f"réplica r usa la misma semilla en todas las configuraciones, así que todas las comparaciones son pareadas. La "
               f"{self.T('diseno')} resume los experimentos.")
        self.tabla("diseno", "Diseño de los experimentos", ["Experimento", "Factores", "Pregunta"], [
            ["E1 · Curva B(k)", "escenario × política × k (0 a 6)", "¿Cuánto rinde cada k con cada política?"],
            ["E2 · Políticas", "cada política en su mejor k", "¿Qué política gana en cada escenario?"],
            ["E3 · Sensibilidad", "ausentismo (5 a 30 %), factor de c_extra (1 a 2), c_espera", "¿Cómo cambia k con el ausentismo y los costos?"],
            ["E4 · Regla práctica", "escenario × ausentismo", "¿Se puede elegir k sin simular?"],
            ["E5 · Riesgo", "k (policonsultorio)", "¿Qué tan seguido un día con sobreturnos rinde menos?"],
            ["E6 · Precisión", f"R de 125 a {ent(e['Rmax'])}", "¿Cómo decrece el error con las réplicas?"],
        ], anchos=[3.3, 5.2, 5.5], alinear=[u.IZQUIERDA] * 3)
        self.p("Los costos no cambian la dinámica del día: entran solo en B y C. Por eso la sensibilidad a los costos se calcula por "
               "**reponderación exacta**: para cada día se guardan los componentes (atendidos, suma de esperas, horas extra valuadas, "
               "ocio valuado y perdidos) y B se recalcula con cualquier costo sin volver a simular, con los mismos días.")
        self.h2("5.2 E1: curva del beneficio según k")
        self.p(f"La {self.F('e1')} muestra la curva de B según k para cada escenario y política, con su banda de confianza. La "
               f"{self.T('e1')} resume el mejor k estimado, el conjunto de óptimos indistinguibles y el k recomendado.")
        self.figura("e1", fg.curvas_bk(e, DIR_FIG / "e1.png"),
                    "E1: beneficio neto medio por día según los sobreturnos por profesional, por política (banda: IC 95 %; marcador vacío: mejor k estimado)")
        filas = []
        for p in PRESETS:
            for pol in POLITICAS:
                c = d.e1(p, pol)
                b = d.punto(c, c["kHat"])["B"]
                filas.append([NOMBRE_PRESET_M[p], NOMBRE_POL_M[pol], str(c["kHat"]), conjunto(c["conjunto"]), str(c["kRec"]),
                              f"{pesos(b['media'])} ± {f(b['semi'], 0)}", str(c["kC"]), ent(c["R"])])
        self.tabla("e1", "E1: mejor k, conjunto de óptimos indistinguibles (Bonferroni), k recomendado y k según el costo clásico C",
                   ["Escenario", "Política", "k̂", "Conjunto", "k rec.", "B en k̂ (IC 95 %)", "k según C", "R"], filas,
                   anchos=[2.7, 2.9, 0.8, 1.6, 1.1, 3.4, 1.3, 1.2], mantener_junta=False)
        self.p("Tres resultados se repiten en los tres escenarios. Primero, la curva es **cóncava**: los primeros sobreturnos rinden "
               "(recuperan horas que se perderían por ausencias) y los siguientes cuestan más espera y horas extra de lo que "
               "facturan. Segundo, poner los sobreturnos **al final** nunca conviene: el mejor k de esa política es 0 en los tres, "
               "porque toda consulta agregada al final es hora extra. Tercero, el **óptimo baja** cuanto más grande es el centro: "
               "con más demanda espontánea los huecos de los ausentes ya se llenan sin sobreturnos. El costo clásico C recomienda "
               "en general menos sobreturnos que B, porque no cuenta los ingresos de las consultas ganadas.")
        self.h2("5.3 E2: comparación de políticas")
        filas = []
        for p in PRESETS:
            e2 = d.e2(p)
            for x in sorted(e2["politicas"], key=lambda x: -x["B"]["media"]):
                filas.append([NOMBRE_PRESET_M[p], NOMBRE_POL_M[x["politica"]] + (" ★" if x["politica"] == e2["ganadora"] else ""), str(x["k"]),
                              f"{pesos(x['B']['media'])} ± {f(x['B']['semi'], 0)}", f(x["esperaPorAtendido"], 1), f(x["ocio"], 1), f(x["horasExtra"], 1)])
        self.tabla("e2", "E2: cada política en su mejor k (★ = ganadora; espera, ocio y horas extra en minutos por día)",
                   ["Escenario", "Política", "k", "B (IC 95 %)", "Espera por atendido", "Ocio", "Horas extra"], filas,
                   anchos=[2.7, 3.3, 0.7, 3.3, 2.4, 1.4, 1.8], mantener_junta=False)
        pares_sig = sum(par["distinguible"] for p in PRESETS for par in d.e2(p)["pares"])
        self.p(f"La política ganadora es **{NOMBRE_POL[d.ganadora('chico')]}** en el consultorio chico y en el policonsultorio, y "
               f"**{NOMBRE_POL[d.ganadora('centro')]}** en el centro. Las comparaciones pareadas entre los seis pares de políticas de "
               f"cada escenario (Bonferroni, 18 en total) declaran distinguibles {pares_sig}; no hay empates en el primer puesto. "
               f"La Sección 5.6 explica por qué cambia la ganadora entre escenarios.")
        self.h2("5.4 E3: sensibilidad al ausentismo y a los costos")
        self.p(f"La {self.F('e3')} muestra, para el policonsultorio con su política ganadora, cómo cambia el k recomendado con el "
               f"ausentismo medio (variando β₀ con β₁ fijo, lo que preserva los números aleatorios comunes: con más ausentismo "
               f"faltan los mismos pacientes y algunos más) y con el costo de la hora extra.")
        self.figura("e3", fg.sensibilidad_ausentismo(e, DIR_FIG / "e3.png"),
                    "E3: k según el ausentismo medio (barras grises: conjunto de óptimos) y k recomendado según ausentismo y factor de c_extra (policonsultorio)")
        filas = [["factor de c_extra", f(x["factor"], 2), str(x["curva"]["kHat"]), conjunto(x["curva"]["conjunto"]), str(x["curva"]["kRec"])]
                 for x in e["e3"]["factorExtra"]]
        filas += [["c_espera [$/min]", f(x["cEspera"], 0), str(x["curva"]["kHat"]), conjunto(x["curva"]["conjunto"]), str(x["curva"]["kRec"])]
                  for x in e["e3"]["cEspera"]]
        self.tabla("e3_costos", "E3: k según los costos (policonsultorio, reponderación exacta sobre los mismos días)",
                   ["Costo", "Valor", "k̂", "Conjunto", "k rec."], filas, anchos=[3.5, 2, 1.2, 2.5, 1.5])
        a0, a1 = e["e3"]["ausentismo"][0], e["e3"]["ausentismo"][-1]
        fx, ce = e["e3"]["factorExtra"], e["e3"]["cEspera"]
        self.p(f"El k recomendado crece con el ausentismo, de {a0['curva']['kRec']} con {pct(a0['p'], 0)} a {a1['curva']['kRec']} con "
               f"{pct(a1['p'], 0)}: más ausencias dejan más huecos para llenar. Con la hora extra más cara el óptimo baja, de "
               f"{fx[0]['curva']['kRec']} con factor {f(fx[0]['factor'], 0)} a {fx[-1]['curva']['kRec']} con factor {f(fx[-1]['factor'], 0)}. "
               f"El costo que más mueve la decisión es el de la **espera**: con {pesos(ce[0]['cEspera'])} por minuto el k recomendado es "
               f"{ce[0]['curva']['kRec']}, y con {pesos(ce[-1]['cEspera'])}, {ce[-1]['curva']['kRec']}. Como ese costo no se puede medir "
               f"directamente (es una valoración del tiempo del paciente), conviene que cada consultorio lo fije de forma explícita antes "
               f"de decidir; el ausentismo, en cambio, sí se mide (Capítulo 7).")
        self.h2("5.5 E4 a E6: regla práctica, riesgo y precisión")
        e4 = e["e4"]
        ri, ra = d.e4_resumen("ingenua"), d.e4_resumen("ajustada")
        self.p(f"La regla ingenua «reponer a los que se espera que falten» propone k = round(p̄·N̄), donde p̄ es el ausentismo medio y N̄ "
               f"los turnos reservados por profesional. La regla ajustada multiplica por α, elegido para minimizar la pérdida "
               f"esperada total en las 18 configuraciones (α = {f(e4['alfa'], 2)}). La {self.F('e4')} y la {self.T('e4')} las comparan.")
        self.figura("e4", fg.regla_practica(e, DIR_FIG / "e4.png"),
                    "E4: k óptimo contra p̄·N̄ en las 18 configuraciones (barras: conjunto de óptimos) y las dos reglas", ancho=11)
        self.tabla("e4", "E4: pérdida esperada por usar cada regla en lugar del k óptimo (18 configuraciones)",
                   ["Regla", "Pérdida media por día", "Pérdida máxima", "k dentro del conjunto óptimo"], [
                       ["Ingenua: round(p̄·N̄)", pesos(ri["perdidaMedia"]), pesos(ri["perdidaMaxima"]), f"{ri['dentro']} de {ri['total']}"],
                       [f"Ajustada: round({f(e4['alfa'], 2)}·p̄·N̄)", pesos(ra["perdidaMedia"]), pesos(ra["perdidaMaxima"]), f"{ra['dentro']} de {ra['total']}"],
                   ], anchos=[4, 3, 3, 3.5])
        self.p("La regla ingenua acierta más veces, pero cuando falla (en el centro, donde la demanda espontánea ya llena los huecos) "
               "falla por mucho; la ajustada reduce la pérdida media a costa de acertar menos. La Sección 5.7 pone a prueba esta "
               "idea con validación cruzada.")
        e5, e6 = e["e5"], e["e6"]
        kr = d.pol_e2("policonsultorio", d.ganadora("policonsultorio"))["kRec"]
        r5 = next(x for x in e5["porK"] if x["k"] == kr)
        self.p(f"La {self.F('e56')} muestra el **riesgo** (E5): la distribución día a día de la ganancia por dar k sobreturnos frente a "
               f"no darlos, en el policonsultorio. Con el k recomendado ({kr}) la ganancia media es {pesos(r5['media'])} por día, pero en "
               f"{pct(r5['pNegativo'], 0)} de los días los sobreturnos rinden menos que no darlos: la decisión es buena en promedio, no "
               f"en cada día. La **precisión** (E6) confirma la ley 1/√R: la pendiente del semiancho contra R en escala logarítmica es "
               f"{f(e6['pendiente'], 3)} (R² = {f(e6['r2'], 4)}).")
        self.figura("e56", fg.riesgo_precision(e, DIR_FIG / "e56.png"),
                    "E5 y E6: distribución diaria de B(k) − B(0) en el policonsultorio y semiancho del IC de B según la cantidad de réplicas")
        self.h2("5.6 Por qué gana cada política")
        self.p("Para explicar el mecanismo se simularon 500 días con trazas completas y números aleatorios comunes, en el k recomendado "
               "de las dos políticas que compiten en cada escenario, y se midieron perfiles por franjas de 30 minutos. La "
               f"{self.F('mec')} muestra el ocio de los médicos y la espera de los pacientes con turno; la {self.T('mec')}, los "
               "totales por día.")
        self.figura("mec", fg.mecanismo(d.comp, DIR_FIG / "mec.png"),
                    "Mecanismo de las políticas: ocio de los médicos y espera de los pacientes con turno por franja de 30 minutos")
        filas = []
        for m in d.comp["mecanismo"]:
            for cfg in m["configs"]:
                t = cfg["perfil"]["totales"]
                filas.append([NOMBRE_PRESET_M[m["preset"]], f"{NOMBRE_POL_M[cfg['politica']]} (k = {cfg['k']})", f(t["ocio"]["media"], 1),
                              f"{f(t['esperaTurno']['media'], 2)} ± {f(t['esperaTurno']['semi'], 2)}", f"{f(t['horasExtra']['media'], 1)} ± {f(t['horasExtra']['semi'], 1)}",
                              f(t["abandonos"]["media"], 2), pesos(t["beneficio"]["media"])])
        self.tabla("mec", f"Totales por día de las políticas que compiten ({d.comp['mecanismo'][0]['configs'][0]['perfil']['R']} días, IC 95 %)",
                   ["Escenario", "Política", "Ocio [min]", "Espera turno [min]", "Horas extra [min]", "Aban- donos", "B"], filas,
                   anchos=[2.7, 3.5, 1.4, 2.4, 2.4, 1.4, 2.2], tam=8.5)
        ci, cm = d.mec("centro", "inicio")["perfil"]["totales"], d.mec("centro", "mayor_ausentismo")["perfil"]["totales"]
        pi, pm = d.mec("policonsultorio", "inicio")["perfil"]["totales"], d.mec("policonsultorio", "mayor_ausentismo")["perfil"]["totales"]
        self.p("La apertura de cada turno tiene un **ocio estructural**: el médico llega con algo de demora y el primer paciente puede "
               "faltar. Ese hueco absorbe aproximadamente un sobreturno. En el centro, donde el k recomendado es 1, ponerlo al inicio "
               f"llena ese hueco y el día termina antes: las horas extra bajan de {f(cm['horasExtra']['media'], 1)} a "
               f"{f(ci['horasExtra']['media'], 1)} minutos por día, y eso compensa el pequeño aumento de la espera. En el "
               f"policonsultorio, con k = 2, el segundo sobreturno al inicio ya no encuentra hueco y forma una cola que se arrastra "
               f"toda la mañana: la espera de los turnos sube de {f(pm['esperaTurno']['media'], 2)} a {f(pi['esperaTurno']['media'], 2)} "
               f"minutos, y conviene repartirlos donde más se falta aunque eso cueste algo más de horas extra. Los cupos usados y la "
               f"demanda espontánea son prácticamente iguales entre políticas: la diferencia no pasa por los espontáneos sino por cómo "
               f"se reparten el ocio de la apertura, la espera y las horas extra.")
        self.h2("5.7 ¿Existe una regla que evite simular?")
        ex = d.comp["regla"]["excedentes"]
        self.p("La hipótesis natural para explicar el fallo de la regla en el centro es que los espontáneos ya llenan parte de los huecos "
               "de los ausentes. Se probó una regla corregida, k = round(α·p̄·N̄ − β·ē), donde ē es la cantidad de espontáneos por "
               f"profesional y por día que excede sus cupos ({f(ex['chico']['media'], 2)} en el chico, {f(ex['policonsultorio']['media'], 2)} "
               f"en el policonsultorio y {f(ex['centro']['media'], 2)} en el centro). Para no evaluarla con los mismos datos con que se "
               f"ajusta, se usó **validación dejando un escenario afuera**: cada regla se ajusta con dos escenarios y se evalúa en el "
               f"tercero, rotando. La {self.T('loo')} muestra el resultado.")
        filas = []
        nombres = {"ingenua": "Ingenua", "alfa": "Un α", "alfaBeta": "Corregida (α, β)"}
        for p in PRESETS:
            for n in ["ingenua", "alfa", "alfaBeta"]:
                ev = d.loo(p, n)
                r = ev["regla"]
                aj = "—" if r["tipo"] == "ingenua" else (f"α = {f(r['alfa'], 2)}" + (f", β = {f(r['beta'], 2)}" if r["tipo"] == "alfaBeta" else ""))
                per = ev["perdida"]
                filas.append([NOMBRE_PRESET_M[p], nombres[n], aj, "$ 0" if abs(per["media"]) < 0.5 else f"{pesos(per['media'])} {icp(per['inf'], per['sup'])}",
                              f"{ev['aciertos']} de {ev['total']}"])
        self.tabla("loo", "Validación dejando un escenario afuera: pérdida media por día en el escenario evaluado (IC 95 %) y aciertos",
                   ["Evaluado en", "Regla", "Ajustada con los otros dos", "Pérdida por día", "Aciertos"], filas,
                   anchos=[2.6, 2.6, 3.2, 4.4, 1.6])
        pi_, pa, pb = d.loo_promedio("ingenua"), d.loo_promedio("alfa"), d.loo_promedio("alfaBeta")
        self.p(f"En promedio de los tres pliegues, la ingenua pierde {pesos(pi_[0])} por día y acierta {pi_[1]} de {pi_[2]}; la de un α, "
               f"{pesos(pa[0])} y {pa[1]} de {pa[2]}; la corregida, {pesos(pb[0])} y {pb[1]} de {pb[2]}. La corrección va en la dirección "
               "de la hipótesis cuando el centro entra en el ajuste, pero **no generaliza al centro**: sin él, los otros dos escenarios "
               "tienen casi el mismo ē y β no se puede estimar. Con tres escenarios no hay una regla universal validable; round(p̄·N̄) "
               "sirve como primera aproximación cuando los cupos cubren la demanda espontánea, y **cada consultorio se tiene que simular**.")

    # ---------------------------------------------------------------- 6. Dinámica de sistemas
    def dinamica(self):
        d = self.d
        din = d.din
        prm = din["parametros"]
        self.h1("6. Dinámica de sistemas")
        self.p("La simulación de eventos discretos responde qué pasa en un día. Dos preguntas quedan fuera de esa escala: qué se pierde "
               "al mirar solo valores medios (Parte A) y qué efecto tienen los sobreturnos, semana a semana, sobre la lista de espera, "
               "que a su vez determina la anticipación de los turnos y, por lo tanto, el ausentismo (Parte B).")
        self.h2("6.1 Parte A: modelo fluido contra eventos discretos")
        self.p("El modelo fluido representa la sala de espera de un día como un stock continuo y determinista, con los mismos parámetros "
               "medios que la simulación: la entrada son las llegadas medias (turnos que vienen, sobreturnos y espontáneos) y la salida, "
               "la capacidad de atención. Se integró con Euler y se comparó con la media de 500 días de la simulación de eventos "
               f"discretos ({self.F('fluido')} y {self.T('fluido')}).")
        self.figura("fluido", fg.fluido(d.comp, DIR_FIG / "fluido.png"),
                    "Pacientes en sala a lo largo del día: modelo fluido contra la media de la simulación de eventos discretos (banda: IC 95 %)")
        filas = [[str(c["k"]), f(c["fluidoArea"], 1), f"{f(c['desArea']['media'], 1)} ± {f(c['desArea']['semi'], 1)}", f(c["fluidoEspera"], 2),
                  f"{f(c['desEspera']['media'], 2)} ± {f(c['desEspera']['semi'], 2)}", "× " + f(c["desEspera"]["media"] / c["fluidoEspera"], 2)]
                 for c in d.comp["fluido"]]
        self.tabla("fluido", "Modelo fluido contra eventos discretos (policonsultorio, sobreturnos intercalados)",
                   ["k", "Área en sala fluido [pac·min]", "Área ED (IC 95 %)", "Espera fluido [min]", "Espera ED (IC 95 %)", "Subestimación"],
                   filas, anchos=[0.8, 2.8, 2.8, 2.2, 2.6, 2])
        self.p("El modelo fluido **subestima la espera** entre 2 y casi 4 veces. Fuera de la apertura de cada turno predice cola cero, "
               "porque la capacidad media supera a la entrada media; en la simulación, la variabilidad de la atención, la puntualidad y "
               "las llegadas espontáneas generan cola aunque la capacidad alcance, como anticipa la fórmula de Pollaczek-Khinchine. La "
               "subestimación relativa es menor con k = 2 porque al subir la carga media una parte de la cola pasa a ser «determinista». "
               "Las decisiones de sobreturnos no se pueden tomar con un modelo de medias: el costo de espera que equilibra al ocio "
               "aparece solo con la variabilidad.")
        self.h2("6.2 Parte B: la lista de espera")
        self.p(f"El stock es la lista de espera L, en pacientes, y el tiempo se mide en días calendario. La capacidad de atención es "
               f"C(k) = n·(N̄ + k)·dh/7 turnos por día, con n profesionales, N̄ turnos reservables por profesional, k sobreturnos y dh "
               f"días hábiles por semana. Por la Ley de Little, la anticipación media de los turnos es a = L/C. Las relaciones son:")
        self.lista([
            "**R1 · ausentismo que se realimenta (refuerzo):** L ↑ → a ↑ → ausentismo ↑ → reingresos ↑ → L ↑. Cuanto más lejos queda el "
            "turno, más pacientes faltan, y una parte de ellos vuelve a pedir turno.",
            "**B1 · desaliento (balance):** L ↑ → a ↑ → desaliento ↑ → demanda efectiva ↓ → L ↓. Con la espera larga, parte de los "
            "pacientes se atiende en otro lado.",
            "**B2 · consumo (balance):** L ↑ → turnos dados ↑ (hasta la capacidad) → L ↓.",
            "**B3 · política adaptativa (balance):** ausentismo observado ↑ → k ↑ → C ↑ → a ↓ → ausentismo ↓.",
        ])
        ruta = fg.diagramas_apilados(CAPTURAS / "28-ds-estructura-claro.png", DIR_FIG / "ds_diagramas.png")
        self.figura("ds_diagramas", ruta, "Diagrama causal con sus bucles y diagrama de stocks y flujos de la lista de espera (captura de la aplicación)", ancho=12.5)
        self.p("La ecuación del stock es:")
        self.ec("dL/dt = D(t)·(1 − d(a)) + r·p(a)·S − S,   S = mín(C, L/τ)")
        self.p("donde D es la demanda de turnos, d(a) el desaliento (rampa lineal desde el umbral u), p(a) el ausentismo con "
               "anticipación media a (la misma logística del modelo del día, aplicada a la tabla de anticipación reescalada), r la "
               "fracción de ausentes que vuelve a pedir turno, S los turnos que se consumen y τ el tiempo mínimo hasta el turno. El "
               "beneficio de cada día sale de la tabla de E3 (beneficio medio por día según k y ausentismo), escalada por la fracción "
               f"de la agenda que se usa: es el **acople** entre el modelo de semanas y el de eventos discretos. La {self.T('ds_param')} "
               "muestra los parámetros.")
        filas = [
            ["n, profesionales", ent(prm["profesionales"]), "escenario policonsultorio"],
            ["N̄, turnos reservables por profesional y día", f(prm["turnosPorProfesional"], 2), "agenda sin cupos"],
            ["dh, días hábiles por semana", ent(prm["diasHabiles"]), "supuesto"],
            ["C(0), capacidad sin sobreturnos", f(din["capacidad0"], 2) + " turnos/día", "n·N̄·dh/7"],
            ["D₀, demanda base", f(prm["demandaBase"], 2) + f" pac/día ({f(din['demandaRelativa'], 3)}·C(0))", "calibrada (Sección 6.3)"],
            ["r, ausentes que vuelven", pct(prm["reingreso"], 0), "supuesto"],
            ["Desaliento: umbral u, ancho, máximo", f"{f(prm['desaliento']['umbral'], 0)} d, {f(prm['desaliento']['ancho'], 0)} d, {pct(prm['desaliento']['maximo'], 0)}", "supuesto (u calibrado, Sección 6.3)"],
            ["τ, tiempo mínimo hasta el turno", f(prm["tiempoMinimo"], 0) + " día", "supuesto"],
            ["Pico de demanda", f"+{pct(prm['pico']['aumento'], 0)} desde la semana {prm['pico']['inicio']}, {prm['pico']['duracion']} semanas", "escenario de invierno"],
        ]
        self.tabla("ds_param", "Parámetros del modelo de la lista de espera", ["Parámetro", "Valor", "Origen"], filas,
                   anchos=[6, 4.2, 3.8], alinear=[u.IZQUIERDA] * 3)
        self.h2("6.3 Equilibrio, estabilidad y biestabilidad")
        eqs = {e_["k"]: e_ for e_ in din["equilibrios"]}
        e0 = eqs[0]["eqs"][0]
        self.p("Con demanda constante, el equilibrio es la anticipación a* en la que el flujo neto se anula, g(a*) = 0, con "
               "g(a) = D·(1 − d(a)) − mín(C, a·C/τ)·(1 − r·p(a)). La ecuación es lineal en D, de modo que la demanda que pone el "
               f"equilibrio sin sobreturnos en la anticipación del modelo del día ({f(e0['a'], 2)} días) se despeja exactamente: "
               f"D₀ = {f(prm['demandaBase'], 2)} pacientes por día, {f(din['demandaRelativa'], 3)} veces la capacidad. El consultorio de "
               f"hoy queda saturado: la demanda potencial supera la capacidad y el desaliento ({pct(e0['d'])}) la equilibra. La "
               f"{self.T('ds_eq')} muestra los equilibrios con cada k.")
        bi = d.dinamica_extra["biestabilidad"]
        filas = [[str(e_["k"]), f(e_["C"], 2), f(q["a"], 3), f(q["L"], 1), pct(q["p"], 2), pct(q["d"], 2), "sí" if q["saturado"] else "no",
                  f"{'estable' if q['estable'] else 'INESTABLE'} (g′ = {f(q['pendiente'], 3)})"] for e_ in din["equilibrios"] for q in e_["eqs"]]
        filas += [[f"0 (u = {bi['umbral']} d)", f(din["capacidad0"], 2), f(q["a"], 3), f(q["L"], 1), pct(q["p"], 2), pct(q["d"], 2),
                   "sí" if q["saturado"] else "no", f"{'estable' if q['estable'] else 'INESTABLE'} (g′ = {f(q['pendiente'], 3)})"] for q in bi["equilibrios"]]
        self.tabla("ds_eq", "Equilibrios de la lista de espera (las últimas filas: variante con desaliento desde los 14 días)",
                   ["k", "C [turnos por día]", "a* [días]", "L*", "p*", "d*", "Saturado", "Estabilidad"], filas,
                   anchos=[1.9, 2.1, 1.5, 1.2, 1.4, 1.4, 1.4, 3.2])
        b_inest = next(q for q in bi["equilibrios"] if not q["estable"])
        self.p(f"La estabilidad mostró un hallazgo propio de la dinámica de sistemas. Entre τ y el umbral de desaliento solo actúa el "
               f"bucle de refuerzo R1, y allí g crece con a: **todo equilibrio saturado con a* menor que el umbral es inestable**. Si el "
               f"desaliento empieza a los {bi['umbral']} días, la demanda que pone el equilibrio en {f(b_inest['a'], 2)} días "
               f"({f(bi['demandaRelativa'], 3)}·C) genera **tres equilibrios**: una lista casi vacía (estable), el estado de hoy "
               f"(inestable) y una lista larga frenada por el desaliento (estable). El sistema es **biestable**: cualquier perturbación lo "
               f"saca del estado de hoy, y un pico de demanda lo dejaría en la lista larga aunque después la demanda vuelva a la normal "
               f"(**histéresis**). Como un estado observado y estacionario tiene que ser un equilibrio estable, el umbral se fijó en "
               f"{f(prm['desaliento']['umbral'], 0)} días: con él, el equilibrio de cada k es único y estable, y cada sobreturno por "
               f"profesional acorta la anticipación en alrededor de un día.")
        self.h2("6.4 Tres políticas ante un pico de demanda")
        pols = din["politicas"]
        self.p(f"Se compararon tres políticas que arrancan del estado de hoy: sin sobreturnos, k fijo = {din['kFijo']} (el recomendado por "
               f"el estudio) y un **k adaptativo**, que cada semana elige el k de mayor beneficio en la tabla de E3 con el ausentismo "
               f"observado la semana anterior ({self.F('lista')} y {self.T('ds_pol')}).")
        self.figura("lista", fg.lista_espera(d.dinamica_extra, DIR_FIG / "lista.png"),
                    "Lista de espera y ausentismo de las tres políticas ante un pico de demanda (sombreado: semanas del pico)")
        nombres = ["Sin sobreturnos (k = 0)", f"k fijo = {din['kFijo']}", "k adaptativo"]
        filas = [[n, f(x["Lmax"], 1), f(x["amax"], 2), pct(x["pmax"], 1), ent(x["picoAtendidos"]), ent(x["picoPerdidos"]), pesos(x["beneficio"]),
                  ent(x["perdidos"])] for n, x in zip(nombres, pols)]
        self.tabla("ds_pol", f"Tres políticas ante el pico (pico: semana {prm['pico']['inicio']} a {prm['pico']['inicio'] + prm['pico']['duracion'] + 6}; totales en {prm['horizonteSemanas']} semanas)",
                   ["Política", "L máx.", "a máx. [d]", "p máx.", "Atendidos (pico)", "Perdidos (pico)", "Beneficio", "Perdidos"], filas,
                   anchos=[3.3, 1.3, 1.4, 1.3, 1.9, 1.8, 2.8, 1.5])
        ks = pols[2]["kSemanal"]
        self.p(f"Dar sobreturnos acorta la lista, lo que baja la anticipación, el ausentismo y el desaliento: los bucles R1 y B1 trabajan "
               f"a favor. Con el ausentismo de hoy, el adaptativo elige el mismo k que el estudio ({ks[0]}) y solo sube a {max(ks)} durante "
               f"{sum(1 for x in ks if x > ks[0])} semanas del pico. Frente al k fijo pierde {ent(pols[1]['picoPerdidos'] - pols[2]['picoPerdidos'])} "
               f"pacientes menos en el pico y gana {pesos(pols[2]['beneficio'] - pols[1]['beneficio'])} en {prm['horizonteSemanas']} semanas; "
               f"frente a no dar sobreturnos, la diferencia es de {pesos(pols[2]['beneficio'] - pols[0]['beneficio'])}.")
        self.h2("6.5 Sensibilidad a los supuestos sin dato")
        self.p("El reingreso, el desaliento y el pico no tienen respaldo en datos. Se los varió de a uno, recalibrando en cada variante "
               f"la demanda base para que el estado de hoy siga siendo el del estudio ({self.F('tornado')} y {self.T('ds_sens')}).")
        self.figura("tornado", fg.tornado(din, DIR_FIG / "tornado.png"),
                    "Tornados: cambio de la ventaja del adaptativo sobre el k fijo respecto de la base (* = el estado de hoy no es un equilibrio estable)")
        nom = {"reingreso": "Reingreso r", "desalientoMaximo": "Desaliento máximo", "umbral": "Umbral u [días]", "aumento": "Magnitud del pico",
               "duracion": "Duración del pico [sem]"}
        val = lambda s: pct(s["valor"], 0) if s["parametro"] in ("reingreso", "desalientoMaximo", "aumento") else f(s["valor"], 0)  # noqa: E731
        gana = {-1: "empate", 0: "k = 0", 1: "k fijo", 2: "adaptativo"}
        filas = [[nom[s["parametro"]], val(s) + (" (base)" if s["esBase"] else ""), f(s["demandaRelativa"], 3), "sí" if s["estable"] else "no",
                  pesos(s["difBeneficio"]), ent(s["difPerdidos"]), gana[s["ganaBeneficio"]], gana[s["ganaPerdidos"]]] for s in din["sensibilidad"]]
        self.tabla("ds_sens", "Sensibilidad de a un supuesto (diferencias: adaptativo − k fijo, en el horizonte)",
                   ["Supuesto", "Valor", "D₀/C", "Hoy estable", "Δ beneficio", "Δ perdidos", "Gana en B", "Gana en perdidos"], filas,
                   anchos=[2.8, 1.8, 1.2, 1.4, 2.2, 1.5, 1.8, 2.1], mantener_junta=False)
        difs = [s["difBeneficio"] for s in din["sensibilidad"] if s["estable"] and s["difBeneficio"] > 0.5]
        k2 = [s["politicas"][1]["beneficio"] - s["politicas"][0]["beneficio"] for s in din["sensibilidad"]]
        self.p(f"«El adaptativo no pierde en beneficio» es **robusto**: gana en {sum(s['ganaBeneficio'] == 2 for s in din['sensibilidad'])} de las "
               f"{len(din['sensibilidad'])} variantes y empata cuando el pico es chico, porque entonces elige k = {ks[0]} todas las semanas. "
               f"«El adaptativo gana por mucho» **no lo es**: con el estado de hoy estable, la ventaja va de {pesos(min(difs))} a "
               f"{pesos(max(difs))} en el horizonte y crece con el tamaño y la duración del pico. Lo que pesa en todas las variantes es "
               f"dar sobreturnos: k fijo = {din['kFijo']} contra k = 0 vale de {pesos(min(k2))} a {pesos(max(k2))}. La conclusión deja de "
               f"valer en perdidos cuando el desaliento empieza tarde (u ≥ 14 días), justamente las variantes en que el estado de hoy es "
               f"inestable.")
        self.h2("6.6 Integración numérica")
        conv = din["convergencia"]
        ref = conv["referencia"]
        self.p(f"El modelo se integró con Euler y con RK4 y se comparó con una referencia RK4 de paso 0,01 día "
               f"({self.F('conv')} y {self.T('ds_conv')}).")
        self.figura("conv", fg.convergencia(din, DIR_FIG / "conv.png"), "Error en la lista final según el paso de integración (escalas logarítmicas)", ancho=10)
        filas = [["Euler" if x["metodo"] == "euler" else "RK4", f(x["dt"], 2), f(x["Lmax"], 3), cient(x["errorLmax"], 2), f(x["Lfinal"], 3),
                  cient(x["errorLfinal"], 2), pesos(x["errorBeneficio"])] for x in conv["filas"]]
        self.tabla("ds_conv", f"Convergencia numérica (k fijo; referencia: L máx. {f(ref['Lmax'], 3)}, L final {f(ref['Lfinal'], 3)})",
                   ["Método", "dt [días]", "L máx.", "Error", "L final", "Error", "Error en B"], filas, anchos=[1.6, 1.6, 2, 2, 2, 2, 2])
        self.p("Euler converge con orden 1: dividir el paso por cuatro divide el error por alrededor de cuatro. RK4 es mucho más preciso "
               "en la lista final y en el beneficio, pero en el máximo de la lista su ventaja es chica: el modelo tiene quiebres (el "
               "mínimo del consumo, la rampa del desaliento y el escalón del pico) y en ellos RK4 pierde su orden 4. La aplicación usa "
               "RK4 con paso 0,25 día, con un error muy por debajo de un paciente.")

    # ---------------------------------------------------------------- 7. Datos reales
    def datos_reales(self):
        d = self.d
        ej = d.datos_ejemplo
        self.h1("7. Uso con datos reales")
        self.p("Para que un consultorio use la herramienta con sus propios datos, la aplicación tiene una pantalla que importa dos "
               "registros simples en CSV: los **tiempos de atención** medidos (profesional, tipo de paciente y duración) y el "
               "**historial de asistencia** (días de anticipación y si el paciente vino). Para comprobar que el procedimiento funciona, "
               f"se generaron datos de ejemplo ficticios con el propio modelo y la semilla {ej['semilla']}, con parámetros conocidos, y se "
               "verificó que el ajuste los recupera.")
        self.h2("7.1 Ajuste de los tiempos de atención")
        g = d.grupo("P1", "control")
        self.p(f"Para cada grupo (profesional × tipo de paciente) se ajustan por **máxima verosimilitud** tres familias continuas, con "
               f"sus errores estándar de la información de Fisher: la **lognormal** (μ y σ son la media y el desvío de ln x), la "
               f"**gamma** (el parámetro de forma se obtiene por Newton sobre ln α − ψ(α) = ln x̄ − media de ln x) y la **exponencial** "
               f"(la media muestral). Se agrega la **discreta empírica** al minuto, como en el TP5. La bondad de ajuste se mide con "
               f"Kolmogorov-Smirnov y con χ² en clases equiprobables bajo cada ajuste (k = 2·n^{{0,4}}, con al menos cinco esperadas "
               f"por clase). La {self.T('aj_grupo')} y la {self.F('ajuste')} muestran el grupo de controles del primer profesional "
               f"(n = {g['n']}; verdaderos: media {f(g['verdadero']['media'], 0)} min y cv {f(g['verdadero']['cv'], 1)}).")
        filas = []
        for a in g["ajustes"]:
            par = "; ".join(f"{x['nombre']} = {f(x['valor'], 3)} ± {f(x['ee'], 3)}" for x in a["parametros"]) if a["familia"] != "empirica" else f"{ent(a['parametros'][0]['valor'])} valores"
            filas.append([a["familia"].capitalize() if a["familia"] != "empirica" else "Empírica", par, f(a["aic"], 1),
                          f(a["ks"]["D"], 3) if a["ks"] else "—", ("< 0,001" if a["ks"]["p"] < 0.001 else f(a["ks"]["p"], 3)) if a["ks"] else "—",
                          f"{f(a['chi2']['estadistico'], 2)} ({a['chi2']['gl']})" if a["chi2"] else "—",
                          ("< 0,001" if a["chi2"]["p"] < 0.001 else f(a["chi2"]["p"], 3)) if a["chi2"] else "—"])
        self.tabla("aj_grupo", f"Ajustes del grupo de controles del primer profesional (n = {g['n']})",
                   ["Familia", "Parámetros (MV ± EE)", "AIC", "KS: D", "KS: p", "χ² (gl)", "χ²: p"], filas,
                   anchos=[1.8, 6, 1.3, 1.2, 1.2, 1.8, 1.2], alinear=[u.IZQUIERDA, u.IZQUIERDA] + [u.CENTRO] * 5)
        self.figura("ajuste", fg.ajuste_tiempos(g, DIR_FIG / "ajuste.png"),
                    "Histograma de las duraciones con las densidades ajustadas y gráfico QQ contra la lognormal ajustada")
        dentro, total, aic = d.recuperacion()
        filas = []
        for x in ej["grupos"]:
            ln = d.ajuste(x, "lognormal")["parametros"]
            ok = lambda par, v: "✔" if abs(par["valor"] - v) <= 1.96 * par["ee"] else "✘"  # noqa: E731
            filas.append([x["nombreProfesional"], TIPO[x["tipo"]], ent(x["n"]), f"{f(x['verdadero']['mu'], 3)} / {f(ln[0]['valor'], 3)} {ok(ln[0], x['verdadero']['mu'])}",
                          f"{f(x['verdadero']['sigma'], 3)} / {f(ln[1]['valor'], 3)} {ok(ln[1], x['verdadero']['sigma'])}", x["mejorAIC"]])
        self.tabla("aj_recup", "Recuperación de los parámetros en los 12 grupos (verdadero / estimado; ✔ = dentro del IC 95 %)",
                   ["Profesional", "Tipo", "n", "μ", "σ", "Menor AIC"], filas, anchos=[2.8, 2, 1, 3.4, 3.4, 2], mantener_junta=False)
        self.p(f"{dentro} de los {total} parámetros caen dentro de su intervalo de confianza del 95 %, lo esperable para un "
               f"procedimiento bien calibrado ({f(0.95 * total, 1)}). La exponencial se rechaza en todos los grupos (KS y χ² con p < 0,001), "
               f"y ni KS ni χ² rechazan la lognormal en ninguno. El AIC elige la lognormal en {aic.get('lognormal', 0)} grupos y la gamma en "
               f"{aic.get('gamma', 0)}: con muestras de 40 a 200 datos, dos familias asimétricas con la misma media y el mismo cv son "
               "difíciles de distinguir, y la elección de la familia no es concluyente. Lo que sí se identifica bien es la media y el cv, "
               "que es lo que usa el modelo.")
        self.p(f"Para llevar el ajuste al escenario, cada duración se divide por la D de su profesional y se ajusta la familia elegida por "
               f"tipo de paciente: el factor de cada tipo es la media ajustada de duración/D, y el cv común es el promedio ponderado de "
               f"los cv por tipo ({self.T('aj_aplic')}). Gamma y empírica, que el modelo no tiene, se aplican como una lognormal con la misma "
               f"media y cv.")
        ap = ej["aplicado"]
        filas = [[c["campo"], c["antes"], c["despues"]] for c in ap["cambios"]]
        self.tabla("aj_aplic", "Parámetros del escenario: verdaderos (los que generaron los datos) contra estimados", ["Parámetro", "Verdadero", "Estimado"],
                   filas, anchos=[6, 2.5, 2.5])
        self.h2("7.2 Regresión logística del ausentismo")
        lg = ej["logistica"]
        self.p(f"El ausentismo se modela como P(falta | d) = 1/(1 + e^{{−(β₀ + β₁·d)}}). Los coeficientes se estiman por máxima verosimilitud "
               f"con Newton-Raphson y sus errores estándar salen de la inversa de la matriz de información, (XᵀWX)⁻¹. Sobre {ent(lg['n'])} turnos "
               f"de ejemplo ({ent(lg['faltas'])} faltas), el método convergió en {lg['iteraciones']} iteraciones ({self.T('logit')} y "
               f"{self.F('logit')}).")
        self.tabla("logit", "Regresión logística sobre los datos de ejemplo", ["Coeficiente", "Verdadero", "Estimado ± EE", "IC 95 %"], [
            ["β₀", f(lg["verdadero"]["beta0"], 4), f"{f(lg['beta0'], 4)} ± {f(lg['ee0'], 4)}", ic(lg["beta0"] - 1.96 * lg["ee0"], lg["beta0"] + 1.96 * lg["ee0"], 3)],
            ["β₁ [1/día]", f(lg["verdadero"]["beta1"], 4), f"{f(lg['beta1'], 4)} ± {f(lg['ee1'], 4)}", ic(lg["beta1"] - 1.96 * lg["ee1"], lg["beta1"] + 1.96 * lg["ee1"], 3)],
        ], anchos=[2.5, 2.5, 3.5, 3.5])
        self.figura("logit", fg.logistica(lg, DIR_FIG / "logit.png"),
                    "Proporción de faltas observada por anticipación (IC 95 % de Wilson), curva estimada y curva verdadera", ancho=11)
        gr = ej["logisticaGrande"]
        self.p(f"Los dos coeficientes verdaderos quedan dentro de su intervalo. Con {ent(gr['n'])} turnos el error estándar de β₁ baja a "
               f"{f(gr['ee1'], 4)}: el estimador es consistente. Los cálculos se contrastaron con scipy y con una implementación "
               "independiente en numpy, y coinciden (Anexo C).")

    # ---------------------------------------------------------------- 8. Herramienta
    def herramienta(self):
        d = self.d
        nav = d.navegador
        self.h1("8. La herramienta")
        self.h2("8.1 Arquitectura")
        self.p("La aplicación es una página web sin servidor: todo, incluida la simulación, corre en el navegador del usuario. Está "
               "escrita en TypeScript estricto, con React para la interfaz, y las corridas pesadas se reparten entre Web Workers (uno "
               f"por núcleo del procesador). El motor de simulación, las distribuciones y las pruebas estadísticas se implementaron en "
               f"el proyecto, sin librerías de simulación ni de estadística. La {self.T('arquitectura')} resume los módulos.")
        self.tabla("arquitectura", "Módulos del proyecto", ["Módulo", "Contenido"], [
            ["src/motor", "Generador xoshiro128∗∗ con flujos por fuente, distribuciones por transformada inversa, calendario de eventos, recursos y colas, estadística y teoría de colas. TypeScript puro, sin acceso al navegador."],
            ["src/modelo", "El policonsultorio: esquema del escenario validado con zod, escenarios, agenda con pre-muestreo por identidad, simulación de un día, métricas y traza."],
            ["src/experimentos", "Monte Carlo: tareas por bloques de réplicas, pool de Web Workers, análisis pareado, selección del mejor con Bonferroni y el estudio E1–E6."],
            ["src/dinamica", "Modelo fluido del día y lista de espera: equilibrios, estabilidad, Euler y RK4, sensibilidad."],
            ["src/datos", "Ajuste de distribuciones, Kolmogorov-Smirnov, χ², regresión logística y lectura de CSV."],
            ["src/ui", "Pantallas, animación de la traza en canvas y gráficos."],
        ], anchos=[3, 11], alinear=[u.IZQUIERDA, u.JUSTIFICADO])
        self.h2("8.2 Recorrido por la aplicación")
        self.p(f"La pantalla de inicio plantea la pregunta y ofrece los tres escenarios ({self.F('cap_inicio')}). La simulación del día "
               "reproduce la traza del modelo: no vuelve a simular, solo dibuja lo que pasó ({self.F('cap_sim')}).".replace("{self.F('cap_sim')}", self.F("cap_sim")))
        self.figura("cap_inicio", fg.recortar_captura(CAPTURAS / "01-inicio-claro.png", DIR_FIG / "cap_inicio.png"),
                    "Pantalla de inicio: la pregunta, los escenarios y una miniatura de la planta en vivo")
        self.figura("cap_sim", fg.recortar_captura(CAPTURAS / "07-simulacion-policonsultorio-claro.png", DIR_FIG / "cap_sim.png"),
                    "Simulación del día: planta del policonsultorio, agenda de cada consultorio e indicadores en vivo")
        self.p(f"La comparación muestra el mismo día con y sin sobreturnos, con los mismos pacientes gracias a los números aleatorios "
               f"comunes ({self.F('cap_comp')}). La pantalla de datos permite cargar los registros del Capítulo 7 y aplicar los ajustes "
               f"al escenario ({self.F('cap_datos')}).")
        self.figura("cap_comp", fg.recortar_captura(CAPTURAS / "09-comparacion-policonsultorio-claro.png", DIR_FIG / "cap_comp.png"),
                    "Comparación sincronizada: el mismo día sin sobreturnos y con sobreturnos intercalados, con la misma semilla")
        self.figura("cap_datos", fg.recortar_captura(CAPTURAS / "35-datos-tiempos-claro.png", DIR_FIG / "cap_datos.png", (0, 0.255, 1, 0.705)),
                    "Pantalla de datos: ajuste de tiempos de atención con tabla comparativa, histograma y gráfico QQ")
        self.h2("8.3 Reproducibilidad")
        self.p("Toda la aleatoriedad sale de la semilla, de modo que la misma semilla reproduce el mismo día y el mismo estudio. Cada réplica "
               "se simula por separado y los agregados se calculan después en un orden fijo, por lo que el estudio da un resultado "
               "**idéntico bit a bit** con cualquier cantidad de hilos en un mismo motor de JavaScript; lo controla un test y el JSON "
               "trae una huella (un hash de todos los valores diarios).")
        self.p(f"Entre motores distintos apareció un hallazgo de reproducibilidad. Node {d.motores['node']} (V8 {d.motores['v8']}) y Chrome "
               f"{d.motores['chrome']} redondean distinto el último bit de Math.exp y Math.log: sobre {d.valores_redondeo} valores, las dos "
               f"funciones dan resultados distintos en algún caso, y el beneficio de un día difiere en el orden de 10⁻¹⁶ relativo (por "
               f"ejemplo, $ {d.ejemplo_redondeo[0]} contra …{d.ejemplo_redondeo[1]}). La huella del estudio cambia, pero las decisiones no: "
               f"corrido completo en el navegador con {nav['hilos']} Web Workers ({f(nav['segundos'], 0)} s), **{nav['decisionesIguales']} de "
               f"{nav['decisiones']} decisiones** son idénticas a las del estudio de Node (mejor k, conjuntos, recomendados, política "
               f"ganadora, α), y las medias de B difieren a lo sumo en {cient(nav['maxDifRelativa'])} relativo. Garantizar la igualdad bit a "
               f"bit entre motores exigiría reemplazar las funciones matemáticas del lenguaje, y no hace falta para la decisión.")
        self.p(f"El código está en un repositorio público. Cada cambio en la rama principal corre los {d.tests['total']} tests y publica la "
               f"aplicación con GitHub Actions; los resultados precalculados se regeneran con scripts y los números de este informe se "
               f"leen de esos resultados.")

    # ---------------------------------------------------------------- 9. Conclusiones
    def conclusiones(self):
        d = self.d
        din = d.din
        g = {p: d.ganadora(p) for p in PRESETS}
        k = {p: d.pol_e2(p, g[p])["kRec"] for p in PRESETS}
        b = {p: d.pol_e2(p, g[p])["B"]["media"] for p in PRESETS}
        b0 = {p: d.punto(d.e1(p, g[p]), 0)["B"]["media"] for p in PRESETS}
        e3 = d.est["e3"]["ausentismo"]
        base = next(s for s in din["sensibilidad"] if s["esBase"])
        fl = d.comp["fluido"]
        dentro, total, _ = d.recuperacion()
        mut = d.mutacion
        self.h1("9. Conclusiones")
        bloques = []

        def P(t):
            self.p(t)
            bloques.append(t)

        def H(t):
            self.h2(t)
            bloques.append(f"### {t}")

        H("9.1 Respuesta a los objetivos")
        P(f"**Modelo validado.** Se construyó un simulador de eventos discretos propio que reproduce, dentro de intervalos de confianza "
          f"simultáneos, los resultados exactos de M/M/c, M/G/1 y una red de Jackson, y cumple la Ley de Little en cada réplica. El modelo "
          f"del consultorio pasa casos deterministas, de conservación y límite, y la suite detecta {sum(m['fallan'] > 0 for m in mut['mutantes'])} "
          f"de {len(mut['mutantes'])} mutantes (el restante es equivalente). Los escenarios se calibraron contra metas fijadas de antemano en tres "
          f"iteraciones; cuatro de cinco metas se cumplen y el abandono queda como limitación documentada.")
        P(f"**Cuántos sobreturnos y dónde.** Con números aleatorios comunes y selección del mejor con Bonferroni, la recomendación es "
          f"{k['chico']} sobreturnos por día {NOMBRE_POL[g['chico']]} en el consultorio chico, {k['policonsultorio']} "
          f"{NOMBRE_POL[g['policonsultorio']]} en el policonsultorio y {k['centro']} {NOMBRE_POL[g['centro']]} del turno en el centro, con "
          f"ganancias de {pesos(b['chico'] - b0['chico'])}, {pesos(b['policonsultorio'] - b0['policonsultorio'])} y "
          f"{pesos(b['centro'] - b0['centro'])} por día frente a no dar sobreturnos. La ubicación importa: al final de la agenda nunca "
          f"conviene, y el mejor lugar depende de cuántos se den.")
        P("**Mecanismo y regla práctica.** La apertura de cada turno tiene un ocio estructural que absorbe un sobreturno: con uno conviene "
          "ponerlo al inicio, con dos o más el segundo ya forma cola y conviene repartirlos donde más se falta. Ninguna regla del tipo "
          "«reponer a los que se espera que falten», ni siquiera corregida por la demanda espontánea, generaliza a los tres escenarios "
          "cuando se la valida dejando un escenario afuera: la decisión depende de la interacción entre ausentismo, cupos y demanda "
          "espontánea, y cada consultorio se tiene que simular.")
        P(f"**Lista de espera.** A escala de semanas, dar sobreturnos acorta la lista y baja el ausentismo, y el k del estudio "
          f"({din['kFijo']}) es casi lo que pide un ajuste semanal: el k adaptativo nunca pierde, pero gana poco "
          f"({pesos(base['difBeneficio'])} en {din['parametros']['horizonteSemanas']} semanas en el caso base). Con el desaliento demorado "
          f"el sistema se vuelve biestable y muestra histéresis. El modelo fluido subestima la espera entre "
          f"{f(min(c['desEspera']['media'] / c['fluidoEspera'] for c in fl), 1)} y {f(max(c['desEspera']['media'] / c['fluidoEspera'] for c in fl), 1)} "
          f"veces: es la variabilidad, no la carga media, la que genera la espera que se negocia contra el ocio.")
        P(f"**Datos reales y herramienta.** El ajuste por máxima verosimilitud y la regresión logística recuperan los parámetros de datos "
          f"generados con valores conocidos ({dentro} de {total} dentro de su IC 95 %; β₀ y β₁ dentro del suyo). La aplicación está publicada, "
          f"corre en el navegador y es reproducible con semilla.")
        H("9.2 Recomendación práctica para un consultorio")
        P("Para un consultorio que quiera usar sobreturnos, el procedimiento que se desprende del trabajo es:")
        items = [
            "Medir el ausentismo según la anticipación del turno (alcanza con registrar, para cada turno, cuántos días antes se dio y si "
            "el paciente vino) y estimar la curva logística: es el dato que más mueve la decisión.",
            "Medir una muestra de tiempos de atención por tipo de paciente y ajustar su distribución; con unas decenas de consultas por "
            "tipo se estiman bien la media y la variabilidad.",
            f"Simular el consultorio propio con esos datos antes de decidir. Como referencia de los escenarios estudiados: con un ausentismo "
            f"cercano al 15 %, empezar con uno a tres sobreturnos por profesional y por día, y subir hasta "
            f"{max(x['curva']['kRec'] for x in e3)} solo con ausentismos del orden de {pct(e3[-1]['p'], 0)}.",
            "No poner los sobreturnos al final de la agenda. Con un sobreturno, el inicio del turno; con más, en los intervalos con más "
            "probabilidad de ausencia.",
            "Revisar la decisión cuando cambie el ausentismo (por ejemplo, en una temporada de demanda alta), y aceptar que algunos días "
            "los sobreturnos rinden menos que no darlos: la decisión es buena en promedio.",
        ]
        self.lista(items, numerada=True)
        bloques.extend(f"{i + 1}. {t}" for i, t in enumerate(items))
        H("9.3 Limitaciones")
        P("Todos los datos son ficticios. El abandono de la demanda espontánea queda por encima de la meta en los tres escenarios. Una "
          "misma política de cupos no sigue la demanda de cada especialidad. El costo de la hora extra (1,5 veces el de ocio) es una "
          "convención, aunque el estudio informa la sensibilidad. Las urgencias no interrumpen consultas. En la lista de espera, el "
          "beneficio de cada semana se toma de días con la agenda llena y se escala cuando la lista es corta, y el reingreso, el "
          "desaliento y el pico son supuestos sin dato, acotados por la sensibilidad de a un supuesto pero sin explorar sus interacciones.")
        H("9.4 Trabajo futuro")
        P("Las extensiones con más valor son calibrar el modelo con los registros de un consultorio real usando la pantalla de datos; "
          "probar cupos distintos por especialidad y reglas de prioridad para los espontáneos que bajen el abandono; incorporar la "
          "reprogramación de turnos y la interrupción por urgencias; y llevar la sensibilidad de la lista de espera a un diseño factorial "
          "que mida las interacciones entre supuestos.")
        self.textos["Conclusiones"] = bloques

    # ---------------------------------------------------------------- 10. Referencias y anexos
    def referencias(self):
        self.h1("10. Referencias")
        refs = [
            "Blackman, D. y Vigna, S. (2021). Scrambled linear pseudorandom number generators. ~~ACM Transactions on Mathematical Software~~, 47(4), artículo 36. https://doi.org/10.1145/3460772",
            "Burke, P. J. (1956). The output of a queuing system. ~~Operations Research~~, 4(6), 699–704. https://doi.org/10.1287/opre.4.6.699",
            "Cayirli, T. y Veral, E. (2003). Outpatient scheduling in health care: a review of literature. ~~Production and Operations Management~~, 12(4), 519–549.",
            "Jackson, J. R. (1957). Networks of waiting lines. ~~Operations Research~~, 5(4), 518–521. https://doi.org/10.1287/opre.5.4.518",
            "Kingman, J. F. C. (1961). The single server queue in heavy traffic. ~~Mathematical Proceedings of the Cambridge Philosophical Society~~, 57(4), 902–904. https://doi.org/10.1017/S0305004100036094",
            "LaGanga, L. R. y Lawrence, S. R. (2007). Clinic overbooking to improve patient access and increase provider productivity. ~~Decision Sciences~~, 38(2), 251–276. https://doi.org/10.1111/j.1540-5915.2007.00158.x",
            "Law, A. M. (2015). ~~Simulation Modeling and Analysis~~ (5.ª ed.). McGraw-Hill Education.",
            "Lewis, P. A. W. y Shedler, G. S. (1979). Simulation of nonhomogeneous Poisson processes by thinning. ~~Naval Research Logistics Quarterly~~, 26(3), 403–413. https://doi.org/10.1002/nav.3800260304",
            "Little, J. D. C. (1961). A proof for the queuing formula: L = λW. ~~Operations Research~~, 9(3), 383–387. https://doi.org/10.1287/opre.9.3.383",
            "Sterman, J. D. (2000). ~~Business Dynamics: Systems Thinking and Modeling for a Complex World~~. McGraw-Hill.",
            "Universidad Tecnológica Nacional, Facultad Regional San Rafael. Simulación: apuntes de cátedra, Capítulos 1 a 7 (Simulación; Números pseudoaleatorios; Aplicaciones de la simulación; Optimización de la línea de montaje; Dinámica de sistemas).",
        ]
        for r in refs:
            par = self.p(r, alinear=u.IZQUIERDA, despues=6)
            par.paragraph_format.left_indent = u.Cm(0.8)
            par.paragraph_format.first_line_indent = u.Cm(-0.8)

    def anexos(self):
        d = self.d
        self.h1("Anexo A. Supuestos del modelo")
        self.p(f"Supuestos del modelo del día ({len(d.supuestos)}) y del modelo de la lista de espera ({len(d.supuestos_ds)}), tal como están "
               "documentados en el repositorio (docs/modelo-conceptual.md y docs/dinamica-sistemas.md). Las referencias a secciones remiten a "
               "esos documentos, y #2, #2b, #2c, #2d y #4 son las etapas del proyecto en las que se introdujo o corrigió cada supuesto.")
        self.tabla("supuestos", "Supuestos del modelo del día", ["N.º", "Supuesto"], [[a, b] for a, b in d.supuestos],
                   anchos=[1.2, 14.8], alinear=[u.CENTRO, u.JUSTIFICADO], tam=8.5, mantener_junta=False)
        self.tabla("supuestos_ds", "Supuestos del modelo de la lista de espera", ["N.º", "Supuesto"], [[a, b] for a, b in d.supuestos_ds],
                   anchos=[1.2, 14.8], alinear=[u.CENTRO, u.JUSTIFICADO], tam=8.5, mantener_junta=False)
        self.h1("Anexo B. Parámetros de los escenarios")
        filas = []
        for pr in d.presets:
            for prof in pr["profesionales"]:
                filas.append([pr["nombre"].split(" (")[0], prof["nombre"], ESPECIALIDAD[prof["especialidad"]], "mañana" if prof["turno"] == "manana" else "tarde",
                              str(prof["D"]), f"{prof['slots']} ({prof['slotsCupo']})", f(prof["cOcio"], 0), f(prof["cExtra"], 0)])
        self.tabla("presets", "Profesionales de los escenarios congelados (intervalos: total y cupos para espontáneos; costos en $/min)",
                   ["Escenario", "Profesional", "Especialidad", "Turno", "D", "Intervalos", "c_ocio", "c_extra"], filas,
                   anchos=[2.6, 2.8, 2.4, 1.4, 0.8, 1.8, 1.4, 1.4], mantener_junta=False)
        for pr in d.presets:
            e = pr["espontaneos"]
            self.p(f"**{pr['nombre']}:** {pr['admision']['recepcionistas']} {'recepcionista' if pr['admision']['recepcionistas'] == 1 else 'recepcionistas'}; demanda espontánea de {f(e['totalDia'], 1)} llegadas "
                   f"por día, {pct(e['proporcionUrgencias'], 0)} urgencias; ocupación de la agenda {pct(pr['profesionales'][0]['ocupacion'], 0)}; "
                   f"cupos 1 de cada {pr['profesionales'][0]['cupos']} intervalos.", despues=4)
        self.h1("Anexo C. Pruebas automatizadas")
        t = d.tests
        self.p(f"La suite tiene {t['total']} tests en {len(t['archivos'])} archivos; todos pasan ({t['pasan']}). Se ejecuta con npm test y en "
               "cada publicación.")
        self.tabla("tests", "Catálogo de pruebas automatizadas", ["Archivo", "Tests", "Qué controla"],
                   [[a["archivo"], str(a["tests"]), "; ".join(a["grupos"])[:230]] for a in t["archivos"]],
                   anchos=[4.6, 1.2, 10.2], alinear=[u.IZQUIERDA, u.CENTRO, u.IZQUIERDA], tam=8, mantener_junta=False)
        self.h1("Anexo D. Declaración de uso de herramientas de inteligencia artificial")
        self.p("El desarrollo del código y la redacción de este informe se hicieron con asistencia de Claude (Anthropic), un modelo de "
               "lenguaje, bajo un método de trabajo en dos niveles: un asistente analizó y planificó cada paso y otro lo implementó y "
               "reportó los resultados. El alumno definió el problema, tomó las decisiones de modelado y de criterio, revisó y validó cada "
               "resultado y fue el intermediario entre ambos. Todos los números del informe provienen de la ejecución del código del "
               "proyecto, y las referencias bibliográficas se verificaron en las bases de datos de las editoriales.")

    # ---------------------------------------------------------------- ensamblado
    def construir(self):
        self.caratula()
        self.indice()
        self.resumen()
        self.introduccion()
        self.fundamentos()
        self.modelo()
        self.validacion()
        self.experimentos()
        self.dinamica()
        self.datos_reales()
        self.herramienta()
        self.conclusiones()
        self.referencias()
        self.anexos()
        assert self.fig == len(FIGURAS) and self.tab == len(TABLAS), f"faltan figuras ({self.fig}/{len(FIGURAS)}) o tablas ({self.tab}/{len(TABLAS)})"
        u.numerar_paginas(self.doc)
        u.finalizar(self.doc)
        prop = self.doc.core_properties
        prop.title = "Proyecto Integrador — Sobreturnos: simulación de un policonsultorio"
        prop.author = "Tomás Agustín Romero"
        prop.subject = "Simulación — UTN FRSR"
        SALIDA.parent.mkdir(exist_ok=True)
        self.doc.save(SALIDA)
        TEXTOS.write_text("\n\n".join(f"## {k}\n\n" + "\n\n".join(v) for k, v in self.textos.items()), encoding="utf-8")
        print(f"  [informe] {SALIDA.relative_to(RAIZ)} ({self.fig} figuras, {self.tab} tablas)")


def main():
    d = Datos()
    n = verificar_narrativa(d)
    print(f"  [verificación] {n} afirmaciones del texto respaldadas por los resultados")
    Informe(d).construir()
    import guion
    guion.generar(d)
    if "--sin-pdf" not in sys.argv:
        import a_pdf
        a_pdf.exportar([SALIDA, guion.SALIDA])


if __name__ == "__main__":
    main()
