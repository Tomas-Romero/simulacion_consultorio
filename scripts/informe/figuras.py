"""Figuras del informe regeneradas para impresión (matplotlib) a partir de public/resultados/*.json e
informe/datos/*.json. Cada función guarda un PNG a 200 dpi pensado para 16 cm de ancho."""

from pathlib import Path

import matplotlib
import matplotlib.ticker

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch  # noqa: E402
from scipy import stats  # noqa: E402

ANCHO_IN = 16 / 2.54
DPI = 200
TINTA = "#18181b"
GRIS = "#71717a"
GRIS_CLARO = "#d4d4d8"
CIAN = "#0e7490"
NARANJA = "#c2410c"
VERDE = "#047857"
POL = {"inicio": "#7c3aed", "intercalado": "#0891b2", "mayor_ausentismo": "#b45309", "final": "#db2777"}
NOMBRE_POL = {"inicio": "Al inicio", "intercalado": "Intercalados", "mayor_ausentismo": "Donde más se falta", "final": "Al final"}
MARCA_POL = {"inicio": "o", "intercalado": "s", "mayor_ausentismo": "D", "final": "^"}
NOMBRE_PRESET = {"chico": "Consultorio chico", "policonsultorio": "Policonsultorio", "centro": "Centro completo"}

plt.rcParams.update({
    "font.family": "Calibri", "font.size": 9, "axes.titlesize": 9.5, "axes.labelsize": 9, "legend.fontsize": 8,
    "xtick.labelsize": 8, "ytick.labelsize": 8, "axes.edgecolor": GRIS, "axes.labelcolor": TINTA,
    "xtick.color": GRIS, "ytick.color": GRIS, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.color": "#e4e4e7", "grid.linewidth": 0.6, "legend.frameon": False,
    "savefig.dpi": DPI, "savefig.bbox": "tight", "savefig.pad_inches": 0.05,
})


def miles(x, _=None):
    return f"{x:,.0f}".replace(",", ".")


def millones(x, _=None):
    return f"{x / 1e6:.2f}".replace(".", ",")


def _guardar(fig, ruta: Path):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(ruta)
    plt.close(fig)
    return ruta


