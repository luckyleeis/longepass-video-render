"""
LONGEPASS 에이전트 방식 명령 (bin/lp). 순서는 .claude/skills/make-video/SKILL.md, 규칙은 CHANNEL.md.

  bin/lp where | list
  bin/lp articles [--n 10] [--all]                  아직 영상이 없는 DB 글 (최근 수정 순, 사이트에 열리는 것만)
  bin/lp new <slug> --from-db                       DB 글로 작업 폴더 (draft.md · article.json, 업로드 대기열에 running 기록)
  bin/lp new <slug> "제목" [--draft 초안.md] [--short]   직접 준 초안으로 (--short = 세로 쇼츠 한 편)
  bin/lp status <slug> | stage <slug> <단계> [남은 일 …] | log <slug> "결정 내용"
  bin/lp templates                                  쓸 수 있는 템플릿과 칸 (studio catalog)
  bin/lp search <slug> "검색어" [--site a,b] [--video] [--portrait]     소재 찾기 (스톡·커먼즈)
  bin/lp get <slug> <번호|File:…> <id> [--start 초 --dur 초] [--focus x,y]   받기 + 출처 기록
  bin/lp capture <slug> <URL> <id> --name "출처" [--width W --height H] [--mobile]   화면 캡처 (공고·기사)
  bin/lp add <slug> <파일> <id> --credit "…" --license "…" [--source URL]   직접 가진 파일
  bin/lp plan <slug>                                raw_plan.json → plan.json (검증·자료 확인)
  bin/lp tts <slug> [--force] [--chapter N …]       나레이션 음성 + 글자 시각 (서버 타임스탬프, 장 번호는 1부터)
  bin/lp job <slug> [--silent]                      job.json + 렌더링 없이 점검
  bin/lp preview <slug> [--key]                     샷별 정지 화면 (render/preview/)
  bin/lp render <slug>                              최종 영상 (사람이 요청할 때만)
  bin/lp thumb <slug>                               썸네일 (render/thumbnail.jpg)
    plan·tts·job·preview·render·thumb 에 --short N (1|2) → 같은 글의 쇼츠 N (raw_plan_short_N.json → render/short_N.mp4)
  bin/lp publish <slug> [--dry-run]                 업로드 대기열에 넣기 (youtube.json + longform_videos ready, 사람이 요청할 때만)
  bin/lp release <slug>                             만들다 그만둠: 내 running 기록을 지워 백엔드가 다시 고를 수 있게

결과는 JSON 으로 stdout, 진행 로그는 stderr.
"""
import argparse
import json
import logging
import os
import sys

from agent import build, capture, config, db, episode, sources, tts
from agent.episode import Episode, part_name


