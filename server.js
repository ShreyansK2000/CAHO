/* Required npm modules */
const path = require('path');
const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const socketio = require('socket.io');

/* User created modules */
const formatMessage = require('./utils/messages');
const roomUserUtil = require('./utils/roomUserUtil');
const { gamesInSession, Game, gameState } = require('./utils/game');
const e = require('express');

/* initialization */
const app = express();
app.use(bodyParser.urlencoded({ extended: true })); 

const server = http.createServer(app);
const io = socketio(server);

const botName = 'カホーちゃん';

roomUserUtil.startUserCleanInterval();

// Run when a client connects
io.on('connection', socket => {

  // TODO add refresh page maintain connection functionality
  // TODO error checking when a user leaves, especially current czar case
  socket.on('joinRoom', ({username, roomID, userCacheID}, callback) => {

    let user = roomUserUtil.checkCacheID(socket.id, username, roomID, userCacheID);
    let welcomeMsg, broadcastMsg, isCachedUser;

    if (!user) {
      console.log(user);
      user = roomUserUtil.userJoin(socket.id, username, roomID);
      console.log(user);
      welcomeMsg = `Welcome to Cards Against Humanity Online. This room is hosted by ${roomUserUtil.getRoomByID(user.roomID).creatingUser}.`;
      broadcastMsg = `${user.username} has joined the chat.`;
      isCachedUser = false;
    } else {
      welcomeMsg = `Welcome back ${user.username}!`;
      broadcastMsg = `${user.username} has rejoined the room.`;
      isCachedUser = true;
    }

    if (user) {
      console.log(user.userCacheID);
      socket.join(user.roomID);
      // user.socket = socket;

      // Welcome current user
      socket.emit('message', formatMessage(botName, welcomeMsg));

      // Notify other users
      socket.broadcast.to(user.roomID).emit('message', formatMessage(botName, broadcastMsg));
    
      // Update user list on clients' pages
      io.to(user.roomID).emit('roomUsers', {
        roomID: user.roomID,
        users: roomUserUtil.getRoomUsers(user.roomID)
      });

      let gameIdx = gamesInSession.findIndex(game => game.room.roomID === roomID);
      if (gameIdx !== -1) {
        if (isCachedUser) {
          let gameSession = gamesInSession[gameIdx];
          gameSession.restoreUser(user.id);
          if(gameSession.currentCzar === user.username) {
            gameSession.stopCzarTimer();
          } 
        }
      }
      callback(user.userCacheID);
    }
  })
  
  socket.on('submissionResponses', async (data, callback) => {
    gameSession = gamesInSession.find(game => game.room.roomID === data.roomID);
    if (!gameSession || gameSession.gameState.currentState != gameState.AWAIT_RESPONSES) {
      callback(false);
    } else {
      callback(data.payload);
      await gameSession.gatherResponses(socket.id, data.payload, data.removeCardIndices);
      // gameSession.dealWhiteCards();
    }
  });

  // TODO add callbacks and error checking
  socket.on('roundWinner', data => {
    gameSession = gamesInSession.find(game => game.room.roomID === data.roomID);
    // if (!gameSession || gameSession.gameState.currentState != gameState.AWAIT_RESPONSES) {
    //   callback(false);
    // } else {
    //   callback(data.payload);
    //   await gameSession.gatherResponses(socket.id, data.payload);
    //   // gameSession.dealWhiteCards();
    // }

    console.log(data.user);
    console.log(data.userAns);

    gameSession.incrementScore(data);
  })

  // Listen for chat message
  // TODO add error checking for user presence
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

    // TODO if user leaves, event in game to check if still need to wait on responses
    let gameIdx = gamesInSession.findIndex(game => game.room.roomID === user.roomID);
    if (gameIdx !== -1) {
      let roomGame = gamesInSession[gameIdx];
      roomGame.currentCzar === user.username ? roomGame.startCzarTimer() : roomGame.checkEventTrigger(false);
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
    res.set('ERR_NO_ROOM');
  } else if (room.roomUsers.find(user => user.username === username)) {
    res.send('ERR_DUPLICATE_USER');
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
      resString = 'ERR_INVALID_USER';
    } else {
      if (userRoom.roomUsers.length > 1) {
        let sessionIdx = gamesInSession.findIndex(game => game.room.roomID === userRoom.roomID);
        if (sessionIdx = -1) {
          resString = 'RES_OK'
          console.log(userRoom);
          const newGame = new Game(userRoom, io);
          gamesInSession.push(newGame);
          newGame.gameStart();
        } else {
          retString = 'ERR_DUP_START_REQ'
        }
      } else {
        resString = 'ERR_ONLY_PLAYER'
        console.log('not sending cards');
      }
    }
  }
  else {
    resString = 'ERR_UNDEFINED_USER';
  }
  
  res.send(resString);
})


server.listen(process.env.PORT || 4000); 