"""
계획 → 음성 → 작업 파일 → 프리뷰/렌더링/썸네일. 렌더링은 studio/ 엔진을 그대로 부른다 (같은 과정, 외부 호출 없음).
"""
import json
import os
from typing import Any, Dict, List

from agent import credits, tts
from agent.episode import Episode
from studio.assets import map_shot


def _load(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def asset_refs(plan: Dict[str, Any]) -> List[Dict[str, str]]:
    """계획에서 쓰는 자료 id 목록 [{shot, ref}]"""
    refs: List[Dict[str, str]] = []
    for ch in plan["chapters"]:
        for s in ch["shots"]:
            def grab(spec, value, sid=s.get("id", "?")):
                ref = value.get("src") if isinstance(value, dict) else value
                if ref:
                    refs.append({"shot": sid, "ref": str(ref)})
                return value
            map_shot(s, grab)
    return refs


def make_plan(ep: Episode) -> Dict[str, Any]:
    """raw_plan.json → plan.json (bin/studio validate 와 같다) + 자료 확인"""
    from studio.plan import allowed_templates, normalize_plan
    from studio.styles import get_style
    raw = _load(ep.f("raw_plan.json"))
    plan = normalize_plan(raw, allowed_templates(ep.cfg["project"], get_style(ep.cfg["style"]), ep.aspect))
    if ep.form == "shortform":   # 쇼츠 위 제목 띠 (raw_plan 의 header, 없으면 작업 제목)
        plan["header"] = raw.get("header") or {"text": ep.status().get("title", "")}
        if raw.get("angle"):     # 업로드 기록(longform_videos.shorts)에 남는 쇼츠 각도
            plan["angle"] = raw["angle"]
    have = credits.load(ep)
    missing = [r for r in asset_refs(plan) if r["ref"] not in have and not os.path.exists(os.path.join(ep.dir, r["ref"]))]
    plan["report"]["missing_assets"] = missing
    _save(ep.f("plan.json"), plan)
    return plan


def make_job(ep: Episode, silent: bool = False) -> Dict[str, Any]:
    plan = _load(ep.f("plan.json"))
    voices = [] if silent else tts.voices_for_job(ep, plan)
    job = {"style": ep.cfg["style"], "plan": plan, "out_dir": "render", "name": ep.name, "voices": voices,
           "assets": credits.to_job_assets(ep)}
    if plan.get("music_mood"):
        job["music_mood"] = plan["music_mood"]
    if ep.form == "shortform":
        job["aspect"] = "9:16"
        job["header"] = plan.get("header") or {"text": ep.status().get("title", "")}
    _save(ep.f("job.json"), job)
    return job


def dry_run(ep: Episode) -> Dict[str, Any]:
    """렌더링 없이 타임라인·자막·메타만 (자료 경고, 길이 확인)"""
    from studio.render import render_job_file
    return render_job_file(ep.f("job.json"), render=False)


def preview(ep: Episode, all_shots: bool = True) -> Dict[str, Any]:
    from studio.preview import render_preview
    job = _load(ep.f("job.json"))
    # 롱폼 render/preview/ · 쇼츠 render/short_N/preview/
    job["out_dir"] = ep.p(job.get("out_dir") or "render", *([ep.part] if ep.part else []))
    return render_preview(job, max_shots=None if all_shots else 6, extract_all=all_shots, base_dir=ep.dir)


def render(ep: Episode) -> Dict[str, Any]:
    from studio.render import cleanup_stale_jobs, render_job_file
    cleanup_stale_jobs()
    meta = render_job_file(ep.f("job.json"), render=True)
    if not ep.part:
        ep.set_stage("rendered", ["영상 확인 (장 시작·사진 장면 프레임)", "쇼츠 1~2개 (--short N)", "업로드 대기열: bin/lp publish (사용자 요청 시)"])
    else:
        ep.log(f"쇼츠 렌더링: render/{ep.name}.mp4 ({meta.get('duration_sec')}초)")
    return meta


def thumbnail(ep: Episode) -> Dict[str, Any]:
    from studio.thumbnail import render_thumbnail
    plan = _load(ep.f("plan.json"))
    spec = plan.get("thumbnail") or {}
    if not spec:
        raise ValueError(f"{os.path.basename(ep.f('raw_plan.json'))} 에 thumbnail 이 없음 (형식: studio/thumbnail.py 맨 위)")
    return render_thumbnail({"style": ep.cfg["style"], "thumbnail": spec, "out": thumb_path(ep), "aspect": ep.aspect, "assets_dir": ep.p("assets")})


def thumb_path(ep: Episode) -> str:
    """render/thumbnail.jpg (롱폼) · render/short_N_thumbnail.jpg (쇼츠 표지)"""
    return ep.p("render", f"{ep.part}_thumbnail.jpg" if ep.part else "thumbnail.jpg")
