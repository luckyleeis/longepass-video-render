"""
기본 스타일 (프로젝트마다 하나): styles/<name>.json

템플릿은 어느 프로젝트에서나 같은 코드이고, 겉모습과 속도감은 스타일이 정한다.
- theme: Remotion에 넘기는 값 (배경 면 색, 강조색, 스킨=테두리/그림자/움직임/배경 무늬)
- pacing: 타임라인 쪽 결정 (음악, 효과음 양, 전환 방식)
- media / continuity: 이 스타일의 그림 재료(clean|sketch)와 이어짐 방식(cut …). 템플릿 후보를 거른다
  (theme.media 에 재료 세부값: 손그림이면 roughness, fillStyle 등)

배경 면 이름은 색이 아니라 역할이다. 템플릿 명세와 타임라인은 역할 이름만 쓴다.
- base: 기본(밝은) 면    - alt: 대비(어두운) 면
- accent: 브랜드색 면 (숫자 강조 등)    - deep: 챕터 카드, 어두운 면 위 강조
운영 스타일: 지금은 showreel 하나만 쓴다 (스타일 파일의 "active": true).
나머지(longepass, sketch_demo)는 보관용이다 — 템플릿을 만들거나 고칠 때 확인하지 않아도 된다.
작업 파일·명령에서 스타일을 빼면 DEFAULT_STYLE, 갤러리에서 스타일을 빼면 운영 스타일만 그린다.
"""
import glob
import json
import os
from typing import Any, Dict, List

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STYLES_DIR = os.path.join(ROOT, "styles")

DEFAULT_STYLE = "showreel"
SURFACE_KEYS = ["bg", "ink", "sub", "grid", "card", "cardInk", "line", "fill", "fillStrong"]
SURFACE_ROLES = ["base", "alt", "accent", "deep"]
MEDIA_KINDS = ["clean", "sketch"]  # src/kit/media.tsx 와 같은 목록
THEME_KEYS = ["font", "mono", "surfaces", "primary", "accent", "accent2", "danger", "brand", "skin"]
PACING_KEYS = ["music", "music_open_lufs", "music_under_voice_lufs", "sfx_gain_db", "stagger_sfx_every", "stagger_beats",
               "transition_frames", "transitions", "transition_sfx", "sfx_replace"]


def list_styles() -> List[str]:
    return sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(STYLES_DIR, "*.json")))


def active_styles() -> List[str]:
    """운영 중인 스타일 ("active": true). 하나도 없으면 DEFAULT_STYLE"""
    out = []
    for n in list_styles():
        with open(os.path.join(STYLES_DIR, f"{n}.json"), "r", encoding="utf-8") as f:
            if json.load(f).get("active"):
                out.append(n)
    return out or [DEFAULT_STYLE]


def get_style(name: str) -> Dict[str, Any]:
    path = os.path.join(STYLES_DIR, f"{name}.json")
    if not os.path.exists(path):
        raise ValueError(f"알 수 없는 스타일: {name} (가능: {', '.join(list_styles())})")
    with open(path, "r", encoding="utf-8") as f:
        style = json.load(f)
    errs = check_style(style)
    if errs:
        raise ValueError(f"스타일 {name} 형식 오류: " + "; ".join(errs))
    return style


def check_style(style: Dict[str, Any]) -> List[str]:
    errs = []
    th, pc = style.get("theme", {}), style.get("pacing", {})
    errs += [f"theme.{k} 없음" for k in THEME_KEYS if k not in th]
    errs += [f"pacing.{k} 없음" for k in PACING_KEYS if k not in pc]
    for role in SURFACE_ROLES:
        surf = th.get("surfaces", {}).get(role)
        if not surf:
            errs.append(f"surfaces.{role} 없음")
            continue
        errs += [f"surfaces.{role}.{k} 없음" for k in SURFACE_KEYS if k not in surf]
    media = th.get("media", {}).get("kind", "clean")
    if media != style.get("media", "clean"):
        errs.append(f"media({style.get('media')})와 theme.media.kind({media})가 다름")
    if media not in MEDIA_KINDS:
        errs.append(f"theme.media.kind는 {MEDIA_KINDS} 중 하나")
    lib_path = os.path.join(ROOT, "public", "music", "library.json")
    if os.path.exists(lib_path):
        with open(lib_path, "r", encoding="utf-8") as f:
            lib = json.load(f)
        if pc.get("music") not in {t["id"] for t in lib["tracks"]}:
            errs.append(f"pacing.music '{pc.get('music')}' 곡이 public/music/library.json 에 없음")
        bad = [m for m in pc.get("music_moods", []) if m not in lib.get("moods", {})]
        if bad:
            errs.append(f"pacing.music_moods 에 없는 분위기 {bad} (가능: {list(lib.get('moods', {}))})")
    if th.get("primary_surface", "base") not in SURFACE_ROLES:
        errs.append(f"theme.primary_surface 는 {SURFACE_ROLES} 중 하나")
    bi = pc.get("brand_intro")
    if bi is not None and not (isinstance(bi, dict) and all(isinstance(x, list) and len(x) == 3 for x in bi.get("sfx", []))):
        errs.append("pacing.brand_intro 는 {sec: 길이(초), sfx: [[효과음 종류, 위치 0~1, gain_db]]}")
    kinds = {"stripes", "glitch", "flash", "iris", "fade", "slide"}   # MotionVideo.tsx TransitionView
    for k in ("chapter", "counter", "default"):
        v = pc.get("transitions", {}).get(k)
        if v is None:
            errs.append(f"pacing.transitions.{k} 없음")
        elif any(x not in kinds for x in (v if isinstance(v, list) else [v])):
            errs.append(f"pacing.transitions.{k}: {sorted(kinds)} 중 하나 또는 그 목록")
    return errs
