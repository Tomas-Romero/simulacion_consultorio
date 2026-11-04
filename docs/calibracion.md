# Calibración de la situación inicial (pasos #2b y #2c)

> Objetivo: que la situación inicial de cada preset (sin sobreturnos, `k = 0`) represente una
> operación plausible, con **metas fijadas de antemano** y **sin mirar el k óptimo** durante la
> calibración. Reproducir con `npm run calibrar` y `npm run barrido-control`.
>
> Las secciones 1–6 son la **primera calibración (#2b)** y quedan como registro histórico; sus
> números corresponden al modelo de ese momento. La **iteración de validación 2 (#2c)**, en
> las secciones 7–8, corrige tres supuestos y define los presets vigentes.

## 1. Metas (fijadas a priori, mensaje #2b)

Media sobre 1000 días por preset, con `k = 0`:

| Indicador | Meta | Cómo se mide |
|---|---|---|
| Utilización del médico | 80–88 % | media diaria de (min atendiendo / min presente), todos los médicos juntos |
| Ausentismo de pacientes con turno | 12–18 % | ausentes / turnos reservados, sobre todos los días |
| Espera media de pacientes con turno | 5–15 min | media de la espera de los atendidos con clase turno, sobre todos los días |
| Horas extra | < 20 min/día por médico | media diaria de horas extra totales / cantidad de médicos |
| Abandono | < 5 % de los espontáneos | abandonos / espontáneos que entraron (sin contar `sin_profesional` ni `fuera_de_horario`) |

## 2. Procedimiento

1. **Correcciones de modelo** (no son calibración): `k = 0` por defecto en los tres presets, y la
   mezcla de especialidades de los espontáneos se renormaliza sobre las especialidades presentes
   en el escenario (`sin_profesional` solo ocurre si la especialidad existe pero nadie de ella
   está en turno a esa hora, por ejemplo pediatría a la tarde).
2. **Palancas, en orden de preferencia:** proporción de primera vez → tasa de espontáneos →
   ocupación de la agenda → tabla de anticipación. No se tocaron la función de costo ni la regla
   de selección.
3. **Semillas separadas:** la exploración usó la semilla 2026100 (300 días por combinación) y la
   verificación final, la semilla 2026200 (1000 días), para no ajustar al ruido de una muestra.
4. **Regla de elección:** se usa la primera palanca que alcance; dentro de una palanca, el
   cambio más chico que cumpla las metas.
5. Durante la calibración **no se corrió ningún experimento de k**. El barrido de control se
   hizo una sola vez, con los parámetros ya congelados y otra semilla (2026300).

## 3. Resultados (1000 días, semilla 2026200)

| Preset | Etapa | k | Utilización | Ausentismo | Espera turno [min] | Extra/médico [min] | Abandono | Ocio/médico [min] | Espont./día | Sin prof./día | Costo medio |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Consultorio chico | #2 original | 2 | 91,4 % ✘ | 15,1 % ✔ | 17,6 ✘ | 23,3 ✘ | 58,7 % ✘ | 31,5 | 7,3 | 5,21 | $226.802 |
| | tras correcciones 1a + 1b | 0 | 89,1 % ✘ | 15,1 % ✔ | 12,6 ✔ | 15,1 ✔ | 51,9 % ✘ | 39,5 | 7,3 | 3,53 | $187.201 |
| | **calibrado** | 0 | **85,2 % ✔** | **15,1 % ✔** | **9,0 ✔** | **9,1 ✔** | 43,8 % ✘ | 53,3 | 3,8 | 0,00 | $102.086 |
| Policonsultorio (por defecto) | #2 original | 2/1 | 92,5 % ✘ | 14,7 % ✔ | 19,5 ✘ | 26,3 ✘ | 63,8 % ✘ | 28,1 | 18,6 | 6,01 | $585.855 |
| | tras correcciones 1a + 1b | 0 | 90,3 % ✘ | 14,7 % ✔ | 14,3 ✔ | 18,1 ✔ | 57,4 % ✘ | 35,5 | 18,6 | 2,84 | $480.527 |
| | **calibrado** | 0 | **87,0 % ✔** | **14,7 % ✔** | **10,5 ✔** | **11,5 ✔** | 49,4 % ✘ | 46,9 | 18,6 | 2,84 | $427.700 |
| Centro completo | #2 original | 2/1 | 91,2 % ✘ | 14,8 % ✔ | 19,7 ✘ | 27,0 ✘ | 66,0 % ✘ | 33,1 | 27,8 | 6,42 | $986.053 |
| | tras correcciones 1a + 1b | 0 | 88,2 % ✘ | 14,8 % ✔ | 14,1 ✔ | 18,2 ✔ | 58,8 % ✘ | 43,6 | 27,8 | 5,97 | $833.945 |
| | **calibrado** | 0 | **84,4 % ✔** | **14,8 % ✔** | **10,2 ✔** | **11,3 ✔** | 51,1 % ✘ | 56,5 | 27,8 | 5,97 | $754.866 |

**Cuatro de las cinco metas se cumplen en los tres presets.** El abandono queda fuera de meta
(sección 5). `tests/modelo/calibracion.test.ts` verifica las cuatro metas como regresión.

## 4. Parámetros cambiados

| Preset | Parámetro | Antes | Después | Palanca / motivo |
|---|---|---|---|---|
| Los tres | `sobreturnos.k` de cada profesional | 2 (clínica y cardiología), 1 (resto) | **0** | Corrección 1a: k es la variable de decisión |
| Los tres | Mezcla de espontáneos | sobre las 6 especialidades | **renormalizada sobre las presentes** | Corrección 1b (código, `preparar.ts`) |
| Los tres | `pacientes.proporcionPrimeraVez` | 0,40 | **0,25** | Palanca 1: atención media 1,0·D → 0,925·D |
| Consultorio chico | `espontaneos.tasasPorHora` | 12 h (08–20) × 0,4 del perfil base | **6 h (08–14)** × 0,4 del perfil base | Palanca 2, decisión propia: el consultorio solo abre de mañana, así que no tiene demanda espontánea a la tarde (antes eran ≈ 3,5 pérdidas/día `sin_profesional`) |
| — | Tasa de espontáneos (policonsultorio, centro), ocupación de la agenda, tabla de anticipación | — | sin cambios | No hizo falta: con la palanca 1 ya se cumplen las cuatro metas alcanzables |

## 5. El abandono no puede quedar debajo del 5 %

**Diagnóstico** (calibrado, 1000 días):

| Preset | Espera media de los espontáneos atendidos | Abandonos en la cola de admisión | Al salir de admisión | En la sala |
|---|---|---|---|---|
| Consultorio chico | 19,0 min | 1 % | 9 % | 89 % |
| Policonsultorio | 20,7 min | 2 % | 9 % | 89 % |
| Centro completo | 21,9 min | 0 % | 9 % | 91 % |

**Por qué no entra.** Con paciencia exponencial de media 45 min, un espontáneo que debería esperar
W minutos abandona con probabilidad `1 − e^(−W/45) ≈ W/45`. Para que el abandono sea < 5 %, la
espera media (que incluye la admisión, ≈ 2,7 min) tendría que ser menor a ≈ 2,3 min. Pero con la
regla de selección del modelo (urgencias → puntuales → tardíos → espontáneos) y la agenda llena,
casi siempre hay un paciente con turno esperando (llegan en promedio 5 min antes), así que el
espontáneo solo entra en los huecos que dejan los ausentes o las consultas cortas. Su espera
depende de cada cuánto aparece un hueco, no de la carga total.

**Evidencia:**
- **Exploración de palancas** (semilla 2026100, 300 días por punto; primera vez 0,25; escala de
  espontáneos 0,1–1 y ocupación de la agenda 0,70–1): el abandono **mínimo** con utilización
  ≥ 80 % fue ≈ 38 % en los tres presets. En toda la grilla, incluso con utilización del 57 %, no
  bajó del 18 %.
- **Sensibilidad a la paciencia** (informativa, **no aplicada**: la paciencia no es una palanca
  permitida). Policonsultorio calibrado, 1000 días:

  | Paciencia media | Abandono | Utilización | Espera turno | Extra/médico | Espera espontáneos atendidos |
  |---|---|---|---|---|---|
  | 45 min (actual) | 49,4 % | 87,0 % | 10,5 | 11,5 | 20,7 min |
  | 90 min | 38,9 % | 88,4 % | 10,8 | 13,2 | 36,4 min |
  | 180 min | 28,5 % | 89,6 % | 11,2 | 15,7 | 55,3 min |
  | 360 min | 19,0 % | 90,6 % | 11,4 | 18,5 | 74,6 min |
  | 720 min | 11,5 % | 91,1 % | 11,5 | 21,3 | 92,0 min |

  Ni con 12 h de paciencia media se llega al 5 %: el abandono lo produce la regla de selección
  combinada con la agenda llena, no la paciencia.

**Conclusión:** con la regla de selección fija y las palancas permitidas, la meta de abandono no
se puede cumplir sin bajar la utilización muy por debajo del 80 % (y aun así no llega). Se deja
fuera de meta y se informa. Alternativas que quedan a decisión del arquitecto (ninguna aplicada):
reservar slots para demanda espontánea, cambiar la regla de selección (por ejemplo, intercalar
espontáneos cada cierta cantidad de turnos, o subirlos de prioridad después de cierto tiempo de
espera) o redefinir la meta.

## 6. Barrido de control (una sola vez, parámetros congelados)

Policonsultorio (escenario por defecto), mismo `k` para los 3 profesionales, política
intercalado, 1000 días con números aleatorios comunes, semilla 2026300:

| k (por médico) | Costo total medio | IC 95 % | Espera | Ocio | Horas extra | Perdidos | Neto medio | Atendidos/día | Abandonos/día | Utilización |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | $427.308 | [$421.779, $432.838] | $110.788 | $70.265 | $24.676 | $221.580 | $1.489.062 | 63,9 | 7,35 | 87,0 % |
| 1 | $468.037 | [$461.742, $474.332] | $141.683 | $57.744 | $31.450 | $237.160 | $1.508.453 | 65,9 | 8,13 | 89,4 % |
| 2 | $512.232 | [$505.050, $519.414] | $172.249 | $47.592 | $41.050 | $251.340 | $1.526.268 | 68,0 | 8,84 | 91,4 % |
| 3 | $562.972 | [$554.736, $571.209] | $207.411 | $38.152 | $53.049 | $264.360 | $1.538.648 | 70,1 | 9,49 | 93,2 % |
| 4 | $621.060 | [$611.711, $630.410] | $247.664 | $29.793 | $66.084 | $277.520 | $1.543.650 | 72,2 | 10,15 | 94,7 % |

Diferencia pareada de costo contra k = 0 (mismos días):

| k | Diferencia media | IC 95 % |
|---|---|---|
| 1 | $40.729 | [$38.702, $42.755] |
| 2 | $84.923 | [$81.650, $88.196] |
| 3 | $135.664 | [$131.139, $140.189] |
| 4 | $193.752 | [$187.843, $199.661] |

**Lectura:** con la función de costo actual la curva es **monótona creciente** y el mínimo está en
`k = 0`. Por cada sobreturno por médico, el ocio baja ≈ $12.500/día, pero la espera sube
≈ $31.000, los perdidos ≈ $15.000 (los sobreturnos ocupan los huecos donde se atendía a los
espontáneos, y aumentan los abandonos) y las horas extra ≈ $7.000. El **resultado neto**, en
cambio, crece con k (+$19.400 con k = 1, +$54.600 con k = 4), porque el honorario de cada consulta
extra no está en la función de costo. Según la consigna, **no se recalibró** para forzar un
óptimo interior.

## 7. Iteración de validación 2 (#2c)

### 7.1 Diagnóstico

El barrido monótono del #2b (k* = 0) y el abandono estructural no eran errores de código: eran
**supuestos poco realistas** que la simulación dejó a la vista (validez aparente). Se corrigen
tres, sin cambiar las metas a priori y sin mirar k durante la calibración:

| # | Supuesto del #2b | Problema | Corrección |
|---|---|---|---|
| 1 | Paciencia exponencial de media 45 min | Sin memoria: el 10,5 % se iba en los primeros 5 min y el 35,9 % antes de los 20, algo inverosímil en una sala de espera | **Lognormal, media 60 min, CV 0,5**: P(< 20 min) = 1,8 %, P(< 30 min) = 10,9 %. Configurable en el esquema (lognormal o exponencial) para la comparación del informe |
| 2 | Los espontáneos no tienen lugar propio | Solo se atienden en los huecos de los ausentes, los mismos que ocupan los sobreturnos | **Cupos de demanda espontánea** por profesional (`cuposEspontaneos.cadaN`): 1 de cada N slots, equiespaciados, que no se reservan para turnos ni reciben sobreturnos. Durante la ventana de un cupo el orden es urgencias → espontáneos → puntuales → tardíos; sin espontáneos esperando, rige el orden normal |
| 3 | c_ocio = $500/min fijo | Un minuto de consulta genera ≈ honorario / duración media ≈ $2.160/min: el ocio estaba subvaluado | **Criterio principal B** (beneficio neto, sin restar ocio) y **criterio secundario C** con `c_ocio` derivado = honorario / duración media de la consulta de cada profesional |

Valores derivados de `c_ocio` (primera vez 0,25 ⇒ duración media 0,925·D):

| D | Duración media | c_ocio derivado |
|---|---|---|
| 15 min | 13,875 min | $2.162/min |
| 20 min | 18,5 min | $1.622/min |
| 30 min | 27,75 min | $1.081/min |

### 7.2 Recalibración

- **Palancas, en orden:** fracción de cupos (N) → tasa de espontáneos → ocupación de la agenda.
  La proporción de primera vez queda en 0,25.
- **Semillas:** exploración 2026100 (300 días por punto), verificación 2026200 (1000 días),
  barrido 2026400.
- **Grilla explorada:** N ∈ {2, 3, 4, 5, 6, 7, 8, 9, 10, 12}, escala de espontáneos × {1; 1,25;
  1,5; 1,75; 2; 2,25; 2,5; 3; 3,5; 4} sobre el valor del #2b, ocupación ∈ {1; 0,95; 0,9}.
- **Resultado:** **ninguna combinación cumple las cinco metas.** El abandono baja del 5 % solo con
  un cupo cada 2 slots y la tasa de espontáneos sin tocar, pero entonces la utilización cae al
  52–58 %.
- **Regla aplicada, porque la meta de abandono vuelve a ser inalcanzable** (extensión propia de
  "la primera palanca que alcance"): se elige la combinación que **minimiza el abandono con las
  otras cuatro metas cumplidas con margen** (utilización 80,5–87,5 %). Se usa primero solo la
  palanca 1, y se agrega la siguiente únicamente si baja el abandono mínimo en **≥ 2 puntos
  porcentuales**. Mínimos de la exploración (semilla 2026100):

| Preset | Solo cupos | Cupos + tasa de espontáneos | + ocupación | Elección |
|---|---|---|---|---|
| Consultorio chico | N = 10 → 20,5 % | N = 2, escala ×4 → 14,6 % | igual | cupos + tasa (−5,9 pp) |
| Policonsultorio | N = 7 → 22,9 % | N = 3, escala ×2 → 19,3 % | N = 2, ×3, ocup. 0,9 → 18,4 % | cupos + tasa (−3,6 pp; la ocupación mejora solo 0,9 pp) |
| Centro completo | N = 12 → 30,9 % | igual | igual | solo cupos |

### 7.3 Metas: calibración #2b → nueva (1000 días, semilla 2026200)

| Preset | Etapa | Utilización (80–88 %) | Ausentismo (12–18 %) | Espera turno (5–15 min) | Extra/médico (< 20 min) | Abandono (< 5 %) | Ocio/médico [min] | Espont./día |
|---|---|---|---|---|---|---|---|---|
| Consultorio chico | calibración #2b | 85,2 % ✔ | 15,1 % ✔ | 9,0 ✔ | 9,1 ✔ | 43,8 % ✘ | 53,3 | 3,8 |
| | tras corregir los supuestos 1 y 3 (sin cupos) | 86,3 % ✔ | 15,1 % ✔ | 9,2 ✔ | 9,7 ✔ | 33,5 % ✘ | 49,3 | 3,8 |
| | **nueva calibración** | **81,1 % ✔** | **15,2 % ✔** | **10,0 ✔** | **2,1 ✔** | 15,2 % ✘ | 66,5 | 15,2 |
| Policonsultorio | calibración #2b | 87,0 % ✔ | 14,7 % ✔ | 10,5 ✔ | 11,5 ✔ | 49,4 % ✘ | 46,9 | 18,6 |
| | tras corregir los supuestos 1 y 3 (sin cupos) | 88,5 % ✘ | 14,7 % ✔ | 10,9 ✔ | 12,1 ✔ | 40,2 % ✘ | 41,7 | 18,6 |
| | **nueva calibración** | **81,4 % ✔** | **14,7 % ✔** | **9,3 ✔** | **6,6 ✔** | 18,8 % ✘ | 66,7 | 36,9 |
| Centro completo | calibración #2b | 84,4 % ✔ | 14,8 % ✔ | 10,2 ✔ | 11,3 ✔ | 51,1 % ✘ | 56,5 | 27,8 |
| | tras corregir los supuestos 1 y 3 (sin cupos) | 85,4 % ✔ | 14,8 % ✔ | 10,5 ✔ | 11,8 ✔ | 42,8 % ✘ | 52,8 | 27,8 |
| | **nueva calibración** | **81,7 % ✔** | **14,8 % ✔** | **9,1 ✔** | **10,3 ✔** | 31,8 % ✘ | 66,1 | 27,8 |

Cuatro de las cinco metas se cumplen en los tres presets. **Abandono mínimo logrado:** 15,2 %
(chico), 18,8 % (policonsultorio), 31,8 % (centro); el 100 % de los abandonos ocurre en la sala.

**Causa:** un cupo da prioridad solo durante su ventana (un slot de D minutos). Un espontáneo que
llega fuera de ella espera a la próxima ventana o a un hueco que dejen los ausentes, y las ventanas
están separadas N·D minutos (45 min en el policonsultorio, 180 min en el centro). Además, en cada
ventana se atiende a un solo espontáneo, así que en las horas pico la cola se acumula. Con
paciencia de media 60 min, las esperas de los espontáneos atendidos (media 20–23 min) ya implican
abandonos del 15–30 %. Bajarlo al 5 % exige cupos tan frecuentes (1 de cada 2) que la agenda
pierde la mitad de los turnos y la utilización cae por debajo del 80 %.

### 7.4 Parámetros cambiados (#2b → #2c)

| Preset | Parámetro | Anterior | Nuevo | Motivo |
|---|---|---|---|---|
| Los tres | `espontaneos.paciencia` | exponencial, media 45 | **lognormal, media 60, CV 0,5** | Supuesto 1 |
| Los tres | `costos.ocio` | 500 $/min | **'derivado'** (2.162 / 1.622 / 1.081 $/min según D) | Supuesto 3 |
| Consultorio chico | `cuposEspontaneos.cadaN` | 0 (sin cupos) | **2** | Palanca 1 |
| Consultorio chico | escala de espontáneos | 0,4 × perfil base (08–14) | **1,6 ×** perfil base (08–14) | Palanca 2 |
| Policonsultorio | `cuposEspontaneos.cadaN` | 0 | **3** | Palanca 1 |
| Policonsultorio | escala de espontáneos | 1 × perfil base | **2 ×** perfil base | Palanca 2 |
| Centro completo | `cuposEspontaneos.cadaN` | 0 | **12** | Palanca 1 |
| Los tres | ocupación de la agenda, primera vez (0,25), resto | — | sin cambios | — |

## 8. Barrido de control #2c (uno, parámetros congelados)

Policonsultorio, mismo `k` para los 3 profesionales, política intercalado, 1000 días con números
aleatorios comunes, semilla 2026400. c_ocio derivado: P1 $2.162/min, P2 $1.622/min, P3 $2.162/min.

| k | B medio | IC 95 % de B | C medio | IC 95 % de C | Ingresos | Espera $ | Ocio $ | Extra $ | Perdidos $ | Atendidos | Abandonos | Ocio [min] | Extra [min] | Utilización |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | $1.445.319 | [$1.436.168, $1.454.470] | $779.510 | [$772.271, $786.748] | $1.844.610 | $125.537 | $380.219 | $13.954 | $259.800 | 61,5 | 5,73 | 198,4 | 18,6 | 81,5 % |
| 1 | $1.453.116 | [$1.443.984, $1.462.248] | $776.713 | [$769.524, $783.902] | $1.899.720 | $150.991 | $330.109 | $17.333 | $278.280 | 63,3 | 6,65 | 171,9 | 23,1 | 84,0 % |
| 2 | $1.468.601 | [$1.459.149, $1.478.052] | **$772.113** | [$764.639, $779.588] | $1.960.110 | $176.011 | $280.604 | $22.358 | $293.140 | 65,3 | 7,40 | 145,9 | 29,8 | 86,5 % |
| 3 | $1.484.030 | [$1.474.459, $1.493.602] | $776.451 | [$768.564, $784.338] | $2.022.840 | $201.860 | $237.641 | $30.670 | $306.280 | 67,4 | 8,06 | 123,5 | 40,9 | 88,7 % |
| 4 | $1.487.469 | [$1.477.320, $1.497.618] | $789.510 | [$781.159, $797.861] | $2.082.030 | $234.851 | $194.949 | $37.770 | $321.940 | 69,4 | 8,84 | 100,9 | 50,4 | 90,8 % |
| 5 | **$1.501.237** | [$1.490.911, $1.511.563] | $808.451 | [$799.442, $817.459] | $2.151.180 | $267.183 | $158.508 | $51.700 | $331.060 | 71,7 | 9,30 | 82,1 | 68,9 | 92,6 % |
| 6 | $1.493.889 | [$1.483.185, $1.504.593] | $851.424 | [$841.417, $861.431] | $2.216.790 | $315.071 | $128.523 | $65.910 | $341.920 | 73,9 | 9,84 | 66,5 | 87,9 | 94,1 % |

Diferencias pareadas contra k = 0 (mismos días):

| k | ΔB medio | IC 95 % de ΔB | ΔC medio | IC 95 % de ΔC | Δ(C + B) |
|---|---|---|---|---|---|
| 1 | $7.797 | [$4.785, $10.809] | −$2.797 | [−$5.455, −$138] | $5.000 |
| 2 | $23.282 | [$18.887, $27.676] | −$7.396 | [−$11.581, −$3.211] | $15.885 |
| 3 | $38.711 | [$33.420, $44.003] | −$3.059 | [−$8.606, $2.489] | $35.652 |
| 4 | $42.150 | [$35.619, $48.681] | $10.000 | [$3.117, $16.883] | $52.150 |
| 5 | $55.918 | [$48.594, $63.243] | $28.941 | [$20.594, $37.289] | $84.860 |
| 6 | $48.570 | [$40.231, $56.908] | $71.914 | [$61.888, $81.941] | $120.484 |

Diferencias pareadas de B entre k consecutivos: B(1)−B(0) = $7.797 [$4.785, $10.809];
B(2)−B(1) = $15.485 [$11.986, $18.983]; B(3)−B(2) = $15.429 [$12.007, $18.852];
B(4)−B(3) = $3.439 [−$256, $7.135]; B(5)−B(4) = $13.768 [$10.438, $17.099];
B(6)−B(5) = −$7.349 [−$10.971, −$3.727].

**Resultado:**
- **El problema de decisión ya no es trivial.** B tiene su máximo en **k = 5**, que supera con
  significancia a k = 4 y a k = 6 (IC pareados que no contienen el 0). C tiene su mínimo en
  **k = 2** (ΔC contra k = 0 = −$7.396 [−$11.581, −$3.211]).
- **Los dos criterios difieren en 3 sobreturnos por médico.** `C + B` no es constante: sube
  de $2.224.829 (k = 0) a $2.345.313 (k = 6), +5,4 %.

**Por qué difieren B y C.** `Δ(C + B) = honorario·Δatendidos + Δ(costo de ocio)`. Descomposición
contra k = 0:

| k | honorario·Δatendidos | Δ costo de ocio | Δ(C + B) | Δ horas extra |
|---|---|---|---|---|
| 1 | $55.110 (1,84 consultas) | −$50.110 | $5.000 | 4,5 min |
| 2 | $115.500 (3,85) | −$99.615 | $15.885 | 11,2 min |
| 3 | $178.230 (5,94) | −$142.578 | $35.652 | 22,3 min |
| 4 | $237.420 (7,91) | −$185.270 | $52.150 | 31,8 min |
| 5 | $306.570 (10,22) | −$221.710 | $84.860 | 50,3 min |
| 6 | $372.180 (12,41) | −$251.696 | $120.484 | 69,3 min |

La equivalencia supone que cada consulta extra se hace con minutos que antes eran ocio dentro del
turno. Con k = 5 se ganan 10,2 consultas, pero la reducción de ocio (116 min) solo "explica"
unas 7–8. El resto sale de dos fuentes:
- **Horas extra:** +50 min. El ocio solo se mide dentro del turno, así que las consultas hechas
  después del cierre suman ingreso sin restar ocio.
- **Duración de las consultas extra:** no es la media de 0,925·D. Los espontáneos duran 0,8·D, y
  los abandonos cambian con k.

En C, la hora extra solo cuesta (c_extra = $750/min) y no tiene contrapartida de ingreso; en B,
cada consulta hecha en horas extra aporta $30.000 frente a un costo de ≈ $10.400 (13,9 min ×
$750). Por eso **C recomienda menos sobreturnos que B**.

La diferencia de criterio se informa tal cual: según la consigna, no se recalibró para acercar
los dos óptimos.
