"""
video-studio 명령 (외부 API 호출 없음).

  bin/studio catalog  --project P --style S [--format prompt|json]   LLM 계획 프롬프트에 넣을 템플릿 설명
  bin/studio validate RAW.json --project P --style S [--out F]       LLM 계획 검증/보정 → 검증된 계획
  bin/studio render   JOB.json [--no-render]                          작업 파일 → 영상/자막/메타 (render.py 참고)
  bin/studio thumbnail JOB.json                                       썸네일 JPEG (thumbnail.py 참고)
  bin/studio check                                                    템플릿 명세·코드 규칙 검사 + templates/index.ts 갱신
  bin/studio list                                                     템플릿 목록
  bin/studio styles                                                   스타일 목록
  bin/studio gallery [스타일 …] [--only id,id]                         템플릿 × 스타일 미리보기 (out/gallery)

결과 JSON은 stdout, 진행 로그는 stderr 로 나간다.
"""
import argparse
import json
import logging
import sys

from studio import catalog
from studio.styles import get_style, list_styles


def _out(data) -> None:
    sys.stdout.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def cmd_catalog(a) -> int:
    style = get_style(a.style)
    found = catalog.candidates(a.project, style)
    if a.format == "json":
        _out({tid: {k: v for k, v in m.items() if not k.startswith("_")} for tid, m in found.items()})
    else:
        sys.stdout.write(catalog.catalog_text(found) + "\n")
    return 0


def cmd_validate(a) -> int:
    from studio.plan import allowed_templates, normalize_plan
    with open(a.raw, "r", encoding="utf-8") as f:
        raw = json.load(f)
    plan = normalize_plan(raw, allowed_templates(a.project, get_style(a.style)))
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(plan, f, ensure_ascii=False, indent=2)
        _out({"out": a.out, "report": plan["report"]})
    else:
        _out(plan)
    return 0


def cmd_render(a) -> int:
    from studio.render import cleanup_stale_jobs, render_job_file
    cleanup_stale_jobs()
    _out(render_job_file(a.job, render=not a.no_render))
    return 0


def cmd_thumbnail(a) -> int:
    from studio.thumbnail import render_thumbnail
    with open(a.job, "r", encoding="utf-8") as f:
        _out(render_thumbnail(json.load(f)))
    return 0


def cmd_check(a) -> int:
    res = catalog.check()
    bad = {k: v for k, v in res.items() if v}
    for tid, errs in bad.items():
        for e in errs:
            print(f"✗ {tid}: {e}", file=sys.stderr)
    print(f"템플릿 {len(res)}개, 문제 {sum(len(v) for v in bad.values())}건", file=sys.stderr)
    if not bad:
        print(f"index 갱신: {catalog.write_index()}", file=sys.stderr)
    return 1 if bad else 0


def cmd_list(a) -> int:
    for tid, m in catalog.load().items():
        scope = m["scope"] if m["scope"] == "common" else ",".join(m["scope"])
        print(f"{tid:16} {m['kind']:6} {m['category']:10} {scope:10} {m['name']}")
    return 0


def cmd_styles(a) -> int:
    for n in list_styles():
        st = get_style(n)
        print(f"{n:14} {st.get('media', 'clean'):7} {st.get('description', '')}")
    return 0


def cmd_gallery(a) -> int:
    from studio import gallery
    if any(catalog.check().values()):
        print("템플릿 검사 실패: bin/studio check", file=sys.stderr)
        return 1
    catalog.write_index()
    only = a.only.split(",") if a.only else None
    for n in a.styles or list_styles():
        gallery.render_style(n, only)
    print(gallery.write_html())
    return 0


def main(argv=None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s", stream=sys.stderr)
    p = argparse.ArgumentParser(prog="studio", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("catalog"); s.add_argument("--project", required=True); s.add_argument("--style", required=True)
    s.add_argument("--format", choices=["prompt", "json"], default="prompt"); s.set_defaults(fn=cmd_catalog)
    s = sub.add_parser("validate"); s.add_argument("raw"); s.add_argument("--project", required=True); s.add_argument("--style", required=True)
    s.add_argument("--out"); s.set_defaults(fn=cmd_validate)
    s = sub.add_parser("render"); s.add_argument("job"); s.add_argument("--no-render", action="store_true"); s.set_defaults(fn=cmd_render)
    s = sub.add_parser("thumbnail"); s.add_argument("job"); s.set_defaults(fn=cmd_thumbnail)
    sub.add_parser("check").set_defaults(fn=cmd_check)
    sub.add_parser("list").set_defaults(fn=cmd_list)
    sub.add_parser("styles").set_defaults(fn=cmd_styles)
    s = sub.add_parser("gallery"); s.add_argument("styles", nargs="*"); s.add_argument("--only"); s.set_defaults(fn=cmd_gallery)
    a = p.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
