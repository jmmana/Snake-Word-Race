# Snake Word Race — Carrera Educativa de Inglés

Juego educativo full-stack de aprendizaje del inglés en tablero serpenteante con modos individual, contra bot, speedrun y multijugador en tiempo real.

---

## 1. Banco de Contenido Educativo

- **Total de preguntas:** **1,620 preguntas verificadas** distribuidas equitativamente entre los 6 niveles del Marco Común Europeo de Referencia (CEFR):
  - **A1:** 270 preguntas (vocabulario cotidiano, colores, números, familia, gramática básica)
  - **A2:** 270 preguntas (rutinas, comparativos, pasado simple, transporte, compras)
  - **B1:** 270 preguntas (phrasal verbs, primer y segundo condicional, presente perfecto)
  - **B2:** 270 preguntas (colocaciones, phrasal verbs avanzados, voz pasiva, modales)
  - **C1:** 270 preguntas (sinónimos precisos, modismos avanzados, inversión formal)
  - **C2:** 270 preguntas (matices semánticos, expresiones literarias, registro culto)
- **Formatos de respuesta:** Selección múltiple (`multiple_choice`), Letras desordenadas (`letter_scramble`), Texto libre (`text_input`) y Completar espacios (`gap_fill`).
- **Retroalimentación educativa:** Cada pregunta cuenta con explicaciones detalladas tanto en inglés como en español para revisión post-ronda y al final de la partida.

---

## 2. Reglas Oficiales del Juego

1. **Recorrido:** Tablero de 30 casillas (inicio en 0, meta en 30).
2. **Puntuación por velocidad (ventana de 10 segundos):**
   - Acierto en `< 3,500 ms`: **+2 casillas**
   - Acierto entre `3,500 ms` y `< 10,000 ms`: **+1 casilla**
   - Fallo o tiempo agotado: **0 casillas**
3. **Casillas Especiales (activadas solo por aterrizaje exacto):**
   - **Boost (Casillas 6, 14, 22):** Si se aterriza tras acertar en `< 4,000 ms`, otorga un impulso extra de **+2 casillas**.
   - **Trampa (Casillas 9, 18, 25):** Activa una pregunta de rescate (6s). Acertar mantiene la posición; fallar penaliza con **-3 casillas**.
   - **Duelo (Casillas 12, 27):** Si ambos jugadores coinciden en una casilla de duelo no utilizada antes, se activa un duelo rápido (6s). El primero en acertar avanza **+2 casillas**.
   - **Meta (Casilla 30):** El primer jugador en llegar a 30 gana. En llegada simultánea, desempatan aciertos acumulados, tiempos acumulados o muerte súbita.
4. **Sin activaciones encadenadas:** Los movimientos otorgados por boosts, trampas o duelos nunca activan otra casilla especial.

---

## 3. Modalidades Implementadas

- **Práctica contra Bot:** Partidas individuales con IA simulada (Fácil: 70% acierto, ~6.5s; Medio: 85% acierto, ~4.5s; Difícil: 95% acierto, ~2.5s) y asistencia adaptativa opcional. Totalmente compatible sin conexión (Offline/PWA).
- **Multijugador Casual:** Partidas 1v1 en tiempo real con salas privadas mediante código alfanumérico copiable o cola rápida.
- **Multijugador Ranked:** Sistema competitivo emparejado por nivel CEFR con cálculo y persistencia del rating oficial Elo (factor K=32).
- **Speedrun Solo:** Desafío contrarreloj para completar las 30 casillas con 100% de precisión y registro de mejores marcas.

---

## 4. Ejecución y Pruebas

```bash
# Instalar dependencias
npm install

# Ejecutar servidor y cliente (Vite + WebSockets en puerto 3000)
npm run dev

# Ejecutar suite de 20 pruebas obligatorias del motor de reglas
npm run test

# Compilar para producción
npm run build
```

### Cómo probar una partida con dos jugadores en tiempo real:
1. Abre dos pestañas o ventanas distintas del navegador en `http://localhost:3000`.
2. En la Pestaña 1, elige "Multijugador Casual" y haz clic en "Crear Sala Multijugador". Copia el código de 6 caracteres generado (por ejemplo, `AB12CD`).
3. En la Pestaña 2, elige "Multijugador Casual", ingresa el código en la casilla y haz clic en "Unirse".
4. Ambos jugadores pulsan "Listo" en la sala de espera y la carrera comenzará sincronizada automáticamente.
