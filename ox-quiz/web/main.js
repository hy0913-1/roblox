// 웹판 시작점: 일반 웹사이트(GitHub Pages 등)에서 돌아가는 OX 도트 대난투
import './fonts.css';
import './web.css';
import '../src/style.css';
import { WebApp } from '../src/web/app-web.js';
import { installCssIcons, markURL } from '../src/pixel.js';

installCssIcons();
const icon = document.createElement('link');
icon.rel = 'icon';
icon.href = markURL('O', '#6c9cf0', 4);
document.head.appendChild(icon);

const app = new WebApp(document.getElementById('app'));
// 테스트/디버그용 핸들 (게임 동작에는 영향 없음)
window.__ox = { app };
app.boot();
