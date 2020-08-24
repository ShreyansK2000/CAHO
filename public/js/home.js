
const joinForm = document.getElementById("join-form");
const createForm = document.getElementById("create-form");

const joinButton = document.getElementById("join-button");
const createButton = document.getElementById("create-button");

function encodeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

joinButton.addEventListener('click', e => {

  e.preventDefault();
  let username = document.getElementById('username-join').value;
  let roomID = document.getElementById('roomid').value;
  if (!username.trim()) {
    alert('Please enter a user name'); // Falsy username values are rejected
  } else if (!roomID.trim()) {
    alert('Please enter a room ID to join')
  } else {
    // Cean username for HTML
    username = encodeHTML(username);
    roomID = encodeHTML(roomID);
    fetch('/joinRoom', {
      method: 'post',
      body: 'username-join='+username+'&roomid='+roomID,
      headers: { 'Content-type': 'application/x-www-form-urlencoded' },
      redirect: 'follow'
    })
    .then(res => res.text())
    .then(text => {
      if (text.substring(0,3) !== 'ERR') {
        window.location.href = "game.html?"+text;
      } else {
        alert('Apologies, there was an unexpected error, please try again later')
      }
    });
  }
});


createButton.addEventListener('click', e => {

  // Don't refresh page by default
  e.preventDefault();

  let username = document.getElementById('username-create').value;

  if (!username.trim()) {
    alert('Please enter a user name'); // Falsy username values are rejected
  } else {
    // Cean username for HTML
    username = encodeHTML(username);
    fetch('/createRoom', {
      method: 'post',
      body: 'username-create='+username,
      headers: { 'Content-type': 'application/x-www-form-urlencoded' },
      redirect: 'follow'
    })
    .then(res => res.text())
    .then(text => {
      if (text !== 'ERR') {
        window.location.href = "game.html?"+text;
      } else {
        alert('Apologies, there was an unexpected error, please try again later')
      }
    });
  }
});