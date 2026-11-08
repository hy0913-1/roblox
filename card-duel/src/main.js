import './style.css';
import { App } from './app.js';
import { aiChoose } from './ai.js';

const app = new App(document.getElementById('app'));
// 테스트/디버그용 핸들 (게임 동작에는 영향 없음)
window.__cd = { app, aiChoose };
app.boot();
