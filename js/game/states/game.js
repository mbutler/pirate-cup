'use strict'
const _ = require('lodash')
const fs = require('fs')
const trackPositions = require('./track.js')
const stats = require('./stats.js')

let game = {}, map, ocean, track, islands, blackShip, yellowShip, greenShip, redShip, blueShip, whiteShip, keyP, shipList = [], shipCollide, currentShip

game.create = function () {
  game.physics.startSystem(Phaser.Physics.ARCADE)
  map = game.add.tilemap('map')
  map.addTilesetImage('water-tile', 'water')
  ocean = map.createLayer('Water')
  islands = map.createLayer('Islands')
  track = game.add.sprite(0, 265, 'track')

  redShip = makeShip('redShip', 'a10')
  game.add.existing(redShip)

  blueShip = makeShip('blueShip', 'c15')
  game.add.existing(blueShip)

  //blackShip = makeShip('blackShip', 'b1')
  //game.add.existing(blackShip)

  //greenShip = makeShip('greenShip', 'c40')
  //game.add.existing(greenShip)

  //yellowShip = makeShip('yellowShip', 'd1')
  //game.add.existing(yellowShip)

  //whiteShip = makeShip('whiteShip', 'a30')
  //game.add.existing(whiteShip)

  //shipList.push(redShip, blueShip, blackShip, greenShip, yellowShip, whiteShip)
  shipList.push(redShip, blueShip)

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

  currentShip = shipList[0]
  currentShip.stats.movement = currentShip.stats.speed
  chooseMove(currentShip)
}

function makeShip (name, startingPositionName) {
  let start = getPositionFromName(startingPositionName)
  let ship = game.make.sprite(start.x, start.y, name)
  ship.anchor.setTo(0.5, 0.5)
  ship.angle = start.angle
  ship.currentPosition = start
  ship.stats = _.cloneDeep(stats)
  ship.animations.add('normal', [0], 0, true)
  ship.animations.add('stroke', [1], 0, true)
  ship.animations.add('grey', [2], 0, true)
  ship.animations.add('damage1', [3], 0, true)
  ship.animations.add('damage2', [4], 0, true)
  ship.animations.add('wreck', [5], 0, true)

  return ship
}

function test () {
  // shipCollide.dispatch()
  // console.log(hitLocation('d38', 'a1'))
  // console.log(blackShip.currentPosition)
  // console.log(isShipPosition('a14'))
  // shipMove(blackShip, 'c32', 'c33')
  // currentShip.animations.play('stroke', true)
  // nextShip()
  currentShip.stats.speed = 8
}

// resolve a card. For some reason we have to update the ship's drift value inside this function instead of returning it
function drawCorneringCards (ship) {
  let chance = _.random(1, 60)
  let result

  console.log("drawing cornering card: " + chance)

  ship.stats.cornerCards -= 1

  if (chance <= 30) {
    console.log('Hold the corner')   

    // keep drawing 'hold the corners' until we can't  
    if (ship.stats.cornerCards > 0) {      
      console.log("corner cards: " + ship.stats.cornerCards) 
      drawCorneringCards(ship)
    }
  } else if (chance > 30 && chance <= 45) {
    console.log('Slide out 1')
    ship.stats.drift = 1
    ship.stats.isDrifting = true   
    
  } else if (chance > 45 && chance <= 51) {
    console.log('Slide out 2')
    ship.stats.drift = 2
    ship.stats.isDrifting = true   
    
  } else if (chance > 51 && chance <= 57) {
    console.log('May move in 1')
    ship.stats.drift = -1
    ship.stats.isDrifting = true    
    
  } else if (chance > 57) {
    console.log('Slide out 3')
    ship.stats.drift = 3
    ship.stats.isDrifting = true 
    
    
  }

  
}

// find the difference between the speed limit and our speed. That's how many cards we draw
function speedCheck (ship) {  
  let cards = 0
  if (ship.currentPosition.speed !== undefined) {
    if (ship.stats.speed > ship.currentPosition.speed) {
      console.log("going too fast!")
      cards = ship.stats.speed - ship.currentPosition.speed
      console.log("ship speed " + ship.stats.speed + " minus " + ship.currentPosition.speed)
    }    
  }

  return cards
}

// returns boolean based on if a ship occupies a particular position
function isShipPosition (positionName) {
  let isShip = false

  _.forEach(shipList, (ship) => {
    if (ship.currentPosition.name === positionName) {
      isShip = true
    }
  })

  return isShip
}

