"""
LONGEPASS 에이전트 방식 명령 (bin/lp). 순서는 .claude/skills/make-video/SKILL.md, 규칙은 CHANNEL.md.

  bin/lp where | list
  bin/lp new <slug> "제목" [--draft 초안.md]       작업 폴더 만들기
  bin/lp status <slug> | stage <slug> <단계> [남은 일 …] | log <slug> "결정 내용"
  bin/lp templates                                  쓸 수 있는 템플릿과 칸 (studio catalog)
  bin/lp search <slug> "검색어" [--site a,b] [--video] [--portrait]     소재 찾기 (스톡·커먼즈)
  bin/lp get <slug> <번호|File:…> <id> [--start 초 --dur 초] [--focus x,y]   받기 + 출처 기록
  bin/lp capture <slug> <URL> <id> --name "출처" [--width W --height H] [--mobile]   화면 캡처 (공고·기사)
  bin/lp add <slug> <파일> <id> --credit "…" --license "…" [--source URL]   직접 가진 파일
  bin/lp plan <slug>                                raw_plan.json → plan.json (검증·자료 확인)
  bin/lp tts <slug> [--force] [--chapter N …]       나레이션 음성 + 글자 시각
  bin/lp job <slug> [--silent]                      job.json + 렌더링 없이 점검
  bin/lp preview <slug> [--key]                     샷별 정지 화면 (render/preview/)
  bin/lp render <slug>                              최종 영상 (사람이 요청할 때만)
  bin/lp thumb <slug>                               썸네일 (render/thumbnail.jpg)

결과는 JSON 으로 stdout, 진행 로그는 stderr.
"""
import argparse
import json
import logging
import os
import sys

from agent import build, capture, config, episode, sources, tts
from agent.episode import Episode


def _out(data) -> None:
    sys.stdout.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main(argv=None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s", stream=sys.stderr)
    p = argparse.ArgumentParser(prog="lp", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("where")
    sub.add_parser("list")
    sub.add_parser("templates")
    s = sub.add_parser("new"); s.add_argument("slug"); s.add_argument("title"); s.add_argument("--draft")
    s = sub.add_parser("status"); s.add_argument("slug")
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
    a = p.parse_args(argv)
    cfg = config.load()
    focus = None
    if getattr(a, "focus", None):
        focus = [float(x) for x in a.focus.split(",")][:2]

    if a.cmd == "where":
        _out({"workspace": cfg["workspace"], "workspace_ok": os.path.isdir(cfg["workspace"]),
              "env": config.ENV_PATH if os.path.exists(config.ENV_PATH) else None, "config": config.CONFIG_PATH, "keys": config.KEYS_PATH,
              "tts": bool(cfg["tts"].get("url")), "stt": bool(cfg["stt"].get("url")), "key_sites": sorted(config.keys())})
        return 0
    if a.cmd == "list":
        _out(episode.list_episodes(cfg))
        return 0
    if a.cmd == "templates":
        from studio import catalog
        from studio.styles import get_style
        sys.stdout.write(catalog.catalog_text(catalog.candidates(cfg["project"], get_style(cfg["style"]))) + "\n")
        return 0
    ep = Episode(a.slug, cfg)
    if a.cmd == "new":
        ep.create(a.title, a.draft)
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
        with open(ep.p("plan.json"), "r", encoding="utf-8") as f:
            plan = json.load(f)
        res = tts.build_voices(ep, plan, force=a.force, only=a.chapter)
        ep.log(f"나레이션 음성 {len(res['chapters'])}장 (경고 {len(res['warnings'])})")
        _out({"chapters": [{"audio": c["audio"], "sec": round(c["clip_end"] / 1000, 1), "sentences": len(c.get("sentences", []))} for c in res["chapters"]],
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
    return 0


if __name__ == "__main__":
    sys.exit(main())