# ---------------------------------------------------------------- modelo conceptual
def flujo_paciente(ruta: Path):
    """Diagrama del flujo del paciente: fuentes a la izquierda, recorrido en el centro y resultados a la derecha."""
    fig, ax = plt.subplots(figsize=(ANCHO_IN, 4.9))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 62)
    ax.axis("off")
    perd, gris_f = "#fef2f2", "#f4f4f5"

    def caja(x, y, w, h, texto, color=TINTA, relleno="#ffffff", negrita=False, fuente=7.8):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.2,rounding_size=1.0", fc=relleno, ec=color, lw=1.1))
        ax.text(x + w / 2, y + h / 2, texto, ha="center", va="center", fontsize=fuente, color=TINTA, weight="bold" if negrita else "normal")

    def flecha(p1, p2, texto=None, pos=0.5, dx=0.0, dy=0.8, ha="center"):
        ax.add_patch(FancyArrowPatch(p1, p2, arrowstyle="-|>", mutation_scale=9, color=GRIS, lw=1, shrinkA=0, shrinkB=0))
        if texto:
            x = p1[0] + (p2[0] - p1[0]) * pos + dx
            y = p1[1] + (p2[1] - p1[1]) * pos + dy
            ax.text(x, y, texto, ha=ha, va="bottom", fontsize=6.8, color=GRIS, style="italic")

    W, H = 24, 8
    caja(2, 52, W, H, "Turno o sobreturno\n(agenda del día)", CIAN, "#ecfeff", True)
    caja(2, 38, W, H, "¿Falta?\nP = logística(β₀ + β₁·d)")
    caja(2, 24, W, H, "Ausente\n(no es pérdida)", GRIS, gris_f)
    caja(2, 12, W, H, "Espontáneo\n(Poisson no homogéneo)", "#7c3aed", "#f5f3ff", True)
    caja(2, 0.5, W, H, "Sin profesional /\nfuera de horario", "#b91c1c", perd)
    flecha((14, 52), (14, 46))
    flecha((7, 38), (7, 32), "sí", dx=-1.5, dy=-0.5)
    flecha((20, 12), (20, 8.5), "no hay profesional", dx=1, dy=-0.6, ha="left")
    X = 38
    caja(X, 52, W, H, "Llegada en hora + δ\n¿más de 15 min tarde?")
    caja(X, 39, W, H, "Admisión\n(urgencias primero)")
    caja(X, 26, W, H, "Sala de espera\n(colas del consultorio)")
    caja(X, 13, W, H, "Médico libre elige:\nurgencia › puntual ›\ntardío › espontáneo", fuente=7)
    caja(X, 0.5, W, H, "Consulta\nfactor × clase × D")
    flecha((26, 43), (X, 55), "no", pos=0.45, dx=-1.2, dy=0.4, ha="right")
    flecha((26, 17), (X, 42), "hay profesional", pos=0.3, dx=1.2, dy=-0.6, ha="left")
    for y1, y2 in [(52, 47), (39, 34), (26, 21), (13, 8.5)]:
        flecha((X + W / 2, y1), (X + W / 2, y2))
    ax.text(X + W / 2 + 1, 49.5, "a tiempo o tardío", fontsize=6.8, color=GRIS, style="italic", va="center")
    R = 76
    caja(R, 52, W, H, "Tardío rechazado\n(o su médico ya se fue)", "#b91c1c", perd)
    caja(R, 26, W, H, "Abandono\n(agotó la paciencia)", "#b91c1c", perd)
    caja(R, 0.5, W, H, "Sale atendido", VERDE, "#ecfdf5", True)
    flecha((X + W, 56), (R, 56), "pierde\nel turno", dy=0.6)
    flecha((X + W, 30), (R, 30), "espontáneo\nno urgente", dy=0.6)
    flecha((X + W, 4.5), (R, 4.5))
    ax.text(R + W / 2, 17, "Cupos acumulables: si el médico\ndebe cupos, el espontáneo\npasa antes que los puntuales", ha="center",
            va="center", fontsize=6.8, color=GRIS, style="italic")
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- E1 · curvas B(k)
def curvas_bk(estudio: dict, ruta: Path):
    fig, ejes = plt.subplots(1, 3, figsize=(ANCHO_IN, 2.9))
    for ax, preset in zip(ejes, ["chico", "policonsultorio", "centro"]):
        for serie in [s for s in estudio["e1"] if s["preset"] == preset]:
            pol, c = serie["politica"], serie["curva"]
            ks = [p["k"] for p in c["puntos"]]
            m = np.array([p["B"]["media"] for p in c["puntos"]])
            lo = np.array([p["B"]["inf"] for p in c["puntos"]])
            hi = np.array([p["B"]["sup"] for p in c["puntos"]])
            ax.fill_between(ks, lo, hi, color=POL[pol], alpha=0.15, lw=0)
            ax.plot(ks, m, color=POL[pol], lw=1.4, marker=MARCA_POL[pol], ms=3.2, label=NOMBRE_POL[pol])
            kh = c["kHat"]
            ax.plot([kh], [m[ks.index(kh)]], marker=MARCA_POL[pol], ms=7, mfc="none", mec=POL[pol], mew=1.4)
        ax.set_title(NOMBRE_PRESET[preset])
        ax.set_xlabel("k por profesional")
        ax.set_xticks(range(7))
    ejes[0].set_ylabel("B medio por día [millones de $]")
    for ax in ejes:
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(millones))
    ejes[1].legend(loc="upper center", bbox_to_anchor=(0.5, -0.27), ncol=4)
    fig.tight_layout(w_pad=1.2)
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- E3 · ausentismo y mapa
def sensibilidad_ausentismo(estudio: dict, ruta: Path):
    e3 = estudio["e3"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(ANCHO_IN, 2.8), gridspec_kw={"width_ratios": [1, 1.25]})
    ps = [100 * x["p"] for x in e3["ausentismo"]]
    for x in e3["ausentismo"]:
        c = x["curva"]
        a1.plot([100 * x["p"]] * len(c["conjunto"]), c["conjunto"], color=GRIS_CLARO, lw=6, solid_capstyle="round")
    a1.plot(ps, [x["curva"]["kHat"] for x in e3["ausentismo"]], "o-", color=CIAN, ms=4, label="k̂ (máximo B)")
    a1.plot(ps, [x["curva"]["kRec"] for x in e3["ausentismo"]], "s--", color=NARANJA, ms=3.5, label="recomendado (mín. del conjunto)")
    a1.set_xlabel("ausentismo medio p̄ [%]")
    a1.set_ylabel("sobreturnos por profesional")
    a1.set_title("Policonsultorio: k según el ausentismo")
    a1.legend(loc="upper left")
    factores = sorted({m["factor"] for m in e3["mapa"]})
    pes = sorted({m["p"] for m in e3["mapa"]})
    Z = np.array([[next(m["kRec"] for m in e3["mapa"] if m["p"] == p and m["factor"] == f) for p in pes] for f in factores])
    im = a2.imshow(Z, cmap="Blues", aspect="auto", origin="lower", vmin=0, vmax=6)
    for i in range(len(factores)):
        for j in range(len(pes)):
            a2.text(j, i, int(Z[i, j]), ha="center", va="center", fontsize=8, color="white" if Z[i, j] >= 4 else TINTA)
    a2.set_xticks(range(len(pes)), [f"{100 * p:.0f}" for p in pes])
    a2.set_yticks(range(len(factores)), [f"{f:g}".replace(".", ",") for f in factores])
    a2.set_xlabel("ausentismo medio p̄ [%]")
    a2.set_ylabel("factor de c_extra")
    a2.set_title("k recomendado: ausentismo × costo de hora extra")
    a2.grid(False)
    fig.colorbar(im, ax=a2, fraction=0.04, pad=0.02)
    fig.tight_layout(w_pad=1.5)
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- E4 · regla práctica
def regla_practica(estudio: dict, ruta: Path):
    e4 = estudio["e4"]
    fig, ax = plt.subplots(figsize=(ANCHO_IN * 0.62, 2.9))
    marcas = {"chico": "o", "policonsultorio": "^", "centro": "s"}
    for c in e4["configuraciones"]:
        ax.plot([c["pN"]] * len(c["conjunto"]), c["conjunto"], color=GRIS_CLARO, lw=5, solid_capstyle="round", zorder=1)
    for preset, mk in marcas.items():
        cs = [c for c in e4["configuraciones"] if c["preset"] == preset]
        ax.scatter([c["pN"] for c in cs], [c["kHat"] for c in cs], marker=mk, s=22, color=CIAN, zorder=3, label=NOMBRE_PRESET[preset])
    x = np.linspace(0, 7, 701)
    ax.step(x, np.clip(np.round(x), 0, 6), where="post", color=GRIS, lw=1, ls="--", label="ingenua: round(p̄·N̄)")
    a = e4["alfa"]
    ax.step(x, np.clip(np.round(a * x), 0, 6), where="post", color=NARANJA, lw=1.2, label=f"ajustada: round({a:.2f}·p̄·N̄)".replace(".", ","))
    ax.set_xlabel("p̄·N̄ (turnos que se espera que falten por profesional)")
    ax.set_ylabel("k óptimo")
    ax.legend(loc="upper left", fontsize=7)
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- E5 y E6
def riesgo_precision(estudio: dict, ruta: Path):
    e5, e6 = estudio["e5"], estudio["e6"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(ANCHO_IN, 2.7))
    ks = [x["k"] for x in e5["porK"] if x["k"] > 0]
    filas = [x for x in e5["porK"] if x["k"] > 0]
    for x in filas:
        a1.plot([x["k"]] * 2, [x["p5"] / 1e3, x["p95"] / 1e3], color=GRIS, lw=1)
        a1.add_patch(plt.Rectangle((x["k"] - 0.25, x["p25"] / 1e3), 0.5, (x["p75"] - x["p25"]) / 1e3, fc="#ecfeff", ec=CIAN, lw=1))
        a1.plot([x["k"] - 0.25, x["k"] + 0.25], [x["p50"] / 1e3] * 2, color=CIAN, lw=1.6)
        a1.plot(x["k"], x["media"] / 1e3, "o", color=NARANJA, ms=3.5)
    a1.axhline(0, color=TINTA, lw=0.8)
    a1.set_xticks(ks)
    a1.set_xlabel("k")
    a1.set_ylabel("B(k) − B(0) por día [miles de $]")
    a1.set_title("Riesgo diario (percentiles 5–25–50–75–95; punto: media)")
    R = np.array([p["R"] for p in e6["puntos"]])
    s = np.array([p["semiancho"] for p in e6["puntos"]])
    a2.loglog(R, s, "o", color=CIAN, ms=4, label="semiancho del IC 95 %")
    a2.loglog(R, np.exp(e6["intercepto"]) * R ** e6["pendiente"], color=NARANJA, lw=1,
              label=f"ajuste: pendiente {e6['pendiente']:.3f}".replace(".", ","))
    a2.set_xlabel("R (días simulados)")
    a2.set_ylabel("semiancho [$]")
    a2.set_title("Precisión de B según R")
    a2.legend()
    fig.tight_layout(w_pad=1.5)
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- mecanismo de las políticas
def mecanismo(comp: dict, ruta: Path):
    fig, ejes = plt.subplots(2, 2, figsize=(ANCHO_IN, 4.6), sharex=True)
    for fila, m in enumerate(comp["mecanismo"]):
        for col, (campo, titulo, unidad) in enumerate([("ocio", "ocio de los médicos", "min por día"), ("esperaTurno", "espera de los pacientes con turno", "min")]):
            ax = ejes[fila][col]
            for cfg in m["configs"]:
                t = np.array(cfg["perfil"]["t"]) / 60
                ax.step(t, cfg["perfil"][campo], where="post", color=POL[cfg["politica"]], lw=1.4,
                        label=f"{NOMBRE_POL[cfg['politica']]} (k = {cfg['k']})")
            ax.set_title(f"{NOMBRE_PRESET[m['preset']]}: {titulo}")
            ax.set_ylabel(unidad)
            if fila == 1:
                ax.set_xlabel("hora del día (franjas de 30 min)")
            ax.legend(fontsize=7, loc="lower center", ncol=2)
            tope = ax.get_ylim()[1]
            ax.set_ylim(bottom=-0.22 * tope)
            ax.set_yticks([t for t in ax.get_yticks() if 0 <= t <= tope])
    fig.tight_layout(h_pad=1.2)
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- dinámica: fluido contra eventos discretos
def fluido(comp: dict, ruta: Path):
    fig, ejes = plt.subplots(1, 2, figsize=(ANCHO_IN, 2.6))
    for ax, c in zip(ejes, comp["fluido"]):
        t = np.array(c["t"]) / 60
        ax.fill_between(t, [d["inf"] for d in c["des"]], [d["sup"] for d in c["des"]], color=CIAN, alpha=0.2, lw=0)
        ax.plot(t, [d["media"] for d in c["des"]], color=CIAN, lw=1.4, label=f"eventos discretos (media de {c['R']} días)")
        ax.plot(t, c["fluido"], color=NARANJA, lw=1.4, ls="--", label="modelo fluido")
        ax.set_title(f"Pacientes en sala, k = {c['k']}")
        ax.set_xlabel("hora del día")
        ax.set_ylim(0, max(max(dd["sup"] for dd in c["des"]), max(c["fluido"])) * 1.3)
        ax.set_ylabel("pacientes")
    ejes[0].legend(loc="upper left", fontsize=7, ncol=2)
    fig.tight_layout(w_pad=1)
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- dinámica: lista de espera
def lista_espera(extra: dict, ruta: Path):
    estilos = [(GRIS, "--"), (CIAN, "-"), ("#7c3aed", "-")]
    nombres = ["k = 0", "k fijo = 2", "k adaptativo"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(ANCHO_IN, 2.7))
    pico = extra["pico"]
    for ax in (a1, a2):
        ax.axvspan(pico["inicio"], pico["inicio"] + pico["duracion"], color=NARANJA, alpha=0.07, lw=0)
    for tr, (color, ls), nombre in zip(extra["trayectorias"], estilos, nombres):
        sem = np.array(tr["t"]) / 7
        a1.plot(sem, tr["L"], color=color, ls=ls, lw=1.4, label=nombre)
        a2.plot(sem, 100 * np.array(tr["p"]), color=color, ls=ls, lw=1.4, label=nombre)
    a1.set_title("Lista de espera L [pacientes]")
    a2.set_title("Ausentismo p(a) [%]")
    for ax in (a1, a2):
        ax.set_xlabel("semana")
    a1.legend(loc="upper right")
    fig.tight_layout(w_pad=1.5)
    return _guardar(fig, ruta)


