---
name: make-video
description: LONGEPASS 영상 세트(롱폼 + 쇼츠 1~2)를 DB 글로 만든다. 아직 영상이 없는 글을 골라, 조사로 정보를 보태고, 대본·샷 구성, 소재 찾기(스톡·커먼즈·화면 캡처), TTS 나레이션, 렌더링까지 한다. 사용자가 확인하면 업로드 대기열에 넣는다. "새 영상 만들어줘", "<slug> 영상 만들어줘", "이 초안으로 영상", /make-video 일 때 쓴다. 이어 하기("하던 거 계속")와 "대기열에 넣어줘"도 이 스킬로 한다 (bin/lp list / status / publish).
---

# 에이전트 방식 영상 제작 (LONGEPASS)

**요청별 범위**
- "새 영상 만들어줘": `bin/lp articles` 맨 위의 글을 골라 렌더링(롱폼 + 쇼츠)까지 하고 보고한다.
- "<slug> 영상 만들어줘": 그 글로 같은 범위를 한다.
- "하던 거 계속": `bin/lp list`에서 끝나지 않은 작업을 골라 `bin/lp status`부터 다시 시작한다.
- "대기열에 넣어줘" / "올려줘": 사용자가 결과를 본 뒤에만 `bin/lp publish`를 한다. 이 단계는 스스로 하지 않는다.

**먼저 [CHANNEL.md](../../../CHANNEL.md)를 읽는다.** 톤·구성·사실·소재·나레이션·화면 리듬 규칙은 거기에 있다.
모든 작업은 `bin/lp` 명령으로 하고, 결정은 대화가 아니라 파일(`log.md`, `status.json`)에 남긴다.
그래야 다음 세션이 이어받을 수 있다.

이 저장소는 사용자의 맥에서 로컬로 돌아간다. 처음 한 번 준비할 것:
- `npm ci && npx remotion browser ensure`
- `.env.example`을 `.env`로 복사하고 `LP_WORKSPACE`(NAS 작업 폴더)를 적는다.
- `longepass.config.example.json`을 `longepass.config.json`으로 복사한다 (TTS는 다큐 그곳 서버, `gemini`·`Aoede`·`zh-tw`).
- `longepass.keys.json`에 스톡 API 키를 넣는다 (Pexels, Pixabay, Unsplash 중 있는 것).
- `.env`에 `DATABASE_URL`(백엔드와 같은 certificate_tw DB)을 적는다. DB는 `uv run --with psycopg`로 읽으므로 `uv`가 있어야 한다.
- 화면 캡처용 Google Chrome
- 확인: `bin/lp where`

## 지켜야 할 것
- **`draft.md`(DB 글 / 사용자 초안)는 고치지 않는다.** DB 글은 주제와 출발점이다. 같은 주제로 조사해서 더 풍부하게 만든다 (CHANNEL.md 「기본 데이터와 조사」). 사용자 초안은 방향을 초안이 정한다.
- **지어내지 않는다.** 숫자·기한·조건·인용은 원문을 확인한 것만 쓴다 (`notes.md` 사실 카드, 등급 X는 쓰지 않음).
- **AI 생성 이미지·영상은 쓰지 않는다** (만들지도, 스톡에서 고르지도 않는다).
- **소재는 라이선스가 분명한 것만** 쓴다. `bin/lp get/capture/add`로 받아야 출처가 자동으로 기록된다. 브라우저로 직접 저장한 그림은 `bin/lp add`로 출처와 함께 넣는다.
- **API 키와 DB 주소(`DATABASE_URL`)를 출력하거나 파일·로그에 옮기지 않는다.**
- DB에는 `bin/lp`로만 쓴다 (`longform_videos`의 내 기록만). 다른 표나 다른 기록은 건드리지 않는다.
- 작업물은 작업 폴더(`bin/lp where`의 workspace = `.env`의 `LP_WORKSPACE`, NAS)에만 둔다. NAS가 연결돼 있지 않으면 `bin/lp new`가 멈춘다. 저장소의 `public/`에 소재를 넣지 않는다.
- 렌더링(`bin/lp render`)은 정지 화면을 다 보고 고친 뒤에 한다. 업로드 대기열(`bin/lp publish`)은 사용자가 요청할 때만 넣는다.
- 렌더링 엔진(`studio/`)에 네트워크 코드를 넣지 않는다. 외부 호출은 `agent/`(bin/lp)에만 있다.

