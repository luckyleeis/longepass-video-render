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
    raw = _load(ep.p("raw_plan.json"))
    plan = normalize_plan(raw, allowed_templates(ep.cfg["project"], get_style(ep.cfg["style"]), ep.aspect))
    if ep.form == "shortform":   # 쇼츠 위 제목 띠 (raw_plan 의 header, 없으면 작업 제목)
        plan["header"] = raw.get("header") or {"text": ep.status().get("title", "")}
    have = credits.load(ep)
    missing = [r for r in asset_refs(plan) if r["ref"] not in have and not os.path.exists(os.path.join(ep.dir, r["ref"]))]
    plan["report"]["missing_assets"] = missing
    _save(ep.p("plan.json"), plan)
    return plan


def make_job(ep: Episode, silent: bool = False) -> Dict[str, Any]:
    plan = _load(ep.p("plan.json"))
    voices = [] if silent else tts.voices_for_job(ep, plan)
    job = {"style": ep.cfg["style"], "plan": plan, "out_dir": "render", "name": ep.slug, "voices": voices,
           "assets": credits.to_job_assets(ep)}
    if plan.get("music_mood"):
        job["music_mood"] = plan["music_mood"]
    if ep.form == "shortform":
        job["aspect"] = "9:16"
        job["header"] = plan.get("header") or {"text": ep.status().get("title", "")}
    _save(ep.p("job.json"), job)
    return job


def dry_run(ep: Episode) -> Dict[str, Any]:
    """렌더링 없이 타임라인·자막·메타만 (자료 경고, 길이 확인)"""
    from studio.render import render_job_file
    return render_job_file(ep.p("job.json"), render=False)


def preview(ep: Episode, all_shots: bool = True) -> Dict[str, Any]:
    from studio.preview import render_preview
    job = _load(ep.p("job.json"))
    job["out_dir"] = ep.p(job.get("out_dir") or "render")
    return render_preview(job, max_shots=None if all_shots else 6, extract_all=all_shots, base_dir=ep.dir)


def render(ep: Episode) -> Dict[str, Any]:
    from studio.render import cleanup_stale_jobs, render_job_file
    cleanup_stale_jobs()
    meta = render_job_file(ep.p("job.json"), render=True)
    ep.set_stage("rendered", ["영상 확인 (장 시작·사진 장면 프레임)", "설명란 출처: render/<slug>.json 의 assets"])
    return meta


def thumbnail(ep: Episode) -> Dict[str, Any]:
    from studio.thumbnail import render_thumbnail
    plan = _load(ep.p("plan.json"))
    spec = plan.get("thumbnail") or {}
    if not spec:
        raise ValueError("raw_plan.json 에 thumbnail 이 없음 (형식: studio/thumbnail.py 맨 위)")
    return render_thumbnail({"style": ep.cfg["style"], "thumbnail": spec, "out": ep.p("render", "thumbnail.jpg"), "aspect": ep.aspect})
