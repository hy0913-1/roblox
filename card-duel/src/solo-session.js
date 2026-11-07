// 솔로 도전 진행: 사람 행동을 기록하고, AI 턴은 검증 때와 똑같은 순서/상태로 둔다.
import { act, enc } from './engine.js';
import { aiChoose } from './ai.js';
import { newRun, floorGame, aiStateFor, floorPoints, nextHp, replayRun, FLOORS } from './solo.js';
import { randomSeed } from './match.js';

export class SoloSession {
  constructor(deck, onUpdate, onDone) {
    this.kind = 'solo';
    this.mode = 'duel';
    this.mySeat = 0;
    this.onUpdate = onUpdate;
    this.onDone = onDone;
    this.run = newRun(randomSeed(), deck);
    this.phase = 'play'; // play | floorClear | done
    this.startFloor(0);
  }

  get floorInfo() {
    return FLOORS[this.run.floor];
  }

  startFloor(f) {
    this.run.floor = f;
    this.run.acts[f] = [];
    this.s = floorGame(this.run.seed, this.run.deck, f, this.run.hp);
    this.ai = aiStateFor(this.run.seed, f);
    this.phase = 'play';
    this.kick();
  }

  isMyTurn() {
    return this.phase === 'play' && !this.s.over && this.s.active === 0;
  }

  act(a) {
    if (!this.isMyTurn() && a.t !== 'x') return '지금은 행동할 수 없어요';
    if (a.t === 'x') return this.abandon();
    const err = act(this.s, 0, a);
    if (err) return err;
    this.run.acts[this.run.floor].push(enc(a));
    this.after();
    return null;
  }

  after() {
    this.onUpdate();
    if (this.s.over) this.floorEnd();
    else this.kick();
  }

  kick() {
    if (this.s.over || this.s.active !== 1 || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      const a = aiChoose(this.s, 1, this.floorInfo.level, this.ai);
      if (act(this.s, 1, a)) act(this.s, 1, { t: 'end' });
      this.lastAi = a;
      this.after();
    }, 750);
  }

  floorEnd() {
    const f = this.run.floor;
    if (this.s.winner === 0) {
      const pts = floorPoints(f, this.s);
      this.run.score += pts;
      this.run.results.push({ f, pts, hp: this.s.sides[0].hp });
      this.run.hp = nextHp(this.s);
      if (f + 1 < FLOORS.length) {
        this.phase = 'floorClear';
        this.onUpdate();
        return;
      }
    }
    this.finish();
  }

  nextFloor() {
    if (this.phase === 'floorClear') this.startFloor(this.run.floor + 1);
    this.onUpdate();
  }

  abandon() {
    clearTimeout(this.timer);
    this.finish(true);
    return null;
  }

  finish(abandoned = false) {
    if (this.phase === 'done') return;
    clearTimeout(this.timer);
    this.phase = 'done';
    this.abandoned = abandoned;
    // 저장 전에 스스로 다시 계산해 본다(검증 실패할 기록은 올리지 않음)
    const check = replayRun(this.run);
    this.verified = check.ok && check.score === this.run.score;
    this.onDone(this);
  }

  timeLeft() {
    return 0;
  }

  dispose() {
    clearTimeout(this.timer);
  }
}
