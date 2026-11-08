import './style.css';
import { App } from './app.js';
import { installCssIcons } from './pixel.js';

installCssIcons();

const app = new App(document.getElementById('app'));
// 테스트/디버그용 핸들 (게임 동작에는 영향 없음)
window.__ox = { app };

const start = () => app.boot();
const hot = window.claude && window.claude.hot;
if (hot && typeof hot.ready === 'function') hot.ready(start);
else start();
