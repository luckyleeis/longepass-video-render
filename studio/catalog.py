"""
템플릿 카탈로그: src/templates/<id>/manifest.json 을 읽는 단일 기준.

- load(): 명세 전부 (id → manifest)
- candidates(project, style, aspect): 이 영상에서 쓸 수 있는 템플릿만 (scope/media/continuity/aspect 필터)
- catalog_text(...): LLM 계획 프롬프트에 넣는 템플릿 설명
- validate_shot(): LLM이 채운 data 검증/보정
- check(): 명세 + 코드 규칙 검사 (새 템플릿 등록 전 반드시 통과)
- write_index(): Remotion 쪽 템플릿 목록(templates/index.ts) 자동 생성

템플릿 종류 (manifest "kind"):
- shot  : 내레이션 한 덩어리 = 화면 하나 (기본)
- stage : 무대. 내레이션 여러 문장(beats)에 걸쳐 화면 요소가 남아서 위치/배치만 바뀐다
          fields = 무대 전체 데이터, beat_fields = 비트마다 바뀌는 값, beat_events/beat_sfx = 비트 안의 순간

명령: bin/studio check (검사 + index.ts 갱신), bin/studio list
작성 규칙은 TEMPLATE_GUIDE.md
"""
import glob
import json
import os
import re
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES_DIR = os.path.join(ROOT, "src", "templates")
SFX_LIBRARY = os.path.join(ROOT, "public", "sfx", "library.json")
MEDIA_TSX = os.path.join(ROOT, "src", "kit", "media.tsx")


@lru_cache(maxsize=1)
def icon_names() -> List[str]:
    """kit/media.tsx 의 ICONS 이름 (명세의 icon 선택지는 이 안에 있어야 한다)"""
    src = open(MEDIA_TSX, encoding="utf-8").read()
    block = src[src.index("const ICONS"):src.index("};", src.index("const ICONS"))]
    return re.findall(r"(\w+): 'Tb", block)

BG_ROLES = ["base", "alt", "accent", "deep"]
CATEGORIES = ["opener", "structure", "emphasis", "number", "organize", "compare", "chart", "space", "story", "outro"]
FIELD_TYPES = ["text", "number", "int", "bool", "enum", "list", "object"]
EVENT_KINDS = ["single", "each", "stagger"]
STAGE_KEYS = ["beat_fields", "beat_events", "beat_sfx", "beats"]
REQUIRED_KEYS = ["id", "version", "name", "component", "category", "scope", "media", "continuity", "aspect", "llm",
                 "use_when", "fields", "events", "sfx", "bg", "duration", "examples"]


@lru_cache(maxsize=1)
def load() -> Dict[str, Dict[str, Any]]:
    out = {}
    for path in sorted(glob.glob(os.path.join(TEMPLATES_DIR, "*", "manifest.json"))):
        with open(path, "r", encoding="utf-8") as f:
            m = json.load(f)
        m["_dir"] = os.path.dirname(path)
        m.setdefault("kind", "shot")
        out[m["id"]] = m
    return out


def get(tid: str) -> Dict[str, Any]:
    m = load().get(tid)
    if not m:
        raise KeyError(f"템플릿 없음: {tid}")
    return m


def candidates(project: str, style: Dict[str, Any], aspect: str = "16:9", llm_only: bool = True) -> Dict[str, Dict[str, Any]]:
    """이 프로젝트/스타일/화면비에서 쓸 수 있는 템플릿"""
    media, cont = style.get("media", "clean"), style.get("continuity", "cut")
    out = {}
    for tid, m in load().items():
        if llm_only and not m["llm"]:
            continue
        if m["scope"] != "common" and project not in m["scope"]:
            continue
        if media not in m["media"] or cont not in m["continuity"] or aspect not in m["aspect"]:
            continue
        out[tid] = m
    return out


# ---------------------------------------------------------------- LLM 설명
def _desc(f: Dict[str, Any]) -> str:
    k = f["type"]
    if k == "text":
        s = f"text(≤{f['max']})"
    elif k == "enum":
        s = "|".join(f["options"])
    elif k == "bool":
        s = "true|false"
    elif k == "object":
        s = "{ " + ", ".join(f"{n}{'*' if _required(v) else ''}: {_desc(v)}" for n, v in f["fields"].items()) + " }"
    elif k == "list":
        s = f"[{_desc(f['item'])}] ({f['min']}~{f['max']})"
    else:
        s = k
    if f.get("desc"):
        s += f" — {f['desc']}"
    return s


