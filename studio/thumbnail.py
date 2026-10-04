"""
썸네일: 작업 파일 → JPEG 한 장 (Remotion still, Thumbnail 컴포지션).

job
{
  "style": "longepass",
  "thumbnail": {"text": "큰 글자 (14자 안팎)", "emphasis": "text 안의 강조 구절", "badge": "왼쪽 위 작은 표",
                "object": "certificate|cash|document|calendar|idcard|passbook", "object_label": "사물 위 글자 (선택)"},
  "out": "/절대경로/thumbnail.jpg",
  "aspect": "9:16",                       # 선택: 기본 16:9 (1280x720), 9:16 = 쇼츠 표지 (1080x1920)
  "width": 1280, "height": 720            # 선택: 크기를 직접 지정
}
"""
import json
import os
import subprocess
import tempfile
from typing import Any, Dict

from studio.render import ROOT, _log_tail, _render_env
from studio.styles import get_style

OBJECTS = ("certificate", "cash", "document", "calendar", "idcard", "passbook")
SIZES = {"16:9": (1280, 720), "9:16": (1080, 1920)}


def render_thumbnail(job: Dict[str, Any]) -> Dict[str, Any]:
    style = get_style(job["style"])
    spec = job.get("thumbnail") or {}
    text = (spec.get("text") or "").strip()
    if not text:
        raise ValueError("thumbnail.text 가 비어 있음")
    out = os.path.abspath(job["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    w, h = SIZES.get(job.get("aspect") or "16:9", SIZES["16:9"])
    props = {"width": job.get("width", w), "height": job.get("height", h), "theme": style["theme"], "text": text,
             "emphasis": spec.get("emphasis") if spec.get("emphasis") and spec["emphasis"] in text else None,
             "badge": spec.get("badge"), "object": spec.get("object") if spec.get("object") in OBJECTS else "certificate",
             "object_label": spec.get("object_label")}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False)
        props_path = f.name
    log_path = os.path.splitext(out)[0] + ".render.log"
    try:
        with open(log_path, "w", encoding="utf-8") as log:
            env = _render_env()
            subprocess.run(["npx", "remotion", "browser", "ensure"], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
            proc = subprocess.run(["npx", "remotion", "still", "Thumbnail", out, f"--props={props_path}",
                                   "--image-format=jpeg", "--jpeg-quality=92"], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    finally:
        os.remove(props_path)
    if proc.returncode != 0 or not os.path.exists(out):
        raise RuntimeError(f"썸네일 렌더링 실패 (exit {proc.returncode}). 로그 {log_path} 끝부분:\n{_log_tail(log_path)}")
    os.remove(log_path)
    return {"thumbnail": out, "text": text, "object": props["object"]}
