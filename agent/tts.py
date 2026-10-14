"""
나레이션 TTS: plan.json 의 장(chapter)마다 음성 파일 하나 + 글자별 시각(char_times).

- OpenAI 호환 음성 API (POST {url} {"input", "voice", "model", "response_format", "speed", "instructions"}).
  설정은 longepass.config.json 의 tts (agent/config.py).
- **문장마다 따로** 읽힌다 (긴 글은 TTS 가 끝에서 무너진다). 같은 문장·같은 설정이면 voice/cache 를 다시 쓴다.
- 문장 앞뒤 무음을 잘라 낸 뒤 문장 사이에 일정한 쉼(pause_ms)을 넣어 잇는다.
  → 문장 경계 시각은 정확하고, 문장 안의 글자는 그 문장 길이에 고르게 나눈다 (글자 정렬 도구 없이 쓸 만한 정확도).
- 선택: stt.url 이 있으면 받아쓰기로 대본과 비교해, 일치율이 낮은 문장은 한 번 다시 만든다 (그래도 낮으면 경고).
결과: voice/chNN.mp3, voice/voices.json
"""
import difflib
import hashlib
import json
import os
import re
import subprocess
from typing import Any, Dict, List, Optional

from agent import net
from agent.episode import Episode, now
from studio.assets import probe
from studio.text import clean_text

SR = 24000
_SPLIT = re.compile(r"(?<=[。！？!?；;…])")


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
    # 읽을 글자가 없는 조각(부호만)은 앞 문장에 붙인다
    merged: List[str] = []
    for s in out:
        if merged and not clean_text(s):
            merged[-1] += s
        else:
            merged.append(s)
    return [s for s in merged if s.strip()]


def _key(tts: Dict[str, Any], text: str) -> str:
    sig = json.dumps([text.strip(), tts.get("voice"), tts.get("model"), tts.get("speed"), tts.get("instructions"),
                      tts.get("extra"), tts.get("format")], ensure_ascii=False, sort_keys=True)
    return hashlib.sha1(sig.encode("utf-8")).hexdigest()[:16]


def synth(tts: Dict[str, Any], text: str, out_path: str) -> str:
    if not tts.get("url"):
        raise RuntimeError("TTS 주소가 없습니다: longepass.config.json 의 tts.url (예시: longepass.config.example.json)")
    payload: Dict[str, Any] = {"input": text.strip(), "response_format": tts.get("format") or "mp3"}
    for k in ("voice", "model", "instructions"):
        if tts.get(k):
            payload[k] = tts[k]
    if tts.get("speed") not in (None, 1, 1.0):
        payload["speed"] = tts["speed"]
    payload.update(tts.get("extra") or {})
    body, headers = net.post_json(tts["url"], payload)
    ctype = (headers.get("Content-Type") or headers.get("content-type") or "").lower()
    if "json" in ctype or "text" in ctype or len(body) < 200:
        raise RuntimeError(f"TTS 응답이 음성이 아님 ({ctype}): {body[:200].decode('utf-8', 'replace')}")
    with open(out_path, "wb") as f:
        f.write(body)
    return out_path


def _to_wav(src: str, dst: str) -> float:
    """앞뒤 무음을 자르고 24kHz 모노 WAV 로. 반환: 길이(ms)"""
    trim = ("silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.04,areverse,"
            "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", trim, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", dst], check=True)
    d = probe(dst).get("duration")
    if not d:
        # 너무 짧아 다 잘렸으면 원본 그대로
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-ar", str(SR), "-ac", "1", "-c:a", "pcm_s16le", dst], check=True)
        d = probe(dst).get("duration") or 0.0
    return d * 1000


def _silence(dst: str, ms: int) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{ms / 1000:.3f}",
                    "-c:a", "pcm_s16le", dst], check=True)


def _ratio(expected: str, got: str) -> float:
    return difflib.SequenceMatcher(None, clean_text(expected), clean_text(got)).ratio()


def _stt(cfg_stt: Dict[str, Any], wav: str) -> Optional[str]:
    if not cfg_stt.get("url"):
        return None
    with open(wav, "rb") as f:
        audio = f.read()
    fields = {k: v for k, v in {"model": cfg_stt.get("model"), "language": cfg_stt.get("language")}.items() if v}
    body = net.post_multipart(cfg_stt["url"], fields, [("file", os.path.basename(wav), audio, "audio/wav")])
    try:
        return json.loads(body.decode("utf-8")).get("text", "")
    except ValueError:
        return body.decode("utf-8", "replace")


