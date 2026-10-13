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
    """글자 사이가 gap_ms 이상 비면 끊어서, 실제로 말하는 구간만 (음악은 쉼에서 다시 올라온다). nar: ChapterNarration"""
    out, a = [], 0
    for i in range(1, len(nar.times)):
        if nar.times[i][0] - nar.times[i - 1][1] > gap_ms or i in nar.pauses:
            out.append([nar.f_start(a), nar.f_end(i - 1)])
            a = i
    out.append([nar.f_start(a), nar.f_end(len(nar.times) - 1)])
    return out


VOICE_LEAD = 6
CHAPTER_TAIL = 14
END_TAIL = 45
CHAPTER_CARD_BEATS = 4
BRAND_HOLD = 10        # 훅 내레이션이 끝나고 브랜드 인트로가 시작되기까지
FIRST_EVENT_MAX = 15   # 샷이 시작되고 첫 요소가 나타나기까지 최대 (그 전엔 화면이 비어 보인다)
# 샷의 마지막 요소가 나타난 뒤 다음 샷(또는 장 끝)까지 최소 프레임 = 등장 애니메이션 + 멈춰 보이는 시간 + 전환 앞 절반.
# 모자라면 다음 샷 내레이션 앞에 쉼을 넣는다 (음성을 그 자리에서 나눠 뒤로 민다). 장의 마지막 샷이면 장 끝을 늘린다
LAST_EVENT_HOLD = 45
# 배경 역할 이름 (실제 색은 styles.py 프로필). 챕터마다 주 바탕(theme.primary_surface)과 반대 바탕을 번갈아 쓴다.
# 명세의 bg "primary" = 주 바탕


def surface_roles(theme: Dict[str, Any]) -> Tuple[str, List[str]]:
    """(주 바탕, 챕터 바탕 순서)"""
    prim = theme.get("primary_surface") or "base"
    return prim, [prim, "alt" if prim == "base" else "base"]


def chapter_text(ch: Dict[str, Any]) -> str:
    return "".join(s["narration"] for s in ch["shots"])


# ---------------------------------------------------------------- 타임라인
class ChapterNarration:
    """
    챕터 내레이션(TTS 한 파일)의 글자별 시각 → 영상 프레임.
    pauses: {글자 위치: 프레임} 그 글자부터 뒤를 그만큼 더 민다 (무음 장면을 끼우거나 샷의 마지막 요소를 보여 줄 쉼.
            음성도 그 자리에서 나눠 재생 — voice_clips)
    """
    def __init__(self, text: str, char_times: List[Tuple[float, float]], lead: int, pauses: Optional[Dict[int, int]] = None):
        self.clean = clean_text(text)
        self.times = char_times
        self.lead = lead
        self.pauses = dict(sorted((pauses or {}).items()))

    def _off(self, i: int) -> int:
        return sum(f for at, f in self.pauses.items() if i >= at)

    def cut(self, i: int) -> int:
        """i 번째 글자 앞에서 음성을 자를 위치 (음성 파일 기준 프레임, 앞 글자 끝과 이 글자 시작의 가운데)"""
        return round((self.times[i - 1][1] + self.times[i][0]) / 2 * FPS / 1000)

    def voice_clips(self, src: str, clip: int) -> List[Dict[str, Any]]:
        """쉼 자리마다 음성을 나눠 미룬 재생 목록"""
        cuts = [0] + [self.cut(at) for at in self.pauses] + [clip]
        offs = [0] + [self._off(at) for at in self.pauses]
        out = []
        for j in range(len(cuts) - 1):
            c = {"src": src, "from": self.lead + cuts[j] + offs[j], "duration": max(1, cuts[j + 1] - cuts[j])}
            if j:
                c["trimBefore"] = cuts[j]
            out.append(c)
        return out

    def f_start(self, i: int) -> int:
        i = min(i, len(self.times) - 1)
        return self.lead + round(self.times[i][0] * FPS / 1000) + self._off(i)

    def f_end(self, i: int) -> int:
        i = min(i, len(self.times) - 1)
        return self.lead + round(self.times[i][1] * FPS / 1000) + self._off(i)

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
        cued = [at_phrase(phrases[i]) if i < len(phrases) else None for i in range(count)]
        # 항목은 순서대로 나타나야 한다. 단서 구절을 말하는 순서가 항목 순서와 어긋나면(예: 1번 항목 구절을 문장 끝에서 말함)
        # 뒤 항목들이 모두 그 뒤로 밀려 샷 끝에 몰려 나온다 → 말하는 순서가 맞는 단서들만 그대로 쓰고,
        # 어긋난 단서의 항목은 앞뒤로 맞는 단서 사이에 고르게 놓는다
        keep = _in_order(cued)
        frames = []
        for i in range(count):
            f = cued[i]
            if f is not None and i not in keep:
                left = max((k for k in keep if k < i), default=None)
                right = min((k for k in keep if k > i), default=None)
                li, lf = (left, cued[left]) if left is not None else (-1, sp_a)
                ri, rf = (right, cued[right]) if right is not None else (count, sp_b)
                f = round(lf + (rf - lf) * (i - li) / (ri - li))
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


