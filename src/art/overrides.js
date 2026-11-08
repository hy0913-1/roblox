// GPT 등으로 만든 이미지를 쓰고 싶을 때 여기에 한 줄씩 추가하면 된다.
// 파일은 public/assets/ 아래에 두고, 값은 'assets/파일명.png' 형태로 적는다. (투명 배경 PNG 권장)
// 키가 여기에 있으면 코드로 그린 기본 그림 대신 이 파일이 쓰인다. 크기는 자동으로 칸에 맞게 줄어든다.
//
// 사용 가능한 키:
//   타워   : tower_yisang, tower_donquixote, tower_faust        (정사각형, 256x256 정도 권장)
//   적     : enemy_shade, enemy_runner, enemy_carapace, enemy_boss
//   맵     : tile_ground, tile_path, tile_rock                  (정사각형 타일, 이어붙여도 어색하지 않게)
//   목표   : bus (버스), portal (적이 나오는 입구)
//
// 예)
//   export const IMAGE_OVERRIDES = {
//     tower_yisang: 'assets/tower_yisang.png',
//     enemy_shade: 'assets/enemy_shade.png',
//   };
export const IMAGE_OVERRIDES = {};
