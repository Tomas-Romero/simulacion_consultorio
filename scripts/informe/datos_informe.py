"""Lectura de los resultados para el informe y el guion, formato de números y verificación de la narrativa.

Fuentes (nada se escribe a mano):
- public/resultados/estudio.json, complementos.json, dinamica.json (estudio, análisis complementarios y
  dinámica de sistemas, precalculados por los scripts del proyecto);
- informe/datos/*.json (scripts/informe/datos.ts: validación, calibración vigente, presets, datos de
  ejemplo, biestabilidad, tests, mutación y comparación en el navegador);
- docs/*.md (registro histórico de la calibración, supuestos y la medición del redondeo Node/Chrome).
"""

import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
RESULTADOS = RAIZ / "public" / "resultados"
DATOS = RAIZ / "informe" / "datos"
DOCS = RAIZ / "docs"
CAPTURAS = RAIZ / "docs" / "capturas"
DEMO = "https://tomas-romero.github.io/simulacion_consultorio/"
REPO = "https://github.com/Tomas-Romero/simulacion_consultorio"

PRESETS = ["chico", "policonsultorio", "centro"]
NOMBRE_PRESET = {"chico": "consultorio chico", "policonsultorio": "policonsultorio", "centro": "centro completo"}
NOMBRE_PRESET_M = {"chico": "Consultorio chico", "policonsultorio": "Policonsultorio", "centro": "Centro completo"}
POLITICAS = ["inicio", "intercalado", "mayor_ausentismo", "final"]
NOMBRE_POL = {"inicio": "al inicio", "intercalado": "intercalados", "mayor_ausentismo": "donde más se falta", "final": "al final"}
NOMBRE_POL_M = {k: v[0].upper() + v[1:] for k, v in NOMBRE_POL.items()}


# ==========================================
# Formato
# ==========================================
def f(x, d: int = 2) -> str:
    """Número con coma decimal, punto de miles y signo menos tipográfico."""
    s = f"{abs(x):,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("−" if x < 0 and round(abs(x), d) != 0 else "") + s


def ent(x) -> str:
    return f(round(x), 0)


def pesos(x) -> str:
    return ("−" if x < 0 and round(x) != 0 else "") + "$ " + f(abs(round(x)), 0)


def pct(x, d: int = 1) -> str:
    return f(100 * x, d) + " %"


def ic(inf, sup, d: int = 2) -> str:
    return f"[{f(inf, d)}; {f(sup, d)}]"


def icp(inf, sup) -> str:
    return f"[{pesos(inf)}; {pesos(sup)}]"


def conjunto(c) -> str:
    return "{" + ", ".join(str(k) for k in c) + "}"


def cient(x, d: int = 1) -> str:
    m, e = f"{x:.{d}e}".split("e")
    return f"{m.replace('.', ',')}·10^{{{int(e)}}}"


def _json(ruta: Path):
    return json.loads(ruta.read_text(encoding="utf-8"))


# ==========================================
# Tablas en markdown de docs/
# ==========================================
def tabla_md(texto: str, despues_de: str) -> list[list[str]]:
    """Primera tabla markdown que aparece después del encabezado `despues_de` (sin la fila de guiones)."""
    i = texto.index(despues_de)
    filas = []
    for linea in (l.strip() for l in texto[i:].splitlines()[1:]):
        if linea.startswith("|"):
            celdas = [c.strip() for c in linea.strip().strip("|").split("|")]
            if not all(set(c) <= set("-: ") for c in celdas):
                filas.append(celdas)
        elif filas:
            break
    return filas


def limpiar(celda: str) -> str:
    return celda.replace("**", "").replace("✔", "").replace("✘", "").strip()


def numero(celda: str) -> float:
    t = limpiar(celda).replace("%", "").replace("$", "").strip()
    return float(t.replace(".", "").replace(",", ".")) if "," in t else float(t)


