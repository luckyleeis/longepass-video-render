"""
업로드 대기열에 넣기 (bin/lp publish) — 백엔드(py-macmini-server)의 업로드 예약이 그대로 가져가게 한다.

백엔드 publish.py 는 longform_videos 에서 status=ready 인 세트를 골라 {out_dir}/youtube.json 으로 Postiz 에 예약한다.
세트 = 롱폼 1 + 쇼츠 1~2 (쇼츠는 롱폼 다음 날부터 하루 하나). 그래서 여기서:
  1. 롱폼(render/<slug>.mp4 + thumbnail.jpg)과 쇼츠(render/short_N.mp4 + short_N_thumbnail.jpg) 1개 이상이 있는지 확인
  2. youtube.json · result.json 을 백엔드 pipeline.py 와 같은 모양으로 쓴다 (경로는 절대 경로 — NAS 가 같은 곳에 연결돼 있다)
     설명란 = 설명 + 챕터 + 해시태그 + 소재 출처 + 음악 출처
  3. longform_videos 기록을 ready 로 (out_dir·영상·썸네일·길이·report·shorts)
"""
import json
import os
from typing import Any, Dict, List, Optional

from agent import db
from agent.build import thumb_path
from agent.episode import Episode

YT_CHAPTER_MIN = 3        # 유튜브 챕터 규칙: 3개 이상, 각 10초 이상, 첫 챕터는 00:00 (백엔드와 같다)
YT_CHAPTER_MIN_SEC = 10


