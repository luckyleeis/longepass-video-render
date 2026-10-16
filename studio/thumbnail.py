"""
썸네일: 작업 파일 → JPEG 한 장 (Remotion still, Thumbnail 컴포지션).

job
{
  "style": "showreel",                    # 선택: 기본 showreel (운영 스타일)
  "thumbnail": {
    "layout": "focus|split|stat|quiz",               # 선택: 기본 focus
    "surface": "alt|base|accent|deep",               # 선택: 배경 색상 테마 (기본 primary_surface)
    "text": "큰 글자 (14자 안팎)",
    "emphasis": "text 안의 강조 구절",
    "badge": "왼쪽 위 작은 표 (선택)",
    "sub_text": "보조 설명 문구 (선택)",
    "object": "certificate|cash|document|calendar|idcard|passbook|car|scooter|sign_warning|speed_limit|traffic_light|stamp",
    "object_label": "사물 위 글자 (선택)",
    "stat": "수치 (stat 레이아웃용, 예: 3,600, 90, 100%)",
    "stat_unit": "수치 단위 (예: 元, 天, 分)",
    "split_left": {"text": "좌측 문구", "tag": "주의", "object": "sign_warning"},
    "split_right": {"text": "우측 문구", "tag": "정답", "object": "certificate", "is_good": true}
  },
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
from studio.styles import DEFAULT_STYLE, get_style

import base64
import mimetypes

OBJECTS = (
    "certificate", "cash", "document", "calendar", "idcard", "passbook",
    "car", "scooter", "sign_warning", "speed_limit", "traffic_light", "stamp"
)
LAYOUTS = ("focus", "split", "stat", "quiz", "photo_hero", "vs_split", "warning_dark", "evidence_doc")
SIZES = {"16:9": (1280, 720), "9:16": (1080, 1920)}


def _to_data_uri(path_or_url: Any, assets_dir: str = "") -> Any:
    if not isinstance(path_or_url, str):
        return path_or_url
    if path_or_url.startswith("data:") or path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        return path_or_url
    candidates = [path_or_url]
    if assets_dir:
        candidates.append(os.path.join(assets_dir, path_or_url))
        for ext in (".jpg", ".jpeg", ".png", ".webp"):
            candidates.append(os.path.join(assets_dir, path_or_url + ext))
    for ext in (".jpg", ".jpeg", ".png", ".webp"):
        candidates.append(path_or_url + ext)
    for c in candidates:
        if os.path.exists(c) and not os.path.isdir(c):
            mime, _ = mimetypes.guess_type(c)
            mime = mime or "image/jpeg"
            with open(c, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("ascii")
            return f"data:{mime};base64,{b64}"
    return path_or_url


def render_thumbnail(job: Dict[str, Any]) -> Dict[str, Any]:
    style = get_style(job.get("style") or DEFAULT_STYLE)
    spec = job.get("thumbnail") or {}
    text = (spec.get("text") or "").strip()
    layout = spec.get("layout") if spec.get("layout") in LAYOUTS else "focus"

    # split/vs_split 레이아웃에서는 text가 없어도 split_left, split_right로 대체 가능
    if not text and layout not in ("split", "vs_split"):
        raise ValueError("thumbnail.text 가 비어 있음")

    out = os.path.abspath(job["out"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    w, h = SIZES.get(job.get("aspect") or "16:9", SIZES["16:9"])

    assets_dir = job.get("assets_dir") or ""
    split_l = spec.get("split_left")
    if isinstance(split_l, dict) and split_l.get("photo"):
        split_l = dict(split_l)
        split_l["photo"] = _to_data_uri(split_l["photo"], assets_dir)

    split_r = spec.get("split_right")
    if isinstance(split_r, dict) and split_r.get("photo"):
        split_r = dict(split_r)
        split_r["photo"] = _to_data_uri(split_r["photo"], assets_dir)

    props = {
        "width": job.get("width", w),
        "height": job.get("height", h),
        "theme": style["theme"],
        "layout": layout,
        "surface": spec.get("surface"),
        "text": text,
        "emphasis": spec.get("emphasis") if spec.get("emphasis") and spec["emphasis"] in text else None,
        "badge": spec.get("badge"),
        "sub_text": spec.get("sub_text"),
        "object": spec.get("object") if spec.get("object") in OBJECTS else "certificate",
        "object_label": spec.get("object_label"),
        "stat": spec.get("stat"),
        "stat_unit": spec.get("stat_unit"),
        "split_left": split_l,
        "split_right": split_r,
        "photo": _to_data_uri(spec.get("photo"), assets_dir),
        "photo_dim": spec.get("photo_dim"),
        "kicker": spec.get("kicker"),
        "tag": spec.get("tag"),
        "stamp": spec.get("stamp"),
        "accent_bar": spec.get("accent_bar"),
    }

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
    return {"thumbnail": out, "layout": layout, "text": text, "object": props["object"]}