def tornado(din: dict, ruta: Path):
    nombres = {"reingreso": "Ausentes que vuelven (r)", "desalientoMaximo": "Desaliento máximo", "umbral": "Umbral de desaliento u",
               "aumento": "Magnitud del pico", "duracion": "Duración del pico"}
    fmt = {"reingreso": lambda v: f"r = {v * 100:.0f} %", "desalientoMaximo": lambda v: f"d máx = {v * 100:.0f} %",
           "umbral": lambda v: f"u = {v:g} d", "aumento": lambda v: f"+{v * 100:.0f} %", "duracion": lambda v: f"{v:g} sem"}
    sens = din["sensibilidad"]
    base = next(f for f in sens if f["esBase"])
    fig, ejes = plt.subplots(2, 1, figsize=(ANCHO_IN, 4.6))
    for ax, campo, titulo, escala, etiqueta in [(ejes[0], "difBeneficio", "Ventaja en beneficio del adaptativo sobre k fijo = 2", 1e6, "millones de $"),
                                                 (ejes[1], "difPerdidos", "Perdidos: adaptativo − k fijo (negativo = el adaptativo pierde menos)", 1, "pacientes")]:
        filas = []
        for par in nombres:
            otros = [(f[campo] - base[campo], f) for f in sens if f["parametro"] == par and not f["esBase"]]
            filas.append((par, min(otros, key=lambda v: v[0]), max(otros, key=lambda v: v[0]), otros))
        filas.sort(key=lambda r: r[2][0] - r[1][0])
        lim = max(abs(v) for r in filas for v in (r[1][0], r[2][0])) / escala
        for i, (par, lo, hi, otros) in enumerate(filas):
            ax.barh(i, lo[0] / escala, color=GRIS_CLARO, height=0.55)
            ax.barh(i, hi[0] / escala, color=CIAN, height=0.55, alpha=0.85)
            marca = lambda f: "" if f["estable"] else " *"  # noqa: E731
            if abs(lo[0] - hi[0]) < 1e-9:
                rotulos = [(hi[0], " y ".join(fmt[par](f["valor"]) for _, f in sorted(otros, key=lambda o: o[1]["valor"])) + marca(hi[1]), hi[0] >= 0)]
            elif np.sign(lo[0]) != np.sign(hi[0]) or lo[0] == 0 or hi[0] == 0:
                rotulos = [(lo[0], fmt[par](lo[1]["valor"]) + marca(lo[1]), False), (hi[0], fmt[par](hi[1]["valor"]) + marca(hi[1]), True)]
            elif hi[0] > 0:
                rotulos = [(0, fmt[par](lo[1]["valor"]) + marca(lo[1]), False), (hi[0], fmt[par](hi[1]["valor"]) + marca(hi[1]), True)]
            else:
                rotulos = [(lo[0], fmt[par](lo[1]["valor"]) + marca(lo[1]), False), (0, fmt[par](hi[1]["valor"]) + marca(hi[1]), True)]
            for v, txt, derecha in rotulos:
                x = max(v, 0) / escala if derecha else min(v, 0) / escala
                ax.text(x + (0.015 * lim if derecha else -0.015 * lim), i, txt, va="center", ha="left" if derecha else "right", fontsize=7, color=TINTA)
        ax.set_yticks(range(len(filas)), [nombres[r[0]] for r in filas])
        ax.axvline(0, color=TINTA, lw=0.8)
        ax.set_title(titulo, loc="left")
        ax.set_xlabel(f"cambio respecto de la base [{etiqueta}]")
        ax.set_xlim(-lim * 0.75, lim * 1.4)
        ax.grid(axis="y", visible=False)
    fig.tight_layout(h_pad=1.4)
    return _guardar(fig, ruta)


