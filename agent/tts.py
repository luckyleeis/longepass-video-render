"""
나레이션 TTS: plan.json 의 장(chapter)마다 음성 파일 하나 + 글자별 시각(char_times).

서버 (다큐 그곳과 같은 TTS 서버, 모델은 서버 쪽 gemini-3.8-flash-lite-tts)
  POST {tts.url}
  {"input": "…", "provider": "gemini", "voice": "Aoede", "language": "zh-tw", "speed": 1.0, "response_format": "mp3",
   "instructions": "…(롱폼/숏폼별)", "path": "longepass/longform/<slug>/ch01"}
  → {"id": "…", "audio_url": "https://…/longepass/longform/<slug>/ch01.mp3",
     "timestamp": [{"word": "今", "start": 0.12, "end": 0.35}, …]}

- 서버가 준 **타임스탬프로 글자 시각**을 만든다. 대본(clean_text)과 타임스탬프 글자를 맞춰 보고(difflib),
  맞지 않는 글자는 앞뒤 시각 사이에 고르게 넣는다. 일치율이 tts.min_ratio 보다 낮으면 (TTS가 대본과 다르게 읽음)
  한 번 다시 만들고, 그래도 낮으면 경고한다.
- 긴 장은 문장 경계에서 tts.chunk_chars 글자 안쪽 조각으로 나눠 읽힌다 (긴 글은 TTS 가 끝에서 무너진다).
  조각 사이에 tts.pause_ms 쉼을 넣어 잇는다. 조각이 여럿이면 path 는 chNN_KK.
- 음성 파일은 audio_url 에서 받는다. tts.local_root 가 있고 그 아래에 같은 경로 파일이 있으면 (NAS 를 맥에 연결해 둔 경우)
  받지 않고 복사한다.
- 서버가 JSON 대신 음성을 바로 주면 (다른 서버) 타임스탬프 없이 음성 길이에 글자를 고르게 나눈다.
- 같은 조각·같은 설정이면 voice/cache 를 다시 쓴다 (--force 로 새로).
결과: voice/chNN.mp3 (1부터), voice/voices.json
"""
import difflib
import hashlib
import json
import os
import re
import shutil
import subprocess
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

from agent import net
from agent.episode import Episode, now
from studio.assets import probe
from studio.text import clean_text

SR = 24000
_SPLIT = re.compile(r"(?<=[。！？!?；;…])")


# ---------------------------------------------------------------- 나누기
def sentences(text: str, max_len: int = 80) -> List[str]:
    """문장 단위로 (글자를 빠뜨리지 않는다). 너무 긴 문장은 쉼표에서 한 번 더 나눈다"""
    out: List[str] = []
    for s in _SPLIT.split(text or ""):
        if not s.strip():
            if out:
                out[-1] += s
            continue
        if len(clean_text(s)) > max_len:
            parts = re.split(r"(?<=[，,、])", s)
            buf = ""
            for p in parts:
                if buf and len(clean_text(buf + p)) > max_len:
                    out.append(buf)
                    buf = ""
                buf += p
            if buf:
                out.append(buf)
        else:
            out.append(s)
    merged: List[str] = []
    for s in out:   # 읽을 글자가 없는 조각(부호만)은 앞 문장에 붙인다
        if merged and not clean_text(s):
            merged[-1] += s
        else:
            merged.append(s)
    return [s for s in merged if s.strip()]


def chunks(text: str, max_chars: int) -> List[str]:
    """문장들을 max_chars 글자 안쪽 조각으로 묶는다"""
    out: List[str] = []
    for s in sentences(text, max_len=max_chars):
        if out and len(clean_text(out[-1] + s)) <= max_chars:
            out[-1] += s
        else:
            out.append(s)
    return out


# ---------------------------------------------------------------- 설정
def instructions_for(tts: Dict[str, Any], form: str) -> str:
    ins = tts.get("instructions")
    if isinstance(ins, dict):
        return ins.get(form) or ins.get("longform") or ""
    return ins or ""


