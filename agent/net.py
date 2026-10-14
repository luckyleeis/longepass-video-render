"""
HTTP 도우미 (표준 라이브러리). 에이전트 방식 도구만 쓴다 — 렌더링 엔진(studio/)은 네트워크를 쓰지 않는다.
오류 메시지에서 API 키를 지운다.
"""
import json
import os
import shutil
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict, Iterable, Optional, Tuple

UA = "longepass-video-render/1.0 (agent tools; contact: channel owner)"
_SECRETS: set = set()


def hide(*values: str) -> None:
    """오류 메시지에서 가릴 값 (API 키) 등록"""
    _SECRETS.update(v for v in values if v)


def _clean(msg: str) -> str:
    for s in _SECRETS:
        msg = msg.replace(s, "***")
    return msg


class NetError(RuntimeError):
    pass


def request(url: str, data: Optional[bytes] = None, headers: Optional[Dict[str, str]] = None, method: Optional[str] = None,
            timeout: float = 60, retries: int = 2) -> Tuple[bytes, Dict[str, str]]:
    h = {"User-Agent": UA, **(headers or {})}
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=h, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(), dict(r.headers)
        except urllib.error.HTTPError as e:
            body = e.read()[:300].decode("utf-8", "replace")
            last = NetError(_clean(f"HTTP {e.code} {url}: {body}"))
            if e.code < 500 and e.code != 429:
                break
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = NetError(_clean(f"연결 실패 {url}: {e}"))
        time.sleep(1.5 * (attempt + 1))
    raise last  # type: ignore[misc]


def get_json(url: str, params: Optional[Dict[str, Any]] = None, headers: Optional[Dict[str, str]] = None) -> Any:
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, "")})
    body, _ = request(url, headers=headers)
    return json.loads(body.decode("utf-8"))


def post_json(url: str, payload: Dict[str, Any], headers: Optional[Dict[str, str]] = None, timeout: float = 180) -> Tuple[bytes, Dict[str, str]]:
    return request(url, data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                   headers={"Content-Type": "application/json", **(headers or {})}, method="POST", timeout=timeout)


def post_multipart(url: str, fields: Dict[str, str], files: Iterable[Tuple[str, str, bytes, str]], timeout: float = 180) -> bytes:
    """files: (필드 이름, 파일 이름, 내용, MIME)"""
    b = uuid.uuid4().hex
    parts = []
    for k, v in fields.items():
        parts.append(f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode("utf-8"))
    for name, fname, content, mime in files:
        parts.append(f"--{b}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{fname}\"\r\nContent-Type: {mime}\r\n\r\n".encode("utf-8"))
        parts.append(content + b"\r\n")
    parts.append(f"--{b}--\r\n".encode("utf-8"))
    body, _ = request(url, data=b"".join(parts), headers={"Content-Type": f"multipart/form-data; boundary={b}"}, method="POST", timeout=timeout)
    return body


def download(url: str, path: str, headers: Optional[Dict[str, str]] = None, timeout: float = 300) -> str:
    """파일 받기 (임시 파일 → 이름 바꾸기). 반환: path"""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".part"
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r, open(tmp, "wb") as f:
            shutil.copyfileobj(r, f)
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise NetError(_clean(f"받기 실패 {url}: {e}"))
    os.replace(tmp, path)
    return path
