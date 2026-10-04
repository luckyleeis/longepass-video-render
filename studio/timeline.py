"""
타임라인: 계획(plan) + 챕터 음성(글자별 시각) + 스타일 → MotionVideo props.

- 이벤트 시점 = 내레이션에서 단서 구절(cues)을 말하는 순간 → 가장 가까운 음악 박자에 맞춤
- 이벤트마다 명세의 효과음 종류로 소리를 골라 음량을 맞춰 붙인다
- 말하는 구간에는 음악을 낮춘다(덕킹), 화면 자막(핵심어 강조)을 만든다
외부 호출 없음 (TTS/LLM은 서버 몫, 여기는 받은 결과로 계산만 한다).
"""
import json
import math
import os
from itertools import cycle
from typing import Any, Dict, List, Optional, Tuple

from studio import catalog
from studio.text import clean_text, split_text_word_safe

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT, "public")

FPS = 30
SNAP_TOLERANCE = 4      # 박자에 맞출 최대 이동 프레임

# 효과음 종류별 목표 최대 음량 (dBFS). 최종 렌더 후 전체를 -14 LUFS로 맞춘다
SFX_TARGET_PEAK = {
    "pop": -14, "click": -18, "check": -14, "ding": -14, "glass": -16, "bong": -12,
    "swish_up": -15, "swish_down": -15, "glitch": -14, "scratch": -14, "error": -16,
    "question": -16, "whoosh": -10, "riser": -12, "impact": -8, "stamp": -8,
}

# 테마(색/스킨)는 styles.py 프로필에 있다 (styles.get_style(name)["theme"])


