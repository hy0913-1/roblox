// scripts/bake-fx.mjs 가 만든 파일이다. 직접 고치지 말고 스크립트를 다시 돌릴 것.
// pixelfx (MIT, https://github.com/patch-gg/pixelfx) 이펙트를 시트로 구운 목록.
export const FX_SHEETS = [
  {
    "key": "fx_hit_slash",
    "file": "fx_hit_slash.png",
    "frames": 16,
    "frameW": 136,
    "frameH": 80,
    "fps": 30,
    "pivot": [
      44,
      64
    ],
    "source": "impacts/hit-spark"
  },
  {
    "key": "fx_hit_orb",
    "file": "fx_hit_orb.png",
    "frames": 16,
    "frameW": 136,
    "frameH": 80,
    "fps": 30,
    "pivot": [
      44,
      64
    ],
    "source": "impacts/hit-spark"
  },
  {
    "key": "fx_blast",
    "file": "fx_blast.png",
    "frames": 28,
    "frameW": 216,
    "frameH": 136,
    "fps": 30,
    "pivot": [
      84,
      106
    ],
    "source": "impacts/crit-hit"
  },
  {
    "key": "fx_poof",
    "file": "fx_poof.png",
    "frames": 49,
    "frameW": 112,
    "frameH": 92,
    "fps": 30,
    "pivot": [
      56,
      80
    ],
    "source": "spawn/poof"
  },
  {
    "key": "fx_poof_boss",
    "file": "fx_poof_boss.png",
    "frames": 49,
    "frameW": 112,
    "frameH": 92,
    "fps": 30,
    "pivot": [
      56,
      80
    ],
    "source": "spawn/poof"
  },
  {
    "key": "fx_sparkle",
    "file": "fx_sparkle.png",
    "frames": 42,
    "frameW": 112,
    "frameH": 108,
    "fps": 30,
    "pivot": [
      56,
      94
    ],
    "source": "pickups/collect-burst"
  }
];
