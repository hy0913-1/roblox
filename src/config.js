// 화면/레이아웃 상수. 논리 해상도는 960x540(16:9)이고, 실제 캔버스는 RENDER_SCALE배로 그려서 선명하게 보이게 한다.
export const W = 960;
export const H = 540;
// ?q=1 로 접속하면 1배(저사양 기기용), 기본은 2배.
const quality = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('q') : null;
export const RENDER_SCALE = quality === '1' ? 1 : 2;

export const CELL = 48;
export const COLS = 16;
export const ROWS = 10;

// 필드(맵)는 상단 바 아래에 놓이고, 오른쪽에는 빌드/정보 패널이 있다.
export const FIELD_X = 0;
export const FIELD_Y = 50;
export const PANEL_X = COLS * CELL; // 768
export const PANEL_W = W - PANEL_X; // 192

export const COLORS = {
  bg: 0x0b0b10,
  panel: 0x15151d,
  panelEdge: 0x2b2b38,
  gold: 0xd9b44a,
  goldText: '#d9b44a',
  red: 0xc0392b,
  redText: '#e05a4a',
  text: '#efe6c8',
  dim: '#8c8a99',
  good: '#7fd69a',
  bad: '#e05a4a',
};

export const FONT = '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", "Nanum Gothic", sans-serif';
