## FEATURE:

Right now the game handles the basic functionality of a Multiplayer Text Based Game. We are aiming to create a Multiplayer Text Based RPG on the genre of Battle Royale.
The functionality you have to implement next is a matching system.
- Each match can have a maximum of 50 concurrent players.
- Once 10 players have joined a match a 60 seconds countdown will start and once it finishes, the game will start.
- When joining a match you are asked for a name that you will use during the match.
- When a player is joining a match the system will search an available match, if none is found a new match will be created.
- When joining a match the system will generate a playerID and a matchID to keep track of players in matches.
- The client will receive the playerID and matchID and will save it on the client cookies to handle reconnections, right now the socketID change on every reconnection.
- If trying to reconnect you don't find the match or the user is not in the match, reset the playerID and sessionID on the client side and return to loby.
- Each match will have its own game world, this means that a RoomSystem needs to be loaded for each match.

## EXAMPLES:

Research if necessary.

## DOCUMENTATION:

Socket.io - https://socket.io/docs/v4/
Research more resources as you need them, specially best practices.

## OTHER CONSIDERATIONS:

Explain the reason behind your design choices inside comments in the code.
You MUST Separate the functionality into modules ensure easy integration in the feature.
You MUST refactor the a file into submodules if its longer than 500 lines.
