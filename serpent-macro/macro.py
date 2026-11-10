"""King Legacy 서펀트 자동 사냥 매크로 (화면 인식 + 키/마우스 입력).

흐름:  SCAN(나침반 확인) -> FISH(낚시로 서펀트 끌어올리기) -> FIGHT(전투) -> SCAN ...

게임 메모리나 클라이언트는 건드리지 않고, 화면을 보고 키/마우스만 누른다.
실행:  python macro.py        (F8 시작/일시정지, F9 종료)
"""
import json
import os
import sys
import time

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))


class Stopped(Exception):
    """사용자가 일시정지/종료를 눌렀을 때 현재 동작을 끊기 위한 예외."""


# ---------------------------------------------------------------- 화면 인식

class Detector:
    """화면의 한 영역(region)에서 템플릿 이미지 또는 특정 색을 찾는다."""

    def __init__(self, name, spec, base_dir=HERE):
        self.name = name
        self.spec = spec
        self.region = spec.get("region")
        if not self.region:
            raise ValueError(
                f"'{name}' 영역이 설정되지 않았습니다. 먼저 `python calibrate.py {name}` 을 실행하세요."
            )
        self.kind = spec.get("type", "template")
        self.template = None
        if self.kind == "template":
            path = os.path.join(base_dir, spec["image"])
            self.template = cv2.imread(path, cv2.IMREAD_COLOR)
            if self.template is None:
                raise ValueError(
                    f"'{name}' 템플릿 이미지({spec['image']})가 없습니다. `python calibrate.py {name}` 을 실행하세요."
                )

    def score(self, roi):
        """roi(BGR 배열)에 대한 일치도 0~1."""
        if self.kind == "color":
            r, g, b = self.spec["rgb"]
            tol = self.spec.get("tolerance", 25)
            diff = np.abs(roi.astype(np.int16) - np.array([b, g, r], dtype=np.int16))
            return float((diff.max(axis=2) <= tol).mean())
        th, tw = self.template.shape[:2]
        if roi.shape[0] < th or roi.shape[1] < tw:
            return 0.0
        res = cv2.matchTemplate(roi, self.template, cv2.TM_CCOEFF_NORMED)
        return float(res.max())

    def found(self, screen):
        roi = screen.grab(self.region)
        if self.kind == "color":
            return self.score(roi) >= self.spec.get("min_ratio", 0.05)
        return self.score(roi) >= self.spec.get("threshold", 0.8)


# ---------------------------------------------------------------- 실제 입출력

class MssScreen:
    def __init__(self):
        import mss
        self._sct = mss.mss()

    def grab(self, region):
        x, y, w, h = region
        shot = self._sct.grab({"left": x, "top": y, "width": w, "height": h})
        return np.array(shot)[:, :, :3]  # BGRA -> BGR


class DirectInput:
    """Roblox는 일반 가상 키 입력을 무시하는 경우가 있어 pydirectinput(스캔코드)을 쓴다."""

    def __init__(self):
        import pydirectinput
        pydirectinput.PAUSE = 0.02
        self._p = pydirectinput

    def press(self, key):
        self._p.press(key)

    def click(self, hold=0.0):
        self._p.mouseDown()
        if hold:
            time.sleep(hold)
        self._p.mouseUp()


# ---------------------------------------------------------------- 매크로 본체

