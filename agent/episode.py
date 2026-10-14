"""
작업 폴더 (영상 한 편 = <workspace>/<slug>/). 대화가 아니라 파일에 남겨 다음 세션이 이어받는다.

  draft.md        사용자 초안 (에이전트가 고치지 않는다)
  notes.md        분석 + 사실 카드 (근거 등급·출처)
  raw_plan.json   대본 + 샷 배정 (에이전트가 쓴다)
  plan.json       bin/studio validate 결과 (bin/lp plan)
  assets/         소재 + _credits.json (출처 자동 기록) + _search.json (마지막 검색 결과)
  voice/          문장별 TTS 캐시, 장별 음성 chNN.mp3, voices.json (글자 시각)
  job.json        렌더링 작업 파일 (bin/lp job)
  render/         mp4·srt·json·썸네일, render/preview/ 정지 화면
  status.json     단계와 남은 일 (bin/lp stage)
  log.md          결정 기록 (bin/lp log)
"""
import datetime as dt
import json
import os
import re
import shutil
from typing import Any, Dict, List, Optional

from agent import config

STAGES = ["draft", "plan", "assets", "voice", "built", "rendered"]

NOTES_TEMPLATE = """# 분석·사실 메모 — {title}

## 한 줄 요약 / 보고 나서 할 행동

## 핵심 메시지 (3개 이내)

## 사실 카드
| # | 주장 (영상에 쓰는 문장) | 근거 등급 | 출처 (URL·문서명·확인 날짜) | 비고 |
|---|---|---|---|---|

근거 등급: A 법령·공고 원문 / B 정부·기관 안내 페이지 / C 언론·민간 / X 확인 못 함(쓰지 않음)

## 초안에서 고친 것 (무엇을 왜)

## 필요한 그림 (장면 → 소재 종류 → 찾을 말)

## 확인 못 한 것 / 사용자에게 물을 것
"""


def now() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M")


def slug_ok(slug: str) -> bool:
    return bool(re.fullmatch(r"[a-z0-9][a-z0-9_\-]{0,63}", slug))


class Episode:
    def __init__(self, slug: str, cfg: Optional[Dict[str, Any]] = None):
        if not slug_ok(slug):
            raise ValueError(f"작업 이름은 영문 소문자·숫자·-·_ ({slug})")
        self.cfg = cfg or config.load()
        self.slug = slug
        self.dir = os.path.join(self.cfg["workspace"], slug)

    def p(self, *parts: str) -> str:
        return os.path.join(self.dir, *parts)

    @property
    def assets(self) -> str:
        return self.p("assets")

    @property
    def voice(self) -> str:
        return self.p("voice")

    def exists(self) -> bool:
        return os.path.isfile(self.p("status.json"))

    def require(self) -> "Episode":
        if not self.exists():
            raise FileNotFoundError(f"작업 폴더 없음: {self.dir} (bin/lp new {self.slug} \"제목\")")
        return self

    # ------------------------------------------------------------ 상태·기록
    def status(self) -> Dict[str, Any]:
        with open(self.p("status.json"), "r", encoding="utf-8") as f:
            return json.load(f)

    def save_status(self, st: Dict[str, Any]) -> None:
        st["updated"] = now()
        with open(self.p("status.json"), "w", encoding="utf-8") as f:
            json.dump(st, f, ensure_ascii=False, indent=2)

    def set_stage(self, stage: str, todo: Optional[List[str]] = None) -> Dict[str, Any]:
        if stage not in STAGES:
            raise ValueError(f"단계는 {STAGES} 중 하나")
        st = self.status()
        st["stage"] = stage
        if todo is not None:
            st["todo"] = todo
        self.save_status(st)
        self.log(f"단계 → {stage}" + (f" (남은 일: {'; '.join(todo)})" if todo else ""))
        return st

    def log(self, text: str) -> None:
        with open(self.p("log.md"), "a", encoding="utf-8") as f:
            f.write(f"- {now()} {text.strip()}\n")

    # ------------------------------------------------------------ 만들기
    def create(self, title: str, draft: Optional[str] = None) -> None:
        if self.exists():
            raise FileExistsError(f"이미 있음: {self.dir}")
        for d in ("", "assets", "voice", "render"):
            os.makedirs(self.p(d), exist_ok=True)
        if draft:
            shutil.copyfile(draft, self.p("draft.md"))
        elif not os.path.exists(self.p("draft.md")):
            with open(self.p("draft.md"), "w", encoding="utf-8") as f:
                f.write(f"# {title}\n\n(사용자 초안을 여기에)\n")
        with open(self.p("notes.md"), "w", encoding="utf-8") as f:
            f.write(NOTES_TEMPLATE.format(title=title))
        with open(self.p("assets", "_credits.json"), "w", encoding="utf-8") as f:
            f.write("{}\n")
        with open(self.p("log.md"), "w", encoding="utf-8") as f:
            f.write(f"# 결정 기록 — {title}\n\n")
        self.save_status({"slug": self.slug, "title": title, "stage": "draft", "todo": ["초안 분석·사실 확인 → notes.md"], "created": now()})
        self.log("작업 폴더 만듦" + (f" (초안: {os.path.basename(draft)})" if draft else ""))


def list_episodes(cfg: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    cfg = cfg or config.load()
    ws = cfg["workspace"]
    out = []
    if os.path.isdir(ws):
        for name in sorted(os.listdir(ws)):
            sp = os.path.join(ws, name, "status.json")
            if os.path.isfile(sp):
                with open(sp, "r", encoding="utf-8") as f:
                    out.append(json.load(f))
    return out
