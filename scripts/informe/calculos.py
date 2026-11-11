"""Cálculos resueltos paso a paso de la versión de entrega (#7c).

resolver() hace cada cálculo de forma independiente en Python (numpy/scipy) a partir de los datos del proyecto, con todos los
valores intermedios. verificar_calculos() compara cada resultado con su referencia: lo que calculó el código del proyecto
(informe/datos/calculos.json, validacion.json, datos-ejemplo.json) o lo que guardó el estudio (estudio.json, dinamica.json).
Si algún cálculo resuelto no coincide con su referencia, la generación se detiene.
"""

import math

import numpy as np
from scipy import stats

from datos_informe import DATOS, Datos, _json

CANTIDAD = 0  # comparaciones hechas por verificar_calculos()


def resolver(d: Datos) -> dict:
    c = _json(DATOS / "calculos.json")
    v = d.validacion
    r = {}

    # ------------------------------------------------ transformada inversa (Cap. 2)
    tr = c["transformada"]
    s2 = math.log(1 + tr["cvAtencion"] ** 2)
    sig = math.sqrt(s2)
    mu = -s2 / 2                                     # media 1
    z = stats.norm.ppf(tr["u"]["atencion"])
    factor = math.exp(mu + sig * z)
    s2p = math.log(1 + tr["pacienciaCv"] ** 2)
    sigp = math.sqrt(s2p)
    mup = math.log(tr["pacienciaMedia"]) - s2p / 2
    zp = stats.norm.ppf(tr["u"]["paciencia"])
    tabla = tr["tablaAnticipacion"]
    tot = sum(x["frecuencia"] for x in tabla)
    acum = np.cumsum([x["frecuencia"] / tot for x in tabla])
    idx = int(np.argmax(acum >= tr["u"]["anticipacion"]))
    logis = lambda dd: 1 / (1 + math.exp(-(tr["beta0"] + tr["beta1"] * dd)))  # noqa: E731
    r["transformada"] = {
        "u": tr["u"], "cv": tr["cvAtencion"], "s2": s2, "sigma": sig, "mu": mu, "z": z, "factor": factor,
        "factorControl": tr["factorControl"], "D": tr["D"], "duracion": factor * tr["factorControl"] * tr["D"], "prof": tr["nombreProfesional"],
        "pacMedia": tr["pacienciaMedia"], "pacCv": tr["pacienciaCv"], "s2p": s2p, "sigmap": sigp, "mup": mup, "zp": zp, "paciencia": math.exp(mup + sigp * zp),
        "tabla": tabla, "acum": acum.tolist(), "anticipacion": tabla[idx]["valor"],
        "beta0": tr["beta0"], "beta1": tr["beta1"], "zlog": tr["beta0"] + tr["beta1"] * tabla[idx]["valor"],
        "pAnt": logis(tabla[idx]["valor"]), "falta": tr["u"]["falta"] < logis(tabla[idx]["valor"]), "p1": logis(1), "p30": logis(30),
    }

    # ------------------------------------------------ Poisson no homogéneo por thinning (Cap. 2)
    th = c["thinning"]
    lmax = th["tasaMaximaPorMin"]
    t = th["inicio"]
    cands = []
    for x in th["candidatos"]:
        t = t - math.log(x["u1"]) / lmax
        h = int((t - th["inicio"]) // 60)
        lam = th["tasasPorHora"][h] / 60
        cands.append({"u1": x["u1"], "salto": -math.log(x["u1"]) / lmax, "t": t, "lambda": lam, "u2": x["u2"], "cociente": lam / lmax,
                      "acepta": x["u2"] < lam / lmax})
    r["thinning"] = {"lmaxHora": 60 * lmax, "candidatos": cands, "aceptadas": [x["t"] for x in cands if x["acepta"]],
                     "motor": th["llegadasMotor"], "inicio": th["inicio"], "tasasPorHora": th["tasasPorHora"], "esperado": sum(th["tasasPorHora"]), "totalMotor": th["totalMotor"]}

    # ------------------------------------------------ KS y χ² sobre un grupo de datos de ejemplo (Cap. 2)
    g = d.grupo("P1", "control")
    xs = np.sort(np.array(g["valores"]))
    n = len(xs)
    ln = d.ajuste(g, "lognormal")["parametros"]
    dist = stats.lognorm(ln[1]["valor"], scale=math.exp(ln[0]["valor"]))
    F = dist.cdf(xs)
    dmas = np.arange(1, n + 1) / n - F
    dmenos = F - np.arange(0, n) / n
    i = int(np.argmax(np.maximum(dmas, dmenos)))
    D = float(max(dmas.max(), dmenos.max()))
    kcl = max(5, min(n // 5, round(2 * n ** 0.4)))
    bordes = dist.ppf(np.arange(1, kcl) / kcl)
    obs = np.bincount(np.searchsorted(bordes, xs, side="left"), minlength=kcl)
    E = n / kcl
    chi2 = float(((obs - E) ** 2 / E).sum())
    gl = kcl - 1 - 2
    r["bondad"] = {"n": n, "mu": ln[0]["valor"], "sigma": ln[1]["valor"], "media": d.ajuste(g, "lognormal")["media"], "D": D, "xD": float(xs[i]),
                   "Fn": (i + 1) / n if dmas[i] >= dmenos[i] else i / n, "F": float(F[i]), "critico": 1.358 / math.sqrt(n),
                   "pKS": float(stats.kstwobign.sf(D * math.sqrt(n))), "k": kcl, "E": E, "bordes": bordes.tolist(), "obs": obs.tolist(),
                   "chi2": chi2, "gl": gl, "pchi2": float(stats.chi2.sf(chi2, gl)), "chi2crit": float(stats.chi2.ppf(0.95, gl)),
                   "prof": g["nombreProfesional"]}

    # ------------------------------------------------ Monte Carlo: IC, 1/√R, pareadas y Bonferroni (Cap. 3)
    mc = c["montecarlo"]
    b0, b2 = np.array(mc["b0"]), np.array(mc["b2"])
    R = len(b0)
    t975 = float(stats.t.ppf(0.975, R - 1))

    def ic(x):
        m, s = float(x.mean()), float(x.std(ddof=1))
        return {"media": m, "S": s, "semi": t975 * s / math.sqrt(R)}

    dif = b2 - b0
    r["ic"] = {"R": R, "t": t975, "b0": ic(b0), "b2": ic(b2), "dif": ic(dif), "corr": float(np.corrcoef(b0, b2)[0, 1]),
               "semiIndep": t975 * math.sqrt(b0.var(ddof=1) / R + b2.var(ddof=1) / R), "semilla": mc["semilla"]}
    e6 = d.est["e6"]
    Rs = np.array([p["R"] for p in e6["puntos"]])
    se = np.array([p["semiancho"] for p in e6["puntos"]])
    pend, inter = np.polyfit(np.log(Rs), np.log(se), 1)
    r["e6"] = {"puntos": [{"R": int(a), "semi": float(b)} for a, b in zip(Rs, se)], "pendiente": float(pend), "k": e6["k"]}
    serie = d.e1("policonsultorio", "mayor_ausentismo")
    m = len(serie["contraMejor"])
    alfa_ind = 0.05 / m
    r["bonferroni"] = {"m": m, "alfaInd": alfa_ind, "nivel": 1 - alfa_ind, "t": float(stats.t.ppf(1 - alfa_ind / 2, serie["R"] - 1)),
                       "tInd": t975, "kHat": serie["kHat"], "conjunto": serie["conjunto"], "contraMejor": serie["contraMejor"], "R": serie["R"]}

    # ------------------------------------------------ M/M/3 a mano, Little y P-K (Cap. 3)
    lam, mu_, cc = 10.0, 4.0, 3
    a = lam / mu_
    rho = a / cc
    suma = sum(a ** k / math.factorial(k) for k in range(cc))
    ultimo = a ** cc / (math.factorial(cc) * (1 - rho))
    P0 = 1 / (suma + ultimo)
    C = ultimo * P0
    Lq = C * rho / (1 - rho)
    Wq = Lq / lam
    W = Wq + 1 / mu_
    L = lam * W
    caso = next(x for x in v["mmc"]["casos"] if x["c"] == 3)
    sim = {x["nombre"].split(" ")[0]: x for x in caso["comparaciones"]}
    r["mm3"] = {"lambda": lam, "mu": mu_, "c": cc, "a": a, "rho": rho, "terminos": [a ** k / math.factorial(k) for k in range(cc)], "suma": suma,
                "ultimo": ultimo, "P0": P0, "C": C, "Lq": Lq, "Wq": Wq * 60, "W": W * 60, "L": L, "sim": sim, "replicas": v["mmc"]["replicas"]}
    li = c["little"]
    r["little"] = {**li, "lambdaW": li["lambda"] * li["W"], "lambdaHora": li["lambda"] * 60}
    lam1, ES, cv = 3.5 / 60, 12.0, 0.4
    rho1 = lam1 * ES
    wq1 = rho1 * ES * (1 + cv ** 2) / (2 * (1 - rho1))
    mg1 = v["modelo"]["casos"][0]["comparaciones"][0]
    r["pk"] = {"lambdaHora": 3.5, "ES": ES, "cv": cv, "rho": rho1, "Wq": wq1, "WqExp": rho1 * ES / (1 - rho1), "sim": mg1}

    # ------------------------------------------------ línea en serie: Burke y Jackson (Cap. 5)
    lamS, Eadm, Econs, cS = 12.0, 2.0, 12.0, 3
    rho_adm = lamS / (60 / Eadm)
    wq_adm = rho_adm / (60 / Eadm - lamS) * 60
    mu_c = 60 / Econs
    ac = lamS / mu_c
    rho_c = ac / cS
    ult = ac ** cS / (math.factorial(cS) * (1 - rho_c))
    P0c = 1 / (sum(ac ** k / math.factorial(k) for k in range(cS)) + ult)
    Cc = ult * P0c
    wq_c = Cc / (cS * mu_c - lamS) * 60
    jk = {x["medida"]: x for x in v["modelo"]["casos"][1]["comparaciones"]}
    r["serie"] = {"lambda": lamS, "Eadm": Eadm, "Econs": Econs, "c": cS, "rhoAdm": rho_adm, "WqAdm": wq_adm, "rhoCons": rho_c, "Ccons": Cc,
                  "WqCons": wq_c, "total": wq_adm + Eadm + wq_c, "sim": jk}

    # ------------------------------------------------ dinámica de sistemas: paso de Euler y equilibrio (Cap. 7)
    eu = c["euler"]
    prm = d.din["parametros"]
    am = sum(x["valor"] * x["frecuencia"] for x in prm["anticipacion"]) / sum(x["frecuencia"] for x in prm["anticipacion"])
    tot = sum(x["frecuencia"] for x in prm["anticipacion"])

    def p_de(aa):
        return sum(x["frecuencia"] / (1 + math.exp(-(prm["beta0"] + prm["beta1"] * x["valor"] * aa / am))) for x in prm["anticipacion"]) / tot

    def d_de(aa):
        u = prm["desaliento"]
        return u["maximo"] * min(1, max(0, (aa - u["umbral"]) / u["ancho"]))

    C0 = prm["profesionales"] * prm["turnosPorProfesional"] * prm["diasHabiles"] / 7
    aE = eu["L0"] / C0
    Dpico = prm["demandaBase"] * (1 + prm["pico"]["aumento"])
    S = min(C0, eu["L0"] / prm["tiempoMinimo"])
    dL = Dpico * (1 - d_de(aE)) + prm["reingreso"] * p_de(aE) * S - S
    a_hoy = am
    D0 = min(C0, a_hoy * C0 / prm["tiempoMinimo"]) * (1 - prm["reingreso"] * p_de(a_hoy)) / (1 - d_de(a_hoy))
    r["ds"] = {"n": prm["profesionales"], "N": prm["turnosPorProfesional"], "dh": prm["diasHabiles"], "C0": C0, "amedia": am, "L0": eu["L0"],
               "t0": eu["t0"], "a": aE, "p": p_de(aE), "d": d_de(aE), "D0": D0, "Dpico": Dpico, "aumento": prm["pico"]["aumento"], "S": S,
               "r": prm["reingreso"], "dL": dL, "dt": eu["dt"], "L1": eu["L0"] + eu["dt"] * dL, "desaliento": prm["desaliento"],
               "L0equilibrio": a_hoy * C0, "tau": prm["tiempoMinimo"]}
    return r


def verificar_calculos(d: Datos, r: dict) -> list[str]:
    """Cada cálculo resuelto tiene que coincidir con su función de referencia."""
    global CANTIDAD
    c = _json(DATOS / "calculos.json")
    fallas = []
    CANTIDAD = 0

    def igual(nombre, a, b, rel=1e-6):
        global CANTIDAD
        CANTIDAD += 1
        if not math.isclose(a, b, rel_tol=rel, abs_tol=1e-9):
            fallas.append(f"{nombre}: resuelto {a} ≠ referencia {b}")

    tr, ref = r["transformada"], c["transformada"]
    igual("transformada inversa: factor de atención", tr["factor"], ref["factorAtencion"], 1e-7)
    igual("transformada inversa: duración", tr["duracion"], ref["duracion"], 1e-7)
    igual("transformada inversa: paciencia", tr["paciencia"], ref["paciencia"], 1e-7)
    igual("empírica discreta: anticipación", tr["anticipacion"], ref["anticipacion"])
    for k, kk in [("pAnt", "pFalta"), ("p1", "p1"), ("p30", "p30")]:
        igual(f"logística: {k}", tr[k], ref[kk], 1e-12)
    if tr["falta"] != ref["falta"]:
        fallas.append("logística: la decisión de falta no coincide")
    th = r["thinning"]
    if [round(x, 9) for x in th["aceptadas"]] != [round(x, 9) for x in th["motor"][:len(th["aceptadas"])]]:
        fallas.append("thinning: las llegadas aceptadas no son las del generador del motor")
    if [x["acepta"] for x in th["candidatos"]] != [x["acepta"] for x in c["thinning"]["candidatos"]]:
        fallas.append("thinning: aceptación distinta")
    g = d.grupo("P1", "control")
    aj = d.ajuste(g, "lognormal")
    igual("KS: D", r["bondad"]["D"], aj["ks"]["D"], 1e-6)
    igual("KS: p", r["bondad"]["pKS"], aj["ks"]["p"], 1e-4)
    igual("χ²: estadístico", r["bondad"]["chi2"], aj["chi2"]["estadistico"], 1e-9)
    igual("χ²: p", r["bondad"]["pchi2"], aj["chi2"]["p"], 1e-6)
    if r["bondad"]["gl"] != aj["chi2"]["gl"] or r["bondad"]["k"] != aj["chi2"]["clases"]:
        fallas.append("χ²: clases o grados de libertad")
    serie = d.e1("policonsultorio", "mayor_ausentismo")
    for k, clave in [(0, "b0"), (2, "b2")]:
        pt = d.punto(serie, k)["B"]
        igual(f"IC: media de B(k={k})", r["ic"][clave]["media"], pt["media"], 1e-12)
        igual(f"IC: semiancho de B(k={k})", r["ic"][clave]["semi"], pt["semi"], 1e-8)
    cc = d.contra_cero(serie, 2)
    igual("pareada: media de la diferencia", r["ic"]["dif"]["media"], cc["media"], 1e-10)
    igual("pareada: semiancho de la diferencia", r["ic"]["dif"]["semi"], cc["semi"], 1e-8)
    if not (r["ic"]["dif"]["S"] < min(r["ic"]["b0"]["S"], r["ic"]["b2"]["S"]) and r["ic"]["dif"]["semi"] < r["ic"]["semiIndep"]):
        fallas.append("pareada: el desvío de la diferencia no es menor que el de cada serie")
    igual("E6: pendiente", r["e6"]["pendiente"], d.est["e6"]["pendiente"], 1e-9)
    igual("Bonferroni: nivel individual", r["bonferroni"]["nivel"], serie["nivelBonferroni"], 1e-12)
    for x in r["bonferroni"]["contraMejor"]:
        dentro = x["ic"]["inf"] <= 0 <= x["ic"]["sup"]
        if dentro != (x["k"] in r["bonferroni"]["conjunto"]):
            fallas.append(f"Bonferroni: k = {x['k']} mal clasificado")
    mm = r["mm3"]
    for clave, nombre in [("rho", "ρ"), ("C", "P(espera"), ("Lq", "Lq"), ("Wq", "Wq"), ("W", "W"), ("L", "L")]:
        igual(f"M/M/3: {clave}", mm[clave], mm["sim"][nombre]["teorico"], 1e-9)
    li = r["little"]
    igual("Little: L = λW", li["L"], li["lambdaW"], 1e-6)
    igual("P-K: Wq", r["pk"]["Wq"], r["pk"]["sim"]["teorico"], 1e-9)
    sr, jk = r["serie"], r["serie"]["sim"]
    igual("Burke: Wq admisión", sr["WqAdm"], jk["Wq admisión [min]"]["teorico"], 1e-9)
    igual("Burke: Wq consultorio", sr["WqCons"], jk["Wq consultorio [min]"]["teorico"], 1e-9)
    total = next(v for k, v in jk.items() if k.startswith("Espera total"))
    igual("Jackson: espera total", sr["total"], total["teorico"], 1e-9)
    ds, eu = r["ds"], c["euler"]
    for clave in ["a", "p", "d", "S"]:
        igual(f"Euler: {clave}", ds[clave], eu[clave], 1e-9)
    igual("Euler: D en el pico", ds["Dpico"], eu["D"], 1e-12)
    igual("Euler: dL/dt", ds["dL"], eu["dL"], 1e-9)
    igual("Euler: L después de un paso", ds["L1"], eu["L1"], 1e-12)
    igual("equilibrio: D₀", ds["D0"], d.din["parametros"]["demandaBase"], 1e-9)
    igual("equilibrio: C(0)", ds["C0"], d.din["capacidad0"], 1e-12)
    igual("equilibrio: L* = a*·C", ds["L0equilibrio"], ds["L0"], 1e-9)
    return fallas
