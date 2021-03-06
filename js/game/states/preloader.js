var preloader = {}

preloader.preload = function () {
  this.game.load.tilemap('map', 'images/map.json', null, Phaser.Tilemap.TILED_JSON)
  this.game.load.image('water', 'images/water-tile.png')
  this.game.load.image('track', 'images/track.png')
  this.game.load.image('tile_01', 'images/tile_01.png')
  this.game.load.image('tile_17', 'images/tile_17.png')
  this.game.load.image('tile_33', 'images/tile_33.png')
  this.game.load.image('tile_02', 'images/tile_02.png')
  this.game.load.image('tile_03', 'images/tile_03.png')
  this.game.load.image('tile_19', 'images/tile_19.png')
  this.game.load.image('tile_35', 'images/tile_35.png')
  this.game.load.image('tile_34', 'images/tile_34.png')
  this.game.load.image('tile_69', 'images/tile_69.png')
  this.game.load.image('tile_66', 'images/tile_66.png')
  this.game.load.image('tile_51', 'images/tile_51.png')
  // this.game.load.image('blackShip', 'images/black_ship_1.png')
  // this.game.load.image('yellowShip', 'images/yellow_ship_1.png')
  // this.game.load.image('greenShip', 'images/green_ship_1.png')
  // this.game.load.image('blueShip', 'images/blue_ship_1.png')
  // this.game.load.image('redShip', 'images/red_ship_1.png')
  this.game.load.spritesheet('redShip', 'images/red-ship-spritesheet.png', 46, 79)
  this.game.load.spritesheet('blueShip', 'images/blue-ship-spritesheet.png', 46, 79)
  this.game.load.spritesheet('blackShip', 'images/black-ship-spritesheet.png', 46, 79)
  this.game.load.spritesheet('greenShip', 'images/green-ship-spritesheet.png', 46, 79)
  this.game.load.spritesheet('yellowShip', 'images/yellow-ship-spritesheet.png', 46, 79)
  this.game.load.spritesheet('whiteShip', 'images/white-ship-spritesheet.png', 46, 79)

}

preloader.create = function () {
  this.game.state.start('game')
}

module.exports = preloader