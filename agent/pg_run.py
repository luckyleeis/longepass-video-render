"""
Postgres 실행기 — agent/db.py 가 `uv run --with psycopg[binary]` 로 따로 띄운다 (agent/ 는 표준 라이브러리만 쓰므로).
이 파일만 psycopg 를 쓴다. agent 패키지를 import 하지 않는다.

stdin:  {"steps": [{"sql": "…", "params": […]}, …], "commit": true}
        steps 는 한 트랜잭션. commit=false 면 끝에 되돌린다 (쓰기 시험용).
stdout: [{"rows": [{…}, …]} | {"rowcount": N}, …]   (날짜 등은 문자열)
접속 주소는 환경 변수 DATABASE_URL. 주소는 출력하지 않는다.
"""
import json
import os
import sys

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


def main() -> int:
    req = json.load(sys.stdin)
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        sys.stderr.write("DATABASE_URL 이 없음 (.env)\n")
        return 2
    out = []
    try:
        with psycopg.connect(url, row_factory=dict_row, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                for st in req["steps"]:
                    params = [Jsonb(p["$json"]) if isinstance(p, dict) and "$json" in p else p for p in st.get("params") or []]
                    cur.execute(st["sql"], params)
                    out.append({"rows": cur.fetchall()} if cur.description else {"rowcount": cur.rowcount})
            if req.get("commit", True):
                conn.commit()
            else:
                conn.rollback()
    except psycopg.Error as e:
        sys.stderr.write(f"DB 오류: {type(e).__name__}: {str(e).replace(url, '***')[:500]}\n")
        return 1
    sys.stdout.write(json.dumps(out, ensure_ascii=False, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
