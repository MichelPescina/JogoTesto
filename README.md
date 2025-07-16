# Jogotesto

Jogotesto es un pequeño experimento para aprender a utilizar la ingeniería de contexto aplicada al desarrollo de videojuegos apoyado con Agentes basados en Modelos de Lenguaje de Gran Tamaño, en este caso Claude Code.

El proyecto es un juego de rol multijugador con  interacciones a traves de texto en tiempo real construído con Node.js, Socket.io y Express. El desarrollo se hace a través de Prompts de Requerimientos de Producto (PRPs por sus siglas en inglés) los cuales contienen el qué y el cómo de la funcionalidad que se va a implementar.

Estos prompts se generan en base a un documento que describe la funcionalidad y se encuentran en la carpeta `features`, dentro de ellos se puede incluir una descripción de lo que se quiere implementar, historias de usuario, documentación pertinente, vínculos a servidores de RAG, ejemplos de proyectos similares y otras consideraciones como indicaciones de que hacer en aspectos dónde falla la IA. Para generarlo se ejecuta el comando que se encuentra en `.claude/commands/generate-prp.md`.

Posteriormente el PRP creado se guarda en la carpeta `PRPs` y se ejecuta con el comando `.claude/commands/execute-prp.md`.

## Instalación del juego

¿Quieres probar el juego? Sigue estos pasos.

1. Abre la terminal.
2. Clona el repositorio con `git clone https://github.com/MichelPescina/JogoTesto.git`.
3. Entra a la carpeta con `cd JogoTesto`
4. Instala las dependencias con `npm install`.
5. Ejecuta el servidor con `npm start`.
6. Abre tu navegador en `http://localhost:3000` (puede variar pero el programa te indica la URL)
7. Disfruta

Para realizar este proceso necesitarás tener node.js instalado.

## Referencias

- **[AI Engineering Resources for Claude Code](https://www.markdownguide.org/basic-syntax/)** por Wisram.
- **[Context Engineering Template](https://github.com/coleam00/context-engineering-intro)** por Cole Medin.
