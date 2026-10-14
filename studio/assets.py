"""
자료(이미지·영상) 연결: 계획의 asset 칸 → Remotion이 읽을 수 있는 파일.

템플릿 명세(manifest)의 칸 중 {"type": "asset", "kind": "image|video|any"} 인 칸에 자료를 넣는다.
칸 값은 세 가지 중 하나:
  "photo_01"                         job.json 의 assets 에 있는 id
  "/절대경로/a.jpg" 또는 "assets/a.jpg"  파일 경로 (상대 경로는 작업 파일이 있는 폴더 기준)
  "samples/city.jpg"                 public/ 안의 파일 (갤러리 예시용 샘플)
  {"src": 위 셋 중 하나, "focus": [x, y], "credit": "...", "fit": "cover|contain", "start": 초}   세부 지정

job.json
  "assets": {
    "photo_01": {
      "path": "/절대경로/photo_01.jpg",      # 필수. 로컬 파일만 (렌더링 중 인터넷에서 받지 않는다)
      "kind": "image",                      # 선택: image | video (없으면 확장자로)
      "focus": [0.5, 0.35],                 # 선택: 잘릴 때 남길 중심 (0~1, 기본 가운데)
      "credit": "攝影：王小明 / CC BY 4.0",   # 선택: 화면 구석에 작게 + 메타데이터의 출처 목록
      "source": "https://…",                # 선택: 원본 위치 (메타데이터에만)
      "license": "CC BY 4.0"                # 선택: 라이선스 (메타데이터에만)
    }
  }

파일이 없거나 형식이 맞지 않으면 그 칸을 비운다 (경고만 남기고 렌더링은 계속). 템플릿은 자료가 없을 때의
대체 화면을 갖고 있다. 렌더링할 파일은 public/_jobs/<작업>/ 에 복사했다가 끝나면 지운다 (음성과 같은 방식).
ffprobe로 크기·길이를 읽는다 (로컬 도구, 외부 호출 없음).
"""
import json
import os
import shutil
import subprocess
from typing import Any, Dict, List, Optional, Tuple

from studio import catalog

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT, "public")

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp"}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v", ".mkv"}
ASSET_KINDS = ("image", "video", "any")
DETAIL_KEYS = ("focus", "credit", "fit", "start")


def kind_of(path: str) -> Optional[str]:
    ext = os.path.splitext(path)[1].lower()
    return "image" if ext in IMAGE_EXT else "video" if ext in VIDEO_EXT else None


def probe(path: str) -> Dict[str, Any]:
    """ffprobe로 크기(w, h)와 영상 길이(duration 초). 실패하면 빈 값"""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
             "-of", "json", path], capture_output=True, text=True, timeout=30)
        data = json.loads(out.stdout or "{}")
    except (OSError, ValueError, subprocess.SubprocessError):
        return {}
    st = (data.get("streams") or [{}])[0]
    res: Dict[str, Any] = {}
    if st.get("width") and st.get("height"):
        res["w"], res["h"] = int(st["width"]), int(st["height"])
    try:
        d = float((data.get("format") or {}).get("duration") or 0)
        if d > 0:
            res["duration"] = round(d, 3)
    except ValueError:
        pass
    return res


def _focus(v) -> Optional[List[float]]:
    if isinstance(v, (list, tuple)) and len(v) == 2:
        try:
            return [min(1.0, max(0.0, float(v[0]))), min(1.0, max(0.0, float(v[1])))]
        except (TypeError, ValueError):
            return None
    return None


def check_value(v) -> bool:
    """명세 검증용: asset 칸 값 형식 (파일 존재는 렌더링 때 본다)"""
    if isinstance(v, str):
        return bool(v.strip())
    return isinstance(v, dict) and isinstance(v.get("src"), str) and bool(v["src"].strip())


# ---------------------------------------------------------------- 칸 찾기
def _walk(spec: Dict[str, Any], value, fn):
    """명세 spec 을 따라 data 값에서 asset 칸을 찾아 fn(칸 명세, 값) 결과로 바꾼다 (None이면 칸 삭제)"""
    k = spec.get("type")
    if k == "asset":
        return fn(spec, value)
    if k == "object" and isinstance(value, dict):
        out = dict(value)
        for n, sub in spec.get("fields", {}).items():
            if n in out:
                r = _walk(sub, out[n], fn)
                if r is None:
                    out.pop(n)
                else:
                    out[n] = r
        return out
    if k == "list" and isinstance(value, list):
        return [_walk(spec["item"], it, fn) if it is not None else None for it in value]
    return value


def has_asset_fields(m: Dict[str, Any]) -> bool:
    def any_asset(spec) -> bool:
        k = spec.get("type")
        return k == "asset" or (k == "object" and any(any_asset(s) for s in spec.get("fields", {}).values())) \
            or (k == "list" and any_asset(spec.get("item", {})))
    return any(any_asset(s) for s in list(m["fields"].values()) + list(m.get("beat_fields", {}).values()))


