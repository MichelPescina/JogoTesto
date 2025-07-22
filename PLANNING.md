# JogoTesto
This projects goal is to create a very simple videogame through AI-Driven development to use with friends and family and won't be used outside of that. The game will be a online text-based RPG battle royale that uses Node.js, Socket.io and Express.js.

Please help me develop a PRD for this project.

## Requirements
This is a greenfield project so there is the necessity to plan for the architecture of the application, communication between modules, communication between the server and client and more.

The requirements are the following:
- **Base game mechanics**
	- Game World
		- The game world is composed of several interconnected rooms.
		- In each room there can be up to four exits, each corresponding to a cardinal direction (north, south, east, west).
		- Each room has a description that tells the player the looks of the location:
			- e.g. A riveting river traverses the green sun washed field, up the stream, to the north, a village lies in the horizon, to the east a thick forest closes the path.
		- Inside a room there is a chance for a weapon to appear randomly.
			- This must be signaled in the description of the room with something like: "Looks like there is something hidden here."
		- The world map (this means the set of rooms) should be saved in a human readable and editable format like JSON.
	- Weapons
		- Weapons have only one statistic and that is the damage they deal.
		- It's more common to find weak weapons than stronger ones.
		- If a player looks for a weapon in a room they can't do anything for 2 seconds.
			- If another player attacks you while you are looking you can't defend yourself and thus you die.
		- If you find a weapon in the room you must keep it, you can't decide whether you keep it or not.
	- Battles
		- Battles are very simple, if you enter into a room and there is another player you get a prompt asking if you want to attack it, if you say yes then a prompt opens to the other player asking if they want to attack or escape.
			- If they decide to attack then the one who has the greater attack stats wins and the other dies.
			- Else, if they want to escape, there is a chance to succed with this.
				- If you succed you run away to one of the exits randomly.
				- Else, if the action fails, you get killed inmediately even if you have a strong weapon.
		- Each won battle gives makes you stronger.
			- This means that each player has an attack stat that augments with each battle won.
			- To compute the dealt damage one must sum the strength of the player plus the attack stat of the weapon.
- **Usability**
	- The interface should be text-based. As events happen during the game this should be shown to the player through text.
	- The interface looks like a console terminal.
	- Each action the player has to do must be entered through the keyboard.
		- E.g. press the "w" key to go north, "a" to go west, "d" to go east, "s" to go south.
		- The attack/escape decision for example could be shown as a little menu where the player pressing "a" or "d" selects the action.
- **Match system**
	- As this is a personal project for personal use with friends and family is not expected to have a great number of players, at most 20.
	- Make the system very simple, only handle one match at a time, you have to wait until the match ends to start a new one.
	- The match should be wait for the minimum amount of players to start, e.g. 20.
	- Once a match start no other player can join.
		- If a player wants to join the match after it has started the game must shown them a message saying: "The match already started, please wait until the match finishes".
	- To join a match you must introduce your player name.
