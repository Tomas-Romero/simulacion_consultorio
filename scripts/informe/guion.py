"""Guion de la defensa oral (informe/Guion_Defensa_Romero.docx): estructura de 15 minutos, recorrido de la demo
sobre el sitio publicado, hoja de cifras clave, preguntas probables y plan B. Las cifras salen de los mismos
resultados que el informe (datos_informe.Datos)."""

import docx_utils as u
from datos_informe import DEMO, NOMBRE_POL, NOMBRE_POL_M, NOMBRE_PRESET_M, PRESETS, RAIZ, REPO, Datos, cient, cifras_recomendacion, ent, f, pct, pesos

SALIDA = RAIZ / "informe" / "Guion_Defensa_Romero.docx"
PLANTILLA = RAIZ.parent / "Capitulo 4 - Practica TP3" / "TP4_Romero Tomas_Caminante_al_Azar.docx"


def generar(d: Datos):
    doc = u.crear_documento(PLANTILLA)
    t = {"n": 0}

    def tabla(texto, enc, filas, **kw):
        t["n"] += 1
        u.tabla_datos(doc, t["n"], texto, enc, filas, **kw)

    def p(texto, **kw):
        kw.setdefault("interlineado", 1.1)
        kw.setdefault("despues", 5)
        return u.parrafo(doc, texto, **kw)

    g = {x: d.ganadora(x) for x in PRESETS}
    cr = cifras_recomendacion(d)
    k = {x: cr[x]["k"] for x in PRESETS}
    b = {x: {"media": cr[x]["brec"], "semi": cr[x]["brecSemi"]} for x in PRESETS}
    b0 = {x: cr[x]["b0"] for x in PRESETS}
    din = d.din
    base = next(s for s in din["sensibilidad"] if s["esBase"])
    fl = {c["k"]: c for c in d.comp["fluido"]}
    dentro, total, aic = d.recuperacion()
    lg = d.datos_ejemplo["logistica"]
    mut = d.mutacion
    nav = d.navegador
    mmc3 = next(c for c in d.validacion["mmc"]["casos"] if c["c"] == 3)
    wq = next(m for m in mmc3["comparaciones"] if m["nombre"].startswith("Wq"))
    mg1 = d.validacion["modelo"]["casos"][0]["comparaciones"][0]
    cal = {p["nombre"].split(" (")[0]: p["indicadores"] for p in d.calibracion["presets"]}
    pol = din["politicas"]
    ri = d.e4_resumen("ingenua")

    # ---------------------------------------------------------------- portada breve
    u.parrafo(doc, "Simulación · UTN FRSR · 2026", alinear=u.CENTRO, despues=2, interlineado=None, tam=11, color=u.GRIS)
    u.parrafo(doc, "Guion de la defensa", alinear=u.CENTRO, despues=2, interlineado=None, tam=20, negrita=True, color=u.OSCURO)
    u.parrafo(doc, "Sobreturnos: simulación de un policonsultorio", alinear=u.CENTRO, despues=2, interlineado=None, tam=14, negrita=True, color=u.NARANJA)
    u.parrafo(doc, "Tomás Agustín Romero · Legajo 10289", alinear=u.CENTRO, despues=14, interlineado=None, tam=11, color=u.GRIS)
    p(f"**Sitio:** {DEMO}   ·   **Repositorio:** {REPO}", alinear=u.CENTRO, tam=9.5)

    # ---------------------------------------------------------------- 1. estructura
    doc.add_heading("1. Estructura de 15 minutos", level=1)
    bloques = [
        ["0:00 – 1:30", "El problema", "Uno de cada siete pacientes con turno no viene. El sobreturno recupera horas pero trae espera y horas extra. Pregunta: cuántos y dónde."],
        ["1:30 – 3:00", "El modelo", "Eventos discretos, un día terminante, cinco clases de pacientes, cuatro políticas. Criterio: beneficio neto B; C solo de contraste."],
        ["3:00 – 4:30", "Por qué creerle", "Validación contra M/M/c, M/G/1 y Jackson; Little en cada réplica; mutación; calibración con metas a priori y la limitación del abandono."],
        ["4:30 – 9:30", "Demo en vivo", "Recorrido de la Sección 2: un día, la comparación con la misma semilla, los resultados, los experimentos."],
        ["9:30 – 12:00", "Resultados", f"Recomendación por escenario ({k['chico']} / {k['policonsultorio']} / {k['centro']}), por qué gana cada política, no hay regla universal."],
        ["12:00 – 13:30", "Lista de espera", "Dinámica de sistemas: sobreturnos acortan la lista; el adaptativo no pierde pero gana poco; biestabilidad e histéresis."],
        ["13:30 – 14:30", "Datos reales", "Ajuste por máxima verosimilitud, KS y χ², logística; recuperan los parámetros conocidos."],
        ["14:30 – 15:00", "Cierre", "Recomendación práctica y limitaciones. Pasar a preguntas."],
    ]
    tabla("Bloques de la exposición", ["Tiempo", "Bloque", "Mensaje"], bloques, anchos=[2.2, 2.6, 11.2], alinear=[u.CENTRO, u.IZQUIERDA, u.IZQUIERDA])

    # ---------------------------------------------------------------- 2. demo
    doc.add_heading("2. Recorrido de la demo", level=1)
    p("Abrir el sitio antes de empezar, en modo claro (se lee mejor en el proyector) y con el escenario por defecto. Si el escenario "
      "quedó modificado, en Escenario elegir «Policonsultorio». La comparación usa el k y la política elegidos en la propia pantalla "
      "(por defecto, 3 sobreturnos intercalados).")
    pasos = [
        ["1", DEMO + "#/", "Leer la pregunta. Señalar la miniatura en vivo y los pictogramas de las cinco clases (forma + color)."],
        ["2", DEMO + "#/escenario", "Mostrar los tres profesionales del policonsultorio, la curva de ausentismo según la anticipación y los costos derivados (c_ocio del honorario, c_extra = 1,5 × c_ocio). Todo validado en vivo."],
        ["3", DEMO + "#/simulacion?t=10:40", "Reproducir unos segundos. La animación no vuelve a simular: dibuja la traza. Mostrar un ausente (borde punteado), un espontáneo esperando y el panel en vivo."],
        ["4", DEMO + "#/simulacion?comparar=1&t=11:20", "El mismo día, mismos pacientes: a la izquierda sin sobreturnos, a la derecha con sobreturnos. Señalar el ocio que desaparece y la cola que aparece. Mirar ΔB al final del día: un solo día no decide."],
        ["5", DEMO + "#/resultados", "Gantt por profesional (ocio dentro del turno, horas extra después de la línea), sala de espera en el tiempo y desglose de B y C."],
        ["6", DEMO + "#/experimentos", f"Curva B(k) con su banda y el conjunto de óptimos (sección a). Políticas (b): {NOMBRE_POL[g['policonsultorio']]} gana en el policonsultorio; mostrar el perfil de ocio de la apertura. Regla práctica (d): no generaliza."],
        ["7", DEMO + "#/dinamica", "Diagrama causal (R1, B1, B2, B3). Las tres políticas ante el pico y el tornado: el adaptativo no pierde pero gana poco."],
        ["8", DEMO + "#/datos", "«Usar datos de ejemplo» en tiempos y en asistencia: la tabla de ajustes, el QQ y la logística recuperan los parámetros. Botón «Aplicar al escenario»."],
    ]
    pasos = [[n, url.replace(DEMO, ""), txt] for n, url, txt in pasos]
    p(f"Todas las direcciones empiezan con **{DEMO}**; la tabla muestra lo que va después.", despues=4)
    tabla("Pantallas, dirección exacta y qué decir", ["Paso", "Dirección", "Qué decir"], pasos, anchos=[1, 5.4, 9.6],
          alinear=[u.CENTRO, u.IZQUIERDA, u.IZQUIERDA], tam=8.5, mantener_junta=False)

    # ---------------------------------------------------------------- 3. cifras clave
    doc.add_heading("3. Hoja de cifras clave", level=1).paragraph_format.page_break_before = True
    cifras = [
        ["Validación del motor", f"M/M/3: Wq teórico {f(wq['teorico'], 2)} min, simulado {f(wq['media'], 2)} min; Little con error < {pct(max(c['maxErrorL'] for c in d.validacion['mmc']['casos']), 2)}"],
        ["Validación del modelo", f"M/G/1: Wq teórico {f(mg1['teorico'], 2)} min, simulado {f(mg1['media'], 2)} min (Pollaczek-Khinchine)"],
        ["Mutación", f"{sum(m['fallan'] > 0 for m in mut['mutantes'])} de {len(mut['mutantes'])} mutantes detectados (el otro es equivalente)"],
        ["Tests", f"{d.tests['total']} tests, todos pasan"],
        ["Calibración", "utilización " + " / ".join(pct(c["utilizacion"]) for c in cal.values()) + "; abandono " + " / ".join(pct(c["abandono"]) for c in cal.values()) + " (meta < 5 %: limitación)"],
        ["Estudio", f"entre {ent(min(x['curva']['R'] for x in d.est['e1']))} y {ent(max(x['curva']['R'] for x in d.est['e1']))} días por configuración (R duplicado en el centro), semilla {d.est['semilla']}, Bonferroni; huella {d.est['huella']}"],
    ]
    for x in PRESETS:
        c = cr[x]
        cifras.append([f"Recomendación: {NOMBRE_PRESET_M[x].lower()}",
                       f"{k[x]} {NOMBRE_POL[g[x]]}: {pesos(b0[x])} → {pesos(b[x]['media'])} por día; ganancia pareada +{pesos(c['ganancia'])} "
                       f"[{pesos(c['gananciaInf'])}; {pesos(c['gananciaSup'])}] (serie E1, R = {ent(c['R'])})"])
    cifras += [
        ["Regla ingenua round(p̄·N̄)", f"acierta {ri['dentro']} de {ri['total']}; pérdida media {pesos(ri['perdidaMedia'])}/día; no generaliza dejando un escenario afuera"],
        ["Modelo fluido", f"subestima la espera × {f(fl[0]['desEspera']['media'] / fl[0]['fluidoEspera'], 1)} (k = 0) y × {f(fl[2]['desEspera']['media'] / fl[2]['fluidoEspera'], 1)} (k = 2)"],
        ["Lista de espera", f"D₀ = {f(din['demandaRelativa'], 3)}·C, a* = 11,95 d; adaptativo − k fijo = {pesos(base['difBeneficio'])} en {din['parametros']['horizonteSemanas']} semanas"],
        ["Biestabilidad", "con desaliento desde 14 días: 3 equilibrios (estable, inestable, estable)"],
        ["Datos de ejemplo", f"{dentro} de {total} parámetros en su IC; β₀ = {f(lg['beta0'], 3)} ± {f(lg['ee0'], 3)}, β₁ = {f(lg['beta1'], 4)} ± {f(lg['ee1'], 4)}"],
        ["Node contra Chrome", f"{nav['decisionesIguales']} de {nav['decisiones']} decisiones idénticas; B difiere ≤ {cient(nav['maxDifRelativa'])}"],
    ]
    tabla("Cifras para tener a mano", ["Tema", "Cifra"], cifras, anchos=[4.2, 11.8], alinear=[u.IZQUIERDA, u.IZQUIERDA], tam=8.5)

    # ---------------------------------------------------------------- 4. preguntas
    doc.add_heading("4. Preguntas probables", level=1).paragraph_format.page_break_before = True
    preguntas = [
        ("¿Por qué simular y no usar teoría de colas?",
         "Las fórmulas exactas piden llegadas de Poisson y un sistema estacionario. Acá hay turnos programados, ausentismo según la anticipación, puntualidad, demanda espontánea con prioridades, abandono y un día que empieza vacío y termina. Las fórmulas se usaron para validar el motor, no para decidir."),
        ("¿Por qué números aleatorios comunes?",
         "Para que la diferencia entre dos k sea efecto del k y no del azar. Cada paciente tiene su propio flujo según su identidad: agregar un sobreturno no cambia a ningún otro paciente, y la diferencia pareada tiene mucha menos varianza."),
        ("¿Qué es el conjunto de óptimos indistinguibles?",
         "El mejor k estimado más todos los k cuya diferencia con él no es significativa con Bonferroni. Dentro del conjunto se recomienda el menor: el mismo beneficio esperado con menos espera, horas extra y variabilidad."),
        ("¿Por qué Bonferroni?",
         "Porque se compara el mejor contra seis k a la vez; sin corrección la probabilidad de declarar una diferencia falsa crece. Bonferroni es conservador pero simple y garantiza el nivel conjunto."),
        ("¿Por qué falló la paciencia exponencial?",
         f"No tiene memoria: el 10,5 % se iba en los primeros 5 minutos, algo inverosímil en una sala de espera. Se reemplazó por una lognormal de media 60 minutos. Aun así, el abandono no llega a la meta: lo produce la regla de prioridades con la agenda llena, no la paciencia (ni con 12 horas de paciencia baja de {f(d.paciencia[-1]['abandono'], 1)} %)."),
        ("¿Por qué B y no C?",
         "C no cuenta los ingresos: trata el ocio como costo pero no premia la consulta ganada. B resta lo que cuesta (espera, horas extra, perdidos) y suma lo que se factura. C + B no es constante porque las consultas en horas extra y las más cortas rompen la equivalencia; por eso pueden recomendar k distintos, y C se informa como contraste."),
        ("¿Por qué el costo de la hora extra es 1,5 veces el del ocio?",
         "Por coherencia: un minuto fuera de hora no puede costar menos que uno del turno normal. 1,5 es una convención; el estudio informa la sensibilidad entre 1 y 2 y el k no sube con la hora extra más cara."),
        ("¿Cómo eligieron R?",
         f"R inicial de {ent(d.est['R0'])} días y una regla de precisión: duplicar R en la serie mientras el semiancho de las diferencias alrededor del mejor supere {pesos(d.est['umbral'])}. Se duplicó en {sum(x['curva']['R'] > d.est['R0'] for x in d.est['e1'])} series del centro, que llegaron a {ent(max(x['curva']['R'] for x in d.est['e1']))} días. E6 confirma la ley 1/√R (pendiente {f(d.est['e6']['pendiente'], 3)})."),
        ("¿Por qué no hay calentamiento?",
         "Porque es una simulación TERMINANTE: la jornada empieza con el consultorio vacío a las 08:00 y termina vacía cuando se va el último paciente o médico. No hay un régimen estacionario que estimar: el transitorio de la mañana es parte de lo que se quiere medir, y cada réplica es un día completo. Distinto es la validación M/M/c, que compara con fórmulas de régimen estacionario: ahí sí se descartó un período de calentamiento, justificado con el método de Welch."),
        ("¿Cómo saben que el código hace lo que dicen?",
         f"Casos con solución exacta, casos límite, conservación de pacientes, Little en cada réplica y {d.tests['total']} tests. Además una prueba de mutación: se rompieron reglas a propósito y los tests lo detectaron en {sum(m['fallan'] > 0 for m in mut['mutantes'])} de {len(mut['mutantes'])} casos; el otro mutante no cambia el comportamiento."),
        ("¿La calibración no es ajustar los datos hasta que dé lo que quieren?",
         "Las metas se fijaron antes, nunca se miró k durante la calibración, se usaron semillas distintas para explorar, verificar y experimentar, y se dejaron los presets congelados. Lo que no se pudo cumplir (el abandono) se informa como limitación."),
        ("¿Por qué gana una política distinta en el centro?",
         "Porque el centro recomienda un solo sobreturno, y ese uno entra en el ocio estructural de la apertura del turno: al inicio el día termina antes. Con dos o más, el segundo forma cola y conviene repartirlos donde más se falta."),
        ("¿Por qué no hay una regla simple?",
         "Porque la regla ingenua acierta donde los cupos cubren la demanda espontánea y falla en el centro. La corrección por espontáneos va en la dirección correcta, pero con validación dejando un escenario afuera no generaliza: con tres escenarios no se puede validar una regla universal."),
        ("¿Qué agrega la dinámica de sistemas?",
         "La escala de semanas: la lista de espera determina la anticipación, que determina el ausentismo. Muestra que los sobreturnos acortan la lista y bajan el ausentismo, que el ajuste semanal gana poco y que con desaliento tardío hay biestabilidad e histéresis."),
        ("¿Por qué cambiaron el umbral de desaliento a 7 días?",
         "Porque con 14 días el estado de hoy (11,95 días de anticipación) era un equilibrio inestable: por debajo del umbral solo actúa el bucle de refuerzo. Un estado observado y estacionario tiene que ser estable. La variante con 14 días se muestra como hallazgo."),
        ("¿Por qué el modelo fluido falla tanto?",
         "Porque trabaja con medias: si la capacidad media supera a la entrada media, predice cola cero. La espera la genera la variabilidad, como dice Pollaczek-Khinchine."),
        ("¿Cómo se usaría con datos reales?",
         "Con dos registros simples: duración de las consultas por tipo y, por cada turno, la anticipación y si el paciente vino. La pantalla Datos ajusta distribuciones, estima la logística y aplica los resultados al escenario. Después se corre el laboratorio."),
        ("¿KS con parámetros estimados es válido?",
         "El valor p de Kolmogorov es conservador cuando los parámetros se estiman de la misma muestra (Lilliefors). Se usa para comparar familias, junto con χ² y el AIC, no como prueba exacta."),
        ("¿Qué limita el modelo?",
         "Datos ficticios; el abandono por encima de la meta; una misma política de cupos para todas las especialidades; urgencias que no interrumpen; la convención de 1,5 para la hora extra; y en la lista de espera, supuestos sin dato (reingreso, desaliento, pico) evaluados de a uno."),
        ("¿Por qué el resultado del navegador no es idéntico al de Node?",
         f"Node y Chrome redondean distinto el último bit de Math.exp y Math.log. El beneficio de un día difiere en ~10⁻¹⁶ relativo; las {nav['decisiones']} decisiones del estudio son idénticas."),
        ("¿Qué hizo la IA y qué hiciste vos?",
         "Usé Claude como asistente para programar y redactar, con un método en dos niveles. Yo definí el problema, tomé las decisiones de modelado y de criterio y revisé y validé cada resultado. Está declarado en el informe."),
    ]
    for i, (q, r) in enumerate(preguntas, 1):
        par = p(f"**{i}. {q}**", despues=1, alinear=u.IZQUIERDA)
        par.paragraph_format.keep_with_next = True
        p(r, despues=6)

    # ---------------------------------------------------------------- 5. plan B
    doc.add_heading("5. Plan B si falla internet", level=1)
    u.lista(doc, [
        "Llevar el repositorio clonado y las dependencias instaladas. Desde la carpeta del proyecto: npm run dev, y abrir http://localhost:5173. "
        "Todo corre en el navegador, sin servidor externo: la demo es idéntica.",
        "Las mismas URL del recorrido funcionan cambiando el comienzo por http://localhost:5173/ (por ejemplo, http://localhost:5173/#/simulacion?comparar=1&t=11:20).",
        "Si tampoco funciona la computadora del aula: las capturas de docs/capturas/ (pantallas en claro y en oscuro, una por sección) y el PDF del informe en un pendrive.",
        "Antes de la defensa: abrir una vez cada pantalla para que el navegador tenga en caché el estudio y los resultados.",
    ], numerada=True)

    u.numerar_paginas(doc)
    u.finalizar(doc)
    prop = doc.core_properties
    prop.title = "Guion de la defensa — Sobreturnos"
    prop.author = "Tomás Agustín Romero"
    doc.save(SALIDA)
    print(f"  [guion]   {SALIDA.relative_to(RAIZ)} ({len(preguntas)} preguntas)")
    return [q for q, _ in preguntas]