def _out(data) -> None:
    sys.stdout.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main(argv=None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s", stream=sys.stderr)
    p = argparse.ArgumentParser(prog="lp", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("where")
    sub.add_parser("list")
    s = sub.add_parser("articles"); s.add_argument("--n", type=int, default=10); s.add_argument("--all", action="store_true", help="사이트에 아직 안 열리는 글도")
    s = sub.add_parser("templates"); s.add_argument("--short", action="store_true", help="쇼츠(9:16)에서 쓸 수 있는 것만")
    s = sub.add_parser("new"); s.add_argument("slug"); s.add_argument("title", nargs="?"); s.add_argument("--draft")
    s.add_argument("--from-db", action="store_true", help="DB articles 의 글로 (slug = 글 slug)")
    s.add_argument("--short", action="store_true", help="세로 쇼츠 한 편 (9:16, 숏폼 읽기 지시)")
    s = sub.add_parser("status"); s.add_argument("slug")
    s = sub.add_parser("publish"); s.add_argument("slug"); s.add_argument("--dry-run", action="store_true", help="파일만 쓰고 DB 는 시험 후 되돌림")
    s = sub.add_parser("release"); s.add_argument("slug")
    s = sub.add_parser("stage"); s.add_argument("slug"); s.add_argument("stage", choices=episode.STAGES); s.add_argument("todo", nargs="*")
    s = sub.add_parser("log"); s.add_argument("slug"); s.add_argument("text")
    s = sub.add_parser("search"); s.add_argument("slug"); s.add_argument("query"); s.add_argument("--site"); s.add_argument("--video", action="store_true")
    s.add_argument("--portrait", action="store_true"); s.add_argument("--n", type=int, default=6)
    s = sub.add_parser("get"); s.add_argument("slug"); s.add_argument("ref"); s.add_argument("id"); s.add_argument("--start", type=float)
    s.add_argument("--dur", type=float); s.add_argument("--focus")
    s = sub.add_parser("capture"); s.add_argument("slug"); s.add_argument("url"); s.add_argument("id"); s.add_argument("--width", type=int, default=1440)
    s.add_argument("--height", type=int, default=1000); s.add_argument("--mobile", action="store_true"); s.add_argument("--wait", type=int, default=2000)
    s.add_argument("--name", default="", help="출처 이름 (기관명, 언론사 + 날짜) — 화면 오른쪽 옆에 표기")
    s = sub.add_parser("add"); s.add_argument("slug"); s.add_argument("file"); s.add_argument("id"); s.add_argument("--credit", required=True)
    s.add_argument("--license", required=True); s.add_argument("--source", default=""); s.add_argument("--title", default=""); s.add_argument("--focus")
    s = sub.add_parser("plan"); s.add_argument("slug")
    s = sub.add_parser("tts"); s.add_argument("slug"); s.add_argument("--force", action="store_true"); s.add_argument("--chapter", type=int, nargs="*")
    s = sub.add_parser("job"); s.add_argument("slug"); s.add_argument("--silent", action="store_true")
    s = sub.add_parser("preview"); s.add_argument("slug"); s.add_argument("--key", action="store_true", help="핵심 샷 6개만")
    s = sub.add_parser("render"); s.add_argument("slug")
    s = sub.add_parser("thumb"); s.add_argument("slug")
    for name in ("plan", "tts", "job", "preview", "render", "thumb"):
        sub.choices[name].add_argument("--short", type=int, choices=[1, 2], help="같은 글의 쇼츠 N (raw_plan_short_N.json)")
    a = p.parse_args(argv)
    cfg = config.load()
    focus = None
    if getattr(a, "focus", None):
        focus = [float(x) for x in a.focus.split(",")][:2]

    if a.cmd == "where":
        _out({"workspace": cfg["workspace"], "workspace_ok": os.path.isdir(cfg["workspace"]),
              "env": config.ENV_PATH if os.path.exists(config.ENV_PATH) else None, "config": config.CONFIG_PATH, "keys": config.KEYS_PATH,
              "tts": cfg["tts"].get("url") or None, "voice": cfg["tts"].get("voice"), "key_sites": sorted(config.keys()), **db.config_ok()})
        return 0
    if a.cmd == "articles":
        _out(db.candidates(a.n, check_live=not a.all))
        return 0
    if a.cmd == "list":
        _out(episode.list_episodes(cfg))
        return 0
    if a.cmd == "templates":
        from studio import catalog
        from studio.styles import get_style
        sys.stdout.write(catalog.catalog_text(catalog.candidates(cfg["project"], get_style(cfg["style"]), "9:16" if a.short else "16:9")) + "\n")
        return 0
    part = part_name(a.short) if a.cmd in ("plan", "tts", "job", "preview", "render", "thumb") else None
    ep = Episode(a.slug, cfg, part)
    if a.cmd == "new":
        if a.from_db:
            _out(new_from_db(ep, a.title, a.short))
        else:
            if not a.title:
                p.error("new: 제목이 필요함 (DB 글이면 --from-db)")
            ep.create(a.title, a.draft, short=a.short)
            _out({"dir": ep.dir, **ep.status()})
        return 0
    ep.require()
    if a.cmd == "status":
        _out({"dir": ep.dir, **ep.status()})
    elif a.cmd == "stage":
        _out(ep.set_stage(a.stage, a.todo or None))
    elif a.cmd == "log":
        ep.log(a.text)
        _out({"ok": True})
    elif a.cmd == "search":
        res = sources.search(ep, a.query, a.site.split(",") if a.site else None, a.video, a.portrait, a.n)
        for it in res["items"]:
            print(sources.describe(it), file=sys.stderr)
        for n in res["notes"]:
            print(f"! {n}", file=sys.stderr)
        _out({"query": a.query, "count": len(res["items"]), "saved": "assets/_search.json", "notes": res["notes"]})
    elif a.cmd == "get":
        _out(sources.get(ep, a.ref, a.id, a.start, a.dur, focus))
    elif a.cmd == "capture":
        _out(capture.capture(ep, a.url, a.id, a.width, a.height, a.mobile, a.wait, source_name=a.name))
    elif a.cmd == "add":
        _out(sources.add_local(ep, a.file, a.id, a.credit, a.license, a.source, a.title, focus))
    elif a.cmd == "plan":
        plan = build.make_plan(ep)
        _out({"out": "plan.json", "report": plan["report"]})
    elif a.cmd == "tts":
        with open(ep.f("plan.json"), "r", encoding="utf-8") as f:
            plan = json.load(f)
        res = tts.build_voices(ep, plan, force=a.force, only=a.chapter)
        ep.log(f"나레이션 음성{' ' + ep.part if ep.part else ''} {len(res['chapters'])}장 (경고 {len(res['warnings'])})")
        _out({"form": res["form"], "chapters": [{"audio": c["audio"], "sec": round(c["clip_end"] / 1000, 1), "parts": len(c.get("parts", [])),
                                                 "timing": sorted({p["timing"] for p in c.get("parts", [])})} for c in res["chapters"]],
              "warnings": res["warnings"]})
    elif a.cmd == "job":
        job = build.make_job(ep, a.silent)
        meta = build.dry_run(ep)
        _out({"out": "job.json", "voiced_chapters": len(job["voices"]), "assets": len(job["assets"]), "duration_sec": meta["duration_sec"],
              "shots": meta["shots"], "warnings": meta.get("warnings", [])})
    elif a.cmd == "preview":
        _out(build.preview(ep, all_shots=not a.key))
    elif a.cmd == "render":
        _out(build.render(ep))
    elif a.cmd == "thumb":
        _out(build.thumbnail(ep))
    elif a.cmd == "publish":
        from agent import publish
        _out(publish.publish(ep, dry_run=a.dry_run))
    elif a.cmd == "release":
        st = ep.status()
        rid = (st.get("db") or {}).get("request_id")
        if not rid:
            raise ValueError("이 작업에는 DB 기록이 없음")
        n = db.release(rid)
        if n:
            st["db"] = {"request_id": rid, "status": "released"}
            ep.save_status(st)
            ep.log(f"DB 기록 지움 ({rid}) — 백엔드 자동 선택이 이 글을 다시 고를 수 있다")
        _out({"released": n, "request_id": rid, "note": None if n else "running 상태가 아니라 지우지 않음 (이미 ready 이상)"})
    return 0


def new_from_db(ep: Episode, title=None, short: bool = False) -> dict:
    """DB 글 → 작업 폴더 + draft.md + article.json, 그리고 longform_videos 에 running 기록 (백엔드 자동 선택이 건너뛰게)"""
    if short:
        raise ValueError("DB 글은 롱폼 + 쇼츠 세트로 만든다 — --short 없이 만들고, 쇼츠는 plan/tts/… --short N")
    if ep.exists():
        raise FileExistsError(f"이미 있음: {ep.dir} (이어 하기: bin/lp status {ep.slug})")
    art = db.article(ep.slug)
    if not art:
        raise ValueError(f"DB 에 글이 없음: {ep.slug} (bin/lp articles)")
    if not art["confirm"] or art["discarded"]:
        raise ValueError(f"확정되지 않았거나 폐기된 글: {ep.slug}")
    last = db.latest_record(ep.slug)
    if last and last["status"] in db.BUSY:
        raise ValueError(f"이미 영상 기록이 있음: {last['request_id']} ({last['status']}, {last.get('style')}) — 다른 글을 고른다")
    moved = ep.archive_foreign()
    fm = art.get("frontmatter") or {}
    ep.create(title or fm.get("title") or ep.slug)
    with open(ep.p("draft.md"), "w", encoding="utf-8") as f:
        f.write(db.draft_markdown(art))
    with open(ep.p("article.json"), "w", encoding="utf-8") as f:
        json.dump(art, f, ensure_ascii=False, indent=2, default=str)
    rid = db.create_record(ep.slug, art["id"], ep.cfg["style"])
    st = ep.status()
    st["article"] = {"id": art["id"], "url": db.topic_url(ep.slug)}
    st["db"] = {"request_id": rid, "status": "running"}
    st["todo"] = ["초안(DB 글) 분석 + 조사로 정보 보태기 → notes.md (CHANNEL.md 「기본 데이터와 조사」)"]
    ep.save_status(st)
    ep.log(f"DB 글로 시작 (article {art['id']}, longform_videos {rid} running)" + (f" — 남아 있던 파일은 {os.path.relpath(moved, ep.dir)}/ 로 옮김" if moved else ""))
    return {"dir": ep.dir, "moved_old_files": moved, **st}


if __name__ == "__main__":
    sys.exit(main())
