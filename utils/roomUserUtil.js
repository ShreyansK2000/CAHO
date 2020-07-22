let gameExport = require('./game');
let Game = gameExport.Game;

rooms = [];
users = [];

/**
 * Get randomized roomID, unique due to JS seed properties
 */
var roomID = function () {
  return '' + Math.random().toString(36).substr(2, 8);
};

/**
 * Create and push a new room object
 * @param {string} creatingUser 
 * @returns a room object
 */
function createRoom(creatingUser) {
  const room = {
    roomID: roomID(),
    creatingUser: creatingUser,
    roomUsers: []
  };

  addRoom(room);
  return room;
}

/**
 * Alias array push method for readability
 * @param {Object} room 
 */
function addRoom(room) {
  rooms.push(room)
}

/**
 * Try to remove a room from the current array of rooms
 * with a given room ID, occurs when room is empty
 * @param {string} roomID 
 */
function removeRoom(roomID) {
  const index = rooms.findIndex(room => room.roomID === roomID);

  if (index !== -1) {
    return rooms.splice(index, 1)[0];
  }
}

/**
 * Create and return a user object
 * @param {string} id 
 * @param {string} username 
 * @param {string} roomID 
 */
function createUser (id, username, roomID) {
  return {
    id,
    username,
    roomID,
    score: 0
  }
}

function getAllUsers() {
  return users;
}

function getUserByUsername(username) {
  return users.find(user => user.username === username);
}

function getUserByID(id) {
  return users.find(user => user.id == id);
}

function getAllRooms() {
  return rooms;
}

function getRoomByID(roomID) {
  return rooms.find(room => room.roomID === roomID);
}

function getRoomUsers(roomID) {
  const res = rooms.find(room => room.roomID === roomID);
  if (res) {
    return res.roomUsers;
  } else {
    return 'NO ROOM';
  }
}

function userJoin (roomID, id, username) {
  const room = rooms.find(room => room.roomID === roomID);

  if (room !== undefined) {
    const user = createUser(id, username, roomID);
    room.roomUsers.push(user);
    users.push(user);
    return user;
  } else {
    return undefined;
  }
}

function userLeave (id) {
  const index = users.findIndex(user => user.id === id);

  if (index !== -1) {
    const userRoom = rooms.find(room => room.roomID === users[index].roomID);
    const roomsIndex = userRoom.roomUsers.findIndex(user => user.id === id);
      if (roomsIndex != -1) {
        userRoom.roomUsers.splice(roomsIndex, 1);
        if (userRoom.roomUsers.length === 0) {
          rooms.splice(rooms.indexOf(userRoom), 1);
        }
      }

    return users.splice(index, 1)[0];
  }
}

module.exports = {
  createRoom,
  addRoom,
  removeRoom,
  getAllUsers,
  getUserByID,
  getUserByUsername,
  getAllRooms,
  getRoomByID,
  getRoomUsers,
  userJoin,
  userLeave
}