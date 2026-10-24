# AqueLingua Adventure — interfaz de Snake Word Race

## Dirección visual

Menú blanco, fondo lavanda y marfil, texto azul profundo, controles violeta y pequeñas señales menta, rosa y oro. El menú admite modo oscuro y conserva la elección localmente; el tablero mantiene su paleta clara para asegurar legibilidad. El paisaje y el mentor retoman la referencia del login.

## Pantallas y componentes

- Inicio: presentación ilustrada, seis niveles, cuatro tarjetas de modalidad de igual tamaño y configuración del jugador.
- Sala: código compartible, participantes y estado listo.
- Partida: HUD horizontal, tablero amplio de seis columnas por cinco filas y panel lateral de preguntas. En móvil el reto aparece antes del tablero.
- Tablero: casillas uniformes, ruta serpenteante, avatares de Warlock y Polyglot y movimiento animado. Las escaleras representan impulsos +2; las serpientes representan el retroceso al fallar un rescate. No se añaden dados ni reglas nuevas.
- Preguntas: selección, texto, completar y letras desordenadas. El DTO público entrega las letras de la respuesta sin su orden; ya no se usa el banco ficticio ABCDEFGH. Las respuestas de varias palabras conservan sus espacios.
- Retroalimentación: tarjeta junto al tablero, sin ocultar la partida con una pantalla superpuesta.
- Resultados, ayuda, estadísticas y récords: mismos colores, bordes y controles.

## Arte incluido

`public/art/adventure-valley.webp`, `warlock.webp` y `polyglot.webp` son ilustraciones generadas para esta propuesta y optimizadas para web. Las casillas, ruta, serpientes, escaleras e iconos se dibujan con CSS y SVG, de modo que mantienen precisión y escala. Las imágenes son decorativas; la información de juego se expresa también en texto.

## Movimiento y accesibilidad

Las fichas animan sus cambios de posición; se conserva la retroalimentación del juego. Se respeta la preferencia de movimiento reducido, incluido el confeti final. Las ventanas gestionan foco, Tab y Escape y devuelven el foco al control de apertura. Los controles incluyen nombres accesibles, zoom habilitado y estados mediante texto además de color.

## Compatibilidad y caché

El service worker usa una nueva versión de caché y prioriza red para navegación, evitando conservar el antiguo diseño tras actualizar. El modo offline requiere una primera carga con conexión; las partidas multijugador siguen necesitando servidor. El banco educativo existente no se modifica.

## Validación

Pruebas del motor, comprobación TypeScript, compilación de producción y Playwright para escritorio, móvil, respuesta con avance y sala de dos jugadores. El aviso de tamaño del bundle sigue relacionado con el banco educativo incluido en el cliente; no impide compilar.

## Ajuste de espacio de la partida

El marcador de ambos jugadores se muestra sobre el reto en el panel derecho, con posición destacada, barras y aciertos. El tablero adapta su altura a la ventana de escritorio sin ocultar casillas; la ruta SVG se ajusta a la misma geometría que las fichas. En pantallas bajas, un reto largo puede desplazarse dentro del panel derecho sin mover todo el tablero. En móvil se mantiene el desplazamiento natural y el marcador aparece antes del reto.

Las pruebas verifican que la página de partida no requiere desplazamiento vertical en 1440×900, 1366×768, 1920×1080 y 1024×768.
