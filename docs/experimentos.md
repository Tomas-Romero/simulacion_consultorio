# Experimentos Monte Carlo (paso #4)

> Diseño escrito antes de implementar. El modelo y los presets están **congelados**: toda variación
> (k, política, ausentismo, costos) se aplica como modificación del escenario en la capa de
> experimentos (`src/experimentos/`), nunca editando presets ni el modelo.
> Reproducir con `npm run estudio`, que genera `public/resultados/estudio.json` y los CSV.

## 1. Pregunta y criterio

**Pregunta:** cuántos sobreturnos dar por profesional (k) y dónde ubicarlos (política), para cada
escenario.

**Criterio único de decisión:** el beneficio neto esperado por día,
**B = ingresos − c_espera·espera − c_extra·extra − c_perdido·perdidos**. El costo clásico C se
informa como contraste (`docs/modelo-conceptual.md`, sección 1).

**Unidad experimental:** un día simulado (réplica). Los días son independientes e idénticamente
distribuidos (S15), así que el IC de la media es el de t de Student sobre los valores diarios.

## 2. Factores y niveles

| Experimento | Factores | Niveles | Configuraciones |
|---|---|---|---|
| E1 · Curva B(k) | preset × política × k | 3 × 4 × 7 (k = 0–6, igual para todos los profesionales) | 84 |
| E2 · Políticas | sale de E1 (cada política en su mejor k) | — | 0 nuevas |
| E3 · Sensibilidad al ausentismo | ausentismo medio × k (policonsultorio, política ganadora de E2) | 6 × 7 | 42 |
| E3 · Costos | factor de c_extra × k · c_espera × k | 5 × 7 · 3 × 7 | 0 nuevas (reponderación, sección 5) |
| E4 · Regla práctica | preset × ausentismo × k (política ganadora de cada preset) | 3 × 6 × 7 | 84 (las 42 del policonsultorio son las de E3) |
| E5 · Riesgo | sale de E1 (policonsultorio, política ganadora) | — | 0 nuevas |
| E6 · Precisión | R (una configuración: policonsultorio, política ganadora, k̂) | R = 125 · 2ʲ hasta 16 000 | 1 (prefijos anidados) |

**Políticas de ubicación:**

| Política | Ubicación de los sobreturnos |
|---|---|
| `inicio` | Primeros slots para turnos |
| `intercalado` | Repartidos en la jornada |
| `mayor_ausentismo` | Slots con mayor P(no-show) predicha |
| `final` | Después del último slot |

**Ausentismo.** El nivel es el ausentismo medio de los pacientes con turno, ponderado por la tabla
de anticipación: p̄ = Σ f_d · p(d) / Σ f_d con p(d) = 1 / (1 + e^−(β₀ + β₁·d)). Se fija β₁ = 0,055 y
se despeja β₀ por bisección, con 200 iteraciones:

| p̄ objetivo | β₀ | p̄ obtenido |
|---|---|---|
| 5 % | −3,7117 | 5,000 % |
| 10 % | −2,9499 | 10,000 % |
| 15 % | −2,4732 | 15,000 % |
| 20 % | −2,1112 | 20,000 % |
| 25 % | −1,8103 | 25,000 % |
| 30 % | −1,5462 | 30,000 % |

El preset calibrado tiene β₀ = −2,4973, o sea p̄ = 14,7 %. Cambiar β₀ **preserva los números
aleatorios comunes**: cada paciente falta si u₂ < p(d), y el uniforme u₂ no cambia, solo el umbral.
Por eso con p̄ más alto faltan los mismos pacientes que con p̄ más bajo, y algunos más. Lo controla
un test.

**N** (turnos reservados por profesional por día, para la regla práctica de E4) es el promedio sobre
los profesionales del preset de los slots para turnos, sin cupos y con ocupación 1:

| Preset | Slots para turnos por profesional | N̄ |
|---|---|---|
| Chico | 21 | 21 |
| Policonsultorio | 21, 16, 21 | 19,33 |
| Centro | 21, 16, 11, 21, 16, 16 | 16,83 |

## 3. Réplicas y semillas

- **Semilla del estudio:** 2026600, nueva. La exploración usó 2026100, la verificación 2026200 y
  los barridos de control 2026300–2026500.