def supuestos_md(texto: str, desde: str, prefijo: str) -> list[tuple[str, str]]:
    """Lista de supuestos '- **S1.** texto' (con continuación en líneas siguientes) desde un encabezado."""
    bloque = texto[texto.index(desde):]
    patron = re.compile(r"^- \*\*(" + prefijo + r"\d+)\.\*\* (.*)$")
    out, actual = [], None
    for linea in bloque.splitlines()[1:]:
        m = patron.match(linea)
        if m:
            actual = [m.group(1), m.group(2)]
            out.append(actual)
        elif actual and linea.startswith("  ") and linea.strip():
            actual[1] += " " + linea.strip().lstrip("- ")
        elif linea.startswith("#") or (linea.strip() == "" and out and not linea.startswith(" ")):
            if linea.startswith("#"):
                break
            actual = None
    limpio = lambda s: re.sub(r"`([^`]*)`", r"\1", s).replace("**", "").replace("\\*", "*")  # noqa: E731
    return [(a, limpio(b)) for a, b in out]


# ==========================================
# Datos
# ==========================================
class Datos:
    def __init__(self):
        self.est = _json(RESULTADOS / "estudio.json")
        self.comp = _json(RESULTADOS / "complementos.json")
        self.din = _json(RESULTADOS / "dinamica.json")
        for nombre in ["validacion", "calibracion", "presets", "datos-ejemplo", "dinamica-extra", "tests", "mutacion", "navegador"]:
            ruta = DATOS / f"{nombre}.json"
            if not ruta.exists():
                raise FileNotFoundError(f"falta {ruta}: correr npx tsx scripts/informe/datos.ts")
            setattr(self, nombre.replace("-", "_"), _json(ruta))
        self.md_cal = (DOCS / "calibracion.md").read_text(encoding="utf-8")
        self.md_mod = (DOCS / "modelo-conceptual.md").read_text(encoding="utf-8")
        self.md_exp = (DOCS / "experimentos.md").read_text(encoding="utf-8")
        self.md_din = (DOCS / "dinamica-sistemas.md").read_text(encoding="utf-8")
        self.supuestos = supuestos_md(self.md_mod, "## 12. Supuestos", "S")
        self.supuestos_ds = supuestos_md(self.md_din, "### B.5 Supuestos", "SD")
        self._historia_calibracion()
        m = re.search(r"Node (\d+\.\d+) \(V8 ([\d.]+)\) y\s+Chrome (\d+)", self.md_exp)
        self.motores = {"node": m.group(1), "v8": m.group(2), "chrome": m.group(3)}
        m = re.search(r"\$([\d.]+,\d+) contra …(\d+)", self.md_exp)
        self.ejemplo_redondeo = (m.group(1), m.group(2))
        m = re.search(r"sobre ([\d ]+) valores", self.md_exp)
        self.valores_redondeo = m.group(1).strip()

    # -------------------------------------------------- calibración histórica (docs/calibracion.md)
    def _historia_calibracion(self):
        t73 = tabla_md(self.md_cal, "### 7.3 Metas")
        t94 = tabla_md(self.md_cal, "### 9.4 Metas")
        filas, preset = [], None
        for tabla, etapas in [(t73, {"calibración #2b": "#2b", "nueva calibración": "#2c"}), (t94, {"nueva (congelada)": "#2d (congelada)"})]:
            for celdas in tabla[1:]:
                preset = limpiar(celdas[0]) or preset
                etapa = limpiar(celdas[1])
                if etapa in etapas:
                    filas.append({"preset": preset, "etapa": etapas[etapa], "util": numero(celdas[2]), "aus": numero(celdas[3]),
                                  "espera": numero(celdas[4]), "extra": numero(celdas[5]), "abandono": numero(celdas[6])})
        self.cal_historia = filas
        t5 = tabla_md(self.md_cal, "**Sensibilidad a la paciencia**")
        self.paciencia = [{"media": limpiar(c[0]), "abandono": numero(c[1])} for c in t5[1:]]
        tpar = tabla_md(self.md_cal, "### 7.1 Diagnóstico")
        self.supuestos_2c = [(limpiar(c[1]), limpiar(c[2]), limpiar(c[3])) for c in tpar[1:]]

    # -------------------------------------------------- accesos al estudio
    def e1(self, preset, pol):
        return next(x["curva"] for x in self.est["e1"] if x["preset"] == preset and x["politica"] == pol)

    def e2(self, preset):
        return next(x for x in self.est["e2"] if x["preset"] == preset)

    def ganadora(self, preset):
        return self.e2(preset)["ganadora"]

    def pol_e2(self, preset, pol):
        return next(p for p in self.e2(preset)["politicas"] if p["politica"] == pol)

    def punto(self, curva, k):
        return next(p for p in curva["puntos"] if p["k"] == k)

    def contra_cero(self, curva, k):
        return next(c["ic"] for c in curva["contraCero"] if c["k"] == k)

    def e3_ausentismo(self, p):
        return next(x for x in self.est["e3"]["ausentismo"] if abs(x["p"] - p) < 1e-9)

    def e4_resumen(self, regla):
        return next(r for r in self.est["e4"]["resumen"] if r["regla"] == regla)

    def mec(self, preset, pol):
        m = next(x for x in self.comp["mecanismo"] if x["preset"] == preset)
        return next(c for c in m["configs"] if c["politica"] == pol)

    def loo(self, afuera, nombre):
        p = next(x for x in self.comp["regla"]["loo"]["pliegues"] if x["afuera"] == afuera)
        return next(r for r in p["reglas"] if r["nombre"] == nombre)["evaluacion"]

    def loo_promedio(self, nombre):
        ev = [self.loo(p, nombre) for p in PRESETS]
        return sum(e["perdida"]["media"] for e in ev) / 3, sum(e["aciertos"] for e in ev), sum(e["total"] for e in ev)

    def politica_ds(self, i):
        return self.din["politicas"][i]

    def sens(self, par, valor):
        return next(s for s in self.din["sensibilidad"] if s["parametro"] == par and abs(s["valor"] - valor) < 1e-9)

    def grupo(self, prof, tipo):
        return next(g for g in self.datos_ejemplo["grupos"] if g["profesional"] == prof and g["tipo"] == tipo)

    def ajuste(self, grupo, familia):
        return next(a for a in grupo["ajustes"] if a["familia"] == familia)

    # -------------------------------------------------- magnitudes derivadas
    def recuperacion(self):
        """Cuántos (μ, σ) de los 12 grupos caen dentro de su IC 95 % y qué familia elige el AIC."""
        dentro = total = 0
        aic = {}
        for g in self.datos_ejemplo["grupos"]:
            ln = self.ajuste(g, "lognormal")["parametros"]
            for par, verdadero in zip(ln, [g["verdadero"]["mu"], g["verdadero"]["sigma"]]):
                dentro += abs(par["valor"] - verdadero) <= 1.96 * par["ee"]
                total += 1
            aic[g["mejorAIC"]] = aic.get(g["mejorAIC"], 0) + 1
        return dentro, total, aic

    def exponencial_rechazada(self):
        return all(self.ajuste(g, "exponencial")["ks"]["p"] < 0.001 and self.ajuste(g, "exponencial")["chi2"]["p"] < 0.001
                   for g in self.datos_ejemplo["grupos"])

    def no_rechaza(self, familia):
        return sum(self.ajuste(g, familia)["ks"]["p"] >= 0.05 and self.ajuste(g, familia)["chi2"]["p"] >= 0.05 for g in self.datos_ejemplo["grupos"])


