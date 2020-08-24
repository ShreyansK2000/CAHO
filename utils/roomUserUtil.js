/*
 * Global arrays to keep trac of all users and rooms 
 */
rooms = [];
users = [];
usersToRemove = [];

/**
 * Get randomized roomID string
 */
var roomID = function () {
  return '' + Math.random().toString(36).substr(2, 8);
};

var userCacheID = function () {
  return '' + Math.random().toString(36).substr(5, 15);
}

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
function createUser(id, username, roomID) {
  return {
    id,
    username,
    roomID,
    cardIndices: [],
    score: 0,
    userCacheID: userCacheID(),
    online: true
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

function checkCacheID(id, username, roomID, userCacheID) {
  if (!username) {
    return undefined;
  }

  if (!roomID) {
    return undefined;
  }
  
  if (!userCacheID) {
    return undefined;
  }
 

  const userIdx = usersToRemove.findIndex(userToRemove => userToRemove.user.userCacheID === userCacheID);

  if (userIdx !== -1) {
    let user = usersToRemove[userIdx].user;

    // Same user joined a different room from same tab, or different username with same cache information (somehow)
    if (user.roomID !== roomID || user.username !== username) {
      return undefined;
    }

    user.id = id;
    user.online = true;
    usersToRemove.splice(userIdx, 1);

    const room = rooms.find(room => room.roomID === user.roomID);

    if (room !== undefined) {
      room.roomUsers.push(user);
      users.push(user);
      return user;
    }
  }

  console.log(usersToRemove);
  return undefined;
}

function userJoin(id, username, roomID) {
  const room = rooms.find(room => room.roomID === roomID);
  console.log(room);
  if (room !== undefined) {
    const user = createUser(id, username, roomID);
    room.roomUsers.push(user);
    users.push(user);
    return user;
  } else {
    return undefined;
  }
}

function userLeave(id) {
  const index = users.findIndex(user => user.id === id);

  if (index !== -1) {
    const userRoom = rooms.find(room => room.roomID === users[index].roomID);
    const roomsIndex = userRoom.roomUsers.findIndex(user => user.id === id);
    if (roomsIndex != -1) {
      console.log('pre- userRoomlist', userRoom.roomUsers);

      userRoom.roomUsers.splice(roomsIndex, 1);
      console.log('post- userRoomlist', userRoom.roomUsers);
      if (userRoom.roomUsers.length === 0) {
        rooms.splice(rooms.indexOf(userRoom), 1);
      }
    }

    user = users[index];
    user.online = false;
    usersToRemove.push({
      user: user,
      leaveTime: Date.now()
    });

    // console.log(usersToRemove);
    return users.splice(index, 1)[0];
  } else {
    console.log('No user to remove');
  }
}

function startUserCleanInterval() {
  setInterval(function() {
    var time = Date.now();
    usersToRemove = usersToRemove.filter(function(item) {
       return time < item.leaveTime + (2 * 1000 * 60);
    }); 
  }, 5000);
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
  checkCacheID,
  userJoin,
  userLeave,
  startUserCleanInterval
}