def pause_for(tts: Dict[str, Any], form: str) -> int:
    p = tts.get("pause_ms")
    if isinstance(p, dict):
        return int(p.get(form) or p.get("longform") or 250)
    return int(p if p is not None else 250)


def _key(tts: Dict[str, Any], form: str, text: str) -> str:
    sig = json.dumps([text.strip(), tts.get("provider"), tts.get("voice"), tts.get("language"), tts.get("model"), tts.get("speed"),
                      instructions_for(tts, form), tts.get("extra"), tts.get("format")], ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(sig.encode("utf-8")).hexdigest()[:16]


# ---------------------------------------------------------------- 서버 부르기
def synth(tts: Dict[str, Any], form: str, text: str, path: str, out_audio: str) -> Optional[List[Dict[str, Any]]]:
    """한 조각 읽히기 → out_audio 에 음성. 반환: 타임스탬프 목록 (서버가 음성만 주면 None)"""
    if not tts.get("url"):
        raise RuntimeError("TTS 주소가 없습니다: longepass.config.json 의 tts.url 또는 .env 의 LP_TTS_URL")
    payload: Dict[str, Any] = {"input": text.strip(), "response_format": tts.get("format") or "mp3", "path": path}
    for k in ("provider", "voice", "language", "model"):
        if tts.get(k):
            payload[k] = tts[k]
    if tts.get("speed") is not None:
        payload["speed"] = tts["speed"]
    ins = instructions_for(tts, form)
    if ins:
        payload["instructions"] = ins
    payload.update(tts.get("extra") or {})
    body, headers = net.post_json(tts["url"], payload, timeout=300)
    ctype = (headers.get("Content-Type") or headers.get("content-type") or "").lower()
    if "json" in ctype or body[:1] in (b"{", b"["):
        data = json.loads(body.decode("utf-8"))
        if not data.get("audio_url"):
            raise RuntimeError(f"TTS 응답에 audio_url 이 없음: {str(data)[:200]}")
        _fetch_audio(tts, data["audio_url"], out_audio)
        return data.get("timestamp") or data.get("timestamps") or []
    if len(body) < 200:
        raise RuntimeError(f"TTS 응답이 음성이 아님 ({ctype}): {body[:200].decode('utf-8', 'replace')}")
    with open(out_audio, "wb") as f:   # 음성을 바로 주는 서버
        f.write(body)
    return None


def _fetch_audio(tts: Dict[str, Any], url: str, out_audio: str) -> None:
    root = tts.get("local_root")
    if root:
        local = os.path.join(root, urllib.parse.unquote(urllib.parse.urlparse(url).path).lstrip("/"))
        if os.path.isfile(local):
            shutil.copyfile(local, out_audio)
            return
    net.download(url, out_audio)


# ---------------------------------------------------------------- 타임스탬프 → 글자 시각
_NUMERALS = re.compile(r"[0-9a-z零〇一二兩三四五六七八九十百千萬亿億點点]")


def _fidelity(exp: str, heard: str) -> float:
    """대본대로 읽었는지 (0~1). 숫자는 표기가 달라도(90 ↔ 九十) 같은 것으로 보도록 숫자·영문·한자 숫자를 빼고 비교"""
    a, b = _NUMERALS.sub("", exp), _NUMERALS.sub("", heard)
    if not a and not b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


def align(text: str, stamps: List[Dict[str, Any]]) -> Tuple[List[List[float]], float]:
    """대본 글자(clean_text)마다 [시작ms, 끝ms]. 반환: (시각 목록, 일치율 0~1)"""
    exp = clean_text(text)
    heard, times = [], []
    for w in stamps:
        wc = clean_text(str(w.get("word") or w.get("text") or ""))
        try:
            s, e = float(w["start"]) * 1000, float(w["end"]) * 1000
        except (KeyError, TypeError, ValueError):
            continue
        if not wc:
            continue
        step = max(1.0, e - s) / len(wc)
        for i, ch in enumerate(wc):
            heard.append(ch)
            times.append((s + i * step, s + (i + 1) * step))
    if not exp:
        return [], 1.0
    sm = difflib.SequenceMatcher(None, exp, "".join(heard), autojunk=False)
    out: List[Optional[Tuple[float, float]]] = [None] * len(exp)
    for a, b, size in sm.get_matching_blocks():
        for i in range(size):
            out[a + i] = times[b + i]
    ratio = _fidelity(exp, "".join(heard))
    known = [i for i, v in enumerate(out) if v]
    if not known:
        return [], 0.0
    # 맞지 않은 글자: 앞뒤 아는 시각 사이에 고르게
    i = 0
    while i < len(exp):
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < len(exp) and out[j] is None:
            j += 1
        prev_end = out[i - 1][1] if i > 0 else max(0.0, out[j][0] - (j - i) * 150) if j < len(exp) else 0.0
        next_start = out[j][0] if j < len(exp) else prev_end + (j - i) * 150
        step = max(1.0, next_start - prev_end) / (j - i)
        for k in range(i, j):
            out[k] = (prev_end + (k - i) * step, prev_end + (k - i + 0.9) * step)
        i = j
    res, last = [], 0.0
    for s, e in out:  # type: ignore[misc]
        s = max(s, last)
        e = max(e, s + 1)
        res.append([round(s, 1), round(e, 1)])
        last = s
    return res, round(ratio, 3)


def _even(text: str, dur_ms: float) -> List[List[float]]:
    n = len(clean_text(text))
    step = dur_ms / max(1, n)
    return [[round(i * step, 1), round((i + 0.92) * step, 1)] for i in range(n)]


# ---------------------------------------------------------------- 오디오 잇기
def _to_wav(src: str, dst: str) -> float:
    """24kHz 모노 WAV (자르지 않는다 — 타임스탬프가 원본 기준). 반환: 길이(ms)"""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", dst], check=True)
    return (probe(dst).get("duration") or 0.0) * 1000


def _silence(dst: str, ms: int) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{max(ms, 1) / 1000:.3f}",
                    "-c:a", "pcm_s16le", dst], check=True)


