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
      gravity: { y: 0 },
      debug: false
    }
  },
  // embed a scene object which will use the preload, update, and create functions defined below
  scene: {
    preload: preload,
    create: create,
    update, update
  },
  title: 'Tachi Race',
  version: '1.0b'
};

// Create new game instance and pass the config object to Phaser
var game = new Phaser.Game(config);

function preload() {
  this.load.image('grass', 'assets/grass.jpg');
  this.load.spritesheet('tachi', 'assets/white_dog_sprite_sheet.png', { frameWidth: 95, frameHeight: 100 });
  // this.load.image('tachi', 'assets/white_fluffy_dog_filtered.png');
  this.load.image('shiba', 'assets/black_shiba_inu_filtered.png');
  this.load.image('bone', 'assets/bone.png');
}

function create() {
  var self = this;
  this.socket = io();
  this.physics.add.image(0, 0, 'grass').setOrigin(0, 0).setDisplaySize(800, 700);

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

  // To display countdown clock with real-time updates on time left and to enable pause functionality on timer with the spacebar
  this.timeText = this.add.text(300, 20, '', { fontSize: '20px', fill: '#ffffff' });
  this.spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  this.spacebar.on('down', () => this.socket.emit('timerStatusChange'));

  this.socket.on('timeLeft', (timerData) => {
    this.timeText.setText('Countdown: ' + formatTime(timerData.timeLeft) + (timerData.isPaused ? '\n     Paused' : ''));
  });

  // Use of Phaser's Text Game Object in order to display the teams' scores
  this.tachiScoreText = this.add.text(16, 16, '', { fontSize: '32px', fill: '#800000', fontStyle: 'bold' });
  this.shibaScoreText = this.add.text(594, 16, '', { fontSize: '32px', fill: '#800000', fontStyle: 'bold' });

  // When the scoreUpdate event is received, the text of the game objects is updated by calling the setText() method with the team's score passed to each object
  this.socket.on('scoreUpdate', (scores) => {
    self.tachiScoreText.setText('Tachi: ' + scores.tachi);
    self.shibaScoreText.setText('Shiba: ' + scores.shiba);
  });

  // Listen for the boneLocation event. When it's received, bone object is checked to see if it exists and if it does, it is destroyed. A new bone game object is added to the player's game, and the information passed to the event to populate its location is used. If the player's game object and the bone are overlapping, the boneCollected event is emitted.By calling physics.add.overlap, Phaser will automatically check for the overlap and run the provided function when there is an overlap.
  this.socket.on('boneLocation', (boneLocation) => {
    if (self.bone) self.bone.destroy();
    self.bone = self.physics.add.image(boneLocation.x, boneLocation.y, 'bone').setDisplaySize(40, 25);
    self.bone.body.setSize(250, 70);
    self.physics.add.overlap(self.player, self.bone, () => {
      self.bone.destroy();
      this.socket.emit('boneCollected');
    }, null, self);
  });

  this.gameResultText = this.add.text(200, 250, '', { fontSize: '40px', fill: '#ffffff', fontStyle: 'bold' });

  this.socket.on('gameOver', (scores) => {
    if (scores.tachi > scores.shiba) {
      this.gameResultText.setText('Team Tachi Wins!');
    } else if (scores.shiba > scores.tachi) {
      this.gameResultText.setText('Team Shiba Wins!');
    } else {
      this.gameResultText.setText("It's a Draw!");
    }
  });
}

function update() {

  // Regularly emit timerUpdate and gameStatus events
  this.socket.emit('timerUpdate');
  this.socket.emit('gameStatus');

  if (this.player) {
    if (!this.player.anims) {
      // If the left or right key is pressed, the player's angular velocity is updated by calling setAngularVelocity(). The angular velocity will allow the character to rotate left and right. If neighter keys are pressed, then the angular velocity is reset back to 0.
      if (this.cursors.left.isDown) {
        this.player.setAngularVelocity(-150);
      } else if (this.cursors.right.isDown) {
        this.player.setAngularVelocity(150);
      } else {
        this.player.setAngularVelocity(0);
      }

      // If the up key is pressed, then the character’s velocity is updated, otherwise, it's set to 0. 
      if (this.cursors.up.isDown) {
        this.physics.velocityFromRotation(this.player.rotation + 1.5, 100, this.player.body.acceleration);
      } else {
        this.player.setAcceleration(0);
      }
    }
    
    if (this.player.anims) {
      if (this.cursors.left.isDown) {
        this.player.setVelocityX(-150);
        this.player.anims.play('left', true);

      } else if (this.cursors.right.isDown) {
        this.player.setVelocityX(150);
        this.player.anims.play('right', true);

      } else if (this.cursors.up.isDown) {
        this.player.setVelocityY(-150);
        this.player.anims.play('up', true);

      } else if (this.cursors.down.isDown) {
        this.player.setVelocityY(150);
        this.player.anims.play('down', true);

      } else {
        this.player.setVelocityX(0);
        this.player.anims.play('turn');
      }
    }

    // If the character goes off screen it will appear on the other side of the screen. This is done by calling physics.world.wrap() and passing the game object we want to wrap and offset.
    this.physics.world.wrap(this.player, 5);

    // emit player movement
    var x = this.player.x;
    var y = this.player.y;
    var r = this.player.rotation;
    
    // Check to see if the player's rotation or position has changed by comparing the variables to the player's previous rotation and position. If the player’s position or rotation has changed, then a new event called playerMovement is emitted and the player’s information is passed into it.
    if (this.player.oldPosition && (x !== this.player.oldPosition.x || y !== this.player.oldPosition.y || r !== this.player.oldPosition.rotation)) {
      this.socket.emit('playerMovement', { x: this.player.x, y: this.player.y, rotation: this.player.rotation });
    }

    // save old position data with player's current rotation and position
    this.player.oldPosition = {
      x: this.player.x,
      y: this.player.y,
      rotation: this.player.rotation
    };
  }

  if (this.otherPlayers) {
    // Set size of collision rectangle for other players' game objects
    this.otherPlayers.getChildren().forEach((otherPlayer) => {
      this.physics.world.wrap(otherPlayer, 5);

      if (otherPlayer.team === 'tachi') {
        otherPlayer.body.setSize(30, 30);
      } else {
        otherPlayer.body.setSize(120, 120);
      }
    });
  }
}

