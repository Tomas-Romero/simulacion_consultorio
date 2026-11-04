# Calibración de la situación inicial (paso #2b)

> Objetivo: que la situación inicial de cada preset (sin sobreturnos, `k = 0`) represente una
> operación plausible, con **metas fijadas de antemano** y **sin mirar el k óptimo** durante la
> calibración. Reproducir con `npm run calibrar` y `npm run barrido-control`.

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