def convergencia(din: dict, ruta: Path):
    filas = din["convergencia"]["filas"]
    fig, ax = plt.subplots(figsize=(ANCHO_IN * 0.55, 2.5))
    for metodo, color, mk in [("euler", GRIS, "o"), ("rk4", CIAN, "D")]:
        xs = [f["dt"] for f in filas if f["metodo"] == metodo]
        ys = [f["errorLfinal"] for f in filas if f["metodo"] == metodo]
        ax.loglog(xs, ys, marker=mk, color=color, lw=1.3, ms=4, label="Euler" if metodo == "euler" else "RK4")
    ax.set_xlabel("dt [días]")
    ax.set_ylabel("error en L final [pacientes]")
    ax.legend()
    return _guardar(fig, ruta)


# ---------------------------------------------------------------- datos reales
def ajuste_tiempos(grupo: dict, ruta: Path):
    xs = np.array(grupo["valores"])
    aj = {a["familia"]: a for a in grupo["ajustes"]}
    mu, sg = aj["lognormal"]["parametros"][0]["valor"], aj["lognormal"]["parametros"][1]["valor"]
    al, th = aj["gamma"]["parametros"][0]["valor"], aj["gamma"]["parametros"][1]["valor"]
    me = aj["exponencial"]["parametros"][0]["valor"]
    dist = {"lognormal": stats.lognorm(sg, scale=np.exp(mu)), "gamma": stats.gamma(al, scale=th), "exponencial": stats.expon(scale=me)}
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(ANCHO_IN, 2.8))
    a1.hist(xs, bins="fd", density=True, color="#f4f4f5", edgecolor=GRIS_CLARO)
    malla = np.linspace(0.01, xs.max() * 1.05, 400)
    for fam, color, ls in [("lognormal", CIAN, "-"), ("gamma", NARANJA, "-"), ("exponencial", GRIS, "--")]:
        a1.plot(malla, dist[fam].pdf(malla), color=color, ls=ls, lw=1.4, label=fam.capitalize())
    a1.set_xlabel("duración [min]")
    a1.set_ylabel("densidad")
    a1.set_title("Histograma y densidades ajustadas")
    a1.legend()
    o = np.sort(xs)
    q = dist["lognormal"].ppf((np.arange(len(o)) + 0.5) / len(o))
    a2.plot(q, o, "o", ms=2.6, color=CIAN, alpha=0.8)
    lim = max(o.max(), q.max()) * 1.05
    a2.plot([0, lim], [0, lim], color=GRIS, ls="--", lw=0.9)
    a2.set_xlim(0, lim)
    a2.set_ylim(0, lim)
    a2.set_xlabel("cuantil lognormal ajustada [min]")
    a2.set_ylabel("cuantil observado [min]")
    a2.set_title("Gráfico QQ (lognormal)")
    fig.tight_layout(w_pad=1.5)
    return _guardar(fig, ruta)