// Format timeLeft from seconds to digital clock display
function formatTime(seconds) {
  var minutes = Math.floor(seconds/60); // Minutes
  var partInSeconds = seconds%60; // Seconds
  partInSeconds = partInSeconds.toString().padStart(2, '0'); // Adds left zeros to seconds
  return `${minutes}:${partInSeconds}`;
}

function addPlayer(self, playerInfo) {
  // Create the player's character by using the x and y coordinates that were generated in the server code. Instead of just using self.add.image to create the character, self.physics.add.image is used in order to allow that game object to use the arcade physics. setOrigin() is used to set the origin of the game object to be in the middle of the object instead of the top left so that when a game object is rotated, it will be rotated around the origin point. setDisplaySize() is used to change the size and scale of the game object since the original size of the images can vary.
  // self.player = playerInfo.team === 'tachi' ? self.physics.add.image(playerInfo.x, playerInfo.y, 'tachi').setOrigin(0.5, 0.5).setDisplaySize(80, 80) : self.physics.add.image(playerInfo.x, playerInfo.y, 'shiba').setOrigin(0.5, 0.5).setDisplaySize(80, 80);

  self.player = playerInfo.team === 'tachi' ? self.physics.add.sprite(playerInfo.x, playerInfo.y, 'tachi') : self.physics.add.image(playerInfo.x, playerInfo.y, 'shiba').setOrigin(0.5, 0.5).setDisplaySize(65, 65);

  if (playerInfo.team === 'tachi') {
    self.anims.create({
      key: 'left',
      frames: self.anims.generateFrameNumbers('tachi', { start: 12, end: 15 }),
      frameRate: 10,
      repeat: -1
    });

    self.anims.create({
      key: 'turn',
      frames: [ { key: 'tachi', frame: 16 } ],
      frameRate: 20
    });

    self.anims.create({
      key: 'right',
      frames: self.anims.generateFrameNumbers('tachi', { start: 4, end: 7 }),
      frameRate: 10,
      repeat: -1
    });

    self.anims.create({
      key: 'up',
      frames: self.anims.generateFrameNumbers('tachi', { start: 8, end: 11 }),
      frameRate: 10,
      repeat: -1
    });

    self.anims.create({
      key: 'down',
      frames: self.anims.generateFrameNumbers('tachi', { start: 0, end: 4 }),
      frameRate: 10,
      repeat: -1
    })

    self.player.body.setSize(30, 30);
  }

  if (playerInfo.team === 'shiba') {
    self.player.body.setSize(120, 120);
  }
  
  // To make players collide instead of overlapping each other
  self.physics.add.collider(self.player, self.otherPlayers);

  // // Set size of collision rectangle for player's game object
  // self.player.body.setSize(120, 120);

  // setDrag, setAngularDrag, and setMaxVelocity are used to modify how the game object reacts to the arcade physics. Both setDrag and setAngularDrag are used to control the amount of resistance the object will face when it is moving. setMaxVelocity is used to control the max speed the game object can reach.
  self.player.setDrag(100);
  self.player.setAngularDrag(100);
  self.player.setMaxVelocity(200);
}

// Similar to the code added in the addPlayer() function. Main difference is that the other player's game object is added to the otherPlayers group.
function addOtherPlayers(self, playerInfo) {
  var otherPlayer = playerInfo.team === 'shiba' ? self.physics.add.sprite(playerInfo.x, playerInfo.y, 'shiba').setOrigin(0.5, 0.5).setDisplaySize(65, 65): self.physics.add.sprite(playerInfo.x, playerInfo.y, 'tachi');

  // To make other players in player's scene not pushable with collision
  otherPlayer.body.pushable = false;

  otherPlayer.team = playerInfo.team;

  otherPlayer.playerId = playerInfo.playerId;
  self.otherPlayers.add(otherPlayer);
}