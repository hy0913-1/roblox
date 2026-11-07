// 아티팩트(단일 HTML) 빌드에서는 scripts/build-artifact.mjs 가 __EMBED__ 를 true 로 정의한다.
// 이 모드에서는 이미지 시트를 data: URI 로 페이지 안에 넣고(window.__ASSET_URLS), 파일 요청을 하지 않는다.
export const EMBED = typeof __EMBED__ !== 'undefined' && __EMBED__ === true;
