// create the configuration that will be used for the Phaser game
var config = {
  // in the type field, set the renderer type for the game. The two main types are Canvas and WebGL. WebGL is a faster renderer and has better performance, but not all browsers support it. By choosing AUTO for the type, Phaser will use WebGL if it is available, otherwise, it will use Canvas.
  type: Phaser.AUTO,
  // the parent field is used to tell Phaser to render our game in an existing <canvas> element with that id if it exists. If it doesn't, Phaser will create a <canvas> element.
  parent: 'phaser-tachi',
  // specify width and height of the viewable area of the game
  width: 800,
  height: 600,
  // enable the arcade physics that is available in Phaser
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 300 },
      debug: false
    }
  },
  // embed a scene object which will use the preload, update, and create functions defined below
  scene: {
    preload: preload,
    create: create,
    update, update
  }
};

// Create new game instance and pass the config object to Phaser
var game = new Phaser.Game(config);

function preload() {
  this.load.image('tachi', 'assets/white_fluffy_dog.png');
  this.load.image('otherPlayer', 'assets/black_shiba_inu_filtered.png');
}

function create() {
  var self = this;

  // Create a new group called otherPlayers, which will be used to manage all of the other players in the game. 
  this.otherPlayers = this.physics.add.group();

  // Used socket.on to listen for the currentPlayers event. When this event is triggered, the function that was provided will be called with the players object that was passed from the server. When this function is called, loop through each of the players and check to see if that player's id matches the current player's socket id. The addPlayer() function is called and passed the current player's information, and a reference to the current scene. If the player is not the current player, the addOtherPlayers function is called.
  this.socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach((id) => {
      if (players[id].playerId === self.socket.id) {
        addPlayer(self, players[id]);
      } else {
        addOtherPlayers(self, players[id]);
      }
    });
  });

  // When the newPlayer event is fired, the addOtherPlayers function is called to add that new player to the game
  this.socket.on('newPlayer', (playerInfo) => {
    addOtherPlayers(self, playerInfo);
  });

  // When the disconnected event is fired, that player's character is removed from the game by using the player's id. The getChildren() method is called on the otherPlayers group in order to do this. The destroy() method is used to remove that game object from the game.
  this.socket.on('disconnected', (playerId) => {
    self.otherPlayers.getChildren().forEach((otherPlayer) => {
      if (playerId === otherPlayer.playerId) {
        otherPlayer.destroy();
      }
    });
  });

  // This will populate the cursors object with the four main Key objects (up, down, left, right), which will bind to those arrows on the keyboard.
  this.cursors = this.input.keyboard.createCursorKeys();

  // When the playerMoved event is emitted, that player's sprite will be updated in the game
  this.socket.on('playerMoved', (playerInfo) => {
    self.otherPlayers.getChildren().forEach((otherPlayer) => {
      if (playerInfo.playerId === otherPlayer.playerId) {
        otherPlayer.setRotation(playerInfo.rotation);
        otherPlayer.setPosition(playerInfo.x, playerInfo.y);
      }
    });
  });
}

function update() {
  if (this.tachi) {
    // If the left or right key is pressed, the player's angular velocity is updated by calling setAngularVelocity(). The angular velocity will allow the character to rotate left and right. If neighter keys are pressed, then the angular velocity is reset back to 0.
    if (this.cursors.left.isDown) {
      this.tachi.setAngularVelocity(-150);
    } else if (this.cursors.right.isDown) {
      this.tachi.setAngularVelocity(150);
    } else {
      this.tachi.setAngularVelocity(0);
    }

    // If the up key is pressed, then the character’s velocity is updated, otherwise, it's set to 0. 
    if (this.cursors.up.isDown) {
      this.physics.velocityFromRotation(this.tachi.rotation + 1.5, 100, this.tachi.body.acceleration);
    } else {
      this.tachi.setAcceleration(0);
    }

    // If the character goes off screen it will appear on the other side of the screen. This is done by calling physics.world.wrap() and passing the game object we want to wrap and offset.
    this.physics.world.wrap(this.tachi, 5);

    // emit player movement
    var x = this.tachi.x;
    var y = this.tachi.y;
    var r = this.tachi.rotation;
    
    // Check to see if the player's rotation or position has changed by comparing the variables to the player's previous rotation and position. If the player’s position or rotation has changed, then a new event called playerMovement is emitted and the player’s information is passed into it.
    if (this.tachi.oldPosition && (x !== this.tachi.oldPosition.x || y !== this.tachi.oldPosition.y || r !== this.tachi.oldPosition.rotation)) {
      this.socket.emit('playerMovement', { x: this.tachi.x, y: this.tachi.y, rotation: this.tachi.rotation });
    }

    // save old position data with player's current rotation and position
    this.tachi.oldPosition = {
      x: this.tachi.x,
      y: this.tachi.y,
      rotation: this.tachi.rotation
    };
  }
}

function addPlayer(self, playerInfo) {
  // Create the player's character by using the x and y coordinates that were generated in the server code. Instead of just using self.add.image to create the character, self.physics.add.image is used in order to allow that game object to use the arcade physics. setOrigin() is used to set the origin of the game object to be in the middle of the object instead of the top left so that when a game object is rotated, it will be rotated around the origin point. setDisplaySize() is used to change the size and scale of the game object since the original size of the images can vary.
  self.tachi = self.physics.add.image(playerInfo.x, playerInfo.y, 'tachi').setOrigin(0.5, 0.5).setDisplaySize(40, 40);

  // setDrag, setAngularDrag, and setMaxVelocity are used to modify how the game object reacts to the arcade physics. Both setDrag and setAngularDrag are used to control the amount of resistance the object will face when it is moving. setMaxVelocity is used to control the max speed the game object can reach.
  self.tachi.setDrag(100);
  self.tachi.setAngularDrag(100);
  self.tachi.setMaxVelocity(200);
}

// Similar to the code added in the addPlayer() function. Main difference is that the other player's game object is added to the otherPlayers group.
function addOtherPlayers(self, playerInfo) {
  const otherPlayer = self.add.sprite(playerInfo.x, playerInfo.y, 'otherPlayer').setOrigin(0.5, 0.5).setDisplaySize(40, 40);

  otherPlayer.playerId = playerInfo.playerId;
  self.otherPlayers.add(otherPlayer);
}