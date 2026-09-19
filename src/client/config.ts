/** Phaser display configuration — matches the original 1920×1080 track art. */
export const DISPLAY = {
    width: 1920,
    height: 720,
    backgroundColor: '#0b3d5c',
} as const;

/** Tiled tileset names inside race-course-tilemap.json (do not rename without updating the JSON). */
export const ISLAND_TILESETS = [
    'tile_01',
    'tile_02',
    'tile_03',
    'tile_17',
    'tile_19',
    'tile_33',
    'tile_34',
    'tile_35',
    'tile_51',
    'tile_66',
    'tile_69',
] as const;

export const ASSETS = {
    map: {
        tilemapKey: 'raceCourse',
        tilemapPath: 'assets/map/race-course-tilemap.json',
        oceanTilesetName: 'water-tile',
        oceanImageKey: 'oceanWater',
        oceanImagePath: 'assets/map/ocean-water-tile.png',
        trackOverlayKey: 'raceTrackOverlay',
        trackOverlayPath: 'assets/map/race-track-overlay.png',
        islandImagePath(id: string) {
            return `assets/map/island-tileset-${id.replace('tile_', '')}.png`;
        },
    },
    ships: {
        /** Spritesheet frames: normal, active-turn, ghost, light-damage, heavy-damage, wreck */
        frameWidth: 46,
        frameHeight: 79,
        roster: [
            { color: 'red', textureKey: 'shipRed', path: 'assets/ships/ship-red-race-states.png' },
            { color: 'blue', textureKey: 'shipBlue', path: 'assets/ships/ship-blue-race-states.png' },
            { color: 'black', textureKey: 'shipBlack', path: 'assets/ships/ship-black-race-states.png' },
            { color: 'green', textureKey: 'shipGreen', path: 'assets/ships/ship-green-race-states.png' },
            { color: 'yellow', textureKey: 'shipYellow', path: 'assets/ships/ship-yellow-race-states.png' },
            { color: 'white', textureKey: 'shipWhite', path: 'assets/ships/ship-white-race-states.png' },
        ] as const,
        textureKeyForColor(color: string) {
            const match = ASSETS.ships.roster.find((entry) => entry.color === color);
            return match?.textureKey ?? 'shipRed';
        },
    },
    props: {
        dinghyLarge: [
            'assets/props/dinghy-large-north.png',
            'assets/props/dinghy-large-east.png',
            'assets/props/dinghy-large-south.png',
        ],
        dinghySmall: [
            'assets/props/dinghy-small-north.png',
            'assets/props/dinghy-small-east.png',
            'assets/props/dinghy-small-south.png',
        ],
    },
    audio: {
        hullImpact: 'hull-impact',
        boardingClash: 'boarding-clash',
        shipWreck: 'ship-wreck',
        shipBell: 'ship-bell',
        mutinyBell: 'mutiny-bell',
    },
} as const;

export const SHIP_FRAME = {
    normal: 0,
    active: 1,
    ghost: 2,
    damageLight: 3,
    damageHeavy: 4,
    wreck: 5,
} as const;