def _required(f: Dict[str, Any]) -> bool:
    return bool(f.get("required")) or f["type"] in ("list", "object") and f.get("min", 1) > 0


def _fields_text(fields: Dict[str, Any]) -> str:
    return ", ".join(f"{n}{'*' if _required(v) else ''}: {_desc(v)}" for n, v in fields.items())


def _cues_text(events: Dict[str, Any]) -> str:
    return ", ".join(f"{e}{' (one per item)' if spec['kind'] in ('each', 'stagger') else ''}" for e, spec in events.items()) or "(none)"


def catalog_text(templates: Dict[str, Dict[str, Any]]) -> str:
    rows = []
    for tid, m in templates.items():
        avoid = f" Avoid: {m['avoid_when']}" if m.get("avoid_when") else ""
        if m["kind"] == "stage":
            b = m["beats"]
            rows.append(f"- **{tid}** [STAGE, {b['min']}~{b['max']} beats]: {m['use_when']}{avoid}\n"
                        f"  data: {{ {_fields_text(m['fields'])} }}\n"
                        f"  beats[].data: {{ {_fields_text(m['beat_fields'])} }}\n"
                        f"  beats[].cues keys: {_cues_text(m['beat_events'])}")
        else:
            rows.append(f"- **{tid}**: {m['use_when']}{avoid}\n  data: {{ {_fields_text(m['fields'])} }}\n  cues keys: {_cues_text(m['events'])}")
    return "\n".join(rows)


# ---------------------------------------------------------------- 데이터 검증
def _num(v) -> Optional[float]:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _check(f: Dict[str, Any], v, path: str, warns: List[str]) -> Tuple[bool, Any]:
    k, req = f["type"], bool(f.get("required"))
    if k == "text":
        if v in (None, ""):
            return not req, None
        s = str(v).strip()
        if len(s) > f["max"]:
            warns.append(f"{path}: {len(s)}자 (권장 {f['max']})")
        return True, s
    if k == "number":
        n = _num(v)
        return (n is not None) or not req, n
    if k == "int":
        n = _num(v)
        return True, int(n) if n is not None else None
    if k == "bool":
        return True, bool(v) if v is not None else None
    if k == "enum":
        if v in f["options"]:
            return True, v
        return not req, (f["options"][0] if req else None)
    if k == "object":
        if not isinstance(v, dict):
            return not req, None
        out = {}
        for n, sub in f["fields"].items():
            ok, val = _check(sub, v.get(n), f"{path}.{n}", warns)
            if not ok:
                return False, None
            if val is not None:
                out[n] = val
        return True, out
    if k == "list":
        if not isinstance(v, list):
            return f["min"] == 0, []
        out = []
        for i, it in enumerate(v[: f["max"]]):
            ok, val = _check({**f["item"], "required": True} if f["item"]["type"] == "object" else f["item"], it, f"{path}[{i}]", warns)
            if ok and val not in (None, {}, ""):
                out.append(val)
        return len(out) >= f["min"], out
    return True, v


def validate_shot(shot: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], List[str], Optional[str]]:
    """반환: (보정된 data 또는 None, 경고, 실패 사유)"""
    warns: List[str] = []
    m = load().get(shot.get("module") or "")
    if not m:
        return None, warns, f"알 수 없는 템플릿 {shot.get('module')}"
    data_in = shot.get("data") or {}
    out = {}
    for n, f in m["fields"].items():
        ok, val = _check(f, data_in.get(n), f"{m['id']}.{n}", warns)
        if not ok:
            return None, warns, f"{m['id']}.{n} 누락/형식 오류"
        if val is not None:
            out[n] = val
    # 강조/취소 구절은 실제 화면 문구 안에 있어야 한다
    for key in ("highlight", "strike"):
        if isinstance(out.get(key), str) and out.get(key):  # 숫자 칸(bar_chart.highlight = 막대 번호 등)은 제외
            texts = out.get("lines") or [out.get("title", "")]
            if not any(out[key] in t for t in texts):
                warns.append(f"{m['id']}.{key} '{out[key]}'가 문구에 없어 제거")
                out.pop(key)
    return out, warns, None