def logistica(log: dict, ruta: Path):
    fig, ax = plt.subplots(figsize=(ANCHO_IN * 0.6, 2.6))
    tr = log["tramos"]
    d = np.array([t["anticipacion"] for t in tr])
    p = np.array([t["proporcion"] for t in tr])
    ax.errorbar(d, 100 * p, yerr=[100 * (p - np.array([t["inf"] for t in tr])), 100 * (np.array([t["sup"] for t in tr]) - p)],
                fmt="o", color=TINTA, ms=4, capsize=3, lw=1, label="observado (IC 95 % de Wilson)")
    x = np.linspace(0, 32, 200)
    lg = lambda b0, b1: 100 / (1 + np.exp(-(b0 + b1 * x)))  # noqa: E731
    ax.plot(x, lg(log["beta0"], log["beta1"]), color=CIAN, lw=1.5, label="estimada (MV)")
    ax.plot(x, lg(log["verdadero"]["beta0"], log["verdadero"]["beta1"]), color=NARANJA, lw=1.2, ls="--", label="verdadera (escenario)")
    ax.set_xlabel("días de anticipación")
    ax.set_ylabel("probabilidad de faltar [%]")
    ax.legend(loc="upper left", fontsize=7)
    return _guardar(fig, ruta)


def diagramas_apilados(origen: Path, ruta: Path):
    """Recorta de la captura de la aplicación el diagrama causal y el de Forrester y los apila, cada uno a todo el ancho."""
    from PIL import Image

    im = Image.open(origen).convert("RGB")
    w, h = im.size
    izq = im.crop((int(0.016 * w), int(0.235 * h), int(0.495 * w), int(0.89 * h)))
    der = im.crop((int(0.505 * w), int(0.235 * h), int(0.985 * w), int(0.89 * h)))
    ancho = max(izq.width, der.width)
    hoja = Image.new("RGB", (ancho, izq.height + der.height + 12), "white")
    hoja.paste(izq, (0, 0))
    hoja.paste(der, (0, izq.height + 12))
    ruta.parent.mkdir(parents=True, exist_ok=True)
    hoja.save(ruta)
    return ruta


def recortar_captura(origen: Path, ruta: Path, caja: tuple[float, float, float, float] | None = None, ancho_max: int = 2000):
    """Copia una captura (opcionalmente recortada con una caja relativa 0–1) para el informe."""
    from PIL import Image

    im = Image.open(origen).convert("RGB")
    if caja:
        w, h = im.size
        im = im.crop((int(caja[0] * w), int(caja[1] * h), int(caja[2] * w), int(caja[3] * h)))
    if im.width > ancho_max:
        im = im.resize((ancho_max, int(im.height * ancho_max / im.width)), Image.LANCZOS)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    im.save(ruta, optimize=True)
    return ruta