def _in_order(frames: List[Optional[int]]) -> set:
    """단서 시점 목록에서 항목 순서대로 증가하는 가장 긴 묶음의 위치들 (None 은 빼고). 모두 순서대로면 전부"""
    idx = [i for i, f in enumerate(frames) if f is not None]
    best: Dict[int, List[int]] = {}
    for i in idx:
        prev = [best[j] for j in best if frames[j] < frames[i]]
        best[i] = max(prev, key=len, default=[]) + [i]
    return set(max(best.values(), key=len, default=[]))


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
    ev = _map_frames(ev, lambda f: min(max(f, s_start + 2), s_end - 8) if f != s_start else f)
    # 화면이 비어 있지 않게: 가장 먼저 나오는 요소가 FIRST_EVENT_MAX 보다 늦으면 그 하나만 앞으로 당긴다 (나머지는 말에 맞춰)
    frames: List[int] = []
    _map_frames({k: v for k, v in ev.items() if k != "beats"}, frames.append)
    for b in ev.get("beats", [])[:1]:
        _map_frames({k: v for k, v in b.items() if k != "at"}, frames.append)
    first = min(frames, default=s_start)
    if first > s_start + FIRST_EVENT_MAX:
        done = []
        def pull(f):
            if f == first and not done:
                done.append(1)
                return s_start + FIRST_EVENT_MAX
            return f
        ev = {k: (v if k == "beats" else _map_frames(v, pull)) for k, v in ev.items()}
        if not done and ev.get("beats"):
            ev["beats"][0] = {k: (v if k == "at" else _map_frames(v, pull)) for k, v in ev["beats"][0].items()}
    return ev


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