## 작업 폴더 (`<LP_WORKSPACE>/<slug>/`)
| 파일 | 누가 | 내용 |
|---|---|---|
| `draft.md` | DB 글 / 사용자 | 초안 (`bin/lp new <slug> --from-db` 또는 `--draft`) |
| `article.json` | `bin/lp new --from-db` | DB 글 원본 (frontmatter, source_urls …) |
| `notes.md` | 에이전트 | 분석, 사실 카드(등급·출처·확인 날짜, 글에 있던 것 / 조사로 보탠 것), 고친 것, 필요한 그림, 물을 것 |
| `raw_plan.json` · `raw_plan_short_N.json` | 에이전트 | 롱폼 · 쇼츠 N의 대본 + 샷 배정 (아래 형식) |
| `plan.json` · `plan_short_N.json` | `bin/lp plan [--short N]` | 검증 결과 + `report` (replaced / warnings / variety / missing_assets) |
| `assets/` | `bin/lp get/capture/add` | 소재 + `_credits.json`(출처) + `_search.json`(마지막 검색) |
| `voice/` · `voice/short_N/` | `bin/lp tts [--short N]` | 문장별 캐시, 장별 `chNN.mp3`, `voices.json`(글자 시각) |
| `job.json` · `job_short_N.json` | `bin/lp job [--short N]` | 렌더링 작업 파일 |
| `render/` | `bin/lp preview/render/thumb` | 롱폼 `<slug>.mp4`·srt·json·`thumbnail.jpg`, `preview/` · 쇼츠 `short_N.mp4`·`short_N_thumbnail.jpg`, `short_N/preview/` |
| `youtube.json` · `result.json` | `bin/lp publish` | 업로드 정보 (백엔드 업로드 예약이 읽는다) |
| `status.json` · `log.md` | `bin/lp stage/log` | 단계와 남은 일, DB 기록(`db.request_id`) · 결정 기록 |

단계: `draft → plan → assets → voice → built → rendered` (`bin/lp stage <slug> <단계> "남은 일" …`)

## 순서

### 0. 시작 / 이어 하기
```bash
bin/lp articles                     # 아직 영상이 없는 DB 글 (최근 수정 순, 사이트에 열리는 것만). 사용자가 slug 를 안 주면 맨 위
bin/lp new <slug> --from-db         # draft.md · article.json + DB 에 running 기록 (백엔드 자동 제작이 이 글을 건너뛴다)
bin/lp list                         # 내 작업들 (단계)
bin/lp status <slug>                # 이어 하기: 단계·남은 일 + log.md 를 읽고 남은 일부터
bin/lp new <slug> "영상 제목" --draft 초안.md [--short]   # DB 밖 사용자 초안 (업로드 대기열에는 못 넣는다)
```
- 같은 글로 이미 영상 기록(만드는 중·준비됨·예약·공개)이 있으면 `new --from-db`가 멈춘다. 다른 글을 고른다.
- 백엔드가 실패하고 남긴 파일이 폴더에 있으면 `_old/<시각>/`으로 옮긴다.
- 만들다 그만두면 `bin/lp release <slug>`로 DB 기록을 푼다. 그래야 백엔드가 그 글을 다시 고를 수 있다.

