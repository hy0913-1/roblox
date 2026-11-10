"""가짜 화면/입력으로 상태 흐름을 검증한다.  실행: python test_macro.py"""
import os
import tempfile

import cv2
import numpy as np

from macro import Detector, Macro, Stopped

RNG = np.random.default_rng(1)
ICONS = {n: RNG.integers(0, 255, (16, 16, 3), dtype=np.uint8) for n in ("serpent", "bite", "boss")}
REGIONS = {"serpent": [0, 0, 60, 60], "bite": [100, 0, 60, 60], "boss": [200, 0, 60, 60]}


class Clock:
    def __init__(self):
        self.t = 0.0

    def now(self):
        return self.t

    def sleep(self, s):
        self.t += s


class FakeScreen:
    """visible(name, t) 가 참인 아이콘만 그려진 화면을 돌려준다."""

    def __init__(self, clock, visible):
        self.clock, self.visible = clock, visible

    def grab(self, region):
        frame = np.zeros((80, 300, 3), np.uint8)
        for name, (x, y, _, _) in REGIONS.items():
            if self.visible(name, self.clock.t):
                frame[y + 10:y + 26, x + 10:x + 26] = ICONS[name]
        x, y, w, h = region
        return frame[y:y + h, x:x + w]


class FakeInput:
    def __init__(self):
        self.events = []

    def press(self, key):
        self.events.append(key)

    def click(self, hold=0.0):
        self.events.append("click")


def make(visible, tmp):
    os.makedirs(os.path.join(tmp, "images"), exist_ok=True)
    dets = {}
    for n, icon in ICONS.items():
        cv2.imwrite(os.path.join(tmp, "images", f"{n}.png"), icon)
        dets[n] = {"type": "template", "image": f"images/{n}.png", "region": REGIONS[n], "threshold": 0.8}
    cfg = {
        "compass": {"key": "3", "click_to_use": True, "scan_interval": 10},
        "fishing": {"rod_key": "2", "bite_timeout": 20, "reel_seconds": 3, "max_casts": 3},
        "fight": {"weapon_key": "1", "skills": [{"key": "z", "cooldown": 8}], "gone_seconds": 5, "timeout": 120},
        "detectors": dets,
    }
    clock, inp = Clock(), FakeInput()
    m = Macro(cfg, FakeScreen(clock, visible), inp, clock=clock.now, sleep=clock.sleep,
              log=lambda *_: None, base_dir=tmp)
    return m, inp, clock


def test_no_serpent(tmp):
    m, inp, _ = make(lambda n, t: False, tmp)
    assert m.cycle() is False
    assert inp.events == ["3", "click"], inp.events  # 나침반만 확인하고 끝


def test_full_kill(tmp):
    # 서펀트 표시는 항상, 입질은 10~12초, 보스는 14~60초 동안 보임
    def visible(n, t):
        return n == "serpent" or (n == "bite" and 10 <= t < 12) or (n == "boss" and 14 <= t < 60)
    m, inp, clock = make(visible, tmp)
    assert m.cycle() is True
    assert m.kills == 1
    ev = inp.events
    assert ev.index("3") < ev.index("2") < ev.index("1"), "나침반 → 낚싯대 → 무기 순서"
    assert ev.count("z") >= 5, "스킬은 쿨타임마다 반복"
    assert ev.count("z") <= 8, "쿨타임을 무시하고 연타하면 안 됨"
    assert 60 <= clock.t < 70, clock.t  # 보스가 사라지고 gone_seconds 뒤 종료


def test_fishing_gives_up(tmp):
    m, inp, _ = make(lambda n, t: n == "serpent", tmp)
    assert m.cycle() is False
    assert "1" not in inp.events  # 전투로 넘어가지 않음


def test_pause_interrupts(tmp):
    m, _, _ = make(lambda n, t: n == "serpent", tmp)
    m.running = False
    try:
        m.cycle()
    except Stopped:
        return
    raise AssertionError("일시정지 상태에서 동작이 계속됨")


def test_color_detector(tmp):
    d = Detector("bite", {"type": "color", "region": [0, 0, 10, 10], "rgb": [255, 0, 0], "min_ratio": 0.2})
    roi = np.zeros((10, 10, 3), np.uint8)
    assert d.score(roi) == 0.0
    roi[:5] = (0, 0, 255)  # BGR 빨강
    assert abs(d.score(roi) - 0.5) < 1e-6


def test_uncalibrated_message(tmp):
    try:
        Detector("serpent", {"type": "template", "image": "x.png", "region": None})
    except ValueError as e:
        assert "calibrate.py serpent" in str(e)
        return
    raise AssertionError("영역 미설정을 잡아내지 못함")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        with tempfile.TemporaryDirectory() as tmp:
            t(tmp)
        print("ok", t.__name__)
    print(f"{len(tests)}개 통과")