- **Números aleatorios comunes:** la réplica r usa `(semilla, r)` en todas las configuraciones. El
  pre-muestreo por identidad del paciente hace que agregar sobreturnos o cambiar β₀ no altere los
  atributos de los demás pacientes. Todas las comparaciones son **pareadas** por réplica.
- **R inicial = 2000 días.** En el barrido de control del #2d, con 1000 días, el semiancho de las
  diferencias consecutivas cerca del óptimo fue de unos $3.500–4.000. Con 2000 días se espera
  ≈ $2.500–2.800 (∝ 1/√R), apenas por debajo del objetivo de $3.000.
- **Regla de precisión (duplicar R):** para cada serie (configuraciones que solo difieren en k), se
  toman las diferencias pareadas consecutivas alrededor del mejor k̂: B(k̂) − B(k̂−1) y
  B(k̂+1) − B(k̂), las que existan. Si el semiancho del IC 95 % de alguna supera $3.000, se duplica R
  en **toda la serie**, para mantener el pareo, y se repite hasta cumplir o llegar a R = 16 000. Al
  duplicar se simulan solo las réplicas nuevas (r = R … 2R−1); las anteriores se conservan. El R
  final se informa por serie. Se aplica a las series de E1, E3 y E4.
- **Reproducibilidad:** cada réplica se simula por separado y los resultados se ubican por su
  índice. Todos los agregados se calculan después, en un orden fijo. Por eso el resultado es
  **idéntico bit a bit** con 1, 4 u 8 workers; lo controla un test. El JSON trae una huella (hash de
  todos los valores diarios) para comparar corridas.
- **Entre motores de JavaScript distintos** la huella puede cambiar. Medido: Node 22.15 (V8 12.4) y
  Chrome 152 redondean distinto el último bit de `Math.exp` y `Math.log` (sobre 200 000 valores,
  las dos funciones dan resultados distintos en algún caso). B de un día difiere en ~10⁻¹⁶ relativo
  (por ejemplo $1.382.850,6332284356 contra …359), con los mismos pacientes atendidos.
  - Garantizar la igualdad bit a bit entre motores exigiría reemplazar `Math.exp` y `Math.log` en el
    motor, que está congelado.
  - Por eso, cuando el estudio se reproduce en el navegador se comparan las **decisiones**: k̂,
    conjuntos, recomendados, R final, política ganadora, α y k de las reglas. Deben ser idénticas, y
    también se informa la mayor diferencia relativa entre medias de B (`src/experimentos/comparar.ts`).

## 4. Selección del mejor k y comparaciones múltiples

Para cada serie con K = 7 niveles de k:

1. **Mejor estimado:** k̂ = argmax B̄(k).
2. **Conjunto de óptimos indistinguibles.** Para cada k ≠ k̂ se calcula la diferencia pareada diaria
   D_k = B(k̂) − B(k) y su IC con **Bonferroni sobre las K − 1 = 6 comparaciones contra el mejor**:
   nivel individual 1 − 0,05/6 ≈ 99,17 %, conjunto ≥ 95 %. Si el IC de D_k contiene el 0, el valor k
   es indistinguible de k̂. El conjunto es I = {k̂} ∪ {k indistinguibles}.
3. **Recomendación (desempate documentado):** k_rec = min I, el menor k del conjunto. Da el mismo
   beneficio esperado (no se puede distinguir) con menos espera, menos horas extra y menos
   variabilidad diaria.
4. **k*_C** = argmin C̄(k), solo como contraste.
5. **Contra k = 0:** se informa la diferencia pareada B(k) − B(0) con su IC 95 % individual, para cada
   k.

**E2 · Políticas.**

- Cada política se evalúa en su k̂ de E1 (lo mejor que logra) y se reportan también su k_rec, la espera
  media por atendido, el ocio y las horas extra.
- Se comparan los 6 pares de políticas con diferencias pareadas e IC con Bonferroni, nivel
  1 − 0,05/6.
- La ganadora es la de mayor B̄. Si su IC con otra contiene el 0, se informan empatadas, pero se
  mantiene la de mayor B̄ como "ganadora" para E3–E5.
- Las comparaciones usan el R común a las cuatro series (el mínimo), así el pareo es completo.

## 5. Sensibilidad a los costos por reponderación (exacta)

Los costos no cambian la dinámica del día: entran solo en B y C. Por eso, para cada día se guardan
los componentes y B se recalcula con cualquier costo, sin volver a simular:

