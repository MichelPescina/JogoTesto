const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const SessionManager = require('./server/SessionManager');
const Match = require('./server/Match');
const Courier = require('./server/Courier');

const app = express();
const server = createServer(app);
const io = new Server(server)

const sessionManager = new SessionManager();
const sessionToSocket = new Courier();
const match = new Match(sessionToSocket);

app.use(express.static('public'))

/*
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});
*/

io.on('connection', (socket) => {
    // Authentication and session persistance
    const auth = socket.handshake.auth;

    let session = null;
    if(!sessionManager.isValidSession(auth.sessionId, auth.creationDate)) {
        const id = sessionManager.createSession();
        const temp = sessionManager.getSession(id);
        session = {sessionId: temp.sessionId};
    }
    else {
        session = {sessionId: auth.sessionId};
    }
    
    // Sets the output for the courier
    sessionToSocket.setAddress(session.sessionId, (msg) => {
        socket.emit('test', msg);
        console.log('MATCH -> OUTSIDE');
    })
    // socket.on() define callbacks for different events

    socket.on('joinMatch', (msg) => {
        console.log('Miau');
        if (match.playersCanJoin()) {
            match.createPlayer(session.sessionId, msg);
        }
    });

    socket.on('testCall', (miau) => {
        console.log(match.state);
        //console.log('OVO');
        match.testCall();
        //console.log('AVA');
    });

    socket.emit('session', session);
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`)
    console.log(`Open http://localhost:${PORT}`)
})