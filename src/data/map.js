import { CELL, COLS, ROWS } from '../config.js';

// 적이 걷는 길. [col, row] 꼭짓점 목록이고, 첫 점은 화면 왼쪽 밖(-1)이다.
const WAYPOINTS = [
  [-1, 2],
  [3, 2],
  [3, 7],
  [7, 7],
  [7, 2],
  [11, 2],
  [11, 7],
  [15, 7],
];

// 건설할 수 없는 장식용 바위(길이 아닌 칸).
const ROCKS = [
  [1, 0], [9, 0], [14, 1], [5, 4], [9, 5], [13, 4], [2, 9], [6, 9], [10, 9], [13, 9], [0, 5], [15, 3],
];

function build() {
  const pts = WAYPOINTS.map(([c, r]) => ({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const length = cum[cum.length - 1];

  const pathCells = new Set();
  for (let i = 1; i < WAYPOINTS.length; i++) {
    const [c0, r0] = WAYPOINTS[i - 1];
    const [c1, r1] = WAYPOINTS[i];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0;
    let r = r0;
    for (;;) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) pathCells.add(`${c},${r}`);
      if (c === c1 && r === r1) break;
      c += dc;
      r += dr;
    }
  }

  const rocks = new Set(ROCKS.map(([c, r]) => `${c},${r}`));

  // 진행 거리 d에서의 좌표와 진행 방향(각도)
  function posAt(d) {
    if (d <= 0) return { x: pts[0].x, y: pts[0].y, dx: 1, dy: 0 };
    if (d >= length) {
      const last = pts[pts.length - 1];
      return { x: last.x, y: last.y, dx: 1, dy: 0 };
    }
    let i = 1;
    while (cum[i] < d) i++;
    const seg = cum[i] - cum[i - 1];
    const t = (d - cum[i - 1]) / seg;
    const a = pts[i - 1];
    const b = pts[i];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dx: Math.sign(b.x - a.x), dy: Math.sign(b.y - a.y) };
  }

  const start = WAYPOINTS[1];
  const goal = WAYPOINTS[WAYPOINTS.length - 1];
  return { cols: COLS, rows: ROWS, cell: CELL, points: pts, length, pathCells, rocks, posAt, start, goal };
}

export const MAP = build();