def validate_beats(shot: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str], Optional[str]]:
    """무대 템플릿의 beats 검증. 반환: ([{narration, data, cues}], 경고, 실패 사유)"""
    m = get(shot["module"])
    warns: List[str] = []
    out = []
    for i, b in enumerate(shot.get("beats") or []):
        if not isinstance(b, dict) or not (b.get("narration") or "").strip():
            continue
        data = {}
        for n, f in m["beat_fields"].items():
            ok, val = _check(f, (b.get("data") or {}).get(n), f"{m['id']}.beats[{i}].{n}", warns)
            if not ok:
                return [], warns, f"{m['id']}.beats[{i}].{n} 누락/형식 오류"
            if val is not None:
                data[n] = val
        out.append({"narration": b["narration"].strip(), "data": data, "cues": b.get("cues") if isinstance(b.get("cues"), dict) else {}})
    if len(out) < m["beats"]["min"]:
        return [], warns, f"{m['id']}: beats {len(out)}개 (최소 {m['beats']['min']})"
    return out[: m["beats"]["max"]], warns, None


def fallback_shot(narration: str) -> Dict[str, Any]:
    """검증 실패한 샷의 대체: 첫 구절을 큰 글자로"""
    first = narration.replace("，", "。").replace("！", "。").replace("？", "。").split("。")[0].strip()
    lines = [first[i:i + 8] for i in range(0, min(len(first), 16), 8)] or ["…"]
    return {"module": "headline", "data": {"lines": lines}}


