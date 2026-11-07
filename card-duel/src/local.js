// 브라우저 저장소(편의용). 한 기기에서 여러 계정을 써도 섞이지 않게 사용자 id를 키에 붙인다.
let prefix = 'anon';
export function setLocalUser(id) {
  prefix = id || 'anon';
}
export function lget(name, fallback = null) {
  try {
    const v = localStorage.getItem(`${name}:${prefix}`);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
export function lset(name, value) {
  try {
    if (value === null) localStorage.removeItem(`${name}:${prefix}`);
    else localStorage.setItem(`${name}:${prefix}`, JSON.stringify(value));
  } catch {
    /* 저장소 차단: 무시 */
  }
}
