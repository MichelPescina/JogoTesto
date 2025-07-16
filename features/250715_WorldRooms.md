## FEATURE:

Design and implement a system where the player can travel across different rooms inside the game world nad interact with it.
- Each room has a description of what is in it
- Each room has available commands that the user can type to do specific actions.
- Each room has an unique id.
- Each room can be connected to other rooms.
- Save the room's information inside a JSON file for ease of creation and updating.
- If a another player is inside the same room, they can send messages with the /chat command (if no one is there besides the player the command works but the servers sends a message indicating that no one is there).
- Send this game messages to the player using the identity of "Game Master"

User stories:
- As a player if I read from the Game Master that there is a road up north the path I can type /go north to go there.
- As a player if I read from the Game Master that there is another player here I can type /chat to talk to them.
- As a player if I read from the Game Master that there is a cave I can type /go cave to go inside.

## EXAMPLES:

Look over the internet for appropiate examples and add them to INTRO.md if necessary.

## DOCUMENTATION:

None

## OTHER CONSIDERATIONS:

Do not hardcode the rooms into the code, all should be saved inside JSON files to guarantee the ease of creation of new rooms.
For testing create a set of rooms where you can travel to adjacent rooms, the description of each individual room must make clear the possible new locations to go.