def build_voices(ep: Episode, plan: Dict[str, Any], force: bool = False, only: Optional[List[int]] = None) -> Dict[str, Any]:
    """plan.json → voice/chNN.mp3 + voices.json. only: 다시 만들 장 번호 (없으면 바뀐 장만)"""
    tts, stt = ep.cfg["tts"], ep.cfg["stt"]
    cache = os.path.join(ep.voice, "cache")
    os.makedirs(cache, exist_ok=True)
    vpath = os.path.join(ep.voice, "voices.json")
    old = {}
    if os.path.exists(vpath):
        with open(vpath, "r", encoding="utf-8") as f:
            old = {c["text_key"]: c for c in json.load(f).get("chapters", []) if c.get("text_key")}
    pause = int(tts.get("pause_ms") or 350)
    sil = os.path.join(cache, f"silence_{pause}.wav")
    if not os.path.exists(sil):
        _silence(sil, pause)
    chapters, warnings = [], []
    for ci, ch in enumerate(plan["chapters"]):
        text = "".join(s["narration"] for s in ch["shots"])
        text_key = _key(tts, text) + f"-p{pause}"
        out_mp3 = os.path.join(ep.voice, f"ch{ci:02d}.mp3")
        redo = force or (only is not None and ci in only)
        if not redo and text_key in old and os.path.exists(out_mp3):
            chapters.append(old[text_key])
            continue
        sents, wavs, cursor, char_times = [], [], 0.0, []
        for si, s in enumerate(sentences(text)):
            k = _key(tts, s)
            raw = os.path.join(cache, f"{k}.{tts.get('format') or 'mp3'}")
            wav = os.path.join(cache, f"{k}.wav")
            info: Dict[str, Any] = {"text": s, "cache": k}
            tries = 1 + (1 if stt.get("url") else 0)
            for attempt in range(tries):
                if force and attempt == 0 and os.path.exists(raw):   # --force: 캐시도 다시
                    os.remove(raw)
                if not os.path.exists(raw):
                    synth(tts, s, raw)
                dur = _to_wav(raw, wav)
                heard = _stt(stt, wav)
                if heard is None:
                    break
                info["heard"], info["ratio"] = heard, round(_ratio(s, heard), 3)
                if info["ratio"] >= float(stt.get("min_ratio") or 0.85):
                    break
                if attempt + 1 < tries:
                    os.remove(raw)   # 대본과 다르게 읽음 → 한 번 다시
            if info.get("ratio") is not None and info["ratio"] < float(stt.get("min_ratio") or 0.85):
                warnings.append(f"ch{ci:02d} 문장 {si + 1}: 대본과 다르게 읽음 (일치율 {info['ratio']}) — {s.strip()[:30]}")
            n = len(clean_text(s))
            step = dur / max(1, n)
            char_times += [[round(cursor + i * step, 1), round(cursor + (i + 0.92) * step, 1)] for i in range(n)]
            info["start_ms"], info["dur_ms"] = round(cursor, 1), round(dur, 1)
            sents.append(info)
            wavs.append(wav)
            cursor += dur + pause
        cursor -= pause if wavs else 0
        lst = os.path.join(cache, f"ch{ci:02d}.txt")
        with open(lst, "w", encoding="utf-8") as f:
            for i, w in enumerate(wavs):
                if i:
                    f.write(f"file '{os.path.abspath(sil)}'\n")
                f.write(f"file '{os.path.abspath(w)}'\n")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "libmp3lame", "-q:a", "2", out_mp3], check=True)
        if len(char_times) != len(clean_text(text)):
            warnings.append(f"ch{ci:02d}: 글자 수 불일치 ({len(char_times)} ≠ {len(clean_text(text))})")
        chapters.append({"audio": f"voice/ch{ci:02d}.mp3", "char_times": char_times, "clip_end": round(cursor + 200, 1),
                         "text_key": text_key, "chars": len(char_times), "sentences": sents})
    result = {"made": now(), "tts": {k: tts.get(k) for k in ("voice", "model", "speed", "pause_ms")}, "chapters": chapters, "warnings": warnings}
    with open(vpath, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return result


def voices_for_job(ep: Episode, plan: Dict[str, Any]) -> List[Dict[str, Any]]:
    """voices.json 이 지금 계획과 맞으면 job.json voices, 아니면 빈 목록 (무음)"""
    vpath = os.path.join(ep.voice, "voices.json")
    if not os.path.exists(vpath):
        return []
    with open(vpath, "r", encoding="utf-8") as f:
        chapters = json.load(f).get("chapters", [])
    out = []
    for ci, ch in enumerate(plan["chapters"]):
        text = "".join(s["narration"] for s in ch["shots"])
        key = _key(ep.cfg["tts"], text) + f"-p{int(ep.cfg['tts'].get('pause_ms') or 350)}"
        if ci >= len(chapters) or chapters[ci].get("text_key") != key or not os.path.exists(ep.p(chapters[ci]["audio"])):
            raise RuntimeError(f"음성이 지금 계획과 맞지 않음 (ch{ci:02d}) — bin/lp tts {ep.slug}")
        c = chapters[ci]
        out.append({"audio": c["audio"], "char_times": c["char_times"], "clip_end": c["clip_end"]})
    return out
