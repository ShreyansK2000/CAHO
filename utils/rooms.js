rooms = [];

var ID = function () {
  return '' + Math.random().toString(36).substr(2, 8);
};

function getAllRooms() {
  return rooms;
}

function createRoom(creatingUser) {
  return {
    roomID: ID(),
    creatingUser: null,
    allUsers: []
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

function createUser (id, username) {
  return {
    id,
    username
  }
}

function userJoin (roomID, id, username) {
  const room = rooms.find(room => room.roomID === roomID);

  if (room !== undefined) {
    const user = createUser(id, username);
    room.allUsers.push(user);
    return user;
  } else {
    return undefined;
  }
}

// function getUserByID(id) {
//   return users.find(user => user.id == id);
// }

// function userLeave (id) {
//   const index = users.findIndex(user => user.id === id);

//   if (index !== -1) {
//     return users.splice(index, 1)[0];
//   }
// }

// function getRoomUsers(room) {
//   return users.filter(user => user.room === room);
// }



module.exports = {
  getAllRooms,
  createRoom,
  addRoom,
  removeRoom,
  createUser,
  userJoin
  // getUserByID,
  // userLeave,
  // getRoomUsers
}