const express = require('express');
const app = express();
// supply the app to the HTTP server, which will allow express to handle the HTTP requests
const server = require('http').Server(app);
const socket = require('socket.io');
// socket setup
const io = socket(server);

// object to keep track of all players currently in game
var players = {};

// Bone variable used to store the position of the bone collectible
var bone = {
  x: Math.floor(Math.random() * 700) + 50,
  y: Math.floor(Math.random() * 500) + 50
};

// Scores variable used to keep track of both team's score
var scores = {
  bark: 0,
  growl: 0
}

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// add logic to listen for connections and disconnections
io.on('connection', (socket) => {
  console.log('a user connected');

  // Create a new player and add it to the players object
  players[socket.id] = {
    rotation: 0,
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 500) + 50,
    playerId: socket.id,
    team: (Math.floor(Math.random() * 2) == 0) ? 'bark' : 'growl'
  };

  // Send the players object to the new player
  socket.emit('currentPlayers', players);

  // Send the bone object to the new player
  socket.emit('boneLocation', bone);

  // Send the current scores
  socket.emit('scoreUpdate', scores);

  // Update all players of the new player
  socket.broadcast.emit('newPlayer', players[socket.id]);

  // When a player disconnects, that player's data is removed from the players object, and a message is emitted to all other players about this player leaving
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

    // Emit a message to all players about the player that moved
    socket.broadcast.emit('playerMoved', players[socket.id]);
  });

  // When a boneCollected event is triggered, the correct team's score will be updated, a new location for the bone will be generated, and the updated scores and the stars new location will be reflected for each of the players
  socket.on('boneCollected', () => {
    if (players[socket.id].team === 'bark') {
      scores.bark += 10;
    } else {
      scores.growl += 10;
    }
    bone.x = Math.floor(Math.random() * 700) + 50;
    bone.y = Math.floor(Math.random() * 500) + 50;
    io.emit('boneLocation', bone);
    io.emit('scoreUpdate', scores);
  })
});

server.listen(8081, () => {
  console.log(`Listening on ${server.address().port}`);
});