const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector('.chat-messages-container');
const startButton = document.getElementById('start-game-button');

const socket = io();

const {username, roomID} = Qs.parse(location.search, {
  ignoreQueryPrefix: true
});
console.log(username);

console.log(roomID);


socket.emit('joinRoom', {username, roomID});

socket.on('roomUsers', ({roomID, users}) => {
  outputRoomNametoDOM(roomID);
  outputUsers(users);
});

socket.on('message', (e) => {
  console.log(e);
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
});

startButton.addEventListener('click', (e) => {
  e.preventDefault();

  fetch('/startGame', {
    method: 'post',
    body: 'username='+username,
    headers: { 'Content-type': 'application/x-www-form-urlencoded' },
  })
  .then(res => res.text())
  .then(text => {
    if (text !== 'ERR' && text !== 'INVALID USER') {
      alert('Game starting');
    } else if (text === 'INVALID USER') {
      alert('Only the host may start the game');
    } else {
      alert('Apologies, an unknown error occurred.');
    }
  });
})

function outputMessageToDOM(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  div.innerHTML = `<p class="meta">${message.username} <span class="time-span">${message.time}</span></p>
  <p class="text">
    ${message.text}
  </p>
  <hr>`;
  chatMessages.appendChild(div);
}

function outputRoomNametoDOM(roomID) {
  document.getElementById("roomIDSpan").innerText = roomID;
}

function outputUsers(users) {
  document.getElementById("users").innerHTML = `
    ${users.map(user => `<li>${user.username} <span class="score"></span></li>`).join('')}
  `;
}