"""
소재 찾기·받기: 스톡(Pexels · Pixabay · Unsplash, API 키 필요) + 위키미디어 커먼즈(키 불필요).

  bin/lp search <slug> "검색어" [--site pexels,pixabay,unsplash,commons] [--video] [--portrait]
      → 번호 붙은 목록 (assets/_search.json 에 저장)
  bin/lp get <slug> <번호 | File:이름.jpg> <id> [--start 초 --dur 초] [--focus x,y]
      → assets/<id>.jpg|mp4 + _credits.json 에 출처 자동 기록

- 스톡은 영어 검색어가 잘 맞는다. 현대 장면(도시·사무실·시험장·사람 손·서류)에만 쓴다 (CHANNEL.md 「소재」).
- 커먼즈는 라이선스를 읽어 쓸 수 없는 것(NC/ND/불명)은 목록에서 뺀다.
- 사진은 긴 변 2560px 까지 줄이고, 영상은 소리를 빼고 1920px·H.264 로 (구간 지정 가능, 기본 최대 30초).
- API 주소는 환경 변수 LP_API_<SITE> 로 바꿀 수 있다 (시험용).
"""
import html
import json
import os
import re
import subprocess
import urllib.parse
from typing import Any, Dict, List, Optional

from agent import config, credits, net
from agent.episode import Episode, now
from studio.assets import kind_of, probe

API = {
    "pexels": os.getenv("LP_API_PEXELS", "https://api.pexels.com"),
    "pixabay": os.getenv("LP_API_PIXABAY", "https://pixabay.com/api"),
    "unsplash": os.getenv("LP_API_UNSPLASH", "https://api.unsplash.com"),
    "commons": os.getenv("LP_API_COMMONS", "https://commons.wikimedia.org/w/api.php"),
}
LICENSE = {"pexels": "Pexels License", "pixabay": "Pixabay Content License", "unsplash": "Unsplash License"}
SITE_NAME = {"pexels": "Pexels", "pixabay": "Pixabay", "unsplash": "Unsplash", "commons": "Wikimedia Commons"}
MAX_IMAGE = 2560
MAX_VIDEO_W = 1920
MAX_VIDEO_SEC = 30


