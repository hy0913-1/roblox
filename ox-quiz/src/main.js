import './style.css';
import { App } from './app.js';
import { iconURL, markURL } from './pixel.js';

// CSS에서 쓰는 도트 아이콘(하트/에너지)
const root = document.documentElement;
root.style.setProperty('--ic-bolt', `url(${iconURL('bolt', 2)})`);
root.style.setProperty('--ic-heart', `url(${iconURL('heart', 2)})`);
root.style.setProperty('--ic-heart-empty', `url(${iconURL('heartEmpty', 2)})`);
root.style.setProperty('--mk-o', `url(${markURL('O', '#ffffff')})`);
root.style.setProperty('--mk-x', `url(${markURL('X', '#ffffff')})`);
root.style.setProperty('--mk-o-c', `url(${markURL('O', '#6c9cf0')})`);
root.style.setProperty('--mk-x-c', `url(${markURL('X', '#f07a83')})`);

const app = new App(document.getElementById('app'));
// 테스트/디버그용 핸들 (게임 동작에는 영향 없음)
window.__ox = { app };

const start = () => app.boot();
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.ready === 'function') hot.ready(start);
else start();
