"""
템플릿 갤러리: 모든 템플릿의 예시(manifest examples)를 스타일별로 렌더링해 한 페이지로 본다.

  bin/studio gallery                                 # 모든 스타일
  bin/studio gallery longepass                       # 특정 스타일만
  bin/studio gallery longepass --only board,flow     # 일부 템플릿만 (작업 중 빠른 확인)
  bin/studio gallery longepass --aspect 9:16         # 세로 쇼츠 화면에서 (out/gallery/9x16)

결과 (GALLERY_DIR):
  reel_<style>.mp4   예시들을 이어 붙인 무음 영상 (움직임 확인)
  <style>/<id>_<n>.png  각 예시가 다 그려진 순간의 정지 화면
  index.html         템플릿 × 스타일 표
새 스타일을 만들면 여기서 모든 템플릿이 그 모습으로 어떻게 보이는지 한 번에 확인한다.
LLM/TTS 호출 없음 (내레이션 시각은 글자 수로 가정).
"""
import html
import json
import logging
import os
import subprocess
from typing import Any, Dict, List, Optional

from studio import catalog
from studio.render import remotion_render
from studio.styles import get_style, list_styles
from studio.text import clean_text
from studio.timeline import FPS, SIZES, BeatGrid, ChapterNarration, layer_data, shot_events, to_relative

logger = logging.getLogger("studio.gallery")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MUSIC_LIBRARY = os.path.join(ROOT, "public", "music", "library.json")
GALLERY_DIR = os.getenv("STUDIO_GALLERY_DIR", os.path.join(ROOT, "out", "gallery"))
SAMPLE_HEADER = {"text": "考照領錢\n四個重點一次看", "emphasis": "四個重點"}   # 세로 갤러리의 제목 띠 예시

MS_PER_CHAR = 221      # 가정한 말 속도
LEAD = 10              # 샷 시작 후 말 시작까지
TAIL = 36              # 말 끝난 뒤 여운
SILENT_SHOT = 90       # 내레이션이 없는 예시(챕터 카드)의 길이


def _flatten(v, out: List[int]):
    if isinstance(v, dict):
        for x in v.values():
            _flatten(x, out)
    elif isinstance(v, list):
        for x in v:
            _flatten(x, out)
    else:
        out.append(v)


def _bg_for(m: Dict[str, Any]) -> str:
    return m.get("bg") or "base"


def _gallery_dir(aspect: str) -> str:
    return GALLERY_DIR if aspect == "16:9" else os.path.join(GALLERY_DIR, aspect.replace(":", "x"))


def build_props(style: Dict[str, Any], only: Optional[List[str]] = None, aspect: str = "16:9") -> Dict[str, Any]:
    bpm = next(t["bpm"] for t in json.load(open(MUSIC_LIBRARY, encoding="utf-8"))["tracks"] if t["id"] == style["pacing"]["music"])
    grid = BeatGrid(bpm, 60 * FPS * 20)
    shots, stills, frame = [], [], 0
    for tid, m in catalog.load().items():
        if only and tid not in only:
            continue
        if aspect != "16:9" and aspect not in m["aspect"] and not only:
            continue
        for n, ex in enumerate(m["examples"]):
            beats = ex.get("beats")
            narration = "".join(b["narration"] for b in beats) if beats else (ex.get("narration") or "")
            chars = len(clean_text(narration))
            if chars:
                times = [(i * MS_PER_CHAR, (i + 1) * MS_PER_CHAR) for i in range(chars)]
                nar = ChapterNarration(narration, times, frame + LEAD)
                dur = nar.last_frame + TAIL - frame
                shot = {"module": tid, "data": ex["data"], "cues": ex.get("cues") or {}, "beats": beats}
                ev_abs = shot_events(shot, nar, (0, chars), frame, frame + dur, grid, style["pacing"]["stagger_beats"])
            else:
                shot = {"module": tid, "data": ex["data"], "beats": beats}
                dur, ev_abs = SILENT_SHOT, {k: frame + 3 for k in m["events"]}
            ev = to_relative(ev_abs, frame)
            flat: List[int] = []
            _flatten(ev, flat)
            shots.append({"id": f"{tid}_{n}", "label": tid, "bg": _bg_for(m), "start": frame, "duration": dur,
                          "layers": [{"module": tid, "data": layer_data(shot), "ev": ev}]})
            stills.append({"id": tid, "n": n, "frame": frame + min(dur - 6, max(flat or [0]) + 30)})
            frame += dur
    props = {
        "width": SIZES[aspect][0], "height": SIZES[aspect][1], "fps": FPS, "total_frames": frame, "bpm": bpm,
        "beat_frames": [b for b in grid.frames if b <= frame], "theme": style["theme"], "shots": shots,
        "transitions": [], "voice": [], "sfx": [], "music": None, "narration_intervals": [], "captions": [], "chapters": [],
        "hud": {"title": SAMPLE_HEADER["text"], "emphasis": SAMPLE_HEADER["emphasis"]} if aspect != "16:9" else {},
    }
    return {"props": props, "stills": stills}


