const { Match, MatchManager } = require('./matchManager');

let match = new Match();
//console.log(match);

// Check if adding a player in the reference adds the player inside the MatchManager Set structure
let matchMan = new MatchManager();
id = matchMan.createMatch();
let match2 = matchMan.getMatch(id);
match2.addPlayer('player1');
match2.addPlayer('player2');
match2.addPlayer('player3');
match2.addPlayer('player4');
match2.addPlayer('player5');
match2.addPlayer('player6');
console.log(matchMan.matches);
console.log(match2);


