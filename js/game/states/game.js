'use strict'
const _ = require('lodash')
const fs = require('fs')
const trackPositions = require('./track.js')
const stats = require('./stats.js')

var game = {}, map, ocean, track, islands, blackShip, yellowShip, greenShip, redShip, blueShip,
  keyP, blackShipStart, yellowShipStart, greenShipStart, redShipStart, blueShipStart, shipList = [], shipCollide, currentShip, ghostGroup

game.create = function () {
  game.physics.startSystem(Phaser.Physics.ARCADE)
  map = game.add.tilemap('map')
  map.addTilesetImage('water-tile', 'water')
  ocean = map.createLayer('Water')
  islands = map.createLayer('Islands')
  track = game.add.sprite(0, 265, 'track')

  blackShipStart = getPositionFromName('c32')
  blackShip = game.add.sprite(blackShipStart.x, blackShipStart.y, 'blackShip')
  blackShip.scale.setTo(0.6)
  blackShip.angle = blackShipStart.angle
  blackShip.anchor.setTo(0.5, 0.5)
  blackShip.currentPosition = blackShipStart.name
  blackShip.stats = _.cloneDeep(stats)

  yellowShipStart = getPositionFromName('d36')
  yellowShip = game.add.sprite(yellowShipStart.x, yellowShipStart.y, 'yellowShip')
  yellowShip.scale.setTo(0.6)
  yellowShip.angle = yellowShipStart.angle
  yellowShip.anchor.setTo(0.5, 0.5)
  yellowShip.currentPosition = yellowShipStart.name
  yellowShip.stats = _.cloneDeep(stats)

  greenShipStart = getPositionFromName('d35')
  greenShip = game.add.sprite(greenShipStart.x, greenShipStart.y, 'greenShip')
  greenShip.scale.setTo(0.6)
  greenShip.angle = greenShipStart.angle
  greenShip.anchor.setTo(0.5, 0.5)
  greenShip.currentPosition = greenShipStart.name
  greenShip.stats = _.cloneDeep(stats)

  redShipStart = getPositionFromName('b30')
  redShip = game.add.sprite(redShipStart.x, redShipStart.y, 'redShip')
  redShip.scale.setTo(0.6)
  redShip.angle = redShipStart.angle
  redShip.anchor.setTo(0.5, 0.5)
  redShip.currentPosition = redShipStart.name
  redShip.stats = _.cloneDeep(stats)

  blueShipStart = getPositionFromName('c33')
  blueShip = game.add.sprite(blueShipStart.x, blueShipStart.y, 'blueShip')
  blueShip.scale.setTo(0.6)
  blueShip.angle = blueShipStart.angle
  blueShip.anchor.setTo(0.5, 0.5)
  blueShip.currentPosition = blueShipStart.name
  blueShip.stats = _.cloneDeep(stats)

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

  shipCollide = new Phaser.Signal()
  shipCollide.add(ramming, this)

  currentShip = blackShip
  chooseMove(currentShip)
}