def _load(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def chapters_text(chapters: List[Dict[str, Any]], duration_sec: float) -> str:
    """유튜브 설명란 챕터. 10초가 안 되는 챕터는 합치고, 그래도 3개가 안 되면 넣지 않는다 (백엔드 _chapters_text)"""
    marks = [[0 if i == 0 else int(c["start_sec"]), c["title"]] for i, c in enumerate(chapters) if c.get("title")]
    while len(marks) > 1:
        ends = [m[0] for m in marks[1:]] + [int(duration_sec)]
        short = next((i for i, m in enumerate(marks) if ends[i] - m[0] < YT_CHAPTER_MIN_SEC), None)
        if short is None:
            break
        del marks[short if short > 0 else 1]
    if len(marks) < YT_CHAPTER_MIN:
        return ""
    return "\n".join(f"{s // 60:02d}:{s % 60:02d} {title}" for s, title in marks)


def credits_text(assets: List[Dict[str, Any]]) -> str:
    """표기 의무가 있는 소재(CC BY·CC BY-SA)만 설명란에 적는다 (2026-10-14 사용자: 사진·영상은 출처 표시 안 함).
    화면 캡처의 근거 출처는 계획의 description 에 「資料來源」으로 직접 쓴다"""
    lines, seen = [], set()
    for a in assets or []:
        lic = (a.get("license") or "").strip()
        if "cc by" not in lic.lower().replace("-", " "):
            continue
        line = "・" + "，".join(x for x in [a.get("credit"), lic, a.get("source")] if x)
        if line not in seen and line != "・":
            seen.add(line)
            lines.append(line)
    return "素材來源：\n" + "\n".join(lines) if lines else ""


def _music_credit(meta: Dict[str, Any]) -> str:
    a = (meta.get("music") or {}).get("attribution")
    return f"🎵 Music: {a}" if a else ""


def _description(plan: Dict[str, Any], meta: Dict[str, Any], chapters: str = "") -> str:
    tags = " ".join(plan.get("hashtags") or [])
    return "\n\n".join(x for x in [plan.get("description", ""), chapters, tags, credits_text(meta.get("assets")), _music_credit(meta)] if x)


def _part(ep: Episode, part: Optional[str]) -> Dict[str, Any]:
    """렌더링 결과 확인 → {plan, meta, video, thumbnail}"""
    e = Episode(ep.slug, ep.cfg, part)
    meta_path = e.p("render", f"{e.name}.json")
    video = e.p("render", f"{e.name}.mp4")
    thumb = thumb_path(e)
    label = part or "롱폼"
    for path, what in ((e.f("plan.json"), "계획"), (meta_path, "렌더링 메타"), (video, "영상"), (thumb, "썸네일")):
        if not os.path.exists(path):
            raise FileNotFoundError(f"{label} {what} 없음: {path}")
    meta = _load(meta_path)
    if not meta.get("video"):
        raise ValueError(f"{label}: 마지막 렌더링이 점검(--no-render)이었음 — bin/lp render {ep.slug}" + (f" --short {part[-1]}" if part else ""))
    if os.path.getmtime(e.f("plan.json")) > os.path.getmtime(video):
        raise ValueError(f"{label}: 계획이 렌더링보다 새것 — 다시 렌더링한다")
    return {"plan": _load(e.f("plan.json")), "meta": meta, "video": os.path.abspath(video), "thumbnail": os.path.abspath(thumb)}


def build(ep: Episode) -> Dict[str, Any]:
    """youtube.json · result.json 을 쓰고 DB 에 넣을 값을 돌려준다"""
    lf = _part(ep, None)
    shorts = [_part(ep, f"short_{k}") for k in (1, 2) if os.path.exists(ep.p("render", f"short_{k}.mp4"))]
    if not shorts:
        raise FileNotFoundError("쇼츠가 없음 — 업로드 세트는 롱폼 1 + 쇼츠 1~2 (bin/lp render <slug> --short 1)")
    for k, sh in enumerate(shorts, 1):
        if sh["meta"]["duration_sec"] > 60:
            raise ValueError(f"short_{k} 길이 {sh['meta']['duration_sec']}초 — 쇼츠는 60초 이하")
    plan, meta = lf["plan"], lf["meta"]
    chapters = chapters_text(meta["chapters"], meta["duration_sec"])
    youtube = {
        "title": plan.get("video_title"),
        "description": _description(plan, meta, chapters),
        "tags": [h.lstrip("#") for h in plan.get("hashtags", [])],
        "chapters": chapters,
        "captions": os.path.abspath(ep.p("render", f"{ep.slug}.srt")),
        "video": lf["video"],
        "thumbnail": lf["thumbnail"],
        "shorts": [{"title": sh["plan"].get("video_title"), "video": sh["video"], "thumbnail": sh["thumbnail"],
                    "description": _description(sh["plan"], sh["meta"]),
                    "tags": [h.lstrip("#") for h in sh["plan"].get("hashtags", [])]} for sh in shorts],
    }
    for k, it in enumerate([youtube] + youtube["shorts"]):
        name = "롱폼" if k == 0 else f"short_{k}"
        if not it["title"] or not it["description"]:
            raise ValueError(f"{name}: video_title·description 이 비었음 (raw_plan)")
        if len(it["title"]) > 100:
            raise ValueError(f"{name}: 제목 {len(it['title'])}자 — 유튜브는 100자까지")
    shorts_rec = [{"name": f"short_{k}", "angle": sh["plan"].get("angle"), "video": sh["video"], "thumbnail": sh["thumbnail"],
                   "duration_sec": sh["meta"]["duration_sec"], "music": (sh["meta"].get("music") or {}).get("id")}
                  for k, sh in enumerate(shorts, 1)]
    report = {**(plan.get("report") or {}), "made_by": "agent"}
    result = {"out_dir": os.path.abspath(ep.dir), "video": lf["video"], "thumbnail": lf["thumbnail"], "duration_sec": meta["duration_sec"],
              "shots": meta.get("shots"), "sfx": meta.get("sfx"), "music": (meta.get("music") or {}).get("id"), "report": report,
              "shorts": shorts_rec, "made_by": "agent"}
    _save(ep.p("youtube.json"), youtube)
    _save(ep.p("result.json"), result)
    return {"youtube": youtube, "fields": {"out_dir": result["out_dir"], "video_path": lf["video"], "thumbnail_path": lf["thumbnail"],
                                           "duration_sec": meta["duration_sec"], "report": report, "shorts": shorts_rec}}


def publish(ep: Episode, dry_run: bool = False) -> Dict[str, Any]:
    st = ep.status()
    built = build(ep)
    rid = (st.get("db") or {}).get("request_id")
    if not rid:
        art = db.article(ep.slug)
        if not art:
            raise ValueError(f"DB 에 글이 없음: {ep.slug} — 업로드 대기열은 DB 글로 만든 영상만 (bin/lp new --from-db)")
        last = db.latest_record(ep.slug)
        if last and last["status"] in db.BUSY:
            raise ValueError(f"이미 다른 기록이 있음: {last['request_id']} ({last['status']})")
        if dry_run:
            rid = "(새 기록)"
        else:
            rid = db.create_record(ep.slug, art["id"], ep.cfg["style"])
            st["db"] = {"request_id": rid, "status": "running"}
            ep.save_status(st)
    else:
        last = db.latest_record(ep.slug)
        if last and last["request_id"] != rid:
            raise ValueError(f"이 글의 최근 기록이 내 것이 아님: {last['request_id']} ({last['status']}) — 확인 필요")
    summary = {"request_id": rid, "youtube_json": ep.p("youtube.json"), "title": built["youtube"]["title"],
               "shorts": [s["title"] for s in built["youtube"]["shorts"]], "duration_sec": built["fields"]["duration_sec"]}
    if dry_run:
        if rid.startswith("lp-"):
            db.set_ready(rid, built["fields"], commit=False)   # 쓰기 시험 (되돌림)
        return {"status": "dry_run", **summary}
    row = db.set_ready(rid, built["fields"])
    st["db"] = {"request_id": rid, "status": "ready"}
    ep.save_status(st)
    ep.log(f"업로드 대기열에 넣음 (longform_videos {rid} → ready, 쇼츠 {len(built['fields']['shorts'])}개)")
    return {"status": row["status"], **summary}
