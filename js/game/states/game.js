'use strict'
const _ = require('lodash')
const trackPositions = require('./track-positions.js')

var game = {}, map, ocean, track, islands, blackShip, yellowShip, greenShip, speed = 100, keySpace, space = 1, keyP, blackShipStart, yellowShipStart, greenShipStart, shipList = [], shipCollide

game.create = function () {
  game.physics.startSystem(Phaser.Physics.ARCADE)
  map = game.add.tilemap('map')
  map.addTilesetImage('water-tile', 'water')
  ocean = map.createLayer('Water')
  islands = map.createLayer('Islands')
  track = game.add.sprite(0, 265, 'track')

  blackShipStart = getPositionFromName('b19')
  blackShip = game.add.sprite(blackShipStart.x, blackShipStart.y, 'blackShip')
  blackShip.scale.setTo(0.6)
  blackShip.angle = blackShipStart.angle
  blackShip.anchor.setTo(0.5, 0.5)
  blackShip.currentPosition = blackShipStart.name

  yellowShipStart = getPositionFromName('b18')
  yellowShip = game.add.sprite(yellowShipStart.x, yellowShipStart.y, 'yellowShip')
  yellowShip.scale.setTo(0.6)
  yellowShip.angle = yellowShipStart.angle
  yellowShip.anchor.setTo(0.5, 0.5)
  yellowShip.currentPosition = yellowShipStart.name

  greenShipStart = getPositionFromName('b20')
  greenShip = game.add.sprite(greenShipStart.x, greenShipStart.y, 'greenShip')
  greenShip.scale.setTo(0.6)
  greenShip.angle = greenShipStart.angle
  greenShip.anchor.setTo(0.5, 0.5)
  greenShip.currentPosition = greenShipStart.name

  shipList.push(blackShip, yellowShip, greenShip)

  game.physics.arcade.enable(blackShip, true)
  game.physics.arcade.enable(yellowShip, true)

  map.addTilesetImage('tile_01', 'tile_01')
  map.addTilesetImage('tile_17', 'tile_17')
  map.addTilesetImage('tile_33', 'tile_33')
  map.addTilesetImage('tile_02', 'tile_02')
  map.addTilesetImage('tile_19', 'tile_19')
  map.addTilesetImage('tile_35', 'tile_35')
  map.addTilesetImage('tile_03', 'tile_03')
  map.addTilesetImage('tile_34', 'tile_34')
  map.addTilesetImage('tile_69', 'tile_69')
  map.addTilesetImage('tile_66', 'tile_66')
  map.addTilesetImage('tile_51', 'tile_51')

  keyP = game.input.keyboard.addKey(Phaser.KeyCode.P)
  keyP.onUp.add(test)

  shipCollide = new Phaser.Signal()
  shipCollide.add(ramming, this)
}

function isShipPosition (position) {
  let isShip = false

  _.forEach(shipList, (ship) => {
    if (ship.currentPosition === position) {
      isShip = true
    }
  })

  return isShip
}

function getShipFromPosition (position) {
  let ship

  _.forEach(shipList, (boat) => {
    if (position === boat.currentPosition) {
      ship = boat
    }
  })

  return ship
}

function test () {
  // shipCollide.dispatch()
  // console.log(hitLocation('d38', 'a1'))
  // console.log(blackShip.currentPosition)
  // console.log(isShipPosition('a14'))
  shipMove(yellowShip, 'b18', 'b19')
}

function hitLocation (starting, ending) {
  let moveIndex, direction

  _.forEach(trackPositions, (pos) => {
    if (pos.name === starting) {
      moveIndex = _.indexOf(pos.moves, ending)
    }
  })

  if (moveIndex === 0) {
    direction = 'right'
  } else if (moveIndex === 1) {
    direction = 'rear'
  } else if (moveIndex === 2) {
    direction = 'left'
  }

  return direction
}

function getPositionFromName (postionName) {
  return _.find(trackPositions, ['name', postionName])
}

function getPositionFromXY (x, y) {
  let position
  _.forEach(trackPositions, (pos) => {
    if (pos.x === x && pos.y === y) {
      position = pos
    }
  })

  return position
}

function shipMove (ship, starting, ending) {
  let start = getPositionFromName(starting)
  let end = getPositionFromName(ending)
  let moveTween, angleTween

  console.log('moving ship: ', ship.key, start.name, end.name)

  if (isShipPosition(end.name) === true) {    
    let rammed = getShipFromPosition(end.name)
    console.log('detected ship at: ', rammed.key, rammed.currentPosition)
    let location = hitLocation(start.name, end.name)
    shipCollide.dispatch(location, rammed)
  }

  moveTween = game.add.tween(ship).to({ x: end.x, y: end.y }, 500, Phaser.Easing.Back.Out, true)
  angleTween = game.add.tween(ship).to({ angle: end.angle }, 500, Phaser.Easing.Back.Out, true)

  moveTween.onComplete.addOnce(function () { ship.currentPosition = end.name }, this)
}

function ramming (direction, ship) {
  let moveTo, moveIndex, position, currentPosition = ship.currentPosition

  console.log('ramming ship: ', ship.key, ship.currentPosition)

  position = getPositionFromName(ship.currentPosition)

  if (direction === 'left') {
    moveIndex = 2
  } else if (direction === 'right') {
    moveIndex = 0
  } else if (direction === 'rear') {
    moveIndex = 1
  }

  moveTo = position.moves[moveIndex]

  if (moveTo !== '') {
    game.time.events.add(100, function () {
      game.camera.shake(0.0125, 100)      
      shipMove(ship, currentPosition, moveTo)
    }, this)
  }
}

game.update = function () {
  blackShip.body.velocity.x = 0
  blackShip.body.velocity.y = 0

  if (game.input.keyboard.isDown(Phaser.Keyboard.A)) {
    blackShip.angle -= 1
  }

  if (game.input.keyboard.isDown(Phaser.Keyboard.S)) {
    blackShip.angle += 1
  }

  if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT)) {
    blackShip.body.velocity.x -= speed
  } else if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) {
    blackShip.body.velocity.x += speed
  } else if (game.input.keyboard.isDown(Phaser.Keyboard.DOWN)) {
    blackShip.body.velocity.y += speed
  } else if (game.input.keyboard.isDown(Phaser.Keyboard.UP)) {
    blackShip.body.velocity.y -= speed
  }
}

module.exports = game