// returns the ship at a particular position
function getShipFromPosition (positionName) {
  let ship

  _.forEach(shipList, (boat) => {
    if (positionName === boat.currentPosition.name) {
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
  console.log("movement points: " + ship.stats.movement)

  // if there is a ship where we are moving, dispatch the ship collision signal
  if (isShipPosition(end.name) === true) {
    let rammed = getShipFromPosition(end.name)
    console.log('detected ' + rammed.key + ' at: ' + rammed.currentPosition.name)
    let location = hitLocation(start.name, end.name)
    shipCollide.dispatch(location, rammed, ship)
  }

  // update with new ship postion
  ship.currentPosition = getPositionFromName(end.name)  

  // if we don't have any cornering cards already and we're not drifting
  // then draw the right number of cornering cards
  if (ship === currentShip && ship.stats.isDrifting === false) {
    ship.stats.cornerCards = speedCheck(ship)
    console.log("corner cards: " + ship.stats.cornerCards)            
  }

  // if we DO have some cornering cards left and we're not drifting
  // resolve the next cornering card
  if (ship.stats.cornerCards > 0) {    
    drawCorneringCards(ship)
    console.log("drift: " + ship.stats.drift)    
    console.log("corner cards: " + ship.stats.cornerCards) 
  }  

  // ship movement animation
  moveTween = game.add.tween(ship).to({ x: end.x, y: end.y }, 500, Phaser.Easing.Back.Out, true)
  game.add.tween(ship).to({ angle: end.angle }, 500, Phaser.Easing.Back.Out, true)

  // if the ship being moved is our current ship, choose move again when animation is done
  // if we're not drifting, let us choose our next move
  if (ship === currentShip && ship.stats.isDrifting === false) {    
      moveTween.onComplete.addOnce(function () { 
        
        chooseMove(currentShip) }, this)    
  } else if (ship === currentShip) {
    // if we are drifting, update drift value and move the ship unless it's a wall, in which case resolve wall table
    if (ship.stats.drift > 0) {
      console.log('sliding out!')
      ship.stats.drift -= 1
      
      moveTween.onComplete.addOnce(function () {
        if (ship.currentPosition.moves[2] !== 'wall') {
          shipMove(ship, ending, ship.currentPosition.moves[2])
        } else {
          console.log("On the Wall table")
          game.camera.shake(0.0125, 100)
        }
      })
    } else if (ship.stats.drift === -1) {
      console.log('move in!')
      ship.stats.drift += 1
      
      moveTween.onComplete.addOnce(function () {
        if (ship.currentPosition.moves[1] !== 'wall') {
          shipMove(ship, ending, ship.currentPosition.moves[1])
        } else {
          console.log("On the Wall table")
          game.camera.shake(0.0125, 100)
        }
      })
    } else if (ship.stats.speed > 0) {
      moveTween.onComplete.addOnce(function () { 
        
        chooseMove(currentShip) }, this) 
    }
  }
}

// returns an array of all possible moves for a ship
function getPossibleMoves (ship) {
  let position = ship.currentPosition
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
  currentShip.stats.movement = currentShip.stats.speed

  chooseMove(currentShip)
}

// kicks off the move selection process
function chooseMove (ship) {
  _.forEach(shipList, (ship) => {
    ship.animations.play('normal', true)
    ship.alpha = 1
    ship.stats.isDrifting = false
  })

  if (ship.stats.movement > 0) {    
    let ghostGroup = displayPossibleMoves(ship)
    toggleSelection(ship, ghostGroup)
  } else {
    nextShip()
  }
}

// loops through the ghostGroup and looks for alphas
function highlightSelectedGhost (ghostGroup, selection) {
  // set all highlights to default
  for (let i = 0; i < ghostGroup.children.length; i++) {
    let ghostShip = ghostGroup.children[i]
    ghostShip.alpha = 0.15
  }

  // pick the correct highlight for selected ship
  for (let i = 0; i < ghostGroup.children.length; i++) {
    let ghostShip = ghostGroup.children[i]
    if (selection === ghostShip.currentPosition.name) {
      ghostShip.alpha = 0.5
    }
  }
}

// adds three keys and loops through the possible ghost ships
function toggleSelection (ship, ghostGroup) {
  let keyLeft = game.input.keyboard.addKey(Phaser.Keyboard.LEFT)
  let keyRight = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT)
  let keyEnter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER)

  // make the first position the default move
  let index = 0
  let currentSelection = ghostGroup.children[index]
  highlightSelectedGhost(ghostGroup, currentSelection.currentPosition.name)

  keyLeft.onDown.add(function () {
    index--
    if (index < 0) { index = ghostGroup.children.length - 1 }
    currentSelection = ghostGroup.children[index]
    highlightSelectedGhost(ghostGroup, currentSelection.currentPosition.name)
  })

  keyRight.onDown.add(function () {
    index++
    if (index > ghostGroup.children.length - 1) { index = 0 }
    currentSelection = ghostGroup.children[index]
    highlightSelectedGhost(ghostGroup, currentSelection.currentPosition.name)
  })

  keyEnter.onDown.add(function () {
    ghostGroup.destroy()
    game.input.keyboard.removeKey(Phaser.Keyboard.LEFT)
    game.input.keyboard.removeKey(Phaser.Keyboard.RIGHT)
    game.input.keyboard.removeKey(Phaser.Keyboard.ENTER)
    ship.stats.movement -= 1
    shipMove(ship, ship.currentPosition.name, currentSelection.currentPosition.name)
  })
}

// adds sprites with alphas for all the possible moves
function displayPossibleMoves (ship) {
  let moves = getPossibleMoves(ship)
  let ghostGroup = game.add.group()

  // iterate over all possible moves, adding a "ghost" ship in each position
  _.forEach(moves, (ghostPosition) => {
    let position = getPositionFromName(ghostPosition)
    let ghostShip = game.add.sprite(position.x, position.y, ship.key)
    ghostShip.anchor.setTo(0.5, 0.5)
    ghostShip.angle = position.angle
    ghostShip.currentPosition = getPositionFromName(ghostPosition)

    // if there is a ship there, grey it out
    if (isShipPosition(position.name)) {
      let greyShip = getShipFromPosition(position.name)
      greyShip.alpha = 0.4
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

  console.log('ramming ship: ', rammed.key, rammed.currentPosition.name)

  position = rammed.currentPosition
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
      shipMove(rammed, rammed.currentPosition.name, moveTo)
    }, this)
  }
}

game.update = function () {
  currentShip.animations.play('stroke', true)
}

module.exports = game
