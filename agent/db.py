"""
LONGEPASS DB (certificate_tw, 백엔드 py-macmini-server 와 같은 DB) — 기본 데이터와 업로드 대기열.

- 접속 주소는 .env 의 DATABASE_URL (git 제외). 출력·로그·파일에 옮기지 않는다.
- agent/ 는 표준 라이브러리만 쓰므로 psycopg 는 `uv run --with psycopg[binary]` 로 agent/pg_run.py 를 따로 띄워 쓴다
  (저장소에 패키지가 남지 않는다. 처음 한 번 uv 가 내려받는다).

읽기
  articles          글 (slug = 작업 이름, content = 초안 재료). 영상으로 만들 수 있는 글 = confirm AND NOT discarded
  longform_videos   백엔드와 같은 제작 기록. 한 번이라도 기록이 있는 slug 는 새 글 목록에서 뺀다 (백엔드 자동 선택과 같은 기준)
쓰기 (longform_videos 만)
  bin/lp new --from-db   status=running 기록 (request_id lp-…). 백엔드 자동 선택이 같은 글을 고르지 않게 한다
  bin/lp publish         status=ready + out_dir·영상·썸네일·쇼츠 → 백엔드 publish.py 가 {out_dir}/youtube.json 으로 예약
  bin/lp release         아직 running 인 내 기록을 지운다 (만들다 그만둘 때)
"""
import json
import os
import re
import shutil
import subprocess
import uuid
from typing import Any, Dict, List, Optional

from agent import config, net  # noqa: F401 — config 를 불러야 .env (DATABASE_URL) 가 읽힌다

SITE = os.getenv("LONGEPASS_SITE_HOST", "https://longepass.com")
RUNNER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pg_run.py")
BUSY = ("running", "ready", "scheduled", "published")   # 이 상태 기록이 있으면 새로 만들지 않는다 (백엔드 DONE_STATUSES)


class DBError(RuntimeError):
    pass


def available() -> bool:
    return bool(os.getenv("DATABASE_URL"))


def run(steps: List[Dict[str, Any]], commit: bool = True) -> List[Dict[str, Any]]:
    """steps 를 한 트랜잭션으로. commit=False 면 되돌린다"""
    if not available():
        raise DBError("DATABASE_URL 이 없음 — 저장소 루트 .env 에 적는다 (예시 .env.example)")
    uv = shutil.which("uv")
    if not uv:
        raise DBError("uv 가 없음 (brew install uv) — DB 는 uv run --with psycopg 로 읽는다")
    cmd = [uv, "run", "--quiet", "--no-project", "--with", "psycopg[binary]>=3.1", "python", "-I", RUNNER]
    p = subprocess.run(cmd, input=json.dumps({"steps": steps, "commit": commit}, ensure_ascii=False, default=str),
                       capture_output=True, text=True, timeout=120, env=os.environ.copy())
    if p.returncode != 0:
        raise DBError((p.stderr or "").strip().splitlines()[-1] if p.stderr.strip() else f"DB 실행 실패 ({p.returncode})")
    return json.loads(p.stdout or "[]")


def _rows(sql: str, params: Optional[List[Any]] = None) -> List[Dict[str, Any]]:
    return run([{"sql": sql, "params": params or []}])[0]["rows"]


def jsonb(value: Any) -> Dict[str, Any]:
    return {"$json": value}


# ---------------------------------------------------------------- 글
def topic_url(slug: str) -> str:
    return f"{SITE}/topics/{slug}"


def is_live(slug: str) -> bool:
    """사이트에 글 페이지가 열리는지 (정적 빌드라 DB 에 있어도 다음 배포 전엔 404). 백엔드와 같은 기준"""
    try:
        net.request(topic_url(slug), timeout=10, retries=0)
        return True
    except Exception:
        return False


def candidates(n: int = 10, check_live: bool = True) -> List[Dict[str, Any]]:
    """아직 영상 기록이 없는 확정 글, 최근 수정 순"""
    rows = _rows("""
        SELECT a.id, a.slug, a.frontmatter->>'title' AS title, a.label, length(a.content) AS chars, a.last_updated
        FROM articles a
        WHERE a.confirm = true AND a.discarded = false
          AND a.slug NOT IN (SELECT slug FROM longform_videos)
        ORDER BY a.last_updated DESC
    """)
    out = []
    for r in rows:
        if len(out) >= n:
            break
        if check_live:
            r["live"] = is_live(r["slug"])
            if not r["live"]:
                continue
        out.append(r)
    return out


def article(slug: str) -> Optional[Dict[str, Any]]:
    rows = _rows("""
        SELECT id, slug, label, grade, codes, frontmatter, content, source_urls, confirm, discarded, last_updated
        FROM articles WHERE slug = %s
    """, [slug])
    return rows[0] if rows else None