- atendidos;
- Σ espera de los atendidos;
- Σ c_ocio,i·extra_i;
- Σ c_extra,i·extra_i;
- Σ c_ocio,i·ocio_i;
- perdidos.

Con eso:

```
B(c_espera, factor) = honorario·atendidos − c_espera·Σespera − factor·Σ c_ocio,i·extra_i − c_perdido·perdidos
C(c_espera, factor) = c_espera·Σespera + Σ c_ocio,i·ocio_i + factor·Σ c_ocio,i·extra_i + c_perdido·perdidos
```

Con los costos base (c_espera = 150, factor 1,5), la reponderación coincide con el B y el C que
calcula el modelo; lo controla un test. Así:

- el **factor de c_extra** ∈ {1; 1,25; 1,5; 1,75; 2} y **c_espera** ∈ {75, 150, 300} se evalúan sobre
  la serie del policonsultorio de E1;
- el **mapa de calor** ausentismo × factor, sobre las 6 series de ausentismo de E3.

Todo con los mismos días, así que las comparaciones entre niveles de costo también son pareadas.

## 6. Regla práctica (E4)

Sobre las 18 configuraciones preset × ausentismo, cada una con la política ganadora de su preset:

- **Regla ingenua:** k = round(p̄·N̄), "reponer a los que se espera que falten".
- **Regla ajustada:** k = round(α·p̄·N̄).
  - α se elige por grilla (0 a 3, paso 0,01) **minimizando la pérdida esperada total**
    Σ [B̄(k̂) − B̄(k_regla)] sobre las 18 configuraciones.
  - Desempate entre α con la misma pérdida: el más cercano a la pendiente de mínimos cuadrados por
    el origen de k̂ contra p̄·N̄.
  - Se informa también esa pendiente.
- En las dos reglas, k se recorta a 0–6, el rango simulado; se marca cuando se recorta.
- Para cada configuración y regla se informan:
  - la **pérdida esperada por usar la regla**, B(k̂) − B(k_regla), con su IC 95 % pareado;
  - si k_regla cae dentro del conjunto indistinguible (**margen de error de la regla**).
- La pérdida medida contra k̂ es levemente optimista para k̂, porque k̂ se elige con los mismos
  días (sesgo de selección); se aclara en el informe.

## 7. Riesgo (E5) y precisión (E6)

- **E5:** para el policonsultorio con la política ganadora y cada k, la distribución de
  ΔB = B(k) − B(0) día a día: percentiles 5, 25, 50, 75 y 95, la media y P(ΔB < 0), la probabilidad
  de que en un día dado los sobreturnos rindan menos que no darlos.
- **E6:** en la configuración policonsultorio, política ganadora, k̂, se simulan 16 000 días. Se
  calcula el semiancho del IC 95 % de B con los primeros R días, para R = 125, 250, …, 16 000, y se
  ajusta log(semiancho) = a + b·log(R) por mínimos cuadrados. Se espera b ≈ −1/2 (como el Exp. 3
  del TP5).

## 8. Implementación

| Pieza | Dónde | Qué hace |
|---|---|---|
| Esquema | `src/experimentos/esquema.ts` | Esquema zod de un experimento: escenario base, factores (k, políticas, ausentismo), R, semilla. Las modificaciones del escenario se aplican en `aplicarNivel` |
| Tareas | `src/experimentos/tareas.ts` | Una tarea es un bloque de réplicas [desde, hasta) de una configuración. El worker devuelve una fila de métricas por réplica |
| Pool | `src/experimentos/pool.ts` | Cola de tareas y hilos genéricos. En el navegador usa `navigator.hardwareConcurrency` Web Workers; en Node, `worker_threads` según `os.cpus()`. Tiene progreso y cancelación con `AbortSignal` |
| Análisis | `src/experimentos/analisis.ts` | Funciones puras sobre las columnas diarias |
| Estudio | `src/experimentos/estudio.ts` | Orquesta E1–E6 con cualquier ejecutor. Lo usan el script de Node y el navegador |
| Script | `scripts/estudio.ts` | `npm run estudio`: escribe `public/resultados/estudio.json` y `public/resultados/*.csv` con versión, semilla, fecha, hash de los presets, huella de los datos, R final por serie, hilos y duración |

En la interfaz, la pantalla de Experimentos carga el JSON al instante y el Laboratorio corre
experimentos a medida en vivo, con el pool de Web Workers.
