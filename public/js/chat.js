// import io from "socket.io-client";

// var socket = io();

var messages = document.querySelector('#messages');
var chatButton = document.querySelector('#chatButton');
var input = document.querySelector('#input');

input.addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    chatButton.click(e);
  }
});

chatButton.addEventListener('click', function(e) {
  if (input.value) {
    socket.emit('chat message', input.value);
    input.value='';
  }
})

socket.on('chat message', function(msg) {
  var item = document.createElement('li');
  item.textContent = msg;
  messages.appendChild(item);
});