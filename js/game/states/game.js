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

  blackShipStart = getPositionFromName('c20')
  blackShip = game.add.sprite(blackShipStart.x, blackShipStart.y, 'blackShip')
  blackShip.scale.setTo(0.6)
  blackShip.angle = blackShipStart.angle
  blackShip.anchor.setTo(0.5, 0.5)
  blackShip.currentPosition = blackShipStart.name

  yellowShipStart = getPositionFromName('d23')
  yellowShip = game.add.sprite(yellowShipStart.x, yellowShipStart.y, 'yellowShip')
  yellowShip.scale.setTo(0.6)
  yellowShip.angle = yellowShipStart.angle
  yellowShip.anchor.setTo(0.5, 0.5)
  yellowShip.currentPosition = yellowShipStart.name

  greenShipStart = getPositionFromName('d22')
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
  shipMove(blackShip, 'c20', 'd23')
}

function hitLocation (starting, ending) {
  let moveIndex, direction
  console.log('hit start: ', starting, 'hit end: ', ending)

  _.forEach(trackPositions, (pos) => {
    if (pos.name === starting) {
      // look up the move of the ramming ship
      moveIndex = _.indexOf(pos.moves, ending)
    }
  })

  // postions move array is left to right
  // 0: left
  // 1: center
  // 2: right
  if (moveIndex === 0) {
    // if they are moving to the left, we get hit on the right
    direction = 'right'
  } else if (moveIndex === 1) {
    // if they are moving forward, we get hit in the rear
    direction = 'rear'
  } else if (moveIndex === 2) {
    // if they are moving to the right, we get hit on the left
    direction = 'left'
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

// returns the position directly behind
function rear (position) {
  let letter = position.charAt(0)
  let number = position.substr(1)
  let newNumber = _.parseInt(number) - 1
  let newPosition = letter + _.toString(newNumber)

  if (position === 'a1') {
    newPosition = 'a30'
  } else if (position === 'b1') {
    newPosition = 'b36'
  } else if (position === 'c1') {
    newPosition = 'c40'
  } else if (position === 'd1') {
    newPosition = 'd44'
  }

  return newPosition
}

function front (position) {
  let letter = position.charAt(0)
  let number = position.substr(1)
  let newNumber = _.parseInt(number) + 1
  let newPosition = letter + _.toString(newNumber)

  if (position === 'a1') {
    newPosition = 'a30'
  } else if (position === 'b1') {
    newPosition = 'b36'
  } else if (position === 'c1') {
    newPosition = 'c40'
  } else if (position === 'd1') {
    newPosition = 'd44'
  }

  return newPosition
}

function shipMove (ship, starting, ending, ramming) {
  let start = getPositionFromName(starting)
  let end = getPositionFromName(ending)
  let moveTween, angleTween

  console.log('moving ship: ', ship.key, start.name, end.name)

  // if we're ramming, we need to shift positions back one
  if (ramming) {
    end = rear(end.name)
    end = getPositionFromName(end)
    start = rear(start.name)
    start = getPositionFromName(start)
  }

  if (isShipPosition(end.name) === true) {
    let rammed = getShipFromPosition(end.name)
    console.log('detected ship at: ', rammed.key, rammed.currentPosition)
    let location = hitLocation(start.name, end.name)
    shipCollide.dispatch(location, rammed)
  }

  // don't run rear() on the position if it hit the wall and is falling back
  // otherwise it will go back one position too far
  // check to see if the intended position is right behind and then keep it that way
  if (ramming && (end.name === rear(start.name))) {
    end = getPositionFromName(ending)
    start = getPositionFromName(starting)
  }

  moveTween = game.add.tween(ship).to({ x: end.x, y: end.y }, 500, Phaser.Easing.Back.Out, true)
  angleTween = game.add.tween(ship).to({ angle: end.angle }, 500, Phaser.Easing.Back.Out, true)

  moveTween.onComplete.addOnce(function () { ship.currentPosition = end.name }, this)
}

function ramming (direction, ship) {
  let moveTo, moveIndex, position, currentPosition = ship.currentPosition

  console.log('ramming ship: ', ship.key, ship.currentPosition)

  position = getPositionFromName(ship.currentPosition)
  console.log('direction: ', direction)

  // if it's from the rear it's 50/50 chance going right or left
  if (direction === 'rear') {
    direction = _.sample(['left', 'right'])
  }

  console.log('new dir: ', direction)
  // postions move array is left to right
  // 0: left
  // 1: center
  // 2: right
  if (direction === 'left') {
    // if hit from the left, move right
    moveIndex = 2
  } else if (direction === 'right') {
    // if hit from the right, move left
    moveIndex = 0
  }

   if (position.moves[moveIndex] === '') {
    // if hit from left, bounce off wall
    moveTo = rear(currentPosition)
  } else {
    moveTo = position.moves[moveIndex]
  }

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