function test () {
  // shipCollide.dispatch()
  // console.log(hitLocation('d38', 'a1'))
  // console.log(blackShip.currentPosition)
  // console.log(isShipPosition('a14'))
  // shipMove(blackShip, 'c32', 'c33')
  nextShip()
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

// returns the side of the rammed ship that is hit
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

function doDamage (rammer, rammed, location) {
  if (location === 'left') {
    rammed.stats.leftHP -= 6
    console.log(rammed.key + ' now has ' + rammed.stats.leftHP + ' hp on left side')
    rammer.stats.rightHP -= 3
    console.log(rammer.key + ' now has ' + rammer.stats.rightHP + ' hp on right side')
  } else if (location === 'right') {
    rammed.stats.rightHP -= 6
    console.log(rammed.key + ' now has ' + rammed.stats.rightHP + ' hp on right side')
    rammer.stats.leftHP -= 3
    console.log(rammer.key + ' now has ' + rammer.stats.leftHP + ' hp on left side')
  } else if (location === 'rear') {
    rammed.stats.rearHP -= 6
    console.log(rammed.key + ' now has ' + rammed.stats.rearHP + ' hp on rear side')
    rammer.stats.mastHP -= 4
    rammer.stats.frontHP -= 2
    console.log(rammer.key + ' now has ' + rammer.stats.mastHP + ' hp on mast and ' + rammer.stats.frontHP + ' on front')
  }
}

function shipMove (ship, starting, ending) {
  let start = getPositionFromName(starting)
  let end = getPositionFromName(ending)
  let moveTween
  console.log('moving ship: ', ship.key, start.name, end.name)

  // if there is a ship where we are moving, dispatch the ship collision signal
  if (isShipPosition(end.name) === true) {
    let rammed = getShipFromPosition(end.name)
    console.log('detected ' + rammed.key + ' at: ' + rammed.currentPosition)
    let location = hitLocation(start.name, end.name)
    shipCollide.dispatch(location, rammed, ship)
  }

  // update with new ship postion
  ship.currentPosition = end.name

  // ship movement animation
  moveTween = game.add.tween(ship).to({ x: end.x, y: end.y }, 500, Phaser.Easing.Back.Out, true)
  game.add.tween(ship).to({ angle: end.angle }, 500, Phaser.Easing.Back.Out, true)

  // if the ship being moved is our current ship, choose move again when animation is done
  if (ship === currentShip) {
    moveTween.onComplete.addOnce(function () { chooseMove(currentShip) }, this)
  }
}

// returns an array of all possible moves for a ship
function getPossibleMoves (ship) {
  let position = getPositionFromName(ship.currentPosition)
  let moves = _.take(position.moves, 3)
  moves = _.pull(moves, 'wall')

  return moves
}

function nextShip () {
  let index = _.indexOf(shipList, currentShip)
  let nextIndex = index + 1
  let nextShip

  if (nextIndex > shipList.length - 1) {
    nextIndex = 0
  }

  nextShip = shipList[nextIndex]

  currentShip = nextShip
  currentShip.stats.speed = 2

  chooseMove(currentShip)
}

// kicks off the move selection process
function chooseMove (ship) {
  if (ship.stats.speed > 0) {
    let shipPosition = getPositionFromName(ship.currentPosition)
    let ghostGroup = displayPossibleMoves(ship)
    toggleSelection(ship, ghostGroup)
    ship.stats.speed--
  } else {
    nextShip()
  }
}

// loops through the ghostGroup and looks for tints and alphas
function highlightSelectedGhost (ghostGroup, selection) {
  let i, j

  // set all highlights to default
  for (j = 0; j < ghostGroup.children.length; j++) {
    let ghostShip = ghostGroup.children[j]

    if (ghostShip.alpha === 1) {
      ghostShip.tint = 0x454545
    } else {
      ghostShip.alpha = 0.35
    }
  }

  // pick the correct highlight for selected ship
  for (i = 0; i < ghostGroup.children.length; i++) {
    let ghostShip = ghostGroup.children[i]
    if (selection === ghostShip.currentPosition) {
      if (ghostShip.alpha === 1) {
        ghostShip.tint = 0xf93807
      } else {
        ghostShip.alpha = 0.7
      }
    }
  }
}

// adds three keys and loops through the possible ghost ships
function toggleSelection (ship, ghostGroup) {
  let keyLeft = game.input.keyboard.addKey(Phaser.Keyboard.LEFT)
  let keyRight = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT)
  let keyEnter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER)

  // make the middle position the default move
  let index = 0
  let currentSelection = ghostGroup.children[index]
  highlightSelectedGhost(ghostGroup, currentSelection.currentPosition)

  keyLeft.onDown.add(function () {
    index--
    if (index < 0) { index = ghostGroup.children.length - 1 }
    currentSelection = ghostGroup.children[index]
    highlightSelectedGhost(ghostGroup, currentSelection.currentPosition)
  })

  keyRight.onDown.add(function () {
    index++
    if (index > ghostGroup.children.length - 1) { index = 0 }
    currentSelection = ghostGroup.children[index]
    highlightSelectedGhost(ghostGroup, currentSelection.currentPosition)
  })

  keyEnter.onDown.add(function () {
    ghostGroup.destroy()
    game.input.keyboard.removeKey(Phaser.Keyboard.LEFT)
    game.input.keyboard.removeKey(Phaser.Keyboard.RIGHT)
    game.input.keyboard.removeKey(Phaser.Keyboard.ENTER)
    shipMove(ship, ship.currentPosition, currentSelection.currentPosition)
  })
}

// adds sprites with tints and alphas for all the possible moves
function displayPossibleMoves (ship) {
  let moves = getPossibleMoves(ship)
  let ghostGroup = game.add.group()

  // iterate over all possible moves, adding a "ghost" ship in each position
  _.forEach(moves, (ghostPosition) => {
    let position = getPositionFromName(ghostPosition)
    let ghostShip = game.add.sprite(position.x, position.y, ship.key)
    ghostShip.anchor.setTo(0.5, 0.5)
    ghostShip.angle = position.angle
    ghostShip.currentPosition = ghostPosition

    // if there is a ship there, simulate an outline
    if (isShipPosition(position.name)) {
      // make it just a little bigger than normal to simulate outline
      ghostShip.scale.setTo(0.7)
      ghostShip.alpha = 1
      // dark grey
      ghostShip.tint = 0x454545
    } else {
      ghostShip.scale.setTo(0.6)
      ghostShip.alpha = 0.25      
    }

    ghostGroup.add(ghostShip)
  })

  // position it just right
  game.world.sendToBack(ghostGroup)
  game.world.moveUp(ghostGroup)
  game.world.moveUp(ghostGroup)

  return ghostGroup
}

// 'rammed' is the ship being rammed
// 'rammer' is the attacking ship doing the ramming
// location is the side of the rammed ship that is being hit
function ramming (location, rammed, rammer) {
  let moveTo,
    moveIndex,
    position

  console.log('ramming ship: ', rammed.key, rammed.currentPosition)

  position = getPositionFromName(rammed.currentPosition)
  console.log('direction: ', location)

  // if they hit from the front, they should be coming off a wall
  // we bounce off that wall. Need to check the rear positions we'll move into
  if (location === 'front') {
    if (position.moves[3] === 'wall') {
      location = 'right'
    } else if (position.moves[5] === 'wall') {
      location = 'left'
    }
  }

  // need to calculate damge right here before the rear location changes to right or left for movement
  doDamage(rammer, rammed, location)

  // if it's from the rear there's a 50/50 chance of moving right or left
  if (location === 'rear') {
    location = _.sample(['left', 'right'])
  }

  console.log('new dir: ', location)

  if (location === 'left') {
    // if hit from the left, move right
    moveIndex = 3
  } else if (location === 'right') {
    // if hit from the right, move left
    moveIndex = 5
  }

  if (position.moves[moveIndex] === 'wall') {
    // if hitting a wall, go back
    moveIndex = 4
  }

  moveTo = position.moves[moveIndex]

  console.log('move index: ', moveIndex)

  console.log('move to: ', moveTo)

  if (moveTo !== 'wall') {
    game.time.events.add(100, function () {
      game.camera.shake(0.0125, 100)
      shipMove(rammed, rammed.currentPosition, moveTo)
    }, this)
  }
}

game.update = function () {

}

module.exports = game
