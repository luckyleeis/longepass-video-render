"""
빠른 프리뷰: job.json 파일 → 썸네일(JPEG) 1장 + 각 씬별 대표 프레임 스틸컷(PNG) 추출.

전체 영상 MP4 렌더링(수 분)을 거치지 않고 씬당 1프레임만 캡처해 눈으로 확인한다.
에이전트 방식(.claude/skills/make-video)에서 전체 렌더링 전에 화면을 고칠 때 쓴다.
음성이 없어도 된다 (글자 수로 시각을 가정). 자료(assets)는 정지 화면을 다 뽑을 때까지 남겨 두었다가 지운다.

CLI 사용법:
  bin/studio preview job.json [--max-shots 6] [--all]
"""
import json
import logging
import os
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional

from studio.styles import DEFAULT_STYLE
from studio.render import ROOT, _json_load, _json_save, _log_tail, _render_env, render_job
from studio.thumbnail import render_thumbnail
from studio.timeline import FPS

logger = logging.getLogger("studio.preview")


def select_key_shots(shots: List[Dict[str, Any]], max_shots: int = 6) -> List[Dict[str, Any]]:
    """
    검수에 가장 유용한 핵심 샷 선별:
    - 첫 번째 샷 (오프닝/훅)
    - 마지막 샷 (아웃트로/CTA)
    - 특수 템플릿 샷 (quiz, compare, contrast, timeline, phone_screen, chart 등)
    - 나머지 구간을 균등하게 분할 선택
    """
    n = len(shots)
    if n <= max_shots:
        return [(i, s) for i, s in enumerate(shots)]

    special_modules = {
        "quiz", "compare", "contrast", "timeline", "phone_screen",
        "board", "flow", "bar_chart", "counter", "document_form"
    }

    selected_indices = set()
    # 1. 첫 번째 샷 & 마지막 샷
    selected_indices.add(0)
    selected_indices.add(n - 1)

    # 2. 특수 템플릿 우선
    for i, s in enumerate(shots):
        if len(selected_indices) >= max_shots:
            break
        mod = s.get("layers", [{}])[0].get("module", "")
        if mod in special_modules:
            selected_indices.add(i)

    # 3. 빈 자리 균등 분할
    if len(selected_indices) < max_shots:
        step = max(1, n // max_shots)
        for i in range(0, n, step):
            if len(selected_indices) >= max_shots:
                break
            selected_indices.add(i)

    sorted_indices = sorted(selected_indices)
    return [(i, shots[i]) for i in sorted_indices]


def render_preview(job: Dict[str, Any], max_shots: Optional[int] = 6, extract_all: bool = False,
                   base_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    job.json 데이터를 기반으로 썸네일 1장 + 대표 프레임 스틸컷들을 생성하여 메타데이터 반환.
    """
    plan = job.get("plan") or {}
    out_dir = job.get("out_dir") or "out/preview"
    preview_dir = os.path.join(out_dir, "preview")
    os.makedirs(preview_dir, exist_ok=True)

    result: Dict[str, Any] = {
        "style": job.get("style") or DEFAULT_STYLE,
        "aspect": job.get("aspect", "16:9"),
        "preview_dir": os.path.abspath(preview_dir),
        "thumbnail": None,
        "stills": [],
    }

    # 1. 썸네일 렌더링
    thumb_spec = job.get("thumbnail") or plan.get("thumbnail")
    if thumb_spec:
        thumb_out = os.path.join(preview_dir, "thumbnail.jpg")
        try:
            thumb_job = {
                "style": job.get("style") or DEFAULT_STYLE,
                "thumbnail": thumb_spec,
                "out": thumb_out,
                "aspect": job.get("aspect", "16:9"),
            }
            render_thumbnail(thumb_job)
            result["thumbnail"] = {
                "image": os.path.abspath(thumb_out),
                "layout": thumb_spec.get("layout", "focus"),
                "surface": thumb_spec.get("surface", "alt"),
                "text": thumb_spec.get("text", ""),
                "object": thumb_spec.get("object", "certificate"),
            }
            logger.info(f"[preview] 썸네일 생성 완료: {thumb_out}")
        except Exception as e:
            logger.warning(f"[preview] 썸네일 생성 실패 (건너뜀): {e}")

    # 2. 타임라인 Props 빌드 (render=False로 음성/타이밍/자막 구조만 계산)
    job_for_props = {**job, "out_dir": preview_dir, "name": "preview"}
    meta = render_job(job_for_props, render=False, base_dir=base_dir, keep_job_dir=True)
    try:
        return _stills(result, meta, preview_dir, max_shots, extract_all)
    finally:
        if meta.get("job_dir"):
            shutil.rmtree(meta["job_dir"], ignore_errors=True)


def _stills(result: Dict[str, Any], meta: Dict[str, Any], preview_dir: str, max_shots: Optional[int], extract_all: bool) -> Dict[str, Any]:
    props_path = os.path.join(preview_dir, "props_preview.json")

    props = _json_load(props_path)
    shots = props.get("shots", [])
    result["total_frames"] = props.get("total_frames", 0)
    result["duration_sec"] = meta.get("duration_sec", 0.0)
    result["shots_count"] = len(shots)

    if not shots:
        return result

    # 3. 샷별 대표 프레임 선정
    if extract_all or max_shots is None or max_shots >= len(shots):
        target_shots = [(i, s) for i, s in enumerate(shots)]
    else:
        target_shots = select_key_shots(shots, max_shots=max_shots)

    env = _render_env()
    subprocess.run(["npx", "remotion", "browser", "ensure"], cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    for idx, s in target_shots:
        mod = s.get("layers", [{}])[0].get("module", "shot")
        start = s.get("start", 0)
        dur = s.get("duration", 30)

        # 애니메이션이 대부분 완성된 시점(70% 지점) 선택
        target_frame = start + min(dur - 6, max(6, int(dur * 0.7)))
        sec = round(target_frame / FPS, 2)

        out_img = os.path.join(preview_dir, f"shot_{idx:02d}_{mod}.png")
        log_file = os.path.splitext(out_img)[0] + ".log"

        cmd = [
            "npx", "remotion", "still", "Motion", out_img,
            f"--props={os.path.abspath(props_path)}",
            f"--frame={target_frame}",
            "--image-format=png",
        ]

        with open(log_file, "w", encoding="utf-8") as log:
            proc = subprocess.run(cmd, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)

        if proc.returncode == 0 and os.path.exists(out_img):
            os.remove(log_file)
            result["stills"].append({
                "shot_index": idx,
                "module": mod,
                "frame": target_frame,
                "sec": sec,
                "bg": s.get("bg", "base"),
                "image": os.path.abspath(out_img),
                "data": s.get("layers", [{}])[0].get("data"),
            })
            logger.info(f"[preview] 샷 {idx} ({mod}) 캡처 완료 (F{target_frame})")
        else:
            logger.warning(f"[preview] 샷 {idx} 캡처 실패 (exit {proc.returncode}). 로그 {log_file}")

    # 4. 프리뷰 요약 JSON 저장
    preview_json = os.path.join(preview_dir, "preview.json")
    _json_save(preview_json, result)
    result["preview_meta_file"] = os.path.abspath(preview_json)

    return result
