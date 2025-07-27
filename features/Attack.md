## FEATURE:

Please help me finish the implementation of this game, the requirements can be found in the file `PLANNING.md`.
The feature we need to implement is the attack functionality, it works as follows:
- When a player issues an attack from the client a message will be sent to the server indicating this action.
- Then the match instance will start a battle with the pieces in the room the player's piece is.
	- The match will create a timer that runs for 10 seconds (taking into account trip time from the server to client and back).
	- During this time the affected players can send what they will do.
- Even if not all players reply, call to the end battle method, as it automatically handles no response scenarios.
- Then send an update to the affected players with the result of the battle.
	

## DOCUMENTATION:

The current system architecture is designed to follow a layered architecture, where components in one layer can not alter the state of components of other layers directly, they must use the interface the component exposes. This ensures that integration can be done in parts, where each new layer enhances the functionality of an inferior layer. For example, the GameEngine can work alone if it's required, but the superior layer, the Match component, enhances the functionality through introducing player management and match flow (waiting for players in a queue, initialization, grace period, finishing it).

The current architecture is the following:

### Server
This is a conceptual representation of the system, several parts are yet to be implemented, please help me finish those parts using the requirements I provided.

- **Layer 1 - Communication with client**
This layer encompasses the communication with client using the websockets and also orquestrates the different components of the system (MatchManger, SessionManager).
To perform communication with the outside a Courier object it's used to send the incoming messages from the layer 2 through the socket.
- **Layer 2 - Match management**
The MatchManager class is responsible for this layer. Basically manages all active matches in the server, communicationg the client messages to the respective match. To send messages from deeper layers to above layers another Courier object it's used, it maps playerId to a function to deliver messages to the above layer.
- **Layer 3 - Match Handling**
This layers is composed of Match instances. Each match it's able to manage the state of a match, from waiting for players to match initialization, having a grace period of 60s where no one can attack, battling, and finishing a match. Each match contains a GameEngine instance where all the Game logic is performed. This one haves a Corier instance that maps playerIds to a delivery function.
- **Layer 4 - Game Engine**
This is the core Game Engine, it performs all game logic, uses a courier to deliver game messages to upper layers so that they can get to the client. This messages contain information that the client will use to update its interface, ask the user for input and more.

## OTHER CONSIDERATIONS:

- Every time you implement a new component or a new function test it in isolation from the above layers, so you can be sure that it works with the lower layer. I recommend using too console.log() to pinpoint where the problem is, along with the error thrown by the interpreter.
- Research the codebase to identify which functionality is already implemented.
- Document the code please.
