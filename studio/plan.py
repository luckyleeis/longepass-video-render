"""
계획 검증: LLM이 쓴 계획(raw) → 명세로 검증/보정한 계획.
서버가 LLM을 부른 뒤 bin/studio validate 로 이 함수를 거친다 (형식 오류 샷은 기본 샷으로 대체하고 보고).
"""
from typing import Any, Dict, Optional

import json
import os

from studio import catalog

MUSIC_LIBRARY = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "music", "library.json")


def music_moods() -> list:
    with open(MUSIC_LIBRARY, "r", encoding="utf-8") as f:
        return list(json.load(f).get("moods", {}))


def allowed_templates(project: str, style: Dict[str, Any], aspect: str = "16:9") -> set:
    return set(catalog.candidates(project, style, aspect))


def variety_report(chapters) -> list:
    """
    화면이 단조로운지 알려 주는 경고 (계획은 바꾸지 않는다). 같은 템플릿이 연달아 나오거나,
    같은 갈래(category)가 셋 이상 이어지거나, 화면 문법이 한 가지(카드형)뿐일 때.
    """
    out = []
    flat = [(ci, s) for ci, ch in enumerate(chapters) for s in ch["shots"]]
    mods = [s["module"] for _, s in flat]
    cats = [catalog.load()[m]["category"] if m in catalog.load() else "" for m in mods]
    for i in range(1, len(flat)):
        if mods[i] == mods[i - 1]:
            out.append(f"{flat[i][1]['id']}: 바로 앞 샷과 같은 템플릿 {mods[i]}")
        if i >= 2 and cats[i] and cats[i] == cats[i - 1] == cats[i - 2]:
            out.append(f"{flat[i][1]['id']}: 같은 갈래({cats[i]})가 세 샷 이어짐")
    loud = {"photo_full", "photo_split", "photo_collage", "screen_focus", "word_slam", "quote_card", "contrast", "counter"}
    if len(flat) >= 8 and not any(m in loud for m in mods):
        out.append("카드형 화면만 있음: 사진·화면 캡처·키네틱 글자(photo_*, screen_focus, word_slam, quote_card) 중 하나 이상 섞기를 권장")
    return out


def normalize_plan(raw: Dict[str, Any], allowed: Optional[set] = None) -> Dict[str, Any]:
    """allowed: 이 영상에서 쓸 수 있는 템플릿 id (없으면 전부)"""
    report = {"replaced": [], "warnings": []}
    chapters = []
    n = 0
    for ch in raw.get("chapters") or []:
        shots = []
        for sh in ch.get("shots") or []:
            module = sh.get("module")
            m = catalog.load().get(module or "")
            stage = bool(m and m["kind"] == "stage")
            if stage:  # 무대: 내레이션은 비트들을 이은 것
                narration = "".join((b.get("narration") or "").strip() for b in sh.get("beats") or [] if isinstance(b, dict))
            else:
                narration = (sh.get("narration") or "").strip()
            if not narration:
                continue
            n += 1
            data, warns, reason = catalog.validate_shot(sh)
            beats = []
            if stage and not reason:
                beats, bwarns, reason = catalog.validate_beats(sh)
                warns += bwarns
                narration = "".join(b["narration"] for b in beats) if beats else narration
            report["warnings"] += [f"shot{n}: {w}" for w in warns]
            if not reason and allowed is not None and module not in allowed:
                reason = f"이 영상에서 쓸 수 없는 템플릿 {module}"
            if reason:
                report["replaced"].append({"shot": n, "reason": reason})
                fb = catalog.fallback_shot(narration)
                module, data, stage = fb["module"], fb["data"], False
            cues = sh.get("cues") if isinstance(sh.get("cues"), dict) else {}
            shot = {"id": f"s{n:02d}", "module": module, "narration": narration, "data": data, "cues": cues}
            if stage:
                shot["beats"] = beats
            shots.append(shot)
        if shots:
            chapters.append({"title": (ch.get("title") or "").strip(), "shots": shots})
    if not chapters:
        raise ValueError("유효한 샷이 없습니다.")
    report["variety"] = variety_report(chapters)
    return {
        "video_title": raw.get("video_title", ""), "description": raw.get("description", ""),
        "hashtags": [h for h in raw.get("hashtags") or [] if isinstance(h, str)][:5],
        "thumbnail": raw.get("thumbnail") or {}, "chapters": chapters, "report": report,
        "music_mood": raw.get("music_mood") if raw.get("music_mood") in music_moods() else None,
    }