def _layout_chapter(ch, char_times, frame: int, ranges: List[Tuple[int, int]], split: Optional[int], brand_len: int,
                    grid: BeatGrid, pacing: Dict[str, Any]) -> Dict[str, Any]:
    """
    장 하나의 샷 배치 → {nar, brand_at, ch_end, shots: [(시작, 끝, 이벤트)]}.
    샷 경계 = 다음 샷 내레이션 시작. 샷의 마지막 요소가 나온 뒤 LAST_EVENT_HOLD 가 안 되면 다음 샷 앞에 쉼을 넣고
    (장의 마지막 샷이면 장 끝을 늘리고) 처음부터 다시 배치한다 — 나타나자마자 화면이 넘어가 요소를 못 보는 일 방지.
    split: 훅(첫 샷) 뒤 브랜드 인트로를 끼울 글자 위치 (없으면 None)
    """
    holds: Dict[int, int] = {}   # 글자 위치 → 앞 샷의 마지막 요소를 보여 줄 쉼 (프레임)
    tail = 0
    for _ in range(8 * len(ranges) + 8):
        pauses = dict(holds)
        if split is not None:
            pauses[split] = pauses.get(split, 0) + BRAND_HOLD + brand_len
        nar = ChapterNarration(chapter_text(ch), char_times, frame + VOICE_LEAD, pauses)
        brand_at = nar.lead + nar.cut(split) + holds.get(split, 0) + BRAND_HOLD if split is not None else None
        starts: List[int] = []
        for si, (lo, _hi) in enumerate(ranges):
            st = frame if si == 0 else max(starts[-1] + 15, grid.snap(nar.f_start(lo) - 3))
            if si == 1 and brand_at is not None:
                st = max(st, brand_at + brand_len)
            starts.append(st)
        ch_end = nar.last_frame + CHAPTER_TAIL + tail
        placed, grow = [], None
        for si, s in enumerate(ch["shots"]):
            s_start = starts[si]
            s_end = starts[si + 1] if si + 1 < len(starts) else ch_end
            if si == 0 and brand_at is not None:
                s_end = brand_at
            ev_abs = shot_events(s, nar, ranges[si], s_start, s_end, grid, pacing["stagger_beats"])
            placed.append((s_start, s_end, ev_abs))
            frames: List[int] = []
            _map_frames(ev_abs, frames.append)
            need = max(frames, default=s_start) + LAST_EVENT_HOLD - s_end
            if need > 0 and grow is None:
                grow = (si, need)
        if grow is None:
            break
        si, need = grow
        at = ranges[si + 1][0] if si + 1 < len(ranges) else None
        if at is not None and 0 < at < len(char_times):
            holds[at] = holds.get(at, 0) + need
        else:
            tail += need
    return {"nar": nar, "brand_at": brand_at, "ch_end": ch_end, "shots": placed}


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

    prim, bases = surface_roles(theme)
    # 브랜드 인트로: 롱폼에서 첫 장의 훅(첫 샷) 바로 뒤에 (스타일 pacing.brand_intro 가 있을 때, 첫 장에 샷이 2개 이상일 때)
    brand = pacing.get("brand_intro") if aspect == "16:9" else None

    frame = 0
    for ci, ch in enumerate(plan["chapters"]):
        base = bases[ci % len(bases)]
        chapters_out.append({"title": ch["title"], "start": frame})
        if ci > 0:
            card = round(CHAPTER_CARD_BEATS * grid.fpb)
            shots.append({"id": f"ch{ci}", "label": "CHAPTER", "bg": "deep", "start": frame, "duration": card,
                          "layers": [{"module": "chapter_card", "data": {"index": ci, "title": ch["title"]}, "ev": {"in": 3}}], "_module": "chapter_card"})
            frame += card
        if ci < len(chapter_voices):
            v = chapter_voices[ci]
        else:
            # 더미 음성 (프리뷰/검수용: 글자당 200ms 기준 더미 타이밍)
            clean_ch = "".join(clean_text(s["narration"]) for s in ch["shots"])
            dummy_char_times = []
            cur_ms = 0.0
            for _ in clean_ch:
                dummy_char_times.append([cur_ms, cur_ms + 180.0])
                cur_ms += 200.0
            v = {
                "audio_src": "",
                "char_times": dummy_char_times,
                "clip_end": cur_ms + 300.0
            }
        ranges, pos = [], 0
        for s in ch["shots"]:
            n = len(clean_text(s["narration"]))
            ranges.append((pos, pos + n))
            pos += n
        clip = math.ceil(v["clip_end"] * FPS / 1000)
        split, brand_len = None, 0
        if ci == 0 and brand and len(ch["shots"]) >= 2 and 0 < ranges[1][0] < len(v["char_times"]):
            split = ranges[1][0]   # 훅(첫 샷) 마지막 글자와 다음 글자 사이에 브랜드 인트로
            brand_len = round(max(2, round(brand.get("sec", 2.2) * FPS / grid.fpb)) * grid.fpb)   # 약 sec 초, 박자 단위
        lay = _layout_chapter(ch, v["char_times"], frame, ranges, split, brand_len, grid, pacing)
        nar, brand_at, ch_end = lay["nar"], lay["brand_at"], lay["ch_end"]
        voice += nar.voice_clips(v["audio_src"], clip)
        intervals += _speech_intervals(nar)  # type: ignore[arg-type]

        for si, s in enumerate(ch["shots"]):
            if si == 1 and brand_at is not None:
                shots.append({"id": "brand", "label": "BRAND", "bg": prim, "start": brand_at, "duration": brand_len,
                              "layers": [{"module": "brand_intro", "data": {"tagline": theme["brand"].get("tagline") or ""}, "ev": {"in": 2}}],
                              "_module": "brand_intro"})
                for cat, at, gain in brand.get("sfx", []):
                    c = bank.clip(cat, brand_at + round(at * brand_len), gain_db=gain)
                    if c:
                        sfx.append(c)
            s_start, s_end, ev_abs = lay["shots"][si]
            sfx += [c for c in _sfx_for(s, ev_abs, bank, pacing) if c["from"] < s_end]
            ev_rel = to_relative(ev_abs, s_start)
            bg = catalog.get(s["module"]).get("bg") or base
            bg = prim if bg == "primary" else bg
            if bg == base == "alt" and s["module"] == "contrast":
                bg = "deep"
            shots.append({"id": s["id"], "label": s["module"].upper(), "bg": bg, "start": s_start, "duration": s_end - s_start,
                          "layers": [{"module": s["module"], "data": layer_data(s), "ev": ev_rel}], "_module": s["module"]})

        # 자막 (브랜드 인트로로 나뉜 장은 앞뒤를 따로: 인트로 동안 자막이 남지 않게)
        cursor = 0
        parts = [ch["shots"]] if split is None else [ch["shots"][:1], ch["shots"][1:]]
        for part in parts:
            caps = []
            for chunk in split_text_word_safe("".join(sh["narration"] for sh in part), max_len=16 if aspect == "16:9" else 14):
                n = len(clean_text(chunk))
                if not n:
                    continue
                caps.append({"text": chunk, "start": nar.f_start(cursor), "highlight": [h for h in highlights if h in chunk]})
                cursor += n
            for i, c in enumerate(caps):
                c["end"] = caps[i + 1]["start"] if i + 1 < len(caps) else nar.f_end(cursor - 1) + 8
            captions += caps
        if ci == 0 and brand and split is None:
            # 첫 장이 훅 하나뿐이면 첫 장 끝에 브랜드 인트로
            brand_len = round(max(2, round(brand.get("sec", 2.2) * FPS / grid.fpb)) * grid.fpb)
            shots.append({"id": "brand", "label": "BRAND", "bg": prim, "start": ch_end, "duration": brand_len,
                          "layers": [{"module": "brand_intro", "data": {"tagline": theme["brand"].get("tagline") or ""}, "ev": {"in": 2}}],
                          "_module": "brand_intro"})
            for cat, at, gain in brand.get("sfx", []):
                c = bank.clip(cat, ch_end + round(at * brand_len), gain_db=gain)
                if c:
                    sfx.append(c)
            ch_end += brand_len
        frame = ch_end

    total = frame + END_TAIL
    shots[-1]["duration"] = total - shots[-1]["start"]

    transitions = []
    for i in range(1, len(shots)):
        prev, cur = shots[i - 1], shots[i]
        branded = "brand_intro" in (prev["_module"], cur["_module"])   # 브랜드 인트로 앞뒤는 배경이 같아도 전환
        if cur["bg"] == prev["bg"] and not branded:
            prev["exit"] = True
            continue
        role = "chapter" if cur["_module"] == "chapter_card" or branded else ("counter" if cur["_module"] == "counter" else "default")
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
