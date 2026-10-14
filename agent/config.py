"""
에이전트 방식 설정: 저장소 루트의 longepass.config.json (git에 올리지 않음) + 기본값.
API 키는 longepass.keys.json (git에 올리지 않음) 에서만 읽고, 화면·로그·파일에 옮기지 않는다.

longepass.config.json (예시: longepass.config.example.json)
{
  "workspace": "out/agent",                 # 작업 폴더 — 보통 .env 의 LP_WORKSPACE (NAS) 가 앞선다
  "project": "longepass", "style": "showreel",
  "tts": {"url": "http://…/v1/audio/speech", "provider": "gemini", "voice": "Aoede", "language": "zh-tw", "speed": 1.0,
          "format": "mp3", "path_prefix": "longepass",
          "instructions": {"longform": "…", "shortform": "…"},   # 롱폼/숏폼 읽기 지시
          "pause_ms": {"longform": 250, "shortform": 120},        # 조각 사이 쉼
          "chunk_chars": 300, "min_ratio": 0.9, "local_root": "", "extra": {}},   # 형식은 agent/tts.py 맨 위
  "chrome": ""                              # 선택: 화면 캡처에 쓸 크롬 경로 (없으면 맥의 Google Chrome)
}
longepass.keys.json
{"pexels": "…", "pixabay": "…", "unsplash": "…"}   # 없는 사이트는 검색에서 빠진다

.env (저장소 루트, git에 올리지 않음 — 예시 .env.example). 같은 이름의 환경 변수가 있으면 그것이 앞선다.
  LP_WORKSPACE=/Volumes/…/longepass       작업 폴더 (NAS). config 의 workspace 보다 앞선다
  LP_TTS_URL=…  LP_TTS_VOICE=…            TTS 주소·목소리 (config 의 tts.url / tts.voice 보다 앞선다)
"""
import copy
import json
import os
from typing import Any, Dict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT, ".env")


def load_env(path: str = ENV_PATH) -> Dict[str, str]:
    """.env 의 KEY=VALUE 를 읽어 환경 변수에 없는 것만 채운다 (따옴표·주석·export 허용)"""
    out: Dict[str, str] = {}
    if not os.path.exists(path):
        return out
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip().removeprefix("export ").strip()
            v = v.strip()
            if v[:1] in ("'", '"') and v.find(v[0], 1) > 0:
                v = v[1:v.find(v[0], 1)]          # "값"  # 주석
            else:
                v = v.split(" #", 1)[0].strip()
            out[k] = v
            os.environ.setdefault(k, v)
    return out


load_env()
CONFIG_PATH = os.getenv("LP_CONFIG") or os.path.join(ROOT, "longepass.config.json")
KEYS_PATH = os.getenv("LP_KEYS") or os.path.join(ROOT, "longepass.keys.json")

DEFAULTS: Dict[str, Any] = {
    "workspace": "out/agent",
    "project": "longepass",
    "style": "showreel",
    "tts": {
        "url": "", "provider": "gemini", "voice": "Aoede", "language": "zh-tw", "model": "", "speed": 1.0, "format": "mp3",
        "path_prefix": "longepass", "chunk_chars": 300, "min_ratio": 0.9, "local_root": "", "extra": {},
        "pause_ms": {"longform": 250, "shortform": 120},
        # 2026-10-14 사용자가 정한 읽기 지시 (서버 모델: gemini-3.8-flash-lite-tts)
        "instructions": {
            "longform": ("Read in standard Taiwanese Mandarin with a smart, friendly, and well-articulated explanatory tone, "
                         "like an encouraging study mentor. Keep a steady, engaging pace so the listener stays focused throughout the breakdown."),
            "shortform": ("Speak in standard Taiwanese Mandarin with a brisk, upbeat, energetic pace for a short vertical video. "
                          "Keep pauses between sentences short and transitions tight, but say numbers, amounts, dates and key terms "
                          "clearly so they are easy to catch."),
        },
    },
    "chrome": "",
}


def _merge(base: Dict[str, Any], over: Dict[str, Any]) -> Dict[str, Any]:
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        out[k] = _merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def load() -> Dict[str, Any]:
    cfg = DEFAULTS
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = _merge(DEFAULTS, json.load(f))
    else:
        cfg = copy.deepcopy(DEFAULTS)
    if os.getenv("LP_WORKSPACE"):
        cfg["workspace"] = os.path.expanduser(os.environ["LP_WORKSPACE"])
    if os.getenv("LP_TTS_URL"):
        cfg["tts"]["url"] = os.environ["LP_TTS_URL"]
    if os.getenv("LP_TTS_VOICE"):
        cfg["tts"]["voice"] = os.environ["LP_TTS_VOICE"]
    ws = cfg["workspace"]
    cfg["workspace"] = ws if os.path.isabs(ws) else os.path.join(ROOT, ws)
    return cfg


def keys() -> Dict[str, str]:
    """사이트 → API 키. 값은 절대 출력하지 않는다"""
    if not os.path.exists(KEYS_PATH):
        return {}
    with open(KEYS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if isinstance(v, str) and v.strip()}
