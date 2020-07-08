const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const { getAllRooms, createRoom, addRoom, removeRoom, createUser, userJoin, getRoomUsers, getRoomByUserID, userLeave, getUserByID } = require('./utils/rooms');
const e = require('express');

const app = express();
app.use(bodyParser.urlencoded({ extended: true })); 


const server = http.createServer(app);
const io = socketio(server);

const botName = 'カホーちゃん';

// Run when a client connects
io.on('connection', socket => {

  socket.on('joinRoom', ({username, roomID}) => {

    const user = userJoin(roomID, socket.id, username);
    if (user) {
      socket.join(user.roomID);

      // Welcome current user
      socket.emit('message', formatMessage(botName, 'Welcome to ChatCord'));

      // Notify other users
      socket.broadcast.to(user.roomID).emit('message', formatMessage(botName, `${user.username} has joined the chat`));
    
      io.to(user.roomID).emit('roomUsers', {
        room: user.roomID,
        users: getRoomUsers(user.roomID)
      });
    }
  })
  

  // Listen for chat message
  socket.on('chatMessage', (e) => {
    const user = getUserByID(socket.id);
    io.to(user.roomID).emit('message', formatMessage(user.username, e));
  });

  
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.roomID).emit('message', formatMessage(botName, `${user.username} has left the chat`));
      io.to(user.roomID).emit('roomUsers', {
        room: user.roomID,
        users: getRoomUsers(user.roomID)
      });
    }
  });
  
});

const PORT = 4000 || process.env.PORT;

// Setup static folder
app.use(express.static(path.join(__dirname, 'public')));

app.post('/joinRoom', function (req, res) {
  const username = req.body['username-join'];
  const room = getAllRooms().find(room => room.roomID === req.body['roomid']);
  if (room === -1) {
    res.set('ERR');
  } else {
    let resString = 'username=' + username + '&roomID=' + room.roomID;
    res.send(resString);
  }
})

app.post('/createRoom', function (req, res) {
  const username = req.body['username-create'];
  const room = createRoom(username);
  addRoom(room);
  let resString = 'username=' + username + '&roomID=' + room.roomID;
  res.send(resString);
})

server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 