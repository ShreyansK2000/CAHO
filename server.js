/* Required npm modules */
const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const socketio = require('socket.io');

/* User created modules */
const formatMessage = require('./utils/messages');
const roomUserUtil = require('./utils/roomUserUtil');
const gameExport = require('./utils/game')
let Game = gameExport.Game;
const gamesInSession = gameExport.gamesInSession;

const app = express();
app.use(bodyParser.urlencoded({ extended: true })); 


const server = http.createServer(app);
const io = socketio(server);

const botName = 'カホーちゃん';

// Run when a client connects
io.on('connection', socket => {

  socket.on('joinRoom', ({username, roomID}) => {

    const user = roomUserUtil.userJoin(roomID, socket.id, username);
    if (user) {
      socket.join(user.roomID);

      // Welcome current user
      socket.emit('message', formatMessage(botName, 
        `Welcome to Cards Against Humanity Online. This room is hosted by ${roomUserUtil.getRoomByID(user.roomID).creatingUser}.`));

      // Notify other users
      socket.broadcast.to(user.roomID).emit('message', formatMessage(botName, `${user.username} has joined the chat`));
    
      io.to(user.roomID).emit('roomUsers', {
        roomID: user.roomID,
        users: roomUserUtil.getRoomUsers(user.roomID)
      });
    }
  })
  

  // Listen for chat message
  socket.on('chatMessage', (e) => {
    const user = roomUserUtil.getUserByID(socket.id);
    io.to(user.roomID).emit('message', formatMessage(user.username, e));
  });

  // User connection breaks or close window/tab
  socket.on('disconnect', () => {
    const user = roomUserUtil.userLeave(socket.id);
    if (user) {
      io.to(user.roomID).emit('message', formatMessage(botName, `${user.username} has left the room`));
      io.to(user.roomID).emit('roomUsers', {
        room: user.roomID,
        users: roomUserUtil.getRoomUsers(user.roomID)
      });
    }
  });
  
});

const PORT = 4000 || process.env.PORT;

// Setup static folder
app.use(express.static(path.join(__dirname, 'public')));

app.post('/joinRoom', function (req, res) {
  const username = req.body['username-join'];
  const room = roomUserUtil.getRoomByID(req.body['roomid']);
  if (room === undefined) {
    res.set('ERR');
  } else {
    let resString = 'username=' + username + '&roomID=' + room.roomID;
    res.send(resString);
  }
})

app.post('/createRoom', function (req, res) {
  const username = req.body['username-create'];
  const room = roomUserUtil.createRoom(username);

  let resString = 'username=' + username + '&roomID=' + room.roomID;
  res.send(resString);
})

app.post('/startGame', function (req, res) {
  const username = req.body['username'];
  const user = roomUserUtil.getUserByUsername(username);
  let resString;
  if (user !== undefined) {
    const userRoom = roomUserUtil.getRoomByID(user.roomID);
    if (userRoom.creatingUser !== username) {
      resString = 'INVALID USER';
    } else {
      resString = 'OK'
      console.log(userRoom);
      const newGame = new Game(userRoom, io);
      gamesInSession.push(newGame);
      newGame.addServerRef();
      // TODO game start logic
      // const game = new Game(userRoom);

      /* Some random assign by reference testing */
      // console.log('Creating User: ' + game.room.creatingUser);
      // userRoom.creatingUser = 'asdhasd';
      // console.log('Creating User: ' + game.room.creatingUser);
    }
  }
  else {
    resString = 'ERR';
  }
  
  res.send(resString);
})


server.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 