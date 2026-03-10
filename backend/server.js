const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.set('io', io);

app.use(cors());
app.use(express.json());
app.use(fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pulls', require('./routes/pulls'));
app.use('/api/users', require('./routes/users'));

// Socket.io for live draw
io.on('connection', (socket) => {
  socket.on('join_pull', (pullId) => {
    socket.join(`pull_${pullId}`);
  });
  socket.on('leave_pull', (pullId) => {
    socket.leave(`pull_${pullId}`);
  });
  // Admin starts live draw
  socket.on('start_draw', (pullId) => {
    io.to(`pull_${pullId}`).emit('draw_started', { pullId });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