def _load(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class SfxBank:
    """종류별로 소리를 돌려가며 고른다 (같은 소리 반복 방지)"""

    def __init__(self):
        lib = _load(os.path.join(PUBLIC_DIR, "sfx", "library.json"))
        self.by_cat: Dict[str, List[Dict[str, Any]]] = {}
        for s in lib["sounds"]:
            self.by_cat.setdefault(s["category"], []).append(s)
        self._cycles = {c: cycle(v) for c, v in self.by_cat.items()}
        self.event_defaults = lib.get("event_defaults", {})

    def clip(self, category: str, frame: int, gain_db: float = 0.0) -> Optional[Dict[str, Any]]:
        if category not in self._cycles:
            return None
        s = next(self._cycles[category])
        target = SFX_TARGET_PEAK.get(category, -14) + gain_db
        volume = round(min(1.0, 10 ** ((target - s["peak_db"]) / 20.0)), 4)
        return {"src": s["file"], "from": max(0, frame), "duration": max(2, math.ceil(s["duration_sec"] * FPS) + 2), "volume": volume}


class BeatGrid:
    def __init__(self, bpm: float, total_frames: int):
        self.fpb = FPS * 60.0 / bpm
        self.frames = [round(i * self.fpb) for i in range(int(total_frames / self.fpb) + 2)]

    def snap(self, frame: int, tolerance: int = SNAP_TOLERANCE) -> int:
        best = min(self.frames, key=lambda b: abs(b - frame))
        if abs(best - frame) <= tolerance:
            return best
        half = [round((i + 0.5) * self.fpb) for i in range(len(self.frames))]
        best_h = min(half, key=lambda b: abs(b - frame))
        return best_h if abs(best_h - frame) <= tolerance - 1 else frame

    def nth_after(self, frame: int, n: float) -> int:
        return round(frame + n * self.fpb)


def _speech_intervals(nar, gap_ms: float = 300.0) -> List[List[int]]:
    """글자 사이가 gap_ms 이상 비면 끊어서, 실제로 말하는 구간만 (음악은 쉼에서 다시 올라온다). nar: .times(ms), .lead(프레임)"""
    out, a, prev_end = [], nar.times[0][0], nar.times[0][1]
    for s, e in nar.times[1:]:
        if s - prev_end > gap_ms:
            out.append([nar.lead + round(a * FPS / 1000), nar.lead + round(prev_end * FPS / 1000)])
            a = s
        prev_end = e
    out.append([nar.lead + round(a * FPS / 1000), nar.lead + round(prev_end * FPS / 1000)])
    return out


VOICE_LEAD = 6
CHAPTER_TAIL = 14
END_TAIL = 45
CHAPTER_CARD_BEATS = 4
# 배경 역할 이름 (실제 색은 styles.py 프로필). 챕터마다 밝은 면/어두운 면을 번갈아 쓴다
CHAPTER_BASES = ["base", "alt"]


def chapter_text(ch: Dict[str, Any]) -> str:
    return "".join(s["narration"] for s in ch["shots"])


# ---------------------------------------------------------------- 타임라인
class ChapterNarration:
    def __init__(self, text: str, char_times: List[Tuple[float, float]], lead: int):
        self.clean = clean_text(text)
        self.times = char_times
        self.lead = lead

    def f_start(self, i: int) -> int:
        return self.lead + round(self.times[min(i, len(self.times) - 1)][0] * FPS / 1000)

    def f_end(self, i: int) -> int:
        return self.lead + round(self.times[min(i, len(self.times) - 1)][1] * FPS / 1000)

    def find(self, phrase: str, lo: int, hi: int) -> Optional[int]:
        p = clean_text(phrase or "")
        if not p:
            return None
        i = self.clean.find(p, lo, hi)
        return i if i >= 0 else None

    @property
    def last_frame(self) -> int:
        return self.f_end(len(self.times) - 1)


def _events(spec: Dict[str, Any], data: Dict[str, Any], cues: Dict[str, Any], nar: ChapterNarration, lo: int, hi: int,
            s_start: int, grid: BeatGrid, stagger_beats: float) -> Dict[str, Any]:
    """명세의 events → 절대 프레임. 단서 구절(cues)이 발화되는 순간을 박자에 맞추고, 없으면 발화 구간 비율로"""
    sp_a, sp_b = nar.f_start(lo), nar.f_end(hi - 1)
    span = max(12, sp_b - sp_a)

    def at_phrase(p) -> Optional[int]:
        i = nar.find(p, lo, hi) if isinstance(p, str) else None
        return grid.snap(nar.f_start(i)) if i is not None else None

    ev: Dict[str, Any] = {}
    for name, sp in spec.items():
        if sp.get("when") and not data.get(sp["when"]):
            continue
        kind = sp["kind"]
        if kind == "single":
            f = at_phrase(cues.get(name))
            if f is None:
                f = s_start + 4 if not sp.get("at") else grid.snap(round(sp_a + span * sp["at"]))
            after = sp.get("after")
            if after and after["event"] in ev:
                ref = ev[after["event"]]
                f = max(f, (ref[-1] if isinstance(ref, list) else ref) + after["gap"])
            ev[name] = f
            continue
        count = len(data.get(sp["of"]) or [])
        if count == 0:
            continue
        if kind == "stagger":
            first = at_phrase(cues.get(name) if isinstance(cues.get(name), str) else None) or (sp_a + 4)
            step = max(3.0, grid.fpb * stagger_beats)  # 스타일이 정한 박자 간격으로 차오름
            ev[name] = [round(first + i * step) for i in range(count)]
            continue
        phrases = cues.get(name) if isinstance(cues.get(name), list) else []
        base = sp.get("start", 0.05)
        frames = []
        for i in range(count):
            f = at_phrase(phrases[i]) if i < len(phrases) else None
            if f is None:
                f = grid.snap(round(sp_a + span * (base + 0.75 * i / max(count, 1))))
            frames.append(f)
        after = sp.get("after")
        if after and isinstance(ev.get(after["event"]), list):
            ref = ev[after["event"]]
            frames = [max(f, ref[min(i, len(ref) - 1)] + after["gap"]) for i, f in enumerate(frames)]
        for i in range(1, len(frames)):
            frames[i] = max(frames[i], frames[i - 1] + 8)
        ev[name] = frames
    return ev


def _map_frames(ev, fn):
    """이벤트 값(숫자 / 숫자 목록 / 비트 목록)마다 fn 적용"""
    if isinstance(ev, dict):
        return {k: _map_frames(v, fn) for k, v in ev.items()}
    if isinstance(ev, list):
        return [_map_frames(x, fn) for x in ev]
    return fn(ev)


def shot_events(shot, nar: ChapterNarration, rng: Tuple[int, int], s_start: int, s_end: int, grid: BeatGrid,
                stagger_beats: float = 0.25) -> Dict[str, Any]:
    """샷의 이벤트 (절대 프레임). 무대 템플릿은 ev["beats"] = [{at, …비트 안 이벤트}]"""
    m = catalog.get(shot["module"])
    lo, hi = rng
    ev = _events(m["events"], shot["data"], shot.get("cues") or {}, nar, lo, hi, s_start, grid, stagger_beats)
    if m["kind"] == "stage":
        beats, pos = [], lo
        for bi, b in enumerate(shot.get("beats") or []):
            n = len(clean_text(b["narration"]))
            at = s_start if bi == 0 else max(beats[-1]["at"] + 15, grid.snap(nar.f_start(pos) - 3))
            spec = {k: v for k, v in m["beat_events"].items() if not (v.get("once") and bi > 0)}  # once = 첫 비트에서만
            bev = _events(spec, {**shot["data"], **b["data"]}, b.get("cues") or {}, nar, pos, pos + n, at, grid, stagger_beats)
            bev["at"] = at
            beats.append(bev)
            pos += n
        ev["beats"] = beats
    # 샷 안에서 보이도록 범위 제한
    return _map_frames(ev, lambda f: min(max(f, s_start + 2), s_end - 8) if f != s_start else f)


def layer_data(shot) -> Dict[str, Any]:
    """Remotion 템플릿에 넘길 data (무대는 비트별 데이터를 data.beats 로)"""
    if shot.get("beats") is not None:
        return {**shot["data"], "beats": [b["data"] for b in shot["beats"]]}
    return shot["data"]


def to_relative(ev_abs: Dict[str, Any], s_start: int) -> Dict[str, Any]:
    return _map_frames(ev_abs, lambda f: f - s_start)


def _sfx_for(shot, ev_abs, bank: SfxBank, pacing: Dict[str, Any]) -> List[Dict[str, Any]]:
    m = catalog.get(shot["module"])
    out = _sfx_from(catalog.sfx_map(m, shot["data"]), ev_abs, m["events"], bank, pacing)
    for bi, bev in enumerate(ev_abs.get("beats") or []):
        mapping = {k: v for k, v in m["beat_sfx"].items() if not (k == "at" and bi == 0)}  # 첫 비트 시작 = 샷 시작
        out += _sfx_from(mapping, bev, {**m["beat_events"], "at": {"kind": "single"}}, bank, pacing)
    return out


def _sfx_from(mapping, ev_abs, events, bank: SfxBank, pacing: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for name, cat in mapping.items():
        frames = ev_abs.get(name)
        if frames is None:
            continue
        frames = frames if isinstance(frames, list) else [frames]
        every = pacing["stagger_sfx_every"] if events[name]["kind"] == "stagger" else 1
        cats = []
        for c in (cat if isinstance(cat, list) else [cat]):
            c = pacing["sfx_replace"].get(c, c)
            if c and c not in cats:
                cats.append(c)
        for j, f in enumerate(frames):
            if j % every:
                continue
            for c in cats:
                clip = bank.clip(c, f, gain_db=pacing["sfx_gain_db"])
                if clip:
                    out.append(clip)
    return out


SIZES = {"16:9": (1920, 1080), "9:16": (1080, 1920)}


def build_long_props(plan, chapter_voices, track, style: Dict[str, Any], aspect: str = "16:9",
                     header: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    style: styles.py 프로필 ({"theme", "pacing"})
    aspect: "16:9" 롱폼 | "9:16" 쇼츠 (템플릿은 가운데 정사각형 무대에, 위에 header 제목 띠)
    header: 쇼츠 제목 띠 {"text": "두 줄은 \\n", "emphasis": "강조 구절"}
    """
    if aspect not in SIZES:
        raise ValueError(f"지원하지 않는 화면비: {aspect} (가능: {list(SIZES)})")
    width, height = SIZES[aspect]
    theme, pacing = style["theme"], style["pacing"]
    grid = BeatGrid(track["bpm"], 60 * FPS * 20)
    bank = SfxBank()
    shots, voice, intervals, captions, chapters_out, sfx = [], [], [], [], [], []
    highlights = []
    for ch in plan["chapters"]:
        for s in ch["shots"]:
            for k in ("highlight", "big"):
                if s["data"].get(k):
                    highlights.append(str(s["data"][k]))

    frame = 0
    for ci, ch in enumerate(plan["chapters"]):
        base = CHAPTER_BASES[ci % len(CHAPTER_BASES)]
        chapters_out.append({"title": ch["title"], "start": frame})
        if ci > 0:
            card = round(CHAPTER_CARD_BEATS * grid.fpb)
            shots.append({"id": f"ch{ci}", "label": "CHAPTER", "bg": "deep", "start": frame, "duration": card,
                          "layers": [{"module": "chapter_card", "data": {"index": ci, "title": ch["title"]}, "ev": {"in": 3}}], "_module": "chapter_card"})
            frame += card
        v = chapter_voices[ci]
        nar = ChapterNarration(chapter_text(ch), v["char_times"], frame + VOICE_LEAD)
        voice.append({"src": v["audio_src"], "from": nar.lead, "duration": math.ceil(v["clip_end"] * FPS / 1000)})
        intervals += _speech_intervals(nar)  # type: ignore[arg-type]

        ranges, pos = [], 0
        for s in ch["shots"]:
            n = len(clean_text(s["narration"]))
            ranges.append((pos, pos + n))
            pos += n
        starts = []
        for si, (lo, hi) in enumerate(ranges):
            st = frame if si == 0 else max(starts[-1] + 15, grid.snap(nar.f_start(lo) - 3))
            starts.append(st)
        ch_end = nar.last_frame + CHAPTER_TAIL
        for si, s in enumerate(ch["shots"]):
            s_start = starts[si]
            s_end = starts[si + 1] if si + 1 < len(starts) else ch_end
            ev_abs = shot_events(s, nar, ranges[si], s_start, s_end, grid, pacing["stagger_beats"])
            sfx += [c for c in _sfx_for(s, ev_abs, bank, pacing) if c["from"] < s_end]
            ev_rel = to_relative(ev_abs, s_start)
            bg = catalog.get(s["module"]).get("bg") or base
            if bg == base == "alt" and s["module"] == "contrast":
                bg = "deep"
            shots.append({"id": s["id"], "label": s["module"].upper(), "bg": bg, "start": s_start, "duration": s_end - s_start,
                          "layers": [{"module": s["module"], "data": layer_data(s), "ev": ev_rel}], "_module": s["module"]})

        # 자막
        cursor = 0
        caps = []
        for chunk in split_text_word_safe(chapter_text(ch), max_len=16 if aspect == "16:9" else 14):
            n = len(clean_text(chunk))
            if not n:
                continue
            caps.append({"text": chunk, "start": nar.f_start(cursor), "highlight": [h for h in highlights if h in chunk]})
            cursor += n
        for i, c in enumerate(caps):
            c["end"] = caps[i + 1]["start"] if i + 1 < len(caps) else nar.last_frame + 8
        captions += caps
        frame = ch_end

    total = frame + END_TAIL
    shots[-1]["duration"] = total - shots[-1]["start"]

    transitions = []
    for i in range(1, len(shots)):
        prev, cur = shots[i - 1], shots[i]
        if cur["bg"] == prev["bg"]:
            prev["exit"] = True
            continue
        role = "chapter" if cur["_module"] == "chapter_card" else ("counter" if cur["_module"] == "counter" else "default")
        kind = pacing["transitions"][role]
        dur = pacing["transition_frames"]
        tr = {"type": kind, "frame": cur["start"], "duration": dur}
        next_bg = theme["surfaces"][cur["bg"]]["bg"]
        if kind == "iris":
            tr["colors"] = [theme["surfaces"]["accent"]["bg"]]
        elif kind in ("fade", "slide"):
            tr["colors"] = [next_bg, theme["primary"]]
        transitions.append(tr)
        tsfx = pacing["transition_sfx"].get(kind)
        if tsfx:
            clip = bank.clip(tsfx[0], cur["start"] - dur // 2, gain_db=tsfx[1])
            if clip:
                sfx.append(clip)
    for s in shots:
        s.pop("_module", None)

    gain = lambda target: round(10 ** ((target - track["lufs"]) / 20.0), 4)  # noqa: E731
    return {
        "width": width, "height": height, "fps": FPS, "total_frames": total, "bpm": track["bpm"],
        "beat_frames": [b for b in grid.frames if b <= total], "theme": theme, "shots": shots,
        "transitions": transitions, "voice": voice, "sfx": sorted(sfx, key=lambda x: x["from"]),
        "music": {"src": track["file"], "trimBefore": round(track.get("first_beat_sec", 0) * FPS),
                  "open": gain(pacing["music_open_lufs"]), "under_voice": gain(pacing["music_under_voice_lufs"])},
        "narration_intervals": intervals, "captions": captions, "chapters": chapters_out,
        "hud": {"title": (header or {}).get("text") or "", "emphasis": (header or {}).get("emphasis") or ""},
    }
