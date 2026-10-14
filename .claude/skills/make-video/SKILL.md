---
name: make-video
description: 사용자 초안(글·메모·기사·링크)으로 LONGEPASS 영상을 만든다. 에이전트가 사실 확인, 대본·샷 구성, 소재 찾기(스톡·커먼즈·화면 캡처), TTS 나레이션을 하고 렌더링까지 한다. "이 초안으로 영상 만들어줘", "에이전트 방식으로 영상", /make-video 일 때 쓴다. 이어 하기도 이 스킬로 한다 (bin/lp status).
---

# 에이전트 방식 영상 제작 (LONGEPASS)

**먼저 [CHANNEL.md](../../../CHANNEL.md)를 읽는다.** 톤·구성·사실·소재·나레이션·화면 리듬 규칙은 거기에 있다.
모든 작업은 `bin/lp` 명령으로 하고, 결정은 대화가 아니라 파일(`log.md`, `status.json`)에 남긴다.
그래야 다음 세션이 이어받을 수 있다.

이 저장소는 사용자의 맥에서 로컬로 돌아간다. 처음 한 번 준비할 것:
- `npm ci && npx remotion browser ensure`
- `.env.example`을 `.env`로 복사하고 `LP_WORKSPACE`(NAS 작업 폴더)를 적는다.
- `longepass.config.example.json`을 `longepass.config.json`으로 복사한다 (TTS는 다큐 그곳 서버, 목소리 기본 `Charon`).
- `longepass.keys.json`에 스톡 API 키를 넣는다 (Pexels, Pixabay, Unsplash 중 있는 것).
- 화면 캡처용 Google Chrome
- 확인: `bin/lp where`

## 지켜야 할 것
- **사용자 초안은 고치지 않는다** (`draft.md`). 방향은 초안이 정한다. 사실은 바로잡고 기록한다 (CHANNEL.md 「초안은 사용자가」).
- **지어내지 않는다.** 숫자·기한·조건·인용은 원문을 확인한 것만 쓴다 (`notes.md` 사실 카드, 등급 X는 쓰지 않음).
- **AI 생성 이미지·영상은 쓰지 않는다** (만들지도, 스톡에서 고르지도 않는다).
- **소재는 라이선스가 분명한 것만** 쓴다. `bin/lp get/capture/add`로 받아야 출처가 자동으로 기록된다. 브라우저로 직접 저장한 그림은 `bin/lp add`로 출처와 함께 넣는다.
- **API 키를 출력하거나 파일·로그에 옮기지 않는다.**
- 작업물은 작업 폴더(`bin/lp where`의 workspace = `.env`의 `LP_WORKSPACE`, NAS)에만 둔다. NAS가 연결돼 있지 않으면 `bin/lp new`가 멈춘다. 저장소의 `public/`에 소재를 넣지 않는다.
- 최종 렌더링(`bin/lp render`)은 사용자가 요청할 때만 한다.
- 렌더링 엔진(`studio/`)에 네트워크 코드를 넣지 않는다. 외부 호출은 `agent/`(bin/lp)에만 있다.

## 작업 폴더 (`<LP_WORKSPACE>/<slug>/`)
| 파일 | 누가 | 내용 |
|---|---|---|
| `draft.md` | 사용자 | 초안 (`bin/lp new … --draft`) |
| `notes.md` | 에이전트 | 분석, 사실 카드(등급·출처·확인 날짜), 초안에서 고친 것, 필요한 그림, 물을 것 |
| `raw_plan.json` | 에이전트 | 대본 + 샷 배정 (아래 형식) |
| `plan.json` | `bin/lp plan` | 검증 결과 + `report` (replaced / warnings / variety / missing_assets) |
| `assets/` | `bin/lp get/capture/add` | 소재 + `_credits.json`(출처) + `_search.json`(마지막 검색) |
| `voice/` | `bin/lp tts` | 문장별 캐시, 장별 `chNN.mp3`, `voices.json`(글자 시각) |
| `job.json` | `bin/lp job` | 렌더링 작업 파일 |
| `render/` | `bin/lp preview/render/thumb` | `preview/` 정지 화면, mp4·srt·json·thumbnail.jpg |
| `status.json` · `log.md` | `bin/lp stage/log` | 단계와 남은 일 · 결정 기록 |

