// Linked chambers, causeways and two sealed wings of the flooded dungeon.
export function configureDungeonMap(map) {
  Object.assign(map, {
    name: "The Drowned Vault",
    width: 2900,
    height: 2200,
    cx: 1450,
    cy: 1100,
    bounds: { left: 0, top: 0, width: 2900, height: 2200 },
    dungeonStage: 0,
    rooms: [
      { x: 150, y: 1450, w: 650, h: 550, label: "THE DESCENT" },
      { x: 1050, y: 1450, w: 650, h: 550, label: "TIDAL WARD" },
      { x: 2050, y: 1450, w: 650, h: 550, label: "THE MENAGERIE" },
      { x: 2050, y: 500, w: 650, h: 600, section: 1, label: "KEEPER OF KEYS" },
      { x: 850, y: 150, w: 850, h: 650, section: 2, label: "THE SEALED VAULT" },
      { x: 150, y: 500, w: 550, h: 600, label: "THE FORGOTTEN WELL" },
    ],
    gates: [
      { x: 2290, y: 1430, w: 170, h: 36, section: 1, label: "TIDAL SEAL" },
      { x: 1790, y: 650, w: 36, h: 170, section: 2, label: "VAULT LOCK" },
    ],
    entry: { x: 390, y: 1830 },
  });
  map.shapes = [
    ...map.rooms,
    { x: 730, y: 1640, w: 390, h: 190 },
    { x: 1630, y: 1640, w: 490, h: 190 },
    { x: 2290, y: 1000, w: 170, h: 530, section: 1 },
    { x: 1810, y: 650, w: 320, h: 170, section: 1 },
    { x: 1630, y: 650, w: 220, h: 170, section: 2 },
    { x: 330, y: 1030, w: 190, h: 500 },
    { x: 630, y: 1120, w: 570, h: 180 },
    { x: 1050, y: 1120, w: 190, h: 400 },
    { x: 570, y: 1000, w: 190, h: 250 },
  ];
  map.navigation = [
    [390, 1830],
    [440, 1710],
    [750, 1730],
    [1100, 1730],
    [1400, 1730],
    [1650, 1730],
    [2100, 1730],
    [2370, 1730],
    [2370, 1500],
    [2370, 1200],
    [2370, 1050],
    [2370, 800],
    [2100, 735],
    [1750, 735],
    [1630, 735],
    [1300, 500],
    [425, 1500],
    [425, 1080],
    [425, 800],
    [650, 1040],
    [650, 1210],
    [1125, 1210],
    [1140, 1490],
  ];
  map.teamSpawn = () => ({ ...map.entry });
}