# ==========================================
# Cifras de la recomendación (las que citan Resumen, Cap. 5, 9.1, guion y README)
# ==========================================
def cifras_recomendacion(d: "Datos") -> dict:
    """Por escenario: política ganadora (E2) y, de SU serie E1 (un solo R), el k recomendado, B sin sobreturnos, B en el k
    recomendado y la ganancia como diferencia pareada día a día contra k = 0, con su IC 95 %. No se restan medias de corridas
    con distinto R: E2 compara políticas con el R común a las cuatro series, que en el centro es menor que el de E1."""
    out = {}
    for p in PRESETS:
        pol = d.ganadora(p)
        serie = d.e1(p, pol)
        k = serie["kRec"]
        b0, brec = d.punto(serie, 0)["B"], d.punto(serie, k)["B"]
        dB = d.contra_cero(serie, k)
        out[p] = {"politica": pol, "k": k, "R": serie["R"], "b0": b0["media"], "brec": brec["media"], "brecSemi": brec["semi"],
                  "ganancia": dB["media"], "gananciaInf": dB["inf"], "gananciaSup": dB["sup"]}
    return out


def verificar_cifras_recomendacion(d: "Datos", citas: dict, readme: str | None = None) -> list[str]:
    """Cada par «sin sobreturnos → recomendado» citado tiene que salir de la MISMA serie E1 (política ganadora, mismo R), y la
    ganancia tiene que ser la diferencia pareada de E1 contra k = 0, con su IC. Devuelve la lista de fallas."""
    fallas = []
    cerca = lambda a, b: a is not None and b is not None and abs(a - b) < 0.5  # noqa: E731
    for p in PRESETS:
        serie = d.e1(p, d.ganadora(p))
        kr = serie["kRec"]
        b0, br = d.punto(serie, 0)["B"], d.punto(serie, kr)["B"]
        dB = d.contra_cero(serie, kr)
        c = citas[p]
        if c["k"] != kr or c["R"] != serie["R"]:
            fallas.append(f"{p}: k o R citados ({c['k']}, {c['R']}) no son los de la serie E1 ({kr}, {serie['R']})")
        if not (cerca(c["b0"], b0["media"]) and cerca(c["brec"], br["media"]) and cerca(c["brecSemi"], br["semi"])):
            fallas.append(f"{p}: B(0) = {c['b0']:.0f} y B(rec) = {c['brec']:.0f} citados no son los de la serie E1 "
                          f"(B(0) = {b0['media']:.0f}, B(k={kr}) = {br['media']:.0f}, R = {serie['R']})")
        if not (cerca(c["ganancia"], dB["media"]) and cerca(c["gananciaInf"], dB["inf"]) and cerca(c["gananciaSup"], dB["sup"])):
            fallas.append(f"{p}: la ganancia citada ({c['ganancia']:.0f}) no es la ΔB pareada de E1 ({dB['media']:.0f} "
                          f"[{dB['inf']:.0f}; {dB['sup']:.0f}])")
        if abs((br["media"] - b0["media"]) - dB["media"]) > 0.5:
            fallas.append(f"{p}: en E1, B(rec) − B(0) no coincide con la diferencia pareada (¿series con distinto R?)")
    if readme is not None:
        fila = {"chico": "Consultorio chico", "policonsultorio": "Policonsultorio", "centro": "Centro completo"}
        for p in PRESETS:
            linea = next((l for l in readme.splitlines() if l.startswith(f"| {fila[p]}")), None)
            if linea is None:
                fallas.append(f"README: no está la fila de {fila[p]}")
                continue
            # Orden de la fila: B(rec) ± semi | B(0) | ΔB [inf; sup] | R
            nums = [round(float(x.replace(".", ""))) for x in re.findall(r"\$ ([\d.]+)", linea)]
            serie = d.e1(p, d.ganadora(p))
            kr = serie["kRec"]
            dB = d.contra_cero(serie, kr)
            esperado = [round(x) for x in (d.punto(serie, kr)["B"]["media"], d.punto(serie, 0)["B"]["media"], dB["media"], dB["inf"], dB["sup"])]
            if nums != esperado:
                fallas.append(f"README, {fila[p]}: cifras {nums} no son las de la serie E1 (B(rec), B(0), ΔB, inf, sup = {esperado})")
    return fallas