단계: `draft → plan → assets → voice → built → rendered` (`bin/lp stage <slug> <단계> "남은 일" …`)

## 순서

### 0. 시작 / 이어 하기
```bash
bin/lp new <slug> "영상 제목" --draft 초안.md   # slug: 영문 소문자·숫자·-
bin/lp status <slug>                            # 이어 하기: 단계·남은 일 + log.md 를 읽고 남은 일부터
```

### 1. 초안 분석과 사실 확인 → `notes.md`
- 누가 보는 영상인지, 보고 나서 할 행동 하나, 핵심 메시지 3개 이내를 적는다.
- 초안의 모든 사실 주장을 원문으로 확인한다. 웹 검색이나 브라우저 등 그 세션에서 쓸 수 있는 도구를 쓴다. 사실 카드 표에 등급, 출처 URL, 확인 날짜를 적는다.
- 틀린 것은 바로잡는다: `bin/lp log <slug> "金額 3萬→2萬 (勞動部 公告 2026-xx)"`.
- 거부할지 판단한다 (CHANNEL.md): 바로잡으면 중심 주장이 무너지는 경우 등. 거부하면 근거와 함께 사용자에게 보고하고 멈춘다.
- 필요한 그림 목록을 적는다 (장면 → 사진 / 영상 / 화면 캡처 → 찾을 말).

### 2. 대본 + 샷 배정 → `raw_plan.json`, 그리고 `bin/lp plan`
- 템플릿과 칸 목록: `bin/lp templates`. 예시 모양은 `src/templates/<id>/manifest.json`의 `examples`를 본다.
- 형식 (백엔드 LLM 계획과 같다):
  ```json
  {
    "video_title": "…", "description": "…", "hashtags": ["…"], "music_mood": "motivating",
    "thumbnail": {"layout": "stat", "text": "…", "emphasis": "…", "stat": "20,000", "stat_unit": "元", "object": "cash"},
    "chapters": [
      {"title": "장 제목", "shots": [
        {"module": "photo_full", "narration": "이 샷에서 읽을 문장。", "data": {"image": "hero", "lines": ["…"], "icon": "train"},
         "cues": {"lines": ["나레이션 속 단어"]}},
        {"module": "board", "data": {…}, "beats": [{"narration": "…", "data": {…}, "cues": {…}}]}
      ]}
    ]
  }
  ```
  - `narration`은 zh-tw다. 문장은 짧게 쓰고 `。！？`로 끝낸다 (TTS가 문장마다 읽는다).
  - asset 칸(`image` 등)에는 **소재 id**(assets/의 파일 이름에서 확장자를 뺀 것)를 쓴다. 아직 없어도 된다. 3단계에서 그 이름으로 받는다.
  - `cues`는 그 샷 나레이션에 실제로 있는 단어여야 한다.
  - 화면 리듬은 CHANNEL.md 「화면 리듬」을 따른다 (같은 템플릿 연속 금지, 4~5샷마다 카드 없는 화면, 근거는 `screen_focus`/`quote_card`).
- `bin/lp plan <slug>`:
  - `replaced`(형식 오류 → headline으로 대체)는 반드시 고친다.
  - `warnings`(글자 수 초과)는 줄인다.
  - `variety`는 가능하면 고친다.
  - `missing_assets`는 3단계에서 받을 목록이다.
- `bin/lp stage <slug> plan "소재 받기: …"`

