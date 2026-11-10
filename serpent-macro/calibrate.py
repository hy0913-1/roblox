"""인식 영역/템플릿 설정 도구.

사용법:  python calibrate.py <serpent|bite|boss> [--color]

  serpent : 나침반에 서펀트가 떴을 때 보이는 표시
  bite    : 낚시 중 입질이 왔을 때 보이는 표시
  boss    : 서펀트 보스 체력바(이름 부분)

실행하면 5초 뒤 화면을 캡처한다. 그 사이에 게임 창으로 가서 해당 표시가
보이는 상태를 만들어 둔다. 캡처된 화면에서 두 번 드래그한다.
  1) 찾을 대상(아이콘/글자)만 딱 맞게 드래그 -> Enter
  2) 그 대상이 나타날 수 있는 범위를 넉넉하게 드래그 -> Enter
--color 를 주면 템플릿 대신 1)에서 고른 부분의 평균 색으로 인식한다.
"""
import json
import os
import sys
import time

import cv2
import mss
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "config.json")
NAMES = ("serpent", "bite", "boss")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1 or args[0] not in NAMES:
        sys.exit(__doc__)
    name = args[0]
    use_color = "--color" in sys.argv

    for i in range(5, 0, -1):
        print(f"{i}초 뒤 캡처... 게임 화면을 준비하세요")
        time.sleep(1)
    with mss.mss() as sct:
        mon = sct.monitors[1]
        frame = np.array(sct.grab(mon))[:, :, :3].copy()

    win = "1) 찾을 대상을 드래그 후 Enter"
    tx, ty, tw, th = cv2.selectROI(win, frame, showCrosshair=False)
    cv2.destroyWindow(win)
    if not tw or not th:
        sys.exit("취소됨")
    win = "2) 대상이 나타나는 범위를 넉넉히 드래그 후 Enter"
    rx, ry, rw, rh = cv2.selectROI(win, frame, showCrosshair=False)
    cv2.destroyWindow(win)
    if not rw or not rh:
        # 범위를 안 고르면 대상 주변 20px 여유를 준다
        rx, ry = max(tx - 20, 0), max(ty - 20, 0)
        rw, rh = tw + 40, th + 40

    with open(CONFIG, encoding="utf-8") as f:
        cfg = json.load(f)
    det = cfg["detectors"][name]
    det["region"] = [mon["left"] + rx, mon["top"] + ry, rw, rh]
    crop = frame[ty:ty + th, tx:tx + tw]
    if use_color:
        b, g, r = (int(v) for v in crop.reshape(-1, 3).mean(axis=0))
        det.update(type="color", rgb=[r, g, b])
        det.setdefault("tolerance", 25)
        det.setdefault("min_ratio", 0.05)
        print(f"{name}: 색 {det['rgb']} 로 인식")
    else:
        os.makedirs(os.path.join(HERE, "images"), exist_ok=True)
        det.update(type="template", image=f"images/{name}.png")
        det.setdefault("threshold", 0.8)
        cv2.imwrite(os.path.join(HERE, det["image"]), crop)
        print(f"{name}: 템플릿 {det['image']} 저장")
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    print(f"영역 {det['region']} 저장 완료")


if __name__ == "__main__":
    main()
