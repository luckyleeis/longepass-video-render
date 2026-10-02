"""
텍스트 도우미 (자막 나누기, 매칭용 정제). 원본: py-macmini-server src/longepass/sns/timeline_gen.py
서버의 글자 정렬과 같은 정제 규칙을 써야 글자 위치가 맞는다 (clean_text를 바꾸면 양쪽을 같이 바꿀 것).
"""
import re
from typing import List

_CLEAN_RE = re.compile(r"[^\w一-鿿]")


def clean_text(text: str) -> str:
    """부호 및 공백 제거하여 매칭용 텍스트 생성"""
    if not text:
        return ""
    return _CLEAN_RE.sub("", text).lower()


_CLAUSE_END = "，。！？；：、,.!?;:"
_OPENING = "「『（("


def _display_width(text: str) -> float:
    return sum(0.55 if ord(ch) < 0x2E80 else 1.0 for ch in text.strip())


def split_text_word_safe(text: str, max_len: int = 10) -> List[str]:
    """
    자막용 분할: 먼저 문장 부호 단위(절)로 나누고, max_len보다 긴 절은 균등한 길이로 다시 나눕니다.
    영문/숫자 단어는 자르지 않고, 두 글자 이하로 남는 조각은 앞 조각에 붙입니다.
    """
    tokens = re.findall(r"[a-zA-Z0-9]+|\s+|.", text or "")

    clauses: List[List[str]] = [[]]
    for tok in tokens:
        if tok in _OPENING and clauses[-1] and "".join(clauses[-1]).strip():
            clauses.append([])
        clauses[-1].append(tok)
        if tok in _CLAUSE_END:
            clauses.append([])

    def visible_len(toks: List[str]) -> int:
        return len(clean_text("".join(toks)))

    chunks: List[str] = []
    for clause in clauses:
        total = visible_len(clause)
        if total == 0:
            if chunks and "".join(clause).strip():
                chunks[-1] += "".join(clause).strip()
            continue
        parts = -(-total // max_len)
        target = total / parts
        current: List[str] = []
        for tok in clause:
            if current and visible_len(current) + visible_len([tok]) > target + 0.5 and clean_text(tok):
                chunks.append("".join(current).strip())
                current = []
            current.append(tok)
        if current:
            chunks.append("".join(current).strip())

    merged: List[str] = []
    for c in chunks:
        if not c:
            continue
        if merged and len(clean_text(c)) <= 2 and _display_width(merged[-1] + c) <= max_len + 1.5:
            merged[-1] += c
        else:
            merged.append(c)
    return merged


# ---------------------------------------------------------------------------
