const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector('.chat-messages-container');
const startButton = document.getElementById('start-game-button');
const checkboxInputArray = document.querySelectorAll("input[id^=input]");
const cardOptionArray = document.querySelectorAll("span[id^=card]");
const submitResponsesButton = document.getElementById('submit-responses-button');
const leaderboardButton = document.getElementById('leaderboard-button');
const chooseAnswerButton = document.getElementById('choose-button');
// const leaveButton = document.getElementById();

/* Logic for the leaderboard dialog box (added before socket related stuff) */
let leaderboardDialog = document.getElementById("leaderboard-dialog");
let responsesDialog = document.getElementById("responses-dialog");


leaderboardButton.onclick = function() {
  if (document.getElementById('current-czar').textContent) {
    leaderboardDialog.style.display = "block";
  } else {
    alert("Game has not yet started, no leaderboard to show")
  }
}

window.onclick = function(event) {
  if (event.target == leaderboardDialog) {
    leaderboardDialog.style.display = "none";
  }
}

let closeButton = document.getElementsByClassName("close")[0];
closeButton.onclick = function() {
  leaderboardDialog.style.display = "none";
}


// loadScoreTable();
const submissionResponses = [];
const submissionCardIndices = [];

const socket = io();
let reqPicks = 0;
let curCzarName = '';

const { username, roomID } = Qs.parse(location.search, {
  ignoreQueryPrefix: true
});

// window.addEventListener('beforeunload', function (e) {
//   let cardOptionTextArray = cardOptionArray.map(span => span.innerHTML);
// });

/* socket events */

// userCacheID helps protect users from breaking funtionality
// on refreshes or temporary disconnections
let userCacheID = window.sessionStorage.getItem('userCacheID');
console.log('oldUserCacheID', userCacheID);

socket.emit('joinRoom', {
  username,
  roomID,
  userCacheID
}, function (responsedata) {
    console.log(responsedata);
    if (responsedata) {
      // responsedata is the userCacheID that both the server and client share
      window.sessionStorage.setItem('userCacheID', responsedata);
      console.log('afterstoring', window.sessionStorage.getItem('userCacheID'));
    } else {
      alert('Apologies, an unknown error occurred. Please try and submit again');
    }
});

socket.on('roomUsers', ({
  roomID,
  users
}) => {
  outputRoomNametoDOM(roomID);
  outputUsers(users);
  loadScoreTable(users);
});

socket.on('blackCard', ({
  text,
  pick
}) => {
  outputBlackCard(text);
  document.getElementById('pick-number').innerText = '' + pick;
  reqPicks = pick;
  checkboxInputArray.forEach(input => {
    input.disabled = false;
  })
})

socket.on('whiteCards', arr => {
  console.log(arr);
  let i = 0;
  cardOptionArray.forEach(span => {
    // if (span.innerText === '') {
      span.innerHTML = arr[i];
      i++;
    // }
  });
});

socket.on('currentCzar', czarName => {
  curCzarName = czarName;
  let amICzar = czarName === username;

  document.getElementById("current-czar").innerText = amICzar ? 'You' : czarName;

  checkboxInputArray.forEach(input => {
    input.disabled = amICzar;
  });
});

socket.on('responsesToBlackCard', collectedResponses => {
  console.log();

  // showResponsesDialog(collectedResponses);
  loadCollectedResponses(collectedResponses);
  responsesDialog.style.display = "block";

});