def strip_html(content: str) -> str:
    """본문의 스타일/HTML 태그를 걷어낸 텍스트 (백엔드 _strip_article_html 과 같다)"""
    text = re.sub(r"<style[\s\S]*?</style>", "", content or "")
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"</(div|p|li|tr)>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    return text.strip()


def draft_markdown(art: Dict[str, Any]) -> str:
    """DB 글 → draft.md (영상의 주제와 출발점. 에이전트가 조사로 보탠다 — CHANNEL.md 「기본 데이터와 조사」)"""
    fm = art.get("frontmatter") or {}
    lines = [f"# {fm.get('title') or art['slug']}", "",
             f"- slug: `{art['slug']}` · 분류: {art.get('label') or fm.get('category') or '-'} · 마지막 수정: {art.get('last_updated')}",
             f"- 사이트: {topic_url(art['slug'])}"]
    if fm.get("codes") or art.get("codes"):
        lines.append(f"- 職類 코드: {json.dumps(fm.get('codes') or art.get('codes'), ensure_ascii=False)}")
    if fm.get("description"):
        lines += ["", "## 요약", "", fm["description"]]
    lines += ["", "## 본문", "", strip_html(art.get("content") or "")]
    faqs = fm.get("faqs") or []
    if faqs:
        lines += ["", "## FAQ", ""]
        for q in faqs:
            if isinstance(q, dict):
                lines += [f"**Q. {q.get('question') or q.get('q') or ''}**", "", str(q.get("answer") or q.get("a") or ""), ""]
    steps = fm.get("howto_steps") or []
    if steps:
        lines += ["", "## 절차", ""] + [f"{i}. {s.get('name') or s.get('text') if isinstance(s, dict) else s}" for i, s in enumerate(steps, 1)]
    src = art.get("source_urls") or []
    if src:
        lines += ["", "## 글의 출처 (DB source_urls)", ""] + [f"- {u.get('url') if isinstance(u, dict) else u}" for u in src]
    return "\n".join(lines).rstrip() + "\n"


# ---------------------------------------------------------------- 제작 기록 (longform_videos)
def latest_record(slug: str) -> Optional[Dict[str, Any]]:
    rows = _rows("SELECT * FROM longform_videos WHERE slug = %s ORDER BY created_at DESC LIMIT 1", [slug])
    return rows[0] if rows else None


def get_record(request_id: str) -> Optional[Dict[str, Any]]:
    rows = _rows("SELECT * FROM longform_videos WHERE request_id = %s", [request_id])
    return rows[0] if rows else None


def create_record(slug: str, article_id: Optional[int], style: str) -> str:
    """status=running (백엔드 자동 선택이 이 글을 건너뛴다). request_id 는 lp-… (에이전트 방식 표시)"""
    rid = f"lp-{uuid.uuid4().hex[:12]}"
    run([{"sql": """INSERT INTO longform_videos (request_id, slug, article_id, style, status, report)
                    VALUES (%s, %s, %s, %s, 'running', %s)""",
          "params": [rid, slug, article_id, style, jsonb({"made_by": "agent"})]}])
    return rid


def set_ready(request_id: str, fields: Dict[str, Any], commit: bool = True) -> Dict[str, Any]:
    """status=ready + 업로드 재료 (백엔드 route/video_longform.py 의 ready 와 같은 칸)"""
    cols = ["status", "out_dir", "video_path", "thumbnail_path", "duration_sec", "report", "shorts", "error_message"]
    vals = ["ready", fields["out_dir"], fields["video_path"], fields["thumbnail_path"], fields["duration_sec"],
            jsonb(fields["report"]), jsonb(fields["shorts"]), None]
    sets = ", ".join(f"{c} = %s" for c in cols)
    res = run([{"sql": f"UPDATE longform_videos SET {sets}, updated_at = NOW() WHERE request_id = %s AND status IN ('running', 'failed', 'ready')",
                "params": [*vals, request_id]},
               {"sql": "SELECT request_id, slug, status, out_dir, video_path, thumbnail_path, duration_sec, shorts FROM longform_videos WHERE request_id = %s",
                "params": [request_id]}], commit=commit)
    if res[0]["rowcount"] != 1:
        raise DBError(f"기록을 ready 로 바꾸지 못함: {request_id} (이미 예약·공개됐거나 없음)")
    return res[1]["rows"][0]


def release(request_id: str) -> int:
    """만들다 그만둔 내 기록(running)을 지운다. 지운 줄 수"""
    return run([{"sql": "DELETE FROM longform_videos WHERE request_id = %s AND status = 'running' AND request_id LIKE 'lp-%%'",
                 "params": [request_id]}])[0]["rowcount"]


def config_ok() -> Dict[str, Any]:
    """bin/lp where 용 (주소는 보이지 않는다)"""
    url = os.getenv("DATABASE_URL", "")
    m = re.match(r"\w+://[^@]*@([^/:]+)(?::\d+)?/(\w+)", url)
    return {"database": f"{m.group(2)}@{m.group(1)}" if m else None}

