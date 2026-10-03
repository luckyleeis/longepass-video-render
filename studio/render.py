"""
렌더링: 작업 파일(job.json) → 영상 + 자막 + 메타데이터.

job.json
{
  "style": "longepass",                    # styles/<name>.json
  "plan": { 검증된 계획 (bin/studio validate 결과) },
  "voices": [                              # 챕터 순서대로
    {"audio": "/절대경로/ch00.mp3", "char_times": [[시작ms, 끝ms], ...], "clip_end": 밀리초}
  ],
  "out_dir": "/절대경로/결과폴더",
  "name": "motion"                         # 결과 파일 이름 (기본 motion)
}

결과 (out_dir)
  <name>.mp4          -14 LUFS로 맞춘 영상
  <name>.srt          자막
  <name>.json         메타데이터: 길이, 챕터 시각, 음악 저작권 표기, 샷/효과음 수
  props_<name>.json   Remotion에 넘긴 값 (디버깅용)

음성 파일은 Remotion이 읽을 수 있게 public/_jobs/<작업>/ 에 잠시 복사했다가 끝나면 지운다.
"""
import json
import logging
import os
import shutil
import subprocess
import sys
import uuid
from typing import Any, Dict, Optional

from studio import timeline
from studio.styles import get_style

logger = logging.getLogger("studio.render")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT, "public")
MUSIC_LIBRARY = os.path.join(PUBLIC_DIR, "music", "library.json")
JOBS_DIR = os.path.join(PUBLIC_DIR, "_jobs")
DEFAULT_TMP = "/Volumes/Cache/temp_cache/Asumup/video_render/remotion"


def _json_load(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _json_save(path: str, data: Any) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def music_track(style: Dict[str, Any]) -> Dict[str, Any]:
    return next(t for t in _json_load(MUSIC_LIBRARY)["tracks"] if t["id"] == style["pacing"]["music"])


def _render_env() -> Dict[str, str]:
    env = os.environ.copy()
    if "TMPDIR" not in env and os.path.exists(DEFAULT_TMP):
        env["TMPDIR"] = DEFAULT_TMP
    if "TMPDIR" in env:
        os.makedirs(env["TMPDIR"], exist_ok=True)
    return env


def render_concurrency() -> str:
    """동시 렌더링 수: REMOTION_CONCURRENCY 가 있으면 그 값, 없으면 min(12, CPU 코어 수).
    Remotion은 코어 수보다 큰 값을 주면 렌더링 전에 바로 실패한다 (8코어 서버에서 12 → 실패)."""
    return os.getenv("REMOTION_CONCURRENCY") or str(max(1, min(12, os.cpu_count() or 1)))


def remotion_render(props_path: str, out_mp4: str, composition: str = "Motion") -> None:
    # 글자 위주 영상이라 프레임 JPEG 압축 손실이 글자 가장자리에 보여 품질을 올린다
    cmd = ["npx", "remotion", "render", composition, os.path.abspath(out_mp4), f"--props={os.path.abspath(props_path)}",
           "--concurrency", render_concurrency(), "--jpeg-quality", "95"]
    os.makedirs(os.path.dirname(os.path.abspath(out_mp4)), exist_ok=True)
    logger.info(f"[render] Remotion {composition} → {out_mp4}")
    # 진행 로그는 stderr 로 (stdout 은 명령 결과 JSON 전용)
    subprocess.run(cmd, cwd=ROOT, env=_render_env(), check=True, stdout=sys.stderr)


def loudnorm(src: str, dst: str) -> None:
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-v", "error", "-y", "-i", src, "-c:v", "copy",
         "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", dst],
        check=True,
    )


def _srt(captions) -> str:
    def tc(f: int) -> str:
        ms = int(round(f * 1000 / timeline.FPS))
        h, r = divmod(ms, 3600000)
        m, r = divmod(r, 60000)
        s, ms = divmod(r, 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
    return "\n".join(f"{i + 1}\n{tc(c['start'])} --> {tc(c['end'])}\n{c['text']}\n" for i, c in enumerate(captions))


def render_job(job: Dict[str, Any], render: bool = True) -> Dict[str, Any]:
    """render=False 면 props/자막/메타만 만든다 (빠른 확인용)"""
    style = get_style(job["style"])
    plan, out_dir = job["plan"], job["out_dir"]
    name = job.get("name") or "motion"
    os.makedirs(out_dir, exist_ok=True)
    track = music_track(style)

    job_id = f"{name}-{uuid.uuid4().hex[:8]}"
    job_dir = os.path.join(JOBS_DIR, job_id)
    os.makedirs(job_dir, exist_ok=True)
    try:
        voices = []
        for i, v in enumerate(job["voices"]):
            ext = os.path.splitext(v["audio"])[1] or ".mp3"
            link = os.path.join(job_dir, f"v{i:02d}{ext}")
            shutil.copyfile(os.path.abspath(v["audio"]), link)  # 심볼릭 링크는 Remotion 번들 복사에서 빠진다
            voices.append({**v, "audio_src": f"_jobs/{job_id}/v{i:02d}{ext}"})
        props = timeline.build_long_props(plan, voices, track, style)
        props_path = os.path.join(out_dir, f"props_{name}.json")
        _json_save(props_path, props)
        if render:
            raw = os.path.join(out_dir, f"{name}.raw.mp4")
            remotion_render(props_path, raw)
            loudnorm(raw, os.path.join(out_dir, f"{name}.mp4"))
            os.remove(raw)
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)

    with open(os.path.join(out_dir, f"{name}.srt"), "w", encoding="utf-8") as f:
        f.write(_srt(props["captions"]))
    meta = {
        "video": os.path.join(out_dir, f"{name}.mp4") if render else None,
        "captions": os.path.join(out_dir, f"{name}.srt"),
        "duration_sec": round(props["total_frames"] / timeline.FPS, 1),
        "total_frames": props["total_frames"],
        "chapters": [{"title": c["title"], "start_sec": round(c["start"] / timeline.FPS, 2)} for c in props["chapters"]],
        "music": {"id": track["id"], "title": track.get("title"), "attribution": track.get("attribution")},
        "style": job["style"],
        "shots": len(props["shots"]),
        "sfx": len(props["sfx"]),
    }
    _json_save(os.path.join(out_dir, f"{name}.json"), meta)
    return meta


def render_job_file(path: str, render: bool = True) -> Dict[str, Any]:
    return render_job(_json_load(path), render=render)


def cleanup_stale_jobs(max_age_sec: Optional[int] = 6 * 3600) -> None:
    """중간에 죽은 렌더링이 남긴 public/_jobs 연결 정리"""
    import time
    if not os.path.isdir(JOBS_DIR):
        return
    for d in os.listdir(JOBS_DIR):
        p = os.path.join(JOBS_DIR, d)
        if max_age_sec is None or time.time() - os.lstat(p).st_mtime > max_age_sec:
            shutil.rmtree(p, ignore_errors=True)