socket.on('message', (e) => {
  console.log(e);
  outputMessageToDOM(e);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

socket.on('winner', message => {
  let name = message.split(" ")[0];
  if (name === username) {
    let splitArr = message.split(" ");
    splitArr[0] = "You";
    let newMessage = splitArr.join(" ");
    console.log(newMessage);
  } else {
    console.log(message);
  }
})

socket.on('updateScores', data => loadScoreTable(data));

socket.on('gameStateUpdate', data => {
  console.log(data);
})

/* Event listeners for user operations on the game menu */
checkboxInputArray.forEach((input, index) => {
  input.addEventListener('change', function () {
    if (this.checked) {
      if (submissionResponses.length < reqPicks) {
        submissionResponses.push(cardOptionArray[index].innerText);
        submissionCardIndices.push(index);
      } else {
        alert('You cannot pick any more cards.');
        this.checked = false;
      }
    } else {
      let idx = submissionResponses.indexOf(cardOptionArray[index].innerText);
      if (idx !== -1) {
        submissionResponses.splice(idx, 1);
        submissionCardIndices.splice(idx, 1);
      } else {
        alert('Apologies, an unknown error has occurred');
      }
    }

    showSelectedResponses();
    console.log(submissionResponses);
  });
});

submitResponsesButton.addEventListener('click', () => {
  if (username === curCzarName) {
    alert('You cannot submit responses as the current Card Czar!');
  } else if (submissionResponses.length === 0) {
    alert('There are no responses to submit!');
  } else if (submissionResponses.length === reqPicks) {
    socket.emit('submissionResponses', {
        payload: submissionResponses,
        removeCardIndices: submissionCardIndices,
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
            item.disabled = true;
            submissionResponses.length = 0;
            submissionCardIndices.length = 0;
          });
        } else {
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
      body: 'username=' + username,
      headers: {
        'Content-type': 'application/x-www-form-urlencoded'
      },
    })
    .then(res => res.text())
    .then(text => {
      let resCode = text.substring(0, 2);
      if (resCode !== 'ERR') {
        alert('Game starting');
      } else {
        let resType = text.substring(4);
        if (resType === 'INVALID_USER') {
          alert('Only the host may start the game');
        } else if (resType === 'ONLY_PLAYER') {
          alert('I"\'m sure you don\'t need the browser to say this, but this is not a solo game!');
        } else if (resType = 'UNDEFINED_USER') {
          alert('Apologies, there was an error fetching user information');
        } else {
          alert('Apologies, an unknown error has occurred');
        }
      } 
    });
});

chooseAnswerButton.addEventListener('click', (e) => {
  e.preventDefault();

  const radioInputArray = document.querySelectorAll("input[id^=radio]");

  let checkedInputIdx;
  radioInputArray.forEach((input, index) => {
    if(input.checked) {
      checkedInputIdx = index;
    }
  });

  // console.log(document.querySelectorAll("span[id^=userID]")[checkedInputIdx].textContent)
  // console.log(document.querySelectorAll("span[id^=res]")[checkedInputIdx].textContent)

  // let userSocketID = document.querySelectorAll("span[id^=userID]")[checkedInputIdx];
  // let winningAnswer = document.querySelector("span[id^=res]")[checkedInputIdx];
  let winnerObj = {
    roomID: roomID,
    // user: socket.id,
    user: document.querySelectorAll("span[id^=userID]")[checkedInputIdx].textContent,
    userAns: document.querySelectorAll("span[id^=res]")[checkedInputIdx].textContent
  }
  socket.emit('roundWinner', winnerObj)

  responsesDialog.style.display = "none";
});

/* Helper functions to populate DOMs are required */

/**
 * Outputs the message string in a stylized DOM inside the 
 * chat container
 * @param {string} message 
 */
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

/**
 * Outputs the roomID string to the appropriate DOM
 * @param {string} roomID 
 */
function outputRoomNametoDOM(roomID) {
  document.getElementById("roomIDSpan").innerText = roomID;
}

/**
 * Populates a DOM with a list of users 
 * @param {string[]} users 
 */
function outputUsers(users) {
  document.getElementById("users").innerHTML = `
    ${users.map(user => `<li>${user.username} <span class="score"></span></li>`).join('')}
  `;
}

function loadScoreTable(userScores) {
  userScores.sort((a, b) => (a.score < b.score) ? 1 : -1)
  
  const tableBody = document.getElementById("leaderboard-table-body");
  let innerHTMLData = '';

  let rowidx = 1;

  for (let userinfo of userScores) {
    let tag = getImgTag(rowidx);
    innerHTMLData += `<tr><td>${tag}</td><td>${userinfo.username}</td><td>${userinfo.score}</td></tr>`;
    rowidx++;
  }
  tableBody.innerHTML = innerHTMLData;

}

function loadCollectedResponses(responses) {
  // responses = [
  //   {userID:"asdadasd", responseArr: ["&reg", "Bsdgsaghbarhbfadsbfbf"]},
  //   {userID:"asdadasd", responseArr: ["A", "B"]},
  // ]

  const tableBody = document.getElementById("responses-table-body");
  let innerHTMLData = '';

  let rowidx = 0;

  for (let response of responses) {
    let concatResponses = response.responseArr.join(", ");
    innerHTMLData += 
    `<tr>
      <td>
        <label><input type="radio" id="radio-${rowidx}" /></label><span class="hidden-user-id" style="display:none;" id="userID-${rowidx}">${response.userID}</span>
      </td>
      <td>
        <span id="res-${rowidx}">${concatResponses}</span>
      </td>
    </tr>`;
    rowidx++;
  }
  tableBody.innerHTML = innerHTMLData;

  const radioInputArray = document.querySelectorAll("input[id^=radio]");
  radioInputArray.forEach((input, index) => {
    input.addEventListener('change', function() {
      if (input.checked) {
        let radioInputCopy = [...radioInputArray]
        radioInputCopy.splice(index, 1);
        radioInputCopy.forEach(input => {
          input.checked = false;
        });
        fillInResponse(responses, index)
      }
    }) 
  });

}

function getImgTag(index) {
  switch (index) {
    case 1:
      return '<img src="./img/trophygold.png" width="20" height="20"/>';
      break;
    case 2:
      return '<img src="./img/trophysilver.png" width="20" height="20"/>'
      break;
    case 3:
      return '<img src="./img/trophybronze.png" width="20" height="20"/>'
      break;
    default:
      return ''
      break;
  }
}

/**
 * Outputs the current prompt (text) in the black-card area after adding
 * appropriate blanks where required
 * @param {string} text 
 */
function outputBlackCard(text) {
  res = text.replace(/_/g, '<span class="blank">                   </span>')
  document.getElementById('black-card-text').innerHTML = res;
  document.getElementById('response-black-card-text').innerHTML = res;

  let nonBlanks = document.querySelectorAll("p[class=no-blank]");
  nonBlanks.forEach(space => space.innerHTML = "");

  let nonBlankResponses = document.querySelectorAll("p[class=no-blank-response]");
  nonBlankResponses.forEach(space => space.innerHTML = "");
}

function showResponsesDialog(responsesArr) {
  
}

function showSelectedResponses () {
  let blankSpans = document.querySelectorAll("span[class=blank]");
  if (blankSpans.length !== 0) {
    blankSpans.forEach((space, idx) => {
      space.innerHTML = (idx) >= submissionResponses.length ? "                   " : submissionResponses[idx].replace(".", "");
    });
  } else {
    let nonBlankResponses = document.querySelectorAll("p[class=no-blank]");
    nonBlankResponses.forEach((space, idx) => {
      space.innerHTML = (idx) >= submissionResponses.length ? "" : submissionResponses[idx].replace(".", "");
    });
  }
}

function fillInResponse (responsesArr, index) {
  let blankSpansResponses = document.querySelectorAll("#response-black-card-text .blank");
  if (blankSpansResponses.length !== 0) {
    blankSpansResponses.forEach((space, idx) => {
      console.log(responsesArr, responsesArr[index].responseArr[idx]);
      space.innerHTML = responsesArr[index].responseArr[idx].replace(".", "");
    });
  } else {
    let nonBlankResponses = document.querySelectorAll(".response-black-card-info .no-blank-response");
    nonBlankResponses.forEach((space, idx) => {
      console.log(index)
      console.log(idx);
      console.log(responsesArr[index].responseArr[idx]);
      space.innerHTML = idx >= responsesArr[index].responseArr.length ?  "" : responsesArr[index].responseArr[idx].replace(".", "");
    });
  }
}