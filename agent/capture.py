"""
웹 페이지 화면 캡처 (screen_focus 소재): 헤드리스 크롬으로 PNG.

  bin/lp capture <slug> <URL> <id> --name "勞動部" [--width 1440 --height 1000] [--mobile] [--wait 2000]
  --name: 화면 오른쪽 옆에 쓰일 출처 이름 (기관명, 언론사 + 날짜). 없으면 사이트 주소

크롬은 config 의 chrome → 환경 변수 LP_CHROME → macOS Google Chrome/Chromium/Edge → PATH 의 chrome/chromium
순서로 찾는다. 출처는 그 사이트 이름과 주소로 자동 기록한다.
캡처는 '인용'이다: 정부 공고·언론 기사를 근거로 보여 줄 때 쓰고, 출처는 screen_focus 가 화면 오른쪽 옆에 표기한다
(CHANNEL.md 「소재」). 개인 정보가 보이면 쓰지 않는다.
"""
import os
import shutil
import subprocess
import tempfile
import urllib.parse
from typing import Any, Dict, Optional

from agent import config, credits
from agent.episode import Episode

MOBILE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) "
             "Version/17.0 Mobile/15E148 Safari/604.1")


def find_chrome(cfg: Optional[Dict[str, Any]] = None) -> str:
    """일반 크롬/크로미움 (Remotion 의 chrome-headless-shell 은 --screenshot 이 멈춰서 쓰지 않는다)"""
    cfg = cfg or config.load()
    cands = [cfg.get("chrome"), os.getenv("LP_CHROME"),
             "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
             "/Applications/Chromium.app/Contents/MacOS/Chromium",
             "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
    cands += [shutil.which(n) or "" for n in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser")]
    for c in cands:
        if c and os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    raise FileNotFoundError("크롬을 찾지 못함: Google Chrome 을 설치하거나 longepass.config.json 의 chrome 에 경로를 적는다")


def capture(ep: Episode, url: str, name: str, width: int = 1440, height: int = 1000, mobile: bool = False,
            wait_ms: int = 2000, scale: float = 1.0, source_name: str = "") -> Dict[str, Any]:
    chrome = find_chrome(ep.cfg)
    if mobile:
        width, height, scale = 390, 844, 3.0
    out = os.path.join(ep.assets, f"{name}.png")
    with tempfile.TemporaryDirectory() as prof:
        cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
               f"--user-data-dir={prof}", f"--window-size={width},{height}", f"--force-device-scale-factor={scale}",
               f"--virtual-time-budget={wait_ms}", f"--screenshot={out}", "--lang=zh-TW"]
        if mobile:
            cmd.append(f"--user-agent={MOBILE_UA}")
        if os.geteuid() == 0:
            cmd.append("--no-sandbox")
        try:
            subprocess.run(cmd + [url], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
        except subprocess.TimeoutExpired:
            raise RuntimeError(f"캡처 시간 초과 (90초): {url} — 크롬 경로를 확인 ({chrome})")
    if not os.path.exists(out):
        raise RuntimeError(f"캡처 실패: {url}")
    host = urllib.parse.urlparse(url).netloc or "local"
    credit = f"{source_name}（{host}）" if source_name and host != "local" else (source_name or host)
    info = credits.add(ep, out, title=f"{source_name or host} 畫面截圖", credit=credit, source=url, license="網站截圖（引用）", site="capture")
    ep.log(f"소재 {name}: 화면 캡처 {url}")
    return {"id": name, "file": os.path.basename(out), **info}
