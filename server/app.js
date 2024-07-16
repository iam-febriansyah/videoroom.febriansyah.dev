const socketIo = require('socket.io');
const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { origins: '*:*'});
const PORT = process.env.PORT || 8080;

const corsOptions = {
    origin: 'http://webrtc.local', // Specify your client origin
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
};
app.use(cors(corsOptions));

io.on('connection', (socket, req) => {
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('offer', (data) => {
        socket.to(data.roomId).emit('offer', data.offer);
    });

    socket.on('answer', (data) => {
        socket.to(data.roomId).emit('answer', data.answer);
    });

    socket.on('candidate', (data) => {
        socket.to(data.roomId).emit('candidate', data.candidate);
    });

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

