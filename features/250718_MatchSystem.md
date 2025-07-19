## FEATURE:

Right now the game handles the basic functionality of a Multiplayer Text Based Game. We are aiming to create a Multiplayer Text Based RPG on the genre of Battle Royale.
The functionality you have to implement next is a matching system.
- Each match can have a maximum of 50 concurrent players.
- When joining a match you are asked for a name that you will use during the match.
- Each player must have a playerID for communication between players and a sessionID to handle reconnections seamlessly. Save them as cookies in the client side. Right now the socketID is used as the playerID which is not appropiate due to it changing on every reconnection.
- Each match will create its own world where the players will interact, this means that each match will create a instance of a RoomSystem.
- The match starts when at least 10 players have joined.
- The player should be able to forfeit at any moment, leaving the match.
- Improve the current server implementation so that it can handle different Room files.

## EXAMPLES:

Research if necessary.

## DOCUMENTATION:

Socket.io - https://socket.io/docs/v4/
Research more resources as you need them.

## OTHER CONSIDERATIONS:

Separate the functionality into modules if necessary to ensure easier integration in the future.
