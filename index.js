const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');

const SessionManager = require('./server/sessionManager');

const app = express();
const server = createServer(app);
const io = new Server(server)

const sessionManager = new SessionManager();

app.use(express.static('public'))

/*
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});
*/

io.on('connection', (socket) => {
    // Authentication and session persistance
    const auth = socket.handshake.auth;
    console.log('Server: ', socket.id);
    console.log('sessionId: ', socket.handshake.auth.sessionId);
    console.log('creationDate: ', socket.handshake.auth.creationDate);

    let session = null;
    if(!sessionManager.isValidSession(auth.sessionId, auth.creationDate)) {
        const id = sessionManager.createSession();
        const temp = sessionManager.getSession(id);
        session = {session: temp.sessionId, creationDate: temp.creationDate};
    }
    else {
        session = {sessionId: auth.sessionId, creationDate: auth.creationDate};
    }

    console.log(session);
    socket.emit('session', session);
    // socket.on() define callbacks for different events
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`)
    console.log(`Open http://localhost:${PORT}`)
})