### 1. 글 분석, 조사, 사실 확인 → `notes.md`
- 누가 보는 영상인지, 보고 나서 할 행동 하나, 핵심 메시지 3개 이내를 적는다.
- **글의 모든 사실 주장을 원문으로 확인한다.** 글이 쓰인 뒤 바뀐 일정·금액·조건은 최신 공고로 바로잡는다: `bin/lp log <slug> "第三梯次 報名 8/27→… (技能檢定中心 115年簡章)"`.
- **조사로 정보를 보탠다** (CHANNEL.md 「기본 데이터와 조사」). 시청자가 글을 읽고 나서 다음에 물어볼 것을 공식 출처에서 찾는다.
  - 보탤 것: 시험 구성·배점, 합격률, 관련 보조금, 최신 일정, 자주 틀리는 점 등
  - 웹 검색과 브라우저를 쓰고, 글의 `source_urls`(article.json)도 본다.
  - 보탠 사실은 사실 카드에 「조사로 보탠 것」으로 따로 적고, 등급(A/B 우선)·출처 URL·확인 날짜를 단다.
  - 주제를 벗어나는 것, 출처가 없는 것(등급 X)은 넣지 않는다.
- 거부할지 판단한다: 글의 중심 주장이 틀린 경우(제도 폐지 등) 등. 거부하면 근거와 함께 사용자에게 보고하고 `bin/lp release`로 기록을 푼 뒤 멈춘다.
- 쇼츠 각도 1~2개를 정한다. 각각 핵심 하나이고, 서로 겹치지 않게 한다.
- 필요한 그림 목록을 적는다 (장면 → 사진 / 영상 / 화면 캡처 → 찾을 말).

### 2. 대본 + 샷 배정 → `raw_plan.json`, 그리고 `bin/lp plan`
- 템플릿과 칸 목록: `bin/lp templates`. 예시 모양은 `src/templates/<id>/manifest.json`의 `examples`를 본다.
- 롱폼은 `raw_plan.json`, 쇼츠 N은 `raw_plan_short_N.json`에 쓴다. 형식은 같다 (백엔드 LLM 계획과 같다):
  ```json
  {
    "video_title": "…", "description": "…", "hashtags": ["…"], "music_mood": "motivating",
    "thumbnail": {"layout": "vs_split|evidence_doc|photo_hero|warning_dark", "text": "…", "badge": "2026 最新", "photo": "소재id", "split_left": {…}, "split_right": {…}},
    "chapters": [
      {"title": "장 제목", "shots": [
        {"module": "photo_full", "narration": "이 샷에서 읽을 문장。", "data": {"image": "hero", "lines": ["…"], "icon": "train"},
         "cues": {"lines": ["나레이션 속 단어"]}},
        {"module": "board", "data": {…}, "beats": [{"narration": "…", "data": {…}, "cues": {…}}]}
      ]}
    ]
  }
  ```
  - `narration`은 zh-tw다. 문장은 짧게 쓰고 `。！？`로 끝낸다 (긴 장은 문장 경계에서 나눠 읽힌다).
  - 나레이션에서는 「容易通」, 화면 글자에서는 「LONGEPASS」라고 쓴다. `hashtags`의 첫 번째는 `#LONGEPASS`다.
  - `video_title`(100자 이하), `description`, `hashtags`는 그대로 유튜브 업로드 정보가 된다.
  - **쇼츠** (`raw_plan_short_N.json`):
    - `bin/lp templates --short`의 템플릿만 쓴다. 장은 하나(`"title": ""`)로 한다.
    - 위 제목 띠는 `"header": {"text": "…\n…", "emphasis": "…"}`로 정한다.
    - `"angle": "…"`에 다루는 각도를 한 줄로 적는다. `hashtags`에 `#Shorts`를 넣는다.
    - 나레이션은 60초 이하(보통 200자 안팎)로 쓴다. 롱폼의 사실만 쓴다.
  - asset 칸(`image` 등)에는 **소재 id**(assets/의 파일 이름에서 확장자를 뺀 것)를 쓴다. 아직 없어도 된다. 3단계에서 그 이름으로 받는다.
  - `cues`는 그 샷 나레이션에 실제로 있는 단어여야 한다.
  - 화면 리듬은 CHANNEL.md 「화면 리듬」을 따른다 (같은 템플릿 연속 금지, 4~5샷마다 카드 없는 화면, 근거는 `screen_focus`/`quote_card`).
