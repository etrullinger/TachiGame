const express = require('express');
const app = express();
// supply the app to the HTTP server, which will allow express to handle the HTTP requests
const server = require('http').Server(app);
const socket = require('socket.io');
// socket setup
const io = socket(server);

// object to keep track of all players currently in game
var players = {};

// global time-related variables used to store the countdown time, pause status, and game status
// countdown is set on this server as global variable to enable real-time consistent time updates across users
var timeLeft = 120;
var isPaused = false;
var gameIsOver = false;
var countDown = setInterval(function() {
  if (!isPaused) {
    timeLeft--;
  }

  if (timeLeft === 0) {
    gameIsOver = true;
    clearInterval(countDown);
  }
}, 1000);

// Bone variable used to store the position of the bone collectible
var bone = {
  x: Math.floor(Math.random() * 700) + 50,
  y: Math.floor(Math.random() * 500) + 50
};

// Scores variable used to keep track of both team's score
var scores = {
  tachi: 0,
  shiba: 0
}

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// add logic to listen for connections and disconnections
io.on('connection', (socket) => {
  console.log('a user connected', socket.id);

  // Create a new player and add it to the players object
  players[socket.id] = {
    rotation: 0,
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50,
    playerId: socket.id,
    team: Object.keys(players).length%2 == 0 ? 'tachi' : 'shiba',
  };

  socket.on('chat message', (msg) => {
    console.log('message: ' + msg);
    var chatLine = players[socket.id].team + ': ' + msg;
    console.log('chat line: ' + chatLine);
    io.emit('chat message', chatLine);
  });

  // Send the players object to the new player
  socket.emit('currentPlayers', players);

  // Send the time left on countdown and paused status to the new player
  socket.emit('timeLeft', { timeLeft: timeLeft, isPaused: isPaused });

  // Send the bone object to the new player
  socket.emit('boneLocation', bone);

  // Send the current scores to the new player
  socket.emit('scoreUpdate', scores);

  // Update all other players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // When a player disconnects, that player's data is removed from the players object, and a message is emitted to all players about this player leaving
  socket.on('disconnect', () => {
    console.log('user disconnected');

    // Remove the player from players object
    delete players[socket.id];

    // Emit a message to all players to remove this player. 
    io.emit('disconnected', socket.id);
  });

  // When a player moves, update the player data. (When the playerMovement event is received on the server, we update that player’s information that is stored on the server, emit a new event called playerMoved to all other players, and in this event we pass the updated player’s information.)
  socket.on('playerMovement', (movementData) => {
    players[socket.id].x = movementData.x;
    players[socket.id].y = movementData.y;
    players[socket.id].rotation = movementData.rotation;

    // Emit a message to all other players about the player that moved
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  socket.on('timerUpdate', () => {
    socket.emit('timeLeft', { timeLeft: timeLeft, isPaused: isPaused });
  });

  socket.on('timerStatusChange', () => {
    if (!isPaused) isPaused = true;
    else isPaused = false;
  });

  // When a boneCollected event is triggered, the correct team's score will be updated, a new location for the bone will be generated, and the updated scores and the stars new location will be reflected for each of the players
  socket.on('boneCollected', () => {
    if (!gameIsOver) {
      if (players[socket.id].team === 'tachi') {
        scores.tachi += 10;
      } else {
        scores.shiba += 10;
      }
      bone.x = Math.floor(Math.random() * 700) + 50;
      bone.y = Math.floor(Math.random() * 500) + 50;
      io.emit('boneLocation', bone);
      io.emit('scoreUpdate', scores);
    }
  });

  socket.on('gameStatus', () => {
    if (gameIsOver) {
      socket.emit('gameOver', scores);
    }
  });
});

server.listen(8081, () => {
  console.log(`Listening on ${server.address().port}`);
});