### 3. 소재 → `assets/`
```bash
bin/lp search <slug> "taipei office worker" [--video] [--portrait] [--site pexels,pixabay,unsplash,commons]
bin/lp get <slug> <번호> <id> [--start 초 --dur 초] [--focus x,y]     # 목록 번호로 받기 (출처 자동 기록)
bin/lp get <slug> "File:이름.jpg" <id>                               # 커먼즈 파일 이름으로
bin/lp capture <slug> <URL> <id> --name "勞動部" [--mobile]          # 정부 공고·언론 기사 캡처 (screen_focus, 출처는 화면 오른쪽 옆)
bin/lp add <slug> <파일> <id> --credit "…" --license "…" [--source URL]   # 사용자가 준 파일
```
- 스톡은 영어 검색어가 잘 맞는다. 현대 장면에만 쓴다. 영상은 움직임이 고른 구간만 `--start --dur`로 자른다(최대 30초).
- `--focus x,y`는 잘릴 때 남길 중심이다 (얼굴, 글자 부분).
- `screen_focus`의 `focus`(확대 영역)는 캡처를 보고 0~1 비율로 정한다.
- 못 구한 소재는 비워 둔다. 템플릿이 `icon`으로 대신 그린다. 사용자에게 보고할 목록에 넣는다.
- 다시 `bin/lp plan <slug>`를 돌려 `missing_assets`가 비었는지 본다.

### 4. 나레이션 → `voice/`
```bash
bin/lp tts <slug>                 # 바뀐 장만 다시 (문장 캐시)
bin/lp tts <slug> --chapter 2     # 특정 장만 / --force 전부 새로
```
- `warnings`에 "대본과 다르게 읽음"이 있으면 그 문장을 고쳐 쓰거나(숫자 표기, 쉼표) 다시 만든다.
- TTS 서버를 쓸 수 없으면 `bin/lp job <slug> --silent`로 무음 영상을 만들고, 그 사실을 보고한다.

### 5. 점검 → `job.json`, 그리고 정지 화면으로 고치기
```bash
bin/lp job <slug>         # job.json + 렌더링 없이 점검 (길이, 샷 수, 자료 경고)
bin/lp preview <slug>     # 샷마다 정지 화면 → render/preview/shot_XX_<템플릿>.png
```
- 정지 화면을 **하나씩 직접 열어 본다**. 볼 것:
  - 글자 넘침·겹침
  - 자막 자리 침범
  - 엉뚱한 사진
  - 잘린 얼굴·글자 → `--focus`
  - 빈 화면
- 고칠 때는 `raw_plan.json` → `bin/lp plan` → (`bin/lp tts`) → `bin/lp job` → `bin/lp preview` 순서로 다시 돈다.
- `bin/lp stage <slug> built "사용자 확인 후 렌더링"`

### 6. 렌더링과 납품 (사용자가 요청할 때)
```bash
bin/lp render <slug>      # render/<slug>.mp4 · .srt · .json
bin/lp thumb <slug>       # render/thumbnail.jpg
```
- 장이 시작하는 곳과 사진 장면에서 프레임을 뽑아 확인한다:
  ```bash
  ffmpeg -ss <초> -i render/<slug>.mp4 -frames:v 1 render/check_<초>.png
  ```
- 사용자에게 보고할 것:
  - 영상, 자막, 썸네일 경로
  - **설명란 출처 목록**: `render/<slug>.json`의 `assets`(credit, source, license)와 `music`
  - 바로잡은 사실
  - 확인 못 한 것
  - 아이콘으로 대체된 장면
  - 음성 경고

## 피드백 받기
사용자 피드백은 그 영상만 고치고 끝내지 않는다. 일반 규칙이면 날짜와 함께 CHANNEL.md 「피드백으로 생긴 규칙」에 쌓는다.
검사로 만들 수 있으면 `studio/plan.py`의 `variety_report`에 넣는다.

## 템플릿이 모자랄 때
새 화면 모양이 필요하면 TEMPLATE_GUIDE.md를 따라 템플릿을 추가한다 (CLAUDE.md 「끝내기 전에 반드시」).