def map_shot(shot: Dict[str, Any], fn) -> Dict[str, Any]:
    """계획의 샷 하나(data, 무대면 beats[].data)의 asset 칸에 fn 적용"""
    m = catalog.get(shot["module"])
    if not has_asset_fields(m):
        return shot
    out = dict(shot)
    out["data"] = _walk({"type": "object", "fields": m["fields"]}, shot.get("data") or {}, fn)
    if shot.get("beats"):
        out["beats"] = [{**b, "data": _walk({"type": "object", "fields": m["beat_fields"]}, b.get("data") or {}, fn)}
                        for b in shot["beats"]]
    return out


# ---------------------------------------------------------------- 해석
class AssetResolver:
    """
    assets: job.json 의 assets 표, base_dir: 상대 경로 기준 폴더,
    job_dir/job_src: 복사할 폴더와 Remotion 에서 그 폴더를 부르는 경로 (None이면 복사하지 않고 public/ 안의 파일만 허용 — 갤러리)
    """

    def __init__(self, assets: Optional[Dict[str, Any]] = None, base_dir: Optional[str] = None,
                 job_dir: Optional[str] = None, job_src: Optional[str] = None):
        self.assets = assets or {}
        self.base_dir = base_dir or os.getcwd()
        self.job_dir, self.job_src = job_dir, job_src
        self.copied: Dict[str, Dict[str, Any]] = {}   # 원본 절대 경로 → 결과
        self.used: List[Dict[str, Any]] = []          # 출처 목록 (메타데이터)
        self.warnings: List[str] = []

    def _locate(self, ref: str) -> Tuple[Optional[str], Dict[str, Any], Optional[str]]:
        """ref → (로컬 파일 절대 경로, 자료 정보, public 상대 경로)"""
        info: Dict[str, Any] = {}
        if ref in self.assets:
            info = dict(self.assets[ref]) if isinstance(self.assets[ref], dict) else {"path": self.assets[ref]}
            info["id"] = ref
            ref = str(info.get("path") or "")
        if not ref or ref.startswith(("http://", "https://")):
            return None, info, None   # 인터넷 주소는 받지 않는다 (렌더링 저장소는 외부 호출 금지)
        pub = os.path.normpath(os.path.join(PUBLIC_DIR, ref.lstrip("/")))
        if not os.path.isabs(ref) and pub.startswith(PUBLIC_DIR + os.sep) and os.path.isfile(pub):
            return pub, info, os.path.relpath(pub, PUBLIC_DIR).replace(os.sep, "/")
        path = ref if os.path.isabs(ref) else os.path.join(self.base_dir, ref)
        path = os.path.abspath(path)
        return (path if os.path.isfile(path) else None), info, None

    def resolve(self, spec: Dict[str, Any], value) -> Optional[Dict[str, Any]]:
        if value in (None, ""):
            return None
        if isinstance(value, dict) and value.get("resolved"):
            return value
        detail = dict(value) if isinstance(value, dict) else {"src": value}
        ref = str(detail.get("src") or "").strip()
        path, info, public_rel = self._locate(ref)
        if not path:
            self.warnings.append(f"자료 없음: {ref}")
            return None
        kind = info.get("kind") or kind_of(path)
        want = spec.get("kind", "any")
        if kind not in ("image", "video") or (want != "any" and kind != want):
            self.warnings.append(f"자료 형식이 맞지 않음: {ref} ({kind}, 칸은 {want})")
            return None
        if path in self.copied:
            base = dict(self.copied[path])
        else:
            if public_rel:
                src = public_rel
            elif self.job_dir and self.job_src:
                name = f"a{len(self.copied):02d}{os.path.splitext(path)[1].lower()}"
                shutil.copyfile(path, os.path.join(self.job_dir, name))   # 심볼릭 링크는 Remotion 번들 복사에서 빠진다
                src = f"{self.job_src}/{name}"
            else:
                self.warnings.append(f"public/ 밖의 자료는 작업 파일에서만 쓸 수 있음: {ref}")
                return None
            base = {"src": src, "kind": kind, **probe(path)}
            if kind == "image":
                base.pop("duration", None)   # ffprobe는 그림에도 한 프레임 길이를 준다
            self.copied[path] = base
            self.used.append({k: v for k, v in {
                "id": info.get("id"), "file": os.path.basename(path), "kind": kind, "credit": info.get("credit"),
                "source": info.get("source"), "license": info.get("license")}.items() if v})
        out = {**base, "resolved": True}
        for k in DETAIL_KEYS:   # 칸에 쓴 세부값이 자료 표의 값보다 앞선다
            v = detail.get(k, info.get(k))
            if k == "focus":
                v = _focus(v)
            if v not in (None, ""):
                out[k] = v
        return out

    def plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """검증된 계획 전체의 asset 칸 해석 (원본은 바꾸지 않는다)"""
        out = dict(plan)
        out["chapters"] = [{**ch, "shots": [map_shot(s, self.resolve) for s in ch["shots"]]} for ch in plan["chapters"]]
        return out
