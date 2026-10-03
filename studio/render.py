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
  "name": "motion",                        # 결과 파일 이름 (기본 motion)
  "music_mood": "bright",                  # 선택: 없으면 plan.music_mood → 스타일 기본 곡
  "music": "spring"                        # 선택: 곡을 직접 지정 (public/music/library.json 의 id)
}

결과 (out_dir)
  <name>.mp4          -14 LUFS로 맞춘 영상
  <name>.srt          자막
  <name>.json         메타데이터: 길이, 챕터 시각, 음악 저작권 표기, 샷/효과음 수
  props_<name>.json   Remotion에 넘긴 값 (디버깅용)
  <name>.render.log   Remotion 출력 전체 (실패 원인 확인용)

음성 파일은 Remotion이 읽을 수 있게 public/_jobs/<작업>/ 에 잠시 복사했다가 끝나면 지운다.
"""
import hashlib
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


def music_track(style: Dict[str, Any], mood: Optional[str] = None, key: str = "", track_id: Optional[str] = None) -> Dict[str, Any]:
    """
    영상 배경음악 고르기.
    track_id 가 있으면 그 곡, 아니면 계획의 분위기(mood)가 스타일이 허용한 분위기면 그 분위기 곡 중 하나
    (key 로 고정된 선택 — 같은 영상은 같은 곡, 영상마다는 고르게 섞임), 그 외에는 스타일 기본 곡.
    """
    tracks = _json_load(MUSIC_LIBRARY)["tracks"]
    by_id = {t["id"]: t for t in tracks}
    if track_id and track_id in by_id:
        return by_id[track_id]
    pacing = style["pacing"]
    if mood and mood in pacing.get("music_moods", []):
        pool = [t for t in tracks if t.get("mood") == mood]
        if pool:
            h = int(hashlib.sha1((key or mood).encode("utf-8")).hexdigest(), 16)
            return pool[h % len(pool)]
    return by_id[pacing["music"]]


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


def _log_tail(path: str, n: int = 40) -> str:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return "".join(f.readlines()[-n:])
    except OSError:
        return ""


def remotion_render(props_path: str, out_mp4: str, composition: str = "Motion", log_path: Optional[str] = None) -> None:
    """
    Remotion 렌더링. 출력 전체를 log_path(기본: <영상>.log)에 남기고,
    실패하거나 결과 파일이 없으면 로그 끝부분을 담아 예외를 낸다 (Remotion이 0으로 끝나도 파일이 없으면 실패).
    렌더링 전에 헤드리스 크롬이 있는지 확인한다 (없으면 설치 — 새 머신에서 install 을 빠뜨린 경우).
    """
    out_mp4 = os.path.abspath(out_mp4)
    os.makedirs(os.path.dirname(out_mp4), exist_ok=True)
    log_path = log_path or os.path.splitext(out_mp4)[0] + ".log"
    env = _render_env()
    # 글자 위주 영상이라 프레임 JPEG 압축 손실이 글자 가장자리에 보여 품질을 올린다
    cmd = ["npx", "remotion", "render", composition, out_mp4, f"--props={os.path.abspath(props_path)}",
           "--concurrency", render_concurrency(), "--jpeg-quality", "95"]
    logger.info(f"[render] Remotion {composition} → {out_mp4} (로그 {log_path})")
    with open(log_path, "w", encoding="utf-8") as log:
        subprocess.run(["npx", "remotion", "browser", "ensure"], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
        log.flush()
        proc = subprocess.run(cmd, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    if proc.returncode != 0 or not os.path.exists(out_mp4) or os.path.getsize(out_mp4) == 0:
        raise RuntimeError(f"Remotion 렌더링 실패 (exit {proc.returncode}, 결과 파일 {'있음' if os.path.exists(out_mp4) else '없음'}). "
                           f"로그 {log_path} 끝부분:\n{_log_tail(log_path)}")


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
    track = music_track(style, mood=job.get("music_mood") or plan.get("music_mood"),
                        key=plan.get("video_title") or out_dir, track_id=job.get("music"))

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
            remotion_render(props_path, raw, log_path=os.path.join(out_dir, f"{name}.render.log"))
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
        "music": {"id": track["id"], "title": track.get("title"), "artist": track.get("artist"), "mood": track.get("mood"),
                  "license": track.get("license"), "attribution": track.get("attribution")},
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
