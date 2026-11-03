# Sobreturnos

Simulación de un policonsultorio para decidir **cuántos sobreturnos** dar y **dónde ubicarlos**
en la agenda, minimizando el costo esperado de espera de pacientes, ocio médico, horas extra y
pacientes perdidos. Proyecto integrador de Simulación (UTN FRSR, 2026).

- Motor de eventos discretos propio en TypeScript, validado contra la teoría de colas (Erlang C y
  Ley de Little).
- Generador xoshiro128** con semilla y flujos independientes por fuente de aleatoriedad
  (números aleatorios comunes para comparar escenarios).
- Todo corre en el navegador (Web Workers), sin backend. Datos ficticios documentados.

> Estado: paso 1 de 6 (base y motor validado). El modelo del consultorio y la interfaz están en
> desarrollo.

## Uso

```bash
npm install
npm run dev        # página de diagnóstico en http://localhost:5173
npm test           # suite completa
npm run validar    # tabla de validación M/M/c por consola
```

Modelo conceptual: [`docs/modelo-conceptual.md`](docs/modelo-conceptual.md).

## Autor

Tomás Romero — UTN Facultad Regional San Rafael.