def _chapter_key(tts: Dict[str, Any], form: str, text: str) -> str:
    return _key(tts, form, text) + f"-p{pause_for(tts, form)}-c{int(tts.get('chunk_chars') or 300)}"


def build_voices(ep: Episode, plan: Dict[str, Any], force: bool = False, only: Optional[List[int]] = None) -> Dict[str, Any]:
    """plan.json → voice/chNN.mp3 + voices.json. only: 다시 만들 장 번호(1부터). 없으면 바뀐 장만"""
    tts = ep.cfg["tts"]
    form = ep.form
    cache = os.path.join(ep.voice, "cache")
    os.makedirs(cache, exist_ok=True)
    vpath = os.path.join(ep.voice, "voices.json")
    old = {}
    if os.path.exists(vpath):
        with open(vpath, "r", encoding="utf-8") as f:
            old = {c["text_key"]: c for c in json.load(f).get("chapters", []) if c.get("text_key")}
    pause = pause_for(tts, form)
    sil = os.path.join(cache, f"silence_{pause}.wav")
    if not os.path.exists(sil):
        _silence(sil, pause)
    min_ratio = float(tts.get("min_ratio") or 0.9)
    prefix = (tts.get("path_prefix") or "longepass").strip("/")
    chapters, warnings = [], []
    for ci, ch in enumerate(plan["chapters"]):
        no = ci + 1
        text = "".join(s["narration"] for s in ch["shots"])
        text_key = _chapter_key(tts, form, text)
        out_mp3 = os.path.join(ep.voice, f"ch{no:02d}.mp3")
        redo = force or (only is not None and no in only)
        if not redo and text_key in old and os.path.exists(out_mp3):
            chapters.append(old[text_key])
            continue
        parts = chunks(text, int(tts.get("chunk_chars") or 300))
        wavs, char_times, infos, cursor = [], [], [], 0.0
        for k, part in enumerate(parts):
            key = _key(tts, form, part)
            audio = os.path.join(cache, f"{key}.{tts.get('format') or 'mp3'}")
            stamp_file = os.path.join(cache, f"{key}.json")
            path = f"{prefix}/{form}/{ep.slug}/ch{no:02d}" + (f"_{k + 1:02d}" if len(parts) > 1 else "")
            best: Optional[Tuple[float, List[List[float]], str]] = None
            for attempt in range(2):
                if (force and attempt == 0) or attempt > 0 or not (os.path.exists(audio) and os.path.exists(stamp_file)):
                    stamps = synth(tts, form, part, path, audio)
                    with open(stamp_file, "w", encoding="utf-8") as f:
                        json.dump({"timestamp": stamps}, f, ensure_ascii=False)
                with open(stamp_file, "r", encoding="utf-8") as f:
                    stamps = json.load(f).get("timestamp")
                wav = os.path.join(cache, f"{key}.wav")
                dur = _to_wav(audio, wav)
                if stamps is None:   # 음성만 주는 서버: 고르게
                    times, ratio, how = _even(part, dur), None, "even"
                else:
                    times, ratio = align(part, stamps)
                    how = "timestamp"
                    if not times:    # 맞는 글자가 하나도 없음 → 고르게 (일치율 0 → 경고)
                        times, how = _even(part, dur), "even"
                cand = (ratio if ratio is not None else 1.0, times, how)
                if best is None or cand[0] > best[0]:
                    best = cand
                    shutil.copyfile(wav, wav + ".best.wav")
                if ratio is None or ratio >= min_ratio:
                    break
            assert best is not None
            ratio, times, how = best
            if stamps is not None and ratio < min_ratio:
                warnings.append(f"ch{no:02d} 조각 {k + 1}: 대본과 다르게 읽음 (일치율 {ratio}) — {part.strip()[:30]}")
            wav = os.path.join(cache, f"{key}.wav.best.wav")
            dur = (probe(wav).get("duration") or 0.0) * 1000
            char_times += [[round(s + cursor, 1), round(e + cursor, 1)] for s, e in times]
            infos.append({"text": part, "cache": key, "path": path, "timing": how, "ratio": ratio, "start_ms": round(cursor, 1), "dur_ms": round(dur, 1)})
            wavs.append(wav)
            cursor += dur + pause
        cursor -= pause if wavs else 0
        lst = os.path.join(cache, f"ch{no:02d}.txt")
        with open(lst, "w", encoding="utf-8") as f:
            for i, w in enumerate(wavs):
                if i:
                    f.write(f"file '{os.path.abspath(sil)}'\n")
                f.write(f"file '{os.path.abspath(w)}'\n")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "libmp3lame", "-q:a", "2", out_mp3], check=True)
        if len(char_times) != len(clean_text(text)):
            warnings.append(f"ch{no:02d}: 글자 수 불일치 ({len(char_times)} ≠ {len(clean_text(text))})")
        chapters.append({"audio": f"voice/ch{no:02d}.mp3", "char_times": char_times, "clip_end": round(cursor + 150, 1),
                         "text_key": text_key, "chars": len(char_times), "parts": infos})
    result = {"made": now(), "form": form, "tts": {k: tts.get(k) for k in ("provider", "voice", "language", "speed")},
              "pause_ms": pause, "chapters": chapters, "warnings": warnings}
    with open(vpath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return result


def voices_for_job(ep: Episode, plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """voices.json 이 지금 계획과 맞으면 job.json voices. 맞지 않으면 오류 (bin/lp tts 를 다시)"""
    vpath = os.path.join(ep.voice, "voices.json")
    if not os.path.exists(vpath):
        return []
    with open(vpath, "r", encoding="utf-8") as f:
        chapters = json.load(f).get("chapters", [])
    out = []
    for ci, ch in enumerate(plan["chapters"]):
        text = "".join(s["narration"] for s in ch["shots"])
        key = _chapter_key(ep.cfg["tts"], ep.form, text)
        if ci >= len(chapters) or chapters[ci].get("text_key") != key or not os.path.exists(ep.p(chapters[ci]["audio"])):
            raise RuntimeError(f"음성이 지금 계획과 맞지 않음 (ch{ci + 1:02d}) — bin/lp tts {ep.slug}")
        c = chapters[ci]
        out.append({"audio": c["audio"], "char_times": c["char_times"], "clip_end": c["clip_end"]})
    return out
