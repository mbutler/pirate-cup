'use strict'
const _ = require('lodash')
const fs = require('fs')
const trackPositions = require('./track.js')

var game = {}, map, ocean, track, islands, blackShip, yellowShip, greenShip, redShip, blueShip, speed = 100, keyP, blackShipStart, yellowShipStart, greenShipStart, redShipStart, blueShipStart, shipList = [], shipCollide, keyO

game.create = function () {
  game.physics.startSystem(Phaser.Physics.ARCADE)
  map = game.add.tilemap('map')
  map.addTilesetImage('water-tile', 'water')
  ocean = map.createLayer('Water')
  islands = map.createLayer('Islands')
  track = game.add.sprite(0, 265, 'track')

  blackShipStart = getPositionFromName('b20')
  console.log(blackShipStart)
  blackShip = game.add.sprite(blackShipStart.x, blackShipStart.y, 'blackShip')
  blackShip.scale.setTo(0.6)
  blackShip.angle = blackShipStart.angle
  blackShip.anchor.setTo(0.5, 0.5)
  blackShip.currentPosition = blackShipStart.name

  yellowShipStart = getPositionFromName('b19')
  yellowShip = game.add.sprite(yellowShipStart.x, yellowShipStart.y, 'yellowShip')
  yellowShip.scale.setTo(0.6)
  yellowShip.angle = yellowShipStart.angle
  yellowShip.anchor.setTo(0.5, 0.5)
  yellowShip.currentPosition = yellowShipStart.name

  greenShipStart = getPositionFromName('c21')
  greenShip = game.add.sprite(greenShipStart.x, greenShipStart.y, 'greenShip')
  greenShip.scale.setTo(0.6)
  greenShip.angle = greenShipStart.angle
  greenShip.anchor.setTo(0.5, 0.5)
  greenShip.currentPosition = greenShipStart.name

  redShipStart = getPositionFromName('d23')
  redShip = game.add.sprite(redShipStart.x, redShipStart.y, 'redShip')
  redShip.scale.setTo(0.6)
  redShip.angle = redShipStart.angle
  redShip.anchor.setTo(0.5, 0.5)
  redShip.currentPosition = redShipStart.name

  blueShipStart = getPositionFromName('d22')
  blueShip = game.add.sprite(blueShipStart.x, blueShipStart.y, 'blueShip')
  blueShip.scale.setTo(0.6)
  blueShip.angle = blueShipStart.angle
  blueShip.anchor.setTo(0.5, 0.5)
  blueShip.currentPosition = blueShipStart.name

  shipList.push(blackShip, yellowShip, greenShip, redShip, blueShip)

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

  keyO = game.input.keyboard.addKey(Phaser.KeyCode.O)
  keyO.onDown.add(positionOverlay)

  shipCollide = new Phaser.Signal()
  shipCollide.add(ramming, this)
}

function test () {
  // shipCollide.dispatch()
  // console.log(hitLocation('d38', 'a1'))
  // console.log(blackShip.currentPosition)
  // console.log(isShipPosition('a14'))
  shipMove(yellowShip, 'b19', 'b20')
}

function positionOverlay () {
  let text

  _.forEach(trackPositions, (pos) => {
    text = game.add.text(pos.x, pos.y, pos.name)
    text.anchor.setTo(0.5, 0.5)
  })
}

// returns boolean based on if a ship occupies a particular position
function isShipPosition (position) {
  let isShip = false

  _.forEach(shipList, (ship) => {
    if (ship.currentPosition === position) {
      isShip = true
    }
  })

  return isShip
}

// returns the ship at a particular position
function getShipFromPosition (position) {
  let ship

  _.forEach(shipList, (boat) => {
    if (position === boat.currentPosition) {
      ship = boat
    }
  })

  return ship
}

// returns the direction side of the rammed ship that is hit
// parameters are the starting and ending location of the ramming ship
function hitLocation (starting, ending) {
  let moveIndex, direction
  console.log('hit start: ', starting, 'hit end: ', ending)

  _.forEach(trackPositions, (pos) => {
    if (pos.name === starting) {
      // look up the move of the ramming ship
      // indexOf returns first truthy value. Should be OK since moves are in the first three indexes
      moveIndex = _.indexOf(pos.moves, ending)
    }
  })

  // postions move array is clockwise around ship starting with front left
  // 0: front left
  // 1: front center
  // 2: front right
  // 3: rear right
  // 4: rear center
  // 5: rear left
  if (moveIndex === 0) {
    // if they are moving to the left, we get hit on the right
    direction = 'right'
  } else if (moveIndex === 1) {
    // if they are moving forward, we get hit in the rear
    direction = 'rear'
  } else if (moveIndex === 2) {
    // if they are moving to the right, we get hit on the left
    direction = 'left'
  } else if (moveIndex === 5) {
    // if they are knocked back to the left, we get hit on the right
    direction = 'right'
  } else if (moveIndex === 3) {
    // if they are knocked back to the right, we get hit on the left
    direction = 'left'
  } else {
    direction = 'front'
  }

  return direction
}

// returns a position object given the position name
function getPositionFromName (postionName) {
  return _.find(trackPositions, ['name', postionName])
}

// returns a postions object given an x/y pixel coordinate
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
  console.log('moving ship: ', ship.key, start.name, end.name)

  if (isShipPosition(end.name) === true) {
    let rammed = getShipFromPosition(end.name)
    console.log('detected ship at: ', rammed.key, rammed.currentPosition)
    let location = hitLocation(start.name, end.name)
    shipCollide.dispatch(location, rammed)
  }

  ship.currentPosition = end.name

  game.add.tween(ship).to({ x: end.x, y: end.y }, 500, Phaser.Easing.Back.Out, true)
  game.add.tween(ship).to({ angle: end.angle }, 500, Phaser.Easing.Back.Out, true)
}

// 'ship' is the ship being rammed
//
function ramming (location, ship) {
  let moveTo,
    moveIndex,
    position,
    currentPosition = ship.currentPosition

  console.log('ramming ship: ', ship.key, ship.currentPosition)

  position = getPositionFromName(ship.currentPosition)
  console.log('direction: ', location)

  // if it's from the rear there's a 50/50 chance going right or left
  if (location === 'rear') {
    location = _.sample(['left', 'right'])
  }

  // if they hit from the front, they should be coming off a wall
  // we bounce off that wall. Need to check the rear positions we'll move into
  if (location === 'front') {
    if (position.moves[3] === '') {
      location = 'right'
    } else if (position.moves[5] === '') {
      location = 'left'
    }
  }

  console.log('new dir: ', location)

  if (location === 'left') {
    // if hit from the left, move right
    moveIndex = 3
  } else if (location === 'right') {
    // if hit from the right, move left
    moveIndex = 5
  }

  if (position.moves[moveIndex] === '') {
    // if hitting a wall, go back
    moveIndex = 4
  }

  moveTo = position.moves[moveIndex]

  console.log('move index: ', moveIndex)

  console.log('move to: ', moveTo)

  if (moveTo !== '') {
    game.time.events.add(100, function () {
      game.camera.shake(0.0125, 100)
      shipMove(ship, currentPosition, moveTo, true)
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
