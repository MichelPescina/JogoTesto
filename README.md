# Jogotesto

Jogotesto es un pequeño experimento para aprender a utilizar la ingeniería de contexto aplicada al desarrollo de videojuegos apoyado con Agentes basados en Modelos de Lenguaje de Gran Tamaño, en este caso Claude Code.

## Descripción del juego

El objetivo del proyecto es crear un videojuego Battle Royale TRPG (Text RolePlay Game) multijugador, muy sencillo, utilizando Node.js, Socket.io y Express.js.

La funcionalidad que se busca implementar es la siguiente:

- Usabilidad
	- Utilizar teclas  para introducir los comandos en vez de comandos de texto.
	- Interfaz de texto.
- Mapa
	- Generación procedural del mapa.
	- El mapa tiene final y es radial (desde el centro al perímetro hay el mismo número de habitaciones en promedio).
	- Generación por I.A. de descripciones de las habitaciones y nombres de armas.
		- Debe tener cohesión temática entre habitaciones y entre armas.
	- En cada habitación hay cierta probabilidad de que se genere un arma.
- Armas
	- Las armas se generan con un ataque que sigue una distribución probabilística que favorece armas debiles.
	- Buscar un arma provoca un cooldown al jugador en el cual queda vulnerable a otros jugadores (si te atacan te matan).
	- Al encontrar un arma automáticamente descartas la que tienes actualmente.
- Batallas
	- Cuando te atacan tienes la opción de atacar o escapar.
	- Si atacas gana el duelo quién tenga mayor ataque.
	- Si escapas, la acción tiene cierta probabilidad de fallar y mueres.
- Chat
	- Chat de habitación, no global.
	- Al morir un jugador se muestra quien lo mató y con qué arma.

El desarrollo se hace a través de Prompts de Requerimientos de Producto (PRPs por sus siglas en inglés) los cuales contienen el qué y el cómo de la funcionalidad que se va a implementar.

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

## Experimentos

En esta sección se detallan los diferentes experimentos que realice para encontrar una metodología para desarrollar con Agentes de IA en un proyecto greenfield (que inicia desde cero). Cada rama (branch) corresponde a un experimento, cambia entre llas con git para probar diferentes experimentos.

**TODO**
Para mejorar los experimentos proponer hipótesis de las causas de las observaciones que tuve y hacer experimentos para evaluar si es verdad.

### Experimento 1: desarrollo por Agente de inicio a fin.

En esta sección se detalla el primer experimento donde intenté desarrollar de inicio a fin con el Agente solamente introduciendo peticiones de funcionalidad (features).

**Parámetros**

- Desarrollo por Claude Code de inicio a fin, solo describiendo funcionalidades (features) a implementar.
- Añadir funcionalidades por partes.
- Nivel de detalle de los requerimientos (el qué) dentro de las features: medio.
- Nivel de detalle técnico (el cómo) dentro de las features: bajo.
- Nivel de detalle al planear el sistema: bajo (idea general de lo que hace el sistema y cosas que se tiene que hacer, alrededor de 4 horas).

**Observaciones**
- Conforme crece el proyecto el Agente requiere de más tokens y se pierde más facilmente, no puede tomar en cuenta todo el proyecto.
- Se vuelve difícil para el programador (yo) seguir el ritmo del Agente por la cantidad inmensa de código que genera.
- Una parte sustancial del código que genera tiene el objetivo de asegurar una interfaz limpia y un sistema robusto, que es algo bueno, pero a la hora de estar desarrollando un proyecto desde cero comienza a estorbar y hace más difícil entender el código ya que en esta fase hay muchos cambios y mucho prototipado.
- Tiende a reimplementar funcionalidad.
- Los tests, la validación y la correción son esenciales para que el Agente dé buenos resultados, ya que a través de este proceso iterativo es cómo limpia y mejora el código.
- Los testeos manuales son imposibles para el agente simplemente porque no tiene esa función implementada.
- Como programador se pierden oportunidades para desarrollar las habilidades de investigación, planeación y diseño del sistema a bajo nivel, resolución de problemas, entre otras.
- Curiosamente este tipo de desarrollo te obliga a desarrollar la habilidad de planeación y diseño de sistemas a alto nivel ya que SI tienes que pensar sobre como se va a implementar para describir una feature de manera apropiada.
- El agente logra programar una UI bonita y funcional pero tiende a equivocarse en como debe ser el flujo de pantallas.

**Resultados**

- El agente logró desarrollar la aplicación hasta el punto de implemntar un chat de salas y un sistema de matchmaking que parece funcionar pero no inicia las partidas. Decidí no seguir porque solo se acumularía error sobre error.
- No le pude seguir el ritmo, esto causó que no entendiera el sistema que construyó y debido a ello yo no puedo corregir los errores que haya tenido a menos de que lo estudie a profundidad.

**Posibles mejoras**

Mi forma de programar involucra dividir un problema en pedacitos, usualmente primero estudio el problema en mi libreta, si es necesario investigo en internet por problemas y soluciones similares, creo una posible solución y despues programo dicha solución por pedacitos, iniciando desde un prototipo simple y poco a poco voy introduciendo complejidad mientras hago pruebas hasta tener la solución hecha. Aparte de esto también suelo dividir el problema en módulos y luego integrar todas las partes.

Conociendo mi forma de trabajar algunas posibles mejoras son:
- Desarrollo por módulos o componentes, el Agente desarrolla un módulo y luego yo lo integro al sistema en general.
	- Será necesario tener bien definido la comunicación entre componentes.
- Para aminorar el problema de la gran cantidad de código, aparte del desarrollo modular, puede ser útil crear un comando que me explique partes del código, busque en que lugares se utiliza y cuál es su función y razón de existir en relación a todo el sistema.
- Antes de añadir más cosas al sistema lo tengo que estudiar, entender primero y verificar que no tiene bugs.
- Planear y diseñar el sistema a mucho mayor nivel de detalle desde antes, para saber dónde va a ir cada componente, como va a interactuar y comunicar con el resto del sistema, así como que escenarios se tienen que probar.
- La ingeniería de software es clave.

## Referencias

- **[AI Engineering Resources for Claude Code](https://www.markdownguide.org/basic-syntax/)** por Wisram.
- **[Context Engineering Template](https://github.com/coleam00/context-engineering-intro)** por Cole Medin.
- **[The New Skill in AI is Not Prompting, It's Context Engineering](https://www.philschmid.de/context-engineering)** por Philipp Schmid