- `bin/lp plan <slug>`, 쇼츠는 `bin/lp plan <slug> --short N`:
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
bin/lp tts <slug> --chapter 2     # 특정 장만 (1부터) / --force 전부 새로
bin/lp tts <slug> --short 1       # 쇼츠 1 (숏폼 읽기 지시, voice/short_1/)
```
- 서버의 글자별 타임스탬프로 시각을 맞춘다 (`voices.json`의 `timing: timestamp`).
- `warnings`에 "대본과 다르게 읽음"이 있으면 그 문장을 고쳐 쓰거나(숫자 표기, 쉼표) `--chapter N`으로 다시 만든다.
- TTS 서버를 쓸 수 없으면 `bin/lp job <slug> --silent`로 무음 영상을 만들고, 그 사실을 보고한다.

### 5. 점검 → `job.json`, 그리고 정지 화면으로 고치기
```bash
bin/lp job <slug> [--short N]       # job.json + 렌더링 없이 점검 (길이, 샷 수, 자료 경고). 쇼츠는 60초 이하인지 본다
bin/lp preview <slug> [--short N]   # 샷마다 정지 화면 → render/preview/ (쇼츠는 render/short_N/preview/)
```
- 정지 화면을 **하나씩 직접 열어 본다**. 볼 것:
  - 글자 넘침·겹침
  - 자막 자리 침범
  - 엉뚱한 사진
  - 잘린 얼굴·글자 → `--focus`
  - 빈 화면
- 고칠 때는 `raw_plan.json` → `bin/lp plan` → (`bin/lp tts`) → `bin/lp job` → `bin/lp preview` 순서로 다시 돈다.
- `bin/lp stage <slug> built "렌더링"`

### 6. 렌더링
```bash
bin/lp render <slug>              # render/<slug>.mp4 · .srt · .json
bin/lp thumb <slug>               # render/thumbnail.jpg
bin/lp render <slug> --short 1    # render/short_1.mp4 (쇼츠 2 도 같게)
bin/lp thumb <slug> --short 1     # render/short_1_thumbnail.jpg (세로 표지)
```
- 장이 시작하는 곳과 사진 장면에서 프레임을 뽑아 확인한다:
  ```bash
  ffmpeg -ss <초> -i render/<slug>.mp4 -frames:v 1 render/check_<초>.png
  ```
- 사용자에게 보고할 것:
  - 영상, 자막, 썸네일 경로 (롱폼 + 쇼츠)
  - 조사로 보탠 정보와 바로잡은 사실
  - 확인 못 한 것
  - 아이콘으로 대체된 장면
  - 음성 경고
  - 업로드 대기열에 넣을지 묻기 (`bin/lp publish <slug> --dry-run`으로 미리 확인해 둔다)

### 7. 업로드 대기열 (사용자가 요청할 때만)
```bash
bin/lp publish <slug> --dry-run   # youtube.json·result.json 만 쓰고 DB 는 시험 후 되돌림
bin/lp publish <slug>             # longform_videos 기록 → ready. 백엔드 업로드 예약이 날짜를 잡아 올린다
```
- 롱폼, 썸네일, 쇼츠 1개 이상(각 표지 포함)이 렌더링돼 있어야 한다. 쇼츠는 60초 이하여야 한다.
- 설명란에는 설명, 챕터, 해시태그, 소재 출처, 음악 출처가 자동으로 붙는다.
- 대기열에 넣은 뒤에는 고치지 않는다. 고쳐야 하면 사용자에게 알린다 (예약된 뒤면 Postiz에서 직접 처리).

## 피드백 받기
사용자 피드백은 그 영상만 고치고 끝내지 않는다. 일반 규칙이면 날짜와 함께 CHANNEL.md 「피드백으로 생긴 규칙」에 쌓는다.
검사로 만들 수 있으면 `studio/plan.py`의 `variety_report`에 넣는다.

## 템플릿이 모자랄 때
새 화면 모양이 필요하면 TEMPLATE_GUIDE.md를 따라 템플릿을 추가한다 (CLAUDE.md 「끝내기 전에 반드시」).
