## FEATURE:

Please help me resolve the following bug, right now when a match starts the room description for the initial room is not shown in the client, you have to move to another room to start seeing the correct behaviour, which is seeing the room description once you enter a room. Exploring the code I noticed that at `public/js/client.js` there was a function that wasn't implemented named `requestRoomUpdate`.

## OTHER CONSIDERATIONS:

Perform tests to see that nothing has regressed.
