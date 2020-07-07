const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const { getAllRooms, createRoom, addRoom, removeRoom, createUser, userJoin } = require('./utils/rooms');

const app = express();
app.use(bodyParser.urlencoded({ extended: true })); 


const server = http.createServer(app);
const io = socketio(server);

const botName = 'カホーちゃん';

// Run when a client connects
io.on('connection', socket => {

  socket.on('joinRoom', ({username, room}) => {

    const user = userJoin(socket.id, username, room);
    socket.join(user.room);

    // Welcome current user
    socket.emit('message', formatMessage(botName, 'Welcome to ChatCord'));

    // Notify other users
    socket.broadcast.to(user.room).emit('message', formatMessage(botName, `${user.username} has joined the chat`));
  
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  })
  

  // Listen for chat message
  socket.on('chatMessage', (e) => {
    const user = getUserByID(socket.id);
    io.to(user.room).emit('message', formatMessage(user.username, e));
  });

  
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit('message', formatMessage(botName, `${user.username} has left the chat`));
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
  
});

const PORT = 4000 || process.env.PORT;

// Setup static folder
app.use(express.static(path.join(__dirname, 'public')));

app.post('/createRoom', function (req, res) {
  const room = createRoom();
  addRoom(room);
  let resString = 'username-send=' + req.body['username-create'] + '&roomID=' + room.roomID;
  res.send(resString);
})

server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 