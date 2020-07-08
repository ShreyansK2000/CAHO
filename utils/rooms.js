rooms = [];
users = [];

/**
 * Get randomized roomID, unique due to JS seed properties
 */
var roomID = function () {
  return '' + Math.random().toString(36).substr(2, 8);
};

function getAllRooms() {
  return rooms;
}

function getAllUsers() {
  return users;
}

function createRoom(creatingUser) {
  return {
    roomID: roomID(),
    creatingUser: creatingUser,
    roomUsers: []
  }
}

function addRoom(room) {
  rooms.push(room);
}

function removeRoom(roomID) {
  const index = rooms.findIndex(room => room.roomID === roomID);

  if (index !== -1) {
    return rooms.splice(index, 1)[0];
  }
}

function createUser (id, username, roomID) {
  return {
    id,
    username,
    roomID
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

// function getRoomByUserID(userID) {
//   const index = rooms.findIndex(room => {
//     room.roomUsers.find(user => user.id === userID) != undefined;
//   });

//   if (index != -1) {
//     return rooms
//   }
//   return rooms.find(room => {
//     room.roomUsers.find(user => user.id === userID) != undefined;
//   })
// }

function getUserByID(id) {
  return users.find(user => user.id == id);
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

function getRoomUsers(roomID) {
  // console.log(roomID);
  const res = rooms.find(room => room.roomID === roomID);
  if (res) {
    return res.roomUsers;
  } else {
    return 'NO ROOM';
  }
}



module.exports = {
  getAllRooms,
  createRoom,
  addRoom,
  // removeRoom,
  // createUser,
  userJoin,
  getUserByID,
  userLeave,
  getRoomUsers
  // getRoomByUserID
}