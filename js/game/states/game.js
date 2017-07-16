'use strict'
const _ = require('lodash')
const trackPositions = require('./track-positions.js')

var game = {}, map, ocean, track, islands, black_ship_1, speed = 100, keySpace, space = 1

game.create = function () {
  game.physics.startSystem(Phaser.Physics.ARCADE)
  map = game.add.tilemap('map')
  map.addTilesetImage('water-tile', 'water')
  ocean = map.createLayer('Water')
  islands = map.createLayer('Islands')

  track = game.add.sprite(0, 265, 'track')
  black_ship_1 = game.add.sprite(1423, 432, 'black_ship_1')
  black_ship_1.scale.setTo(0.6)
  black_ship_1.angle = 90
  black_ship_1.anchor.setTo(0.5, 0.5)
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

  game.physics.arcade.enable(black_ship_1, true)

  keySpace = game.input.keyboard.addKey(Phaser.KeyCode.SPACEBAR)
  keySpace.onDown.add(log)

}

function log () {
  let ship, x, y, angle
  x = Math.round(black_ship_1.x)
  y = Math.round(black_ship_1.y)
  angle = Math.round(black_ship_1.angle)

  console.log(`{ "position": "x${space}", "x": ${x}, "y": ${y}, "angle": ${angle} }`)
  space++
  ship = game.add.sprite(black_ship_1.x, black_ship_1.y, 'black_ship_1')
  ship.angle = black_ship_1.angle
  ship.scale.setTo(0.6)
  ship.anchor.setTo(0.5, 0.5)
}

function postionOverlay () {
  let text

  _.forEach(trackPositions, (pos) => {
    text = game.add.text(pos.x, pos.y, pos.position)
    text.anchor.setTo(0.5, 0.5)
  })
}

game.update = function () {
  black_ship_1.body.velocity.x = 0
  black_ship_1.body.velocity.y = 0

  if (game.input.keyboard.isDown(Phaser.Keyboard.O)) {
    postionOverlay()
  }

  if (game.input.keyboard.isDown(Phaser.Keyboard.A)) {
    black_ship_1.angle -= 1
  }

  if (game.input.keyboard.isDown(Phaser.Keyboard.S)) {
    black_ship_1.angle += 1
  }

  if (game.input.keyboard.isDown(Phaser.Keyboard.LEFT)) {
    black_ship_1.body.velocity.x -= speed
  } else if (game.input.keyboard.isDown(Phaser.Keyboard.RIGHT)) {
      black_ship_1.body.velocity.x += speed
    } else if (game.input.keyboard.isDown(Phaser.Keyboard.DOWN)) {
      black_ship_1.body.velocity.y += speed
    } else if (game.input.keyboard.isDown(Phaser.Keyboard.UP)) {
      black_ship_1.body.velocity.y -= speed
    }
}

module.exports = game
