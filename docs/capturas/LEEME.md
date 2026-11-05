# Capturas de la interfaz (paso #3)

Generadas con Chrome sin interfaz (`--headless=new`, protocolo DevTools). Viewport de 1440 × 900
salvo indicación; "página completa" = captura de toda la altura. Escenarios en sus valores
predefinidos (congelados) y semilla 2026.

| Archivo | Qué muestra |
|---|---|
| `01-inicio-claro.png` | Inicio, primera pantalla: la pregunta, la bajada, las acciones y la planta en miniatura en vivo (policonsultorio con 3 sobreturnos) |
| `02-inicio-oscuro.png` | Lo mismo en modo oscuro |
| `03-inicio-completo-claro.png` | Inicio completo: cómo se usa en 3 pasos, los tres escenarios como placas y lo que muestra el modelo |
| `04-escenario-claro.png` | Editor completo: profesionales (tarjetas con c_ocio y c_extra derivados), pacientes, ausentismo con la curva logística, espontáneos con el perfil por hora, admisión, sobreturnos y costos (página completa) |
| `05-escenario-oscuro.png` | Editor en modo oscuro |
| `06-escenario-error-claro.png` | Validación en vivo: un campo inválido (primera vez = 140 %) con el error junto al campo y el aviso arriba |
| `07-simulacion-policonsultorio-claro.png` | Simulación del día, policonsultorio a las 10:40: planta, agenda de cada consultorio y panel en vivo |
| `08-simulacion-centro-oscuro.png` | Simulación del día, centro de 6 profesionales a las 11:10, modo oscuro |
| `09-comparacion-policonsultorio-claro.png` | Comparación sincronizada: el mismo día sin sobreturnos (A) y con k = 3 intercalados (B), misma semilla |
| `10-comparacion-centro-oscuro.png` | Comparación con el centro de 6 profesionales, modo oscuro |
| `11-resultados-claro.png` | Resultados del día: resumen, Gantt por profesional, pacientes en sala, espera por clase, desglose de B y C y tabla por profesional (página completa) |
| `12-resultados-oscuro.png` | Resultados del día en modo oscuro (página completa) |
| `13-acerca-claro.png` | Acerca de: problema, temas de la materia, metodología y validación, limitaciones, autoría y crédito TARC Tech (página completa) |
| `14-dinamica-oscuro.png` | Pantalla del paso #5 (vacía, con su descripción) |
| `15-diagnostico-claro.png` | Página de diagnóstico del paso #1 integrada al sitio (`#/diagnostico`) |
| `16-movil-inicio-claro.png` | Inicio en celular (390 px, página completa) |
| `17-movil-simulacion-oscuro.png` | Simulación en celular: planta simplificada y panel debajo (390 px, página completa) |
| `18-tablet-simulacion-claro.png` | Simulación en tablet (820 × 1180) |
| `19-experimentos-claro.png` | Experimentos (paso #4): cabecera con semilla, R, hilos, duración y huella del estudio, y el índice de secciones |
| `20-exp-a-curva-claro.png` | a) Curva B(k): pequeños múltiplos por escenario con banda de IC y conjunto óptimo, tabla del mejor k y precisión (semiancho contra R, log-log) |
| `21-exp-b-politicas-claro.png` | b) Políticas: cada política en su mejor k con IC, balance espera/ocio y diferencias pareadas con Bonferroni |
| `22-exp-c-sensibilidad-claro.png` | c) Sensibilidad: k óptimo según el ausentismo, mapa de calor ausentismo × costo de hora extra, efecto de c_extra y de c_espera |
| `23-exp-d-regla-claro.png` | d) Regla práctica: fórmulas, k óptimo contra p̄·N̄ con las dos reglas y pérdida esperada por usarlas |
| `24-exp-e-riesgo-claro.png` | e) Riesgo: distribución diaria de B(k) − B(0) y P(B(k) < B(0)) |
| `25-exp-f-laboratorio-claro.png` | f) Laboratorio: experimento a medida corrido en vivo con Web Workers |
| `26-exp-a-curva-oscuro.png` | a) Curva B(k) en modo oscuro |
| `27-exp-c-sensibilidad-oscuro.png` | c) Sensibilidad en modo oscuro |