def sfx_map(m: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    """이벤트별 효과음 (data 조건에 따른 덮어쓰기 반영)"""
    out = dict(m.get("sfx", {}))
    for rule in m.get("sfx_when", []):
        if all(data.get(k) == v for k, v in rule["if"].items()):
            out.update(rule["sfx"])
    return out


# ---------------------------------------------------------------- 검사
HEX_COLOR = re.compile(r"['\"`]#[0-9a-fA-F]{3,8}['\"`]")
RAW_DRAWING = re.compile(r"<(?:rect|circle|ellipse|path|line|polygon|polyline)\b|\bbackground:|\bborderRadius:")


def _check_field_spec(f, path: str, errs: List[str]):
    if not isinstance(f, dict) or f.get("type") not in FIELD_TYPES:
        errs.append(f"{path}: type은 {FIELD_TYPES} 중 하나")
        return
    k = f["type"]
    if k == "text" and not isinstance(f.get("max"), int):
        errs.append(f"{path}: text에는 max(글자 수)가 필요")
    if k == "enum" and not f.get("options"):
        errs.append(f"{path}: enum에는 options가 필요")
    if k == "enum" and path.endswith(".icon"):
        bad = [o for o in f.get("options", []) if o not in icon_names()]
        if bad:
            errs.append(f"{path}: kit/media.tsx에 없는 아이콘 {bad}")
    if k == "list":
        if not isinstance(f.get("min"), int) or not isinstance(f.get("max"), int):
            errs.append(f"{path}: list에는 min/max가 필요")
        _check_field_spec(f.get("item"), f"{path}.item", errs)
    if k == "object":
        for n, sub in (f.get("fields") or {}).items():
            _check_field_spec(sub, f"{path}.{n}", errs)


def check_manifest(m: Dict[str, Any], sfx_categories: set) -> List[str]:
    errs: List[str] = []
    tid = m.get("id", "?")
    for k in REQUIRED_KEYS:
        if k not in m:
            errs.append(f"필수 항목 없음: {k}")
    if errs:
        return errs
    if os.path.basename(m["_dir"]) != tid:
        errs.append(f"폴더 이름({os.path.basename(m['_dir'])})과 id({tid})가 다름")
    if not re.fullmatch(r"[a-z][a-z0-9_]*", tid):
        errs.append("id는 소문자/숫자/밑줄")
    if m["category"] not in CATEGORIES:
        errs.append(f"category는 {CATEGORIES} 중 하나")
    if m["bg"] is not None and m["bg"] not in BG_ROLES:
        errs.append(f"bg는 null 또는 {BG_ROLES}")
    if m["scope"] != "common" and not isinstance(m["scope"], list):
        errs.append('scope는 "common" 또는 프로젝트 이름 목록')
    for n, f in m["fields"].items():
        _check_field_spec(f, f"fields.{n}", errs)
    if m["kind"] not in ("shot", "stage"):
        errs.append('kind는 "shot" 또는 "stage"')
    stage = m["kind"] == "stage"
    if stage:
        errs += [f"무대 템플릿 필수 항목 없음: {k}" for k in STAGE_KEYS if k not in m]
        if errs:
            return errs
        for n, f in m["beat_fields"].items():
            _check_field_spec(f, f"beat_fields.{n}", errs)
    groups = [("events", m["events"], m["fields"])]
    if stage:
        groups.append(("beat_events", m["beat_events"], {**m["fields"], **m["beat_fields"]}))
    for label, events, fields in groups:
        for e, spec in events.items():
            if spec.get("kind") not in EVENT_KINDS:
                errs.append(f"{label}.{e}: kind는 {EVENT_KINDS}")
            if spec.get("kind") in ("each", "stagger") and spec.get("of") not in fields:
                errs.append(f"{label}.{e}: of='{spec.get('of')}'가 fields에 없음")
            if spec.get("when") and spec["when"] not in fields:
                errs.append(f"{label}.{e}: when='{spec['when']}'가 fields에 없음")
            if spec.get("after") and spec["after"].get("event") not in events:
                errs.append(f"{label}.{e}: after.event가 같은 이벤트 목록에 없음")
    sfx_all = [("sfx", m["sfx"], m["events"])] + [("sfx_when", r.get("sfx", {}), m["events"]) for r in m.get("sfx_when", [])]
    if stage:
        sfx_all.append(("beat_sfx", m["beat_sfx"], {**m["beat_events"], "at": {}}))
    for label, mp, events in sfx_all:
        for e, cat in mp.items():
            if e not in events:
                errs.append(f"{label}.{e}: 이벤트 목록에 없는 이벤트")
            for c in (cat if isinstance(cat, list) else [cat]):
                if c not in sfx_categories:
                    errs.append(f"{label}.{e}: 효과음 종류 '{c}' 없음 (sfx/library.json)")
    comp = os.path.join(m["_dir"], m["component"])
    if not os.path.exists(comp):
        errs.append(f"컴포넌트 파일 없음: {m['component']}")
    else:
        src = open(comp, encoding="utf-8").read()
        if "export default" not in src:
            errs.append(f"{m['component']}: export default 없음")
        for hit in sorted(set(HEX_COLOR.findall(src))):
            errs.append(f"{m['component']}: 색을 직접 씀 {hit} (스킨/면 색을 써야 함)")
        # 도형은 그림 재료 층(kit/media.tsx)으로만: 직접 그리면 손그림 등 다른 재료에서 모습이 안 바뀐다
        for hit in sorted(set(RAW_DRAWING.findall(src))):
            errs.append(f"{m['component']}: 도형을 직접 그림 '{hit.strip()}' (kit/media의 Panel/Dot/Bar/Mark/SRect/SPath… 사용)")
    if not m["examples"]:
        errs.append("examples가 최소 1개 필요 (갤러리 미리보기)")
    for i, ex in enumerate(m["examples"]):
        _, _, reason = validate_shot({"module": tid, "data": ex.get("data")})
        if not reason and stage:
            _, _, reason = validate_beats({"module": tid, "beats": ex.get("beats")})
        if reason:
            errs.append(f"examples[{i}]: {reason}")
    return errs


def check() -> Dict[str, List[str]]:
    load.cache_clear()
    with open(SFX_LIBRARY, "r", encoding="utf-8") as f:
        cats = {s["category"] for s in json.load(f)["sounds"]}
    return {tid: check_manifest(m, cats) for tid, m in load().items()}


def write_index() -> str:
    """Remotion 쪽 템플릿 목록 생성 (손으로 고치지 않는다)"""
    lines = ["// 자동 생성: bin/studio check (손으로 고치지 마세요)", "import React from 'react';",
             "import { TemplateProps } from '../kit/types';"]
    names = []
    for tid, m in load().items():
        var = "T_" + tid
        names.append((tid, var))
        lines.append(f"import {var} from './{tid}/{os.path.splitext(m['component'])[0]}';")
    lines.append("")
    lines.append("export const TEMPLATES: Record<string, React.FC<TemplateProps>> = {")
    lines += [f"  {tid}: {var}," for tid, var in names]
    lines.append("};")
    path = os.path.join(TEMPLATES_DIR, "index.ts")
    text = "\n".join(lines) + "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path
