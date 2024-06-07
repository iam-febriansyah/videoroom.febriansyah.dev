const WebSocket = require('ws');
const url = require('url');
const server = new WebSocket.Server({ port: 8080 });

const rooms = {}; // Store clients per room

server.on('connection', (socket, req) => {
    const parameters = url.parse(req.url, true);
    const roomId = parameters.query.roomId;

    if (!rooms[roomId]) {
        rooms[roomId] = [];
    }
    rooms[roomId].push(socket);

    socket.on('message', message => {
        // Broadcast the message to all clients in the room except the sender
        rooms[roomId].forEach(client => {
            if (client !== socket && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    socket.on('close', () => {
        // Remove the client from the room
        rooms[roomId] = rooms[roomId].filter(client => client !== socket);
        if (rooms[roomId].length === 0) {
            delete rooms[roomId];
        }
    });
});

console.log('Signaling server is running on ws://localhost:8080');
