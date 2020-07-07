const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector('.chat-messages');

const socket = io();

const {username, room} = Qs.parse(location.search, {
  ignoreQueryPrefix: true
})
// Receive 'message' from server

socket.emit('joinRoom', {username, room});

socket.on('roomUsers', ({room, users}) => {
  outputRoomNametoDOM(room);
  outputUsers(users);
});

socket.on('message', (e) => {
  console.log(e)
  outputMessageToDOM(e);
  chatMessages.scrollTop = chatMessages.scrollHeight;
})

// Message submit
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // get message text
  const message = e.target.elements.msg.value;

  // emit text message to server
  socket.emit('chatMessage', message);
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
})

function outputMessageToDOM(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<p class="meta">${message.username} <span>${message.time}</span></p>
  <p class="text">
    ${message.text}
  </p>`;
  chatMessages.appendChild(div);
}

function outputRoomNametoDOM(room) {
  document.getElementById("room-name").innerText = room;
}

function outputUsers(users) {
  document.getElementById("users").innerHTML = `
    ${users.map(user => `<li>${user.username}</li>`).join('')}
  `;
}