def _strip(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()


# ---------------------------------------------------------------- 검색 (사이트별)
def _pexels(key: str, q: str, video: bool, portrait: bool, n: int) -> List[Dict[str, Any]]:
    path = "/videos/search" if video else "/v1/search"
    data = net.get_json(API["pexels"] + path, {"query": q, "per_page": n, "orientation": "portrait" if portrait else "landscape"},
                        headers={"Authorization": key})
    out = []
    for it in data.get("videos" if video else "photos", []):
        if video:
            files = [f for f in it.get("video_files", []) if f.get("file_type") == "video/mp4" and f.get("width")]
            best = min(files, key=lambda f: abs(f["width"] - MAX_VIDEO_W) + (0 if f["width"] <= MAX_VIDEO_W else 5000), default=None)
            if not best:
                continue
            out.append({"site": "pexels", "kind": "video", "id": str(it["id"]), "title": (it.get("url") or "").rstrip("/").split("/")[-1],
                        "author": (it.get("user") or {}).get("name", ""), "page": it.get("url"), "url": best["link"],
                        "w": best.get("width"), "h": best.get("height"), "duration": it.get("duration")})
        else:
            src = it.get("src") or {}
            out.append({"site": "pexels", "kind": "image", "id": str(it["id"]), "title": it.get("alt") or "",
                        "author": it.get("photographer", ""), "page": it.get("url"), "url": src.get("large2x") or src.get("original"),
                        "w": it.get("width"), "h": it.get("height")})
    return out


def _pixabay(key: str, q: str, video: bool, portrait: bool, n: int) -> List[Dict[str, Any]]:
    base = API["pixabay"] + ("/videos/" if video else "/")
    params = {"key": key, "q": q, "per_page": max(3, n), "safesearch": "true"}
    if not video:
        params.update({"image_type": "photo", "orientation": "vertical" if portrait else "horizontal"})
    data = net.get_json(base, params)
    out = []
    for it in data.get("hits", []):
        if video:
            v = (it.get("videos") or {})
            best = v.get("large") if (v.get("large") or {}).get("url") else v.get("medium")
            if not best or not best.get("url"):
                continue
            out.append({"site": "pixabay", "kind": "video", "id": str(it["id"]), "title": it.get("tags", ""), "author": it.get("user", ""),
                        "page": it.get("pageURL"), "url": best["url"], "w": best.get("width"), "h": best.get("height"), "duration": it.get("duration")})
        else:
            out.append({"site": "pixabay", "kind": "image", "id": str(it["id"]), "title": it.get("tags", ""), "author": it.get("user", ""),
                        "page": it.get("pageURL"), "url": it.get("largeImageURL") or it.get("webformatURL"),
                        "w": it.get("imageWidth"), "h": it.get("imageHeight")})
    return out


def _unsplash(key: str, q: str, video: bool, portrait: bool, n: int) -> List[Dict[str, Any]]:
    if video:
        return []   # 영상 없음
    data = net.get_json(API["unsplash"] + "/search/photos", {"query": q, "per_page": n, "orientation": "portrait" if portrait else "landscape"},
                        headers={"Authorization": f"Client-ID {key}", "Accept-Version": "v1"})
    out = []
    for it in data.get("results", []):
        urls, user = it.get("urls") or {}, it.get("user") or {}
        raw = urls.get("raw")
        out.append({"site": "unsplash", "kind": "image", "id": it["id"], "title": it.get("alt_description") or it.get("description") or "",
                    "author": user.get("name", ""), "page": (it.get("links") or {}).get("html"),
                    "url": (raw + ("&" if "?" in raw else "?") + "w=2400&fm=jpg&q=85") if raw else urls.get("full"),
                    "download_location": (it.get("links") or {}).get("download_location"), "w": it.get("width"), "h": it.get("height")})
    return out


def _commons_items(pages: Dict[str, Any]) -> List[Dict[str, Any]]:
    out = []
    for pg in sorted(pages.values(), key=lambda p: p.get("index", 0)):
        ii = (pg.get("imageinfo") or [{}])[0]
        meta = ii.get("extmetadata") or {}
        lic = _strip((meta.get("LicenseShortName") or {}).get("value", ""))
        if not credits.license_ok(lic) or not str(ii.get("mime", "")).startswith("image/"):
            continue
        out.append({"site": "commons", "kind": "image", "id": pg.get("title", ""), "title": _strip((meta.get("ObjectName") or {}).get("value", "")) or pg.get("title", ""),
                    "author": _strip((meta.get("Artist") or {}).get("value", ""))[:80] or "unknown", "page": ii.get("descriptionurl"),
                    "url": ii.get("thumburl") or ii.get("url"), "w": ii.get("thumbwidth") or ii.get("width"), "h": ii.get("thumbheight") or ii.get("height"),
                    "license": lic})
    return out


def _commons(q: str, video: bool, n: int) -> List[Dict[str, Any]]:
    if video:
        return []
    data = net.get_json(API["commons"], {"action": "query", "format": "json", "generator": "search", "gsrsearch": f"{q} filetype:bitmap",
                                         "gsrnamespace": 6, "gsrlimit": n * 2, "prop": "imageinfo",
                                         "iiprop": "url|size|mime|extmetadata", "iiurlwidth": MAX_IMAGE})
    return _commons_items((data.get("query") or {}).get("pages") or {})[:n]


def commons_file(title: str) -> Optional[Dict[str, Any]]:
    """'File:이름.jpg' 하나"""
    data = net.get_json(API["commons"], {"action": "query", "format": "json", "titles": title, "prop": "imageinfo",
                                         "iiprop": "url|size|mime|extmetadata", "iiurlwidth": MAX_IMAGE})
    items = _commons_items((data.get("query") or {}).get("pages") or {})
    return items[0] if items else None


def search(ep: Episode, query: str, sites: Optional[List[str]] = None, video: bool = False, portrait: bool = False, per_site: int = 6) -> Dict[str, Any]:
    keys = config.keys()
    net.hide(*keys.values())
    sites = sites or ["pexels", "pixabay", "unsplash", "commons"]
    items, notes = [], []
    for site in sites:
        try:
            if site == "commons":
                items += _commons(query, video, per_site)
            elif site in ("pexels", "pixabay", "unsplash"):
                if not keys.get(site):
                    notes.append(f"{site}: 키 없음 (longepass.keys.json) — 건너뜀")
                    continue
                items += {"pexels": _pexels, "pixabay": _pixabay, "unsplash": _unsplash}[site](keys[site], query, video, portrait, per_site)
            else:
                notes.append(f"모르는 사이트 {site}")
        except net.NetError as e:
            notes.append(f"{site}: {e}")
    for i, it in enumerate(items):
        it["n"] = i + 1
        it.setdefault("license", LICENSE.get(it["site"], ""))
    res = {"query": query, "video": video, "made": now(), "items": items, "notes": notes}
    with open(os.path.join(ep.assets, "_search.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, ensure_ascii=False, indent=2)
    return res


def describe(it: Dict[str, Any]) -> str:
    size = f"{it.get('w')}x{it.get('h')}" if it.get("w") else "?"
    dur = f" {it['duration']}s" if it.get("duration") else ""
    return f"[{it['n']:>2}] {it['site']:8} {it['kind']:5} {size:>9}{dur}  {it.get('author', '')[:24]:24}  {(it.get('title') or '')[:50]}  {it.get('page') or ''}"


# ---------------------------------------------------------------- 받기
def _credit_text(it: Dict[str, Any]) -> str:
    site = SITE_NAME.get(it["site"], it["site"])
    if it["site"] == "commons":
        return f"{it.get('author') or 'unknown'} / {site} / {it.get('license')}"[:80]
    return f"{it.get('author') or site} / {site}"[:80]


def get(ep: Episode, ref: str, name: str, start: Optional[float] = None, dur: Optional[float] = None,
        focus: Optional[List[float]] = None) -> Dict[str, Any]:
    if not re.fullmatch(r"[a-z0-9][a-z0-9_\-]*", name):
        raise ValueError("소재 이름(id)은 영문 소문자·숫자·-·_")
    if ref.startswith("File:"):
        it = commons_file(ref)
        if not it:
            raise ValueError(f"커먼즈에서 찾지 못했거나 쓸 수 없는 라이선스: {ref}")
    else:
        with open(os.path.join(ep.assets, "_search.json"), "r", encoding="utf-8") as f:
            items = {str(x["n"]): x for x in json.load(f)["items"]}
        it = items.get(str(ref).lstrip("#"))
        if not it:
            raise ValueError(f"마지막 검색 결과에 {ref}번이 없음")
    if not credits.license_ok(it.get("license", "")):
        raise ValueError(f"쓸 수 없는 라이선스: {it.get('license')}")
    keys = config.keys()
    net.hide(*keys.values())
    ext = os.path.splitext(urllib.parse.urlparse(it["url"]).path)[1].lower() or (".mp4" if it["kind"] == "video" else ".jpg")
    tmp = os.path.join(ep.assets, f"_dl_{name}{ext}")
    net.download(it["url"], tmp)
    if it["site"] == "unsplash" and it.get("download_location") and keys.get("unsplash"):
        try:   # Unsplash API 규칙: 받을 때 다운로드 횟수를 알린다
            net.request(it["download_location"], headers={"Authorization": f"Client-ID {keys['unsplash']}"}, retries=0)
        except net.NetError:
            pass
    out = finish(tmp, os.path.join(ep.assets, name), it["kind"], start, dur)
    info = credits.add(ep, out, title=it.get("title"), credit=_credit_text(it), source=it.get("page"), license=it.get("license"),
                       site=it["site"], author=it.get("author"), focus=focus)
    ep.log(f"소재 {name}: {it['site']} {it.get('page')} ({it.get('license')})")
    return {"id": name, "file": os.path.basename(out), **info}


def finish(tmp: str, base: str, kind: str, start: Optional[float] = None, dur: Optional[float] = None) -> str:
    """받은 파일 정리: 사진은 긴 변 2560px 이하 JPG/PNG, 영상은 무음 H.264 1920px 이하. 반환: 최종 경로"""
    try:
        if kind == "video":
            out = base + ".mp4"
            cmd = ["ffmpeg", "-v", "error", "-y"]
            if start:
                cmd += ["-ss", f"{start}"]
            cmd += ["-i", tmp, "-t", f"{min(dur or MAX_VIDEO_SEC, MAX_VIDEO_SEC)}", "-an",
                    "-vf", f"scale='min({MAX_VIDEO_W},iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", out]
            subprocess.run(cmd, check=True)
            return out
        p = probe(tmp)
        ext = os.path.splitext(tmp)[1].lower()
        if ext in (".jpg", ".jpeg", ".png") and max(p.get("w", 0), p.get("h", 0)) <= MAX_IMAGE:
            out = base + (".png" if ext == ".png" else ".jpg")
            os.replace(tmp, out)
            return out
        out = base + ".jpg"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-vf",
                        f"scale='if(gt(iw,ih),min({MAX_IMAGE},iw),-2)':'if(gt(iw,ih),-2,min({MAX_IMAGE},ih))'", "-q:v", "3", out], check=True)
        return out
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def add_local(ep: Episode, src: str, name: str, credit: str, license: str, source: str = "", title: str = "",
              focus: Optional[List[float]] = None) -> Dict[str, Any]:
    """사람이 준 파일·직접 만든 파일을 소재로 (출처 기록과 함께)"""
    import shutil
    kind = kind_of(src)
    if not kind:
        raise ValueError(f"사진/영상 파일이 아님: {src}")
    tmp = os.path.join(ep.assets, f"_dl_{name}{os.path.splitext(src)[1].lower()}")
    shutil.copyfile(src, tmp)
    out = finish(tmp, os.path.join(ep.assets, name), kind)
    info = credits.add(ep, out, title=title, credit=credit, source=source, license=license, site="local", focus=focus)
    ep.log(f"소재 {name}: 직접 추가 ({license}) {source}")
    return {"id": name, "file": os.path.basename(out), **info}
