const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector('.chat-messages-container');
const startButton = document.getElementById('start-game-button');
const checkboxInputArray = document.querySelectorAll("input[id^=input]");
const cardOptionArray = document.querySelectorAll("span[id^=card]");
const submitResponsesButton = document.getElementById('submit-responses-button');
const leaderboardButton = document.getElementById('leaderboard-button');

const submissionResponses = [];

const socket = io();
let reqPicks = 0;

const {username, roomID} = Qs.parse(location.search, {
  ignoreQueryPrefix: true
});

socket.emit('joinRoom', {username, roomID});

socket.on('roomUsers', ({roomID, users}) => {
  outputRoomNametoDOM(roomID);
  outputUsers(users);
});

socket.on('blackCard', ({text, pick}) => {
  outputBlackCard(text);
  document.getElementById('pick-number').innerText = '' + pick;
  reqPicks = pick;
})

socket.on('newWhiteCards', arr => {
  console.log(arr);
  let i = 0;
  cardOptionArray.forEach(span => {
    if (span.innerText === '') {
      span.innerHTML = arr[i];
      i++;
    }
  });   
});

socket.on('newCzar', czarName => {
  document.getElementById("current-czar").innerText = czarName;
})

socket.on('message', (e) => {
  console.log(e);
  outputMessageToDOM(e);
  chatMessages.scrollTop = chatMessages.scrollHeight;
})

checkboxInputArray.forEach((input, index) => {
  input.addEventListener('change', function() {
    if (this.checked) {
      if (submissionResponses.length < reqPicks) {
        submissionResponses.push(cardOptionArray[index].innerText);
      } else {
        alert('You cannot pick any more cards.');
        this.checked = false;
      }
    } else {
      let idx = submissionResponses.indexOf(cardOptionArray[index].innerText);
      if (idx !== -1) {
        submissionResponses.splice(idx, 1);
      } else {
        alert('Apologies, an unknown error has occurred');
      }
    }

    console.log(submissionResponses);
  });
});

submitResponsesButton.addEventListener('click', () => {
  if (submissionResponses.length === 0) {
    alert('There are no responses to submit!');
  } else if (submissionResponses.length === reqPicks) {
    socket.emit('submissionResponses', 
      { 
        payload : submissionResponses,
        roomID: roomID
      }, 
      function (responsedata) {
        if (responsedata) {
          alert('Responses submitted');
          checkboxInputArray.forEach((item, index) => {
            if (item.checked) {
              cardOptionArray[index].innerHTML = '';
              item.checked = false;
            }
          });
        } else{
          alert('Apologies, an unknown error occurred. Please try and submit again');
        }
      });
  }
});

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

function outputBlackCard(text) {
  res = text.replace('_', '<span style="text-decoration: underline; white-space: pre;">                   </span>')
  document.getElementById('black-card-text').innerHTML = res;
}