class Macro:
    def __init__(self, cfg, screen, inp, clock=time.monotonic, sleep=time.sleep,
                 log=print, base_dir=HERE):
        self.cfg = cfg
        self.screen = screen
        self.inp = inp
        self.clock = clock
        self._sleep = sleep
        self.log = log
        self.running = True
        self.quit = False
        d = cfg["detectors"]
        self.serpent = Detector("serpent", d["serpent"], base_dir)
        self.bite = Detector("bite", d["bite"], base_dir)
        self.boss = Detector("boss", d["boss"], base_dir)
        self.kills = 0

    # 일시정지/종료 요청이 오면 어떤 대기 중이든 바로 빠져나온다.
    def wait(self, seconds):
        end = self.clock() + seconds
        while True:
            if self.quit or not self.running:
                raise Stopped()
            left = end - self.clock()
            if left <= 0:
                return
            self._sleep(min(left, 0.05))

    # --- 1단계: 나침반으로 서펀트가 떴는지 확인
    def serpent_up(self):
        c = self.cfg["compass"]
        if c.get("key"):
            self.inp.press(c["key"])          # 나침반 장착
            self.wait(c.get("equip_delay", 0.5))
        if c.get("click_to_use"):
            self.inp.click()                  # 나침반 사용
        self.wait(c.get("show_delay", 1.0))
        return self.serpent.found(self.screen)

    # --- 2단계: 낚시. 서펀트(보스 체력바)가 나오면 True
    def fish(self):
        f = self.cfg["fishing"]
        self.inp.press(f["rod_key"])
        self.wait(f.get("equip_delay", 0.5))
        for attempt in range(1, f.get("max_casts", 20) + 1):
            self.log(f"낚시 던지기 {attempt}회차")
            self.inp.click(f.get("cast_hold", 0.0))
            deadline = self.clock() + f.get("bite_timeout", 40)
            bitten = False
            while self.clock() < deadline:
                if self.boss.found(self.screen):
                    return True
                if self.bite.found(self.screen):
                    bitten = True
                    break
                self.wait(f.get("poll", 0.1))
            if bitten:
                self.log("입질! 감아올리는 중")
                end = self.clock() + f.get("reel_seconds", 5)
                while self.clock() < end:
                    self.inp.click()
                    if self.boss.found(self.screen):
                        return True
                    self.wait(f.get("reel_interval", 0.1))
            else:
                self.log("입질 없음, 다시 던짐")
            # 낚아올린 뒤 보스가 나타날 때까지 잠깐 기다려 본다
            end = self.clock() + f.get("spawn_wait", 3)
            while self.clock() < end:
                if self.boss.found(self.screen):
                    return True
                self.wait(0.2)
        return False

    # --- 3단계: 전투. 보스 체력바가 사라지면 처치로 본다
    def fight(self):
        g = self.cfg["fight"]
        self.inp.press(g["weapon_key"])
        self.wait(g.get("equip_delay", 0.5))
        start = self.clock()
        last_seen = start
        ready_at = {s["key"]: start for s in g.get("skills", [])}
        while self.clock() - start < g.get("timeout", 600):
            now = self.clock()
            if self.boss.found(self.screen):
                last_seen = now
            elif now - last_seen >= g.get("gone_seconds", 5):
                return True
            for s in g.get("skills", []):
                if now >= ready_at[s["key"]]:
                    self.inp.press(s["key"])
                    ready_at[s["key"]] = now + s["cooldown"]
                    self.wait(s.get("cast_time", 0.4))
            self.inp.click()
            self.wait(g.get("attack_interval", 0.15))
        return False

    def cycle(self):
        """한 바퀴: 서펀트가 떠 있으면 낚고 잡는다. 처치하면 True."""
        if not self.serpent_up():
            return False
        self.log("나침반에 서펀트 감지 → 낚시 시작")
        if not self.fish():
            self.log("서펀트를 낚지 못함. 다시 탐색")
            return False
        self.log("서펀트 등장 → 전투 시작")
        if self.fight():
            self.kills += 1
            self.log(f"처치 완료 (누적 {self.kills}마리)")
            return True
        self.log("전투 시간 초과. 다시 탐색")
        return False

    def run(self):
        self.log("대기 중. F8 = 시작/일시정지, F9 = 종료")
        while not self.quit:
            if not self.running:
                self._sleep(0.1)
                continue
            try:
                self.cycle()
                self.wait(self.cfg["compass"].get("scan_interval", 10))
            except Stopped:
                if not self.quit:
                    self.log("일시정지")


def load_config(path=None):
    with open(path or os.path.join(HERE, "config.json"), encoding="utf-8") as f:
        return json.load(f)


def main():
    cfg = load_config(sys.argv[1] if len(sys.argv) > 1 else None)
    try:
        macro = Macro(cfg, MssScreen(), DirectInput())
    except ValueError as e:
        sys.exit(str(e))
    macro.running = False  # F8을 눌러야 시작

    import keyboard
    hk = cfg.get("hotkeys", {})

    def toggle():
        macro.running = not macro.running
        if macro.running:
            print("시작")

    def stop():
        macro.quit = True

    keyboard.add_hotkey(hk.get("toggle", "f8"), toggle)
    keyboard.add_hotkey(hk.get("quit", "f9"), stop)
    macro.run()
    print("종료")


if __name__ == "__main__":
    main()