# ==========================================
# Verificación de la narrativa
# ==========================================
def verificar_narrativa(d: Datos):
    """El texto afirma ciertas cosas; si los resultados dejan de respaldarlas, se detiene la generación."""
    v = d.validacion
    din = d.din
    base = next(s for s in din["sensibilidad"] if s["esBase"])
    fl = {c["k"]: c for c in d.comp["fluido"]}
    dentro, total, aic = d.recuperacion()
    lg = d.datos_ejemplo["logistica"]
    eqs0 = next(e for e in din["equilibrios"] if e["k"] == 0)["eqs"]
    bi = d.dinamica_extra["biestabilidad"]["equilibrios"]
    hist = {(r["preset"], r["etapa"]): r for r in d.cal_historia}
    condiciones = {
        # validación
        "M/M/c: todas las medidas dentro del IC simultáneo": all(m["dentroSim"] for c in v["mmc"]["casos"] for m in c["comparaciones"]),
        "M/M/c: las medidas fuera del IC individual lo están por exceso":
            all(m["z"] > 0 for c in v["mmc"]["casos"] for m in c["comparaciones"] if not m["dentro"]),
        "Little: error relativo < 1 % en cada réplica": all(c["maxErrorL"] < 0.01 and c["maxErrorLq"] < 0.01 for c in v["mmc"]["casos"]),
        "modelo: M/G/1 y red dentro del IC simultáneo": all(m["dentroSim"] for c in v["modelo"]["casos"] for m in c["comparaciones"]),
        "mutación: 3 de 4 mutantes detectados y el sobreviviente es el del abandono":
            [m["fallan"] > 0 for m in d.mutacion["mutantes"]] == [True, True, False, True],
        "mutación: el control sin mutar pasa entero": d.mutacion["control"]["fallan"] == 0,
        "tests: todos pasan": d.tests["fallan"] == 0 and d.tests["pasan"] == d.tests["total"],
        # calibración
        "calibración vigente: 4 metas cumplidas y abandono fuera en los tres presets":
            all(all(p["cumple"][m] for m in ["utilizacion", "ausentismo", "esperaTurno", "horasExtraPorMedico"]) and not p["cumple"]["abandono"]
                for p in d.calibracion["presets"]),
        "calibración vigente coincide con la tabla congelada de docs/calibracion.md":
            all(abs(100 * p["indicadores"]["utilizacion"] - hist[(p["nombre"].split(" (")[0], "#2d (congelada)")]["util"]) < 0.051
                and abs(100 * p["indicadores"]["abandono"] - hist[(p["nombre"].split(" (")[0], "#2d (congelada)")]["abandono"]) < 0.051
                for p in d.calibracion["presets"]),
        "el abandono bajó en cada iteración (#2b > #2c > #2d)":
            all(hist[(p, "#2b")]["abandono"] > hist[(p, "#2c")]["abandono"] > hist[(p, "#2d (congelada)")]["abandono"]
                for p in ["Consultorio chico", "Policonsultorio", "Centro completo"]),
        "paciencia: ni con la mayor paciencia probada se llega al 5 %": min(x["abandono"] for x in d.paciencia) > 5,
        # experimentos
        "E2: ganadoras (donde más se falta, donde más se falta, al inicio)":
            [d.ganadora(p) for p in PRESETS] == ["mayor_ausentismo", "mayor_ausentismo", "inicio"],
        "E2: sin empates declarados": all(not d.e2(p)["empatadas"] for p in PRESETS),
        "E1: la regla de precisión duplicó R solo en series del centro":
            {x["preset"] for x in d.est["e1"] if x["curva"]["R"] > d.est["R0"]} == {"centro"},
        "E1: R entre R0 y 2·R0": min(x["curva"]["R"] for x in d.est["e1"]) == d.est["R0"] and max(x["curva"]["R"] for x in d.est["e1"]) == 2 * d.est["R0"],
        "E1: el k recomendado de la serie E1 coincide con el de E2": all(d.e1(p, d.ganadora(p))["kRec"] == d.pol_e2(p, d.ganadora(p))["kRec"] for p in PRESETS),
        "E1: k recomendado de la ganadora 3, 2, 1": [d.pol_e2(p, d.ganadora(p))["kRec"] for p in PRESETS] == [3, 2, 1],
        "E1: B(k_rec) − B(0) > 0 significativo en la ganadora de cada preset":
            all(d.contra_cero(d.e1(p, d.ganadora(p)), d.pol_e2(p, d.ganadora(p))["kRec"])["inf"] > 0 for p in PRESETS),
        "E1: la política final tiene k̂ = 0 en los tres presets": all(d.e1(p, "final")["kHat"] == 0 for p in PRESETS),
        "E3: el k recomendado crece con el ausentismo": all(
            a["curva"]["kRec"] <= b["curva"]["kRec"] for a, b in zip(d.est["e3"]["ausentismo"], d.est["e3"]["ausentismo"][1:])),
        "E3: el k recomendado con c_espera mínimo supera en 3 o más al de c_espera máximo":
            d.est["e3"]["cEspera"][0]["curva"]["kRec"] - d.est["e3"]["cEspera"][-1]["curva"]["kRec"] >= 3,
        "E3: con c_extra más caro el k recomendado baja (extremos)": d.est["e3"]["factorExtra"][0]["curva"]["kRec"] > d.est["e3"]["factorExtra"][-1]["curva"]["kRec"],
        "E3: con c_extra más caro el k recomendado no sube": all(
            a["curva"]["kRec"] >= b["curva"]["kRec"] for a, b in zip(d.est["e3"]["factorExtra"], d.est["e3"]["factorExtra"][1:])),
        "E4: la ingenua acierta más que la ajustada pero pierde más en promedio":
            d.e4_resumen("ingenua")["dentro"] > d.e4_resumen("ajustada")["dentro"]
            and d.e4_resumen("ingenua")["perdidaMedia"] > d.e4_resumen("ajustada")["perdidaMedia"],
        "E5: con el k recomendado la probabilidad de un día peor que k = 0 es menor que 1/2":
            next(x for x in d.est["e5"]["porK"] if x["k"] == d.pol_e2("policonsultorio", d.ganadora("policonsultorio"))["kRec"])["pNegativo"] < 0.5,
        "E6: pendiente del semiancho cercana a −1/2": abs(d.est["e6"]["pendiente"] + 0.5) < 0.05,
        "mecanismo: en el centro, inicio con menos horas extra que donde más se falta":
            d.mec("centro", "inicio")["perfil"]["totales"]["horasExtra"]["media"] < d.mec("centro", "mayor_ausentismo")["perfil"]["totales"]["horasExtra"]["media"],
        "mecanismo: en el policonsultorio, inicio con más espera de los turnos":
            d.mec("policonsultorio", "inicio")["perfil"]["totales"]["esperaTurno"]["media"] > d.mec("policonsultorio", "mayor_ausentismo")["perfil"]["totales"]["esperaTurno"]["media"],
        "regla LOO: en el centro ninguna regla acierta más de 1 de 6": max(d.loo("centro", n)["aciertos"] for n in ["ingenua", "alfa", "alfaBeta"]) <= 1,
        "regla LOO: la ingenua tiene la menor pérdida media de las tres":
            d.loo_promedio("ingenua")[0] < min(d.loo_promedio("alfa")[0], d.loo_promedio("alfaBeta")[0]),
        # dinámica
        "fluido: subestima la espera más de 2 veces en los dos k": all(fl[k]["desEspera"]["media"] / fl[k]["fluidoEspera"] > 2 for k in fl),
        "fluido: la subestimación relativa es menor con k = 2": fl[2]["desEspera"]["media"] / fl[2]["fluidoEspera"] < fl[0]["desEspera"]["media"] / fl[0]["fluidoEspera"],
        "DS: equilibrio k = 0 único, estable, saturado y en 11,95 días":
            len(eqs0) == 1 and eqs0[0]["estable"] and eqs0[0]["saturado"] and abs(eqs0[0]["a"] - 11.95) < 1e-6,
        "DS: con u = 14 hay tres equilibrios (estable, inestable, estable)": [e["estable"] for e in bi] == [True, False, True],
        "DS: el adaptativo nunca pierde en beneficio": all(s["difBeneficio"] >= -1e-6 for s in din["sensibilidad"]),
        "DS: el adaptativo pierde en perdidos solo con u ≥ 14":
            {(s["parametro"], s["valor"]) for s in din["sensibilidad"] if s["difPerdidos"] > 1e-6} == {("umbral", 14), ("umbral", 21)},
        "DS: con pico de +15 % empatan": abs(d.sens("aumento", 0.15)["difBeneficio"]) < 1,
        "DS: k = 2 contra k = 0 vale más que la ventaja del adaptativo en todas las variantes":
            all(s["politicas"][1]["beneficio"] - s["politicas"][0]["beneficio"] > s["difBeneficio"] for s in din["sensibilidad"]),
        "DS: base del adaptativo positiva": base["difBeneficio"] > 0,
        "convergencia: RK4 más preciso que Euler con el mismo dt en L final":
            all(r["errorLfinal"] < e["errorLfinal"] for e in din["convergencia"]["filas"] if e["metodo"] == "euler"
                for r in din["convergencia"]["filas"] if r["metodo"] == "rk4" and r["dt"] == e["dt"]),
        "convergencia: Euler de orden ~1 (dt/4 → error/4 ± 30 %)":
            0.7 < (lambda fs: fs[0]["errorLfinal"] / fs[1]["errorLfinal"] / 4)([x for x in din["convergencia"]["filas"] if x["metodo"] == "euler"]) < 1.3,
        # datos
        "datos: al menos 21 de 24 parámetros dentro del IC": dentro >= 21 and total == 24,
        "datos: la exponencial se rechaza en todos los grupos": d.exponencial_rechazada(),
        "datos: lognormal no rechazada en ningún grupo": d.no_rechaza("lognormal") == 12,
        "datos: AIC elige lognormal en la mayoría pero no en todos": aic.get("lognormal", 0) > 6 and aic.get("gamma", 0) > 0,
        "datos: β₀ y β₁ verdaderos dentro de su IC":
            abs(lg["beta0"] - lg["verdadero"]["beta0"]) <= 1.96 * lg["ee0"] and abs(lg["beta1"] - lg["verdadero"]["beta1"]) <= 1.96 * lg["ee1"],
        # afirmaciones cualitativas del texto
        "E1: curvas unimodales (cóncavas) salvo la política al final":
            all((lambda m, kh: all(a <= b for a, b in zip(m[:kh], m[1:kh + 1])) and all(a >= b for a, b in zip(m[kh:], m[kh + 1:])))(
                [p["B"]["media"] for p in d.e1(p_, pol)["puntos"]], d.e1(p_, pol)["kHat"]) for p_ in PRESETS for pol in POLITICAS if pol != "final"),
        "E1: C recomienda menos o igual que B en la mayoría de las series":
            sum(x["curva"]["kC"] <= x["curva"]["kHat"] for x in d.est["e1"]) > len(d.est["e1"]) / 2,
        "E4: la mayor pérdida de la ingenua ocurre en el centro":
            max(d.est["e4"]["configuraciones"], key=lambda c: c["ingenua"]["perdida"]["media"])["preset"] == "centro",
        "mecanismo: en el centro, inicio con algo más de espera (compensada por las horas extra)":
            d.mec("centro", "inicio")["perfil"]["totales"]["esperaTurno"]["media"] > d.mec("centro", "mayor_ausentismo")["perfil"]["totales"]["esperaTurno"]["media"],
        "mecanismo: en el policonsultorio, donde más se falta con más horas extra":
            d.mec("policonsultorio", "mayor_ausentismo")["perfil"]["totales"]["horasExtra"]["media"] > d.mec("policonsultorio", "inicio")["perfil"]["totales"]["horasExtra"]["media"],
        "fluido: subestimación entre 2 y 4 veces": all(2 < fl[k]["desEspera"]["media"] / fl[k]["fluidoEspera"] < 4 for k in fl),
        "DS: el adaptativo arranca con el k del estudio": din["politicas"][2]["kSemanal"][0] == din["kFijo"],
        "DS: el adaptativo sube k solo durante el pico y las semanas siguientes":
            all(din["parametros"]["pico"]["inicio"] <= i < din["parametros"]["pico"]["inicio"] + din["parametros"]["pico"]["duracion"] + 6
                for i, k in enumerate(din["politicas"][2]["kSemanal"]) if k > din["kFijo"]),
        "datos: grupos de 40 a 200 datos": min(g["n"] for g in d.datos_ejemplo["grupos"]) == 40 and max(g["n"] for g in d.datos_ejemplo["grupos"]) == 200,
        "recomendación: k recomendado de las ganadoras entre 1 y 3": all(1 <= d.pol_e2(p, d.ganadora(p))["kRec"] <= 3 for p in PRESETS),
        # reproducibilidad
        "navegador: todas las decisiones idénticas y la huella distinta":
            d.navegador["decisionesIguales"] == d.navegador["decisiones"] and not d.navegador["huellaIgual"],
    }
    fallas = [nombre for nombre, ok in condiciones.items() if not ok]
    # Pares «sin sobreturnos → recomendado»: misma serie E1, mismo R, ganancia = ΔB pareada (texto, guion y README).
    fallas += verificar_cifras_recomendacion(d, cifras_recomendacion(d), (RAIZ / "README.md").read_text(encoding="utf-8"))
    if fallas:
        raise AssertionError("El texto del informe ya no coincide con los resultados: " + "; ".join(fallas))
    return len(condiciones) + 1
