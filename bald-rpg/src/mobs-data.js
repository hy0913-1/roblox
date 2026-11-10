// 몹 종류: 생김새는 pixelfx 생물 이펙트에 색만 바꿔 입힌다.
import * as slime from '../vendor/pixelfx/fx/critters/slime.js';
import * as snake from '../vendor/pixelfx/fx/critters/snake.js';
import * as bat from '../vendor/pixelfx/fx/critters/bat.js';
import * as ghost from '../vendor/pixelfx/fx/critters/ghost.js';
import * as skull from '../vendor/pixelfx/fx/critters/flying-skull.js';
import * as eyeball from '../vendor/pixelfx/fx/critters/eyeball.js';
import * as frog from '../vendor/pixelfx/fx/critters/frog.js';
import * as wisp from '../vendor/pixelfx/fx/critters/wisp.js';

export const MOBS = {
  fluff: { name: '털뭉치', mod: slime, opts: { palette: ['#3b2412', '#6b4320', '#9a6a34', '#c9964f', '#e6bf7a', '#f7e2ae', '#ffffff'], hop: 14 }, lv: 1, hp: 38, atk: 6, exp: 9, gold: [3, 8], speed: 22, kind: 'walk', hair: '#9a6a34' },
  mint: { name: '민트 털뭉치', mod: slime, opts: { palette: ['#0f3b33', '#1b6b58', '#2f9a7a', '#58c9a0', '#93e6c4', '#d2f7e6', '#ffffff'], hop: 18, seed: 3 }, lv: 3, hp: 85, atk: 11, exp: 20, gold: [6, 14], speed: 28, kind: 'walk', hair: '#2f9a7a' },
  frog: { name: '덥수룩 개구리', mod: frog, opts: {}, lv: 4, hp: 120, atk: 14, exp: 28, gold: [8, 16], speed: 20, kind: 'walk', hair: '#4f8a3a' },
  snake: { name: '수염뱀', mod: snake, opts: {}, lv: 5, hp: 160, atk: 18, exp: 38, gold: [10, 20], speed: 34, kind: 'walk', hair: '#7a8a3a' },
  bat: { name: '곱슬 박쥐', mod: bat, opts: {}, lv: 7, hp: 210, atk: 24, exp: 55, gold: [12, 26], speed: 46, kind: 'fly', hair: '#5a4a7a' },
  ghost: { name: '가발 유령', mod: ghost, opts: {}, lv: 9, hp: 330, atk: 30, exp: 80, gold: [16, 32], speed: 30, kind: 'fly', hair: '#cfd6ff' },
  wisp: { name: '정전기 도깨비불', mod: wisp, opts: {}, lv: 10, hp: 280, atk: 36, exp: 92, gold: [18, 34], speed: 52, kind: 'fly', hair: '#8fe6ff' },
  skull: { name: '불꽃머리 해골', mod: skull, opts: { floor: false }, lv: 12, hp: 520, atk: 44, exp: 130, gold: [24, 44], speed: 38, kind: 'fly', hair: '#ff9a3a' },
  eye: { name: '속눈썹 눈알', mod: eyeball, opts: {}, lv: 14, hp: 640, atk: 52, exp: 165, gold: [28, 52], speed: 26, kind: 'fly', shoot: true, hair: '#b8324a' },
  king: { name: '털보 대왕', mod: slime, opts: { palette: ['#1a0f2e', '#3a1d5c', '#6a2f8f', '#a04cc2', '#d48ae6', '#f3d2ff', '#ffffff'], hop: 10, seed: 9 }, lv: 18, hp: 9000, atk: 70, exp: 3000, gold: [600, 800], speed: 30, kind: 'boss', scale: 3, hair: '#6a2f8f' },
};
