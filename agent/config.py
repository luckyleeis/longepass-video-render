"""
에이전트 방식 설정: 저장소 루트의 longepass.config.json (git에 올리지 않음) + 기본값.
API 키는 longepass.keys.json (git에 올리지 않음) 에서만 읽고, 화면·로그·파일에 옮기지 않는다.

longepass.config.json (예시: longepass.config.example.json)
{
  "workspace": "out/agent",                 # 작업 폴더 (상대 경로는 저장소 기준). NAS 등 다른 곳도 가능
  "project": "longepass", "style": "showreel",
  "tts": {"url": "http://…/v1/audio/speech", "voice": "…", "model": "", "speed": 1.0, "instructions": "…",
          "format": "mp3", "pause_ms": 350, "extra": {}},
  "stt": {"url": "", "model": "", "language": "zh", "min_ratio": 0.85},   # 선택: TTS가 대본대로 읽었는지 받아쓰기로 확인
  "chrome": ""                              # 선택: 화면 캡처에 쓸 크롬 경로 (없으면 Remotion 의 헤드리스 크롬)
}
longepass.keys.json
{"pexels": "…", "pixabay": "…", "unsplash": "…"}   # 없는 사이트는 검색에서 빠진다
"""
import copy
import json
import os
from typing import Any, Dict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.getenv("LP_CONFIG") or os.path.join(ROOT, "longepass.config.json")
KEYS_PATH = os.getenv("LP_KEYS") or os.path.join(ROOT, "longepass.keys.json")

DEFAULTS: Dict[str, Any] = {
    "workspace": "out/agent",
    "project": "longepass",
    "style": "showreel",
    "tts": {
        "url": "", "voice": "", "model": "", "speed": 1.0, "format": "mp3", "pause_ms": 350, "extra": {},
        # 대만 표준 중국어, 또렷하고 빠르게. 서버가 instructions 를 모르면 config 에서 "" 로 끈다
        "instructions": "以台灣華語（繁體中文）自然、清楚、明快地朗讀，語速稍快且穩定，不要拖長尾音，不要加入任何原文沒有的字。",
    },
    "stt": {"url": "", "model": "", "language": "zh", "min_ratio": 0.85},
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