def render_style(name: str, only: Optional[List[str]] = None, aspect: str = "16:9") -> List[Dict[str, Any]]:
    style = get_style(name)
    built = build_props(style, only, aspect)
    gdir = _gallery_dir(aspect)
    out_dir = os.path.join(gdir, name)
    os.makedirs(out_dir, exist_ok=True)
    props_path = os.path.join(gdir, f"props_{name}.json")
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(built["props"], f, ensure_ascii=False)
    reel = os.path.join(gdir, f"reel_{name}{'_partial' if only else ''}.mp4")
    remotion_render(props_path, reel)
    for st in built["stills"]:
        st["file"] = f"{name}/{st['id']}_{st['n']}.png"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{st['frame'] / FPS:.3f}", "-i", reel, "-frames:v", "1",
                        "-vf", f"scale={960 if aspect == '16:9' else 360}:-1", os.path.join(gdir, st["file"])], check=True)
    logger.info(f"[gallery] {name}: 예시 {len(built['stills'])}개, {built['props']['total_frames'] / FPS:.0f}초")
    return built["stills"]


def write_html() -> str:
    """디스크에 렌더링돼 있는 모든 스타일 결과를 한 페이지로 (일부 스타일만 다시 렌더링해도 나머지가 남는다)"""
    styles = [s for s in list_styles() if os.path.isdir(os.path.join(GALLERY_DIR, s))]
    by_key = {}
    for s in styles:
        for tid, m in catalog.load().items():
            for n in range(len(m["examples"])):
                f = f"{s}/{tid}_{n}.png"
                if os.path.exists(os.path.join(GALLERY_DIR, f)):
                    by_key[(s, tid, n)] = f"{f}?v={int(os.path.getmtime(os.path.join(GALLERY_DIR, f)))}"
    cards = []
    for tid, m in catalog.load().items():
        scope = "공용" if m["scope"] == "common" else "전용: " + ", ".join(m["scope"])
        meta = f"{m['category']} · {scope} · {'/'.join(m['media'])} · {'/'.join(m['continuity'])} · {'/'.join(m['aspect'])}"
        imgs = []
        for n in range(len(m["examples"])):
            for s in styles:
                f = by_key.get((s, tid, n))
                if f:
                    imgs.append(f'<figure><img src="{html.escape(f)}" loading="lazy"><figcaption>{html.escape(s)}</figcaption></figure>')
        cards.append(f"""<section>
  <header><h2>{html.escape(m['name'])} <code>{tid}</code> <small>v{m['version']}</small></h2>
  <p class="meta">{html.escape(meta)}</p>
  <p><b>언제:</b> {html.escape(m['use_when'])}</p>
  {f"<p><b>피할 때:</b> {html.escape(m['avoid_when'])}</p>" if m.get('avoid_when') else ''}
  <p class="meta">연출 출처: {html.escape(m.get('inspired_by', ''))}</p></header>
  <div class="row">{''.join(imgs)}</div>
</section>""")
    reels = " · ".join(f'<a href="reel_{s}.mp4">{html.escape(s)} 릴 영상</a>' for s in styles)
    page = f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Template Gallery</title>
<style>
:root{{--bg:#f4f6fa;--card:#fff;--ink:#0f172a;--sub:#64748b;--line:#d6dce5}}
@media (prefers-color-scheme:dark){{:root{{--bg:#0b1426;--card:#13203a;--ink:#f1f5f9;--sub:#94a3b8;--line:#24324f}}}}
body{{margin:0;padding:24px 16px;background:var(--bg);color:var(--ink);font-family:-apple-system,'Noto Sans TC','Apple SD Gothic Neo',sans-serif}}
main{{max-width:1400px;margin:0 auto}} h1{{margin:0 0 4px}} .top{{color:var(--sub);margin-bottom:24px}}
section{{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;margin-bottom:18px}}
h2{{margin:0;font-size:20px}} h2 code{{font-size:14px;color:var(--sub)}} small{{color:var(--sub)}}
p{{margin:6px 0;font-size:14px;line-height:1.5}} .meta{{color:var(--sub);font-size:13px}}
.row{{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin-top:12px}}
figure{{margin:0}} img{{width:100%;border-radius:10px;border:1px solid var(--line);display:block}}
figcaption{{font-size:12px;color:var(--sub);margin-top:4px}}
</style></head><body><main>
<h1>템플릿 갤러리</h1><p class="top">템플릿 {len(catalog.load())}개 × 스타일 {len(styles)}개 · {reels}</p>
{''.join(cards)}
</main></body></html>"""
    path = os.path.join(GALLERY_DIR, "index.html")
    with open(path, "w", encoding="utf-8") as f:
        f.write(page)
    return path
