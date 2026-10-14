# 작업 기록 (WORKLOG)

다른 세션의 에이전트가 이어받을 수 있게, 무엇을 왜 어떻게 했는지와 아직 확인하지 않은 것을 남긴다.
새 작업을 하면 맨 위에 항목을 추가한다 (날짜, 무엇을, 어떻게, 확인한 것과 안 한 것, 남은 일).

---

## 2026-10-14 (4) — AI 이미지 금지, showreel 전체 갤러리·세로 쇼츠 확인

### 사용자가 정한 것
- **AI 생성 이미지·영상은 쓰지 않는다.**

### 한 일
- CHANNEL.md 「소재」에 AI 금지를 적었다.
- `agent/credits.py` `ai_marked()`: 제목·태그·작가·출처·라이선스에 AI 생성 표시(ai generated, midjourney, AI 生成 …)가 있는지 본다.
  - `bin/lp search`: 표시가 있는 결과를 빼고 몇 개 뺐는지 알린다.
  - `bin/lp get`·`add`: 표시가 있으면 거부한다. `add`는 라이선스도 검사한다 (NC 거부, 직접 만든 것은 `own`).
- 새 6종(photo_full, photo_split, photo_collage, screen_focus, quote_card, word_slam)의 manifest `aspect`에 `9:16`을 추가했다.

### 확인한 것
- **showreel 전체 갤러리(34개)**: 보조 글자색 변경 뒤에도 부제·축 글자·보조 설명이 읽히고, 지나치게 진해진 곳이 없다. 전환 순환도 동작한다.
- **세로 쇼츠 갤러리(새 6종)**: 넘침·잘림이 없다.
  - photo_full·photo_split의 사진은 쇼츠에서 가운데 정사각형 무대 안에만 찬다 (위아래는 배경색). 쇼츠 화면 구조상 그렇다.
- `bin/lp add`에 AI 표시나 NC 라이선스를 주면 거부하는 것을 확인했다.

### 남은 화면 문제 (작은 것)
- `counter`: 날아다니는 지폐·동전이 「NT$」 글자를 가린다 (showreel).
- `timeline`: 위쪽 날짜 글자가 노랑(primary)이라 크림 바탕에서 옅다.
- `word_slam`: 왼쪽 위 로고의 강조 글자(E)가 파란 바탕에서 안 보인다.
- `flow`·`doodle_scene`: 하단 메모가 노드나 이름표를 가린다 (2026-10-13 점검).

---

## 2026-10-14 (3) — 사용자 결정 반영: TTS 서버, 캡처 출처 표기, NAS 작업 폴더(.env)

### 사용자가 정한 것
- TTS는 **다큐 그곳 서버를 같이 쓴다**. config 예시에 그 주소와 목소리 기본값 `Charon`을 넣었다.
- 화면 캡처는 **정부 공고와 언론 기사**를 쓰고, 출처는 **화면 오른쪽 옆**에 표기한다.
- 작업 폴더는 **NAS**로 옮긴다. 경로는 **`.env`에 적어서** 쓴다.
- 아직 남은 결정: AI 생성 이미지 허용 여부 (CHANNEL.md (확인 필요)).

### 한 일
- `agent/config.py`
  - 저장소 루트의 `.env`(git 제외, 예시 `.env.example`)를 읽는다. `LP_WORKSPACE`, `LP_TTS_URL`, `LP_TTS_VOICE`를 지원한다.
  - 우선순위는 환경 변수 > .env > config다. 따옴표, 줄 끝 주석, `export` 접두어를 허용한다.
- `agent/episode.py`: NAS가 연결돼 있지 않으면(작업 폴더의 상위 폴더가 없으면) `bin/lp new`가 한 줄 오류로 멈춘다.
- `agent/__main__.py`: 사람이 읽을 오류 한 줄만 낸다. 자세한 추적은 `LP_DEBUG=1`.
- `bin/lp where`: `workspace_ok`와 .env 위치를 보여 준다.
- `src/templates/screen_focus`
  - 출처(자료의 credit, 없으면 새 칸 `data.source`)를 틀 **오른쪽 옆** 세로 칸에 표기한다: 강조 막대 + 「資料來源」 + 출처 이름.
  - 그만큼 틀 폭을 줄이고, 틀 + 출처를 한 덩어리로 가운데에 놓는다. 출처가 있으면 구석 Credit은 숨긴다.
- `bin/lp capture … --name "勞動部"`: 출처 이름(기관명, 언론사 + 날짜)을 credit에 넣는다 → `勞動部（www.mol.gov.tw）`.
- CHANNEL.md, SKILL.md, README, CLAUDE.md, `longepass.config.example.json` 갱신.

### 확인한 것
- `bin/studio check` 0건, 타입 검사 0건.
- `bin/studio gallery --only screen_focus`: 브라우저 예시에서 출처가 오른쪽 옆에 읽히게 나온다. 휴대폰 예시(출처 없음)는 그대로다.
- `.env` 읽기: 따옴표 + 주석, `export`, 없는 NAS 경로일 때 오류.
- **이전 방식(백엔드) 호환**: 예전 형식 job.json(`style: longepass`, 절대 경로 음성·char_times, assets 없음)을 다른 폴더에서 `bin/studio render --no-render`로 돌렸다 → 정상.
  - `bin/studio catalog/validate`는 `--style longepass`·`showreel` 모두 정상이다.

---

## 2026-10-14 (2) — LONGEPASS 제작 방식 확정: 에이전트 도구 bin/lp, 채널 규칙, TTS·소재 검색

### 배경
- 사용자가 다른 채널 「다큐 그곳」의 작업 방식(에이전트 안내, 채널 규칙, 설정 구조)을 **참고용**으로 보여 줬다. 그대로 따르라는 것이 아니라, TTS·이미지 검색·작업 흐름을 참고해 LONGEPASS 제작 방식을 정하라는 것이다.
  - 받은 파일 중 API 키 파일이 있었다. 값은 이 저장소 어디에도 옮기지 않았다 (구조만 참고).
- **이 저장소는 사용자의 맥에서 로컬로 돌아간다.** 클라우드 세션은 수정만 하고, 실제 실행은 로컬에서 한다.

### 정한 방식 (다큐 그곳에서 가져온 것 / 바꾼 것)
- **가져온 것**
  - 명령 하나(`./doc` → `bin/lp`)로 모든 작업
  - 작업 폴더 하나에 파일로 남기기 (draft / notes / plan / assets / voice / log / status)
  - 단계 관리
  - 사용자가 초안을 주고 에이전트가 사실 확인·제작 (초안 판정·거부 기준)
  - 사실 근거 등급 A/B/C/X
  - 소재 라이선스 목록과 출처 자동 기록(`_credits.json`)
  - 스톡은 현대 장면에만
  - 문장 단위 TTS와 문장 사이 쉼
  - 받아쓰기로 TTS가 대본대로 읽었는지 확인
  - 피드백을 채널 규칙·검사로 쌓기
- **바꾼 것**
  - 웹 UI·작업 서버·깊이맵·기록영상(Internet Archive)·대사 목소리·쇼츠 흐름은 넣지 않았다 (LONGEPASS 정보 영상에 아직 필요 없음).
  - 렌더링 엔진(`studio/`)은 계속 오프라인이다. 네트워크는 `agent/`에만 있다 — 백엔드 방식이 같은 엔진을 쓰기 때문이다.
  - 작업 폴더 기본값은 저장소 안 `out/agent`다 (설정으로 NAS 등 바꿀 수 있음).

### 한 일
- `CHANNEL.md` (새로 만듦): LONGEPASS 채널 규칙 초안. 톤·구성, 초안은 사용자가, 사실과 표기, 나레이션, 화면 리듬, 소재, 소리, 썸네일, 납품. 사람이 정해야 할 것은 (확인 필요)로 표시했다.
- `agent/` (새로 만듦, 표준 라이브러리만) + `bin/lp`
  - `config.py`: `longepass.config.json` + 기본값. 키는 `longepass.keys.json`에서만 읽는다 (git 제외).
  - `episode.py`: 작업 폴더 `new/status/stage/log/list`. notes.md에는 사실 카드 틀을 넣는다.
  - `tts.py`: plan.json의 장마다 음성을 만든다.
    - 문장 단위로 OpenAI 호환 음성 API를 부르고, 결과를 캐시한다.
    - 문장 앞뒤 무음을 자르고, 문장 사이에 `pause_ms`(기본 350)를 넣어 잇는다.
    - 글자 시각(char_times)은 문장 경계 기준으로, 문장 안은 고르게 나눈다.
    - 선택: 받아쓰기(stt.url)로 일치율을 확인하고, 낮으면 한 번 다시 만든 뒤 그래도 낮으면 경고한다.
  - `sources.py`
    - 검색: Pexels(사진·영상), Pixabay(사진·영상), Unsplash(사진, 받을 때 download_location 호출), 위키미디어 커먼즈(라이선스를 읽어 NC/ND/불명은 뺌).
    - 받기: 번호 또는 `File:` 이름으로 받는다. 사진은 긴 변 2560px 이하로 줄이고, 영상은 무음 H.264 1920px 이하, `--start --dur`, 최대 30초로 만든다.
    - 직접 가진 파일은 `add`로 넣는다.
  - `capture.py`: 크롬 `--headless=new --screenshot`으로 화면을 캡처한다 (데스크톱 1440×1000, `--mobile` 1170×2532). Remotion의 chrome-headless-shell은 `--screenshot`에서 멈춰서 쓰지 않는다. 맥의 Google Chrome을 먼저 찾는다.
  - `credits.py`: `_credits.json`에 출처를 기록하고, 라이선스를 판정하고, job.json의 assets로 바꾼다.
  - `build.py`: `plan`(검증 + 안 받은 소재 목록), `job`(job.json + 렌더링 없이 점검), `preview`, `render`(끝나면 단계를 rendered로), `thumb`.
- `longepass.config.example.json`, `.gitignore`(config·keys 제외)
- `src/templates/screen_focus`: 틀 아래 여백을 화면 높이의 12%에서 20%로 늘렸다 (제목 없이 쓸 때 틀이 자막과 겹쳤음).
- `.claude/skills/make-video/SKILL.md`: `bin/lp` 기준으로 다시 썼다.
- `CLAUDE.md`, `README.md`: 네트워크 경계(엔진 오프라인 / `agent/`만 네트워크), 키 규칙, 로컬 실행.

### 확인한 것
- 가짜 서버(로컬 HTTP: TTS·받아쓰기·Pexels·Pixabay·Unsplash·커먼즈 응답 흉내)로 전체 흐름을 시험했다: `new → search → get → capture → add → plan → tts → job → preview → render → thumb`. 실제 외부 API와 받은 키는 쓰지 않았다.
  - 검색: NC 라이선스 결과가 빠졌다. `File:Bad.jpg`(NC)는 받기를 거부했다.
  - TTS: 앞뒤 무음 자르기, 문장 시각, 글자 수가 나레이션과 일치했다. 다르게 읽은 문장은 다시 만든 뒤 경고가 나왔다. 두 번째 실행은 캐시를 썼다.
  - 실제 mp4 렌더링: 21초, 사진 6장 + 영상 소재 1개 + 화면 캡처가 출처 표기와 함께 나왔다. 음성이 들어갔다(평균 -15dB). 썸네일과 단계 기록도 됐다.
  - 화면 캡처: 시험 환경에서는 Playwright 크로미움으로 확인했다 (`LP_CHROME`).

### 확인하지 않은 것 (로컬에서 할 일)
1. **실제 TTS 서버**: 요청 형식(OpenAI 호환 `/v1/audio/speech`), 대만 화자 목소리, `instructions`를 받는지. 서버가 모르는 칸이 있으면 config에서 빼거나 `extra`로 맞춘다.
2. **실제 받아쓰기 서버**가 있는지와, 번체/간체 차이로 일치율이 낮게 나오지 않는지. 낮게 나오면 `min_ratio`를 조정한다.
3. **실제 Pexels·Pixabay·Unsplash·커먼즈 응답**: 필드 이름은 공개 API 문서 기준으로 짰지만 실제 호출로는 확인하지 않았다.
4. 맥에서의 화면 캡처 (Google Chrome 경로, 한자 글꼴).
5. 앞 항목(2026-10-14)의 "확인하지 않은 것" 중 남은 것: showreel 전체 갤러리 다시 보기, 세로 쇼츠.

### 사람이 정해야 할 것 (CHANNEL.md의 (확인 필요))
- TTS 서버와 목소리 (다큐 그곳 서버를 같이 쓸지)
- 화면 캡처를 어디까지 쓸지 (정부 공고만? 언론 기사?)
- AI 생성 이미지 허용 여부
- 작업 폴더 위치 (저장소 안 `out/agent` 또는 NAS)

---

## 2026-10-14 — showreel 운영 스타일, 사진·영상 자료, 새 템플릿 6종, 에이전트 방식

### 배경 (사람이 정한 것)
- **운영 스타일은 showreel 하나다.** 여러 프로젝트용 테마를 만들려던 계획은 접었다. 다른 스타일은 지우지 않고 보관하며, 템플릿 작업 때 고려하지 않는다.
- **영상 제작 방식 정리:**
  1. 백엔드 방식(py-macmini-server가 job.json을 보냄)은 남긴다. 앞으로는 백엔드가 **이미지 정보까지** 보낸다.
  2. "LLM 여러 번 호출(초안 → 확인·수정 → 렌더 → 확인·수정)" 방식은 효과가 크지 않아 쓰지 않는다. 그 흐름은 백엔드에 있고, 여기서는 `bin/studio preview`만 관련이 있다. preview는 에이전트 방식의 빠른 확인용으로 남겼다.
  3. **에이전트 방식을 추가한다.** 이 저장소의 스킬을 읽은 에이전트가 초안을 받아 분석하고, 이미지·관련 자료·추가 정보를 직접 찾아 넣어 최종 영상까지 렌더링한다.
- 문제의식: 템플릿은 28개였지만 만든 영상이 다 비슷해 보였다. 원인은 템플릿 수가 아니라 화면 문법이 하나뿐이라서다. 모든 장면이 같은 크림 바탕+격자, 같은 카드, 같은 위치의 제목줄, 같은 등장 움직임과 전환, 평면 아이콘만 쓴다. 그래서 다음 세 가지로 대응했다.
  - 사진·영상·화면 캡처 같은 **실물 자료**를 넣을 수 있게 했다.
  - **카드 없는 화면 문법**(전면 사진, 키네틱 글자, 인용 지면)을 추가했다.
  - **반복 경고**와 **전환 순환**을 넣었다.

### 한 일

**1. showreel을 운영 스타일로**
- `styles/showreel.json`
  - `"active": true`를 넣었다.
  - 설명을 바꿨다.
  - 보조 글자색 `sub`를 배경과 대비 4.5 이상으로 바꿨다. 예전 값은 대비 1.35~1.65라 부제·축 글자 등이 거의 안 보였다. 새 값은 base `#6A6254`, accent `#664F00`, alt `#9A958A`, deep `#E3E9FF`다.
  - 예전 `sub` 값은 새 키 `shade`로 옮겼다. 글자 그림자 같은 장식 색이다. `contrast`(큰 글자 그림자)와 `tiles`(가운데 큰 글자 그림자)는 `surf.shade || sub`를 써서 모습이 그대로다.
  - `pacing.transitions.default`를 `["flash","slide","fade"]` 목록으로 바꿨다. 차례로 돌려 쓴다.
  - `transition_sfx`에 slide와 fade를 추가했다.
- `src/kit/types.ts`: `Surface.shade?`를 추가했다.
- `studio/styles.py`
  - `DEFAULT_STYLE = "showreel"`과 `active_styles()`를 추가했다.
  - 전환 종류 검사를 추가했다. 값은 문자열이나 목록이다.
- render/preview/thumbnail 작업 파일에서 `style`을 빼면 showreel을 쓴다.
- `bin/studio gallery`에 스타일을 안 주면 운영 스타일만 그린다. 예전에는 3개 스타일 모두라 약 45분이 걸렸다.
- `bin/studio styles`에 운영 스타일을 `*`로 표시한다.
- `bin/studio check`: 운영 스타일은 `sub` 대비도 검사한다(`studio/catalog.py` `check_thumbnail_rules`).
- `src/templates/mockProps.json`(Remotion Studio 미리보기용, check가 자동 생성)을 showreel 기준으로 만든다.

**2. 사진·영상 자료(asset) 파이프라인 — 백엔드 방식과 에이전트 방식 공용**
- 명세에 새 칸 종류 `{"type": "asset", "kind": "image|video|any"}`를 추가했다(`studio/catalog.py`의 검증과 LLM 설명).
- 새 `studio/assets.py`
  - job.json의 `assets`(id → 로컬 경로·credit·source·license·focus)를 해석한다.
  - 계획의 asset 칸 값은 id, 파일 경로, `{src, focus, credit, fit, start}` 중 하나다.
  - 파일을 `public/_jobs/<작업>/`에 복사한다. ffprobe로 크기와 길이를 읽는다.
  - 인터넷 주소는 받지 않는다. 파일이 없으면 칸을 비우고 경고만 남긴다.
  - 결과 메타에 출처 목록(`assets`)과 경고(`warnings`)를 남긴다.
- `studio/render.py`
  - 자료를 해석하는 단계를 넣었다.
  - **`voices`를 선택으로 바꿨다.** 음성이 없는 장은 무음(자막·음악만)이고 글자당 0.2초로 시각을 가정한다. `char_times`가 없는 음성은 음성 길이에 글자를 고르게 나눈다.
  - 상대 경로는 작업 파일 폴더 기준이다(`out_dir`, 음성, 자료).
  - `keep_job_dir` 옵션을 추가했다. preview가 정지 화면을 다 뽑은 뒤 지운다.
- `studio/timeline.py`: 음성이 없는 장은 음성 재생 목록과 음악 낮추기 구간을 만들지 않는다. 예전에는 빈 `src` 오디오가 생겼다.
- `studio/preview.py`, `studio/cli.py`: 작업 파일 기준 경로를 쓰고, 자료를 유지했다가 정리한다.
- `studio/gallery.py`: 예시의 자료(`public/samples/...`)를 해석한다.
- 새 `src/kit/picture.tsx`
  - `Picture`: Img/OffthreadVideo, focus 기준 cover, 확대·이동, 짧은 영상 되풀이, 읽기 실패 시 대체 화면.
  - `PictureFallback`: 자료가 없을 때의 색 면 + 큰 아이콘.
  - `Scrim`: 사진 위 어두운 그라데이션.
  - `useOverlaySurface`, `Credit`(출처 표기), `assetOf`, `aspectOf`.
- 새 `public/samples/`: ffmpeg로 만든 대용 사진 4장, 영상 1개, 화면 캡처 1장. 모두 `SAMPLE` 표시가 있고 실제 사진이 아니다.

**3. 새 템플릿 6종 (모두 16:9, clean 재료만 선언)**

| id | 화면 문법 | 자료 | 자료 없을 때 |
|---|---|---|---|
| `photo_full` | 화면 끝까지 사진/영상 + 큰 글자 (켄 번스 확대) | image/video | 깊은 색 면 + 큰 아이콘 |
| `photo_split` | 반은 사진(끝까지), 반은 제목·요점 | image/video | 강조색 면 + 아이콘 |
| `photo_collage` | 인화 사진 2~4장이 떨어져 흩어짐 | image ×N | 칸마다 다른 색 + 아이콘 |
| `screen_focus` | 브라우저/휴대폰 틀 안 캡처 → 해당 영역으로 확대 + 테두리 + 설명 | image | 회색 줄 가짜 페이지 + 강조 블록 |
| `quote_card` | 큰 따옴표 + 인용문 + 출처 (잡지 지면) | (선택) image | 글자만 |
| `word_slam` | 단어마다 화면 전체 색이 바뀌며 쾅 (키네틱 타이포) | 없음 | — |

**4. 다양성 장치**
- `studio/plan.py` `variety_report()`: `bin/studio validate` 결과의 `report.variety`에 경고를 낸다(계획은 바꾸지 않음). 다음 경우를 잡는다.
  - 같은 템플릿이 연속으로 나올 때
  - 같은 갈래가 세 샷 이어질 때
  - 8샷 이상인데 카드형 화면만 있을 때
- 전환 순환: 1번 참고.

**5. 에이전트 방식**
- 새 스킬 `.claude/skills/make-video/SKILL.md`: 초안 → 분석(notes.md) → 조사·자료 수집 → 계획 → validate → preview로 고치기 → render → 보고.
  - 작업 폴더는 `out/agent/<slug>/`이다.
  - 자료 라이선스 규칙, 지어내지 않기, 화면 다양성 규칙, 음성 선택지(있음/글자 정렬 없음/무음)를 담았다.
- `CLAUDE.md`(= `AGENTS.md`, 심볼릭 링크): 두 방식, showreel만, 외부 호출 규칙(저장소 코드 금지 / 에이전트 도구는 허용), 끝내기 전 확인(WORKLOG 기록 포함)을 반영했다.
- `README.md`, `TEMPLATE_GUIDE.md`(9장 "사진·영상 자료" 추가): 갱신했다.

### 확인한 것
- `bin/studio check`: 템플릿 34개, 문제 0건.
- 타입 검사(`MotionVideo.tsx`, `Thumbnail.tsx`): 오류 0건.
- `bin/studio validate` + `render --no-render` 시험(`out/check/job_test/`, git에 없음). 다음이 동작했다.
  - 자료 id, 상대 경로, 없는 파일(경고만 남김)
  - `char_times` 없는 음성
  - 음성 없는 장
  - 전환 순환과 variety 경고
- `bin/studio gallery showreel --only <새 6종>`: 렌더링 오류 없이 나왔다. 정지 화면을 한 번 보고 두 가지를 고쳤다.
  - 사진 위 알약 강조의 글자색
  - 휴대폰 대체 화면에서 설명이 두 번 나옴

### 확인하지 않은 것 (사람 요청으로 검증을 미룸 — 다음 세션에서 할 일)
1. **showreel 전체 갤러리 다시 보기**: `sub` 색 변경과 전환 순환은 기존 28개 템플릿의 결과를 바꾼다. 의도한 변경이다. 그래도 `bin/studio gallery`로 28개를 다시 보고 보조 글자가 너무 진해 보이는 곳이 없는지 확인해야 한다.
2. **새 템플릿의 움직임**: 릴 영상(`out/gallery/reel_showreel_partial.mp4`)으로 아직 보지 않았다. 확인할 것:
   - screen_focus 확대 타이밍
   - word_slam 원형 전환
   - photo_collage 떨어지는 움직임
3. **실제 자료로 렌더링**: 진짜 사진, 세로 사진, 아주 큰 사진, 긴 영상, 짧은 영상 되풀이, 읽기 실패한 파일(`onError` → 대체 화면).
4. **실제 mp4 렌더링**: 전체 렌더링(`bin/studio render`, `--no-render` 아님)과 `bin/studio preview`. 특히 영상 자료의 OffthreadVideo는 아직 mp4로 끝까지 렌더링해 보지 않았다.
5. **세로 쇼츠(9:16)**: 새 템플릿은 16:9만 선언했다. `bin/studio gallery --aspect 9:16 --only …`로 보고 맞으면 manifest `aspect`에 추가한다.
6. **word_slam의 HUD 로고**: 단어마다 바탕색이 바뀌는데, 왼쪽 위 로고는 샷 bg(accent) 기준 색이라 어두운 바탕에서 잘 안 보일 수 있다.
7. **에이전트 방식을 실제 초안으로 끝까지 한 번 돌려 보기**: 스킬 문서대로 하면 막히는 곳이 없는지 본다.

### 앞서 찾았지만 손대지 않은 것 (2026-10-13 점검)
- `flow` 3번째 비트, `doodle_scene` 마지막 비트: 하단 메모(`BeatNote`, `src/kit/stage.tsx`, 화면 아래 고정)가 확대된 노드나 이름표를 가린다.
- 썸네일(`src/thumbnail/Thumbnail.tsx`): `'#fff'` 등을 직접 쓰고 div로 원·배지를 그린다. 템플릿 규칙 위반인데 check가 썸네일 소스를 검사하지 않는다.
- 썸네일: 줄 첫머리가 전각 `【`이면 들여쓴 것처럼 보인다.
- `npm audit`: high 17건 (확인 안 함).

### 백엔드(py-macmini-server)에 필요한 일 — 이 저장소 밖
- 프로젝트 설정의 스타일을 `showreel`로 바꾼다 (지금 서버가 `longepass`를 넘기는지 확인 필요).
- LLM 계획 프롬프트(`direction.md` 등)는 `bin/studio catalog --style showreel` 출력을 그대로 넣는다. 새 템플릿과 asset 칸이 자동으로 포함된다. 프롬프트에 다음 규칙을 추가한다.
  - 자료 id는 서버가 준 목록에서만 고른다.
  - 화면 다양성 규칙(SKILL.md 3단계와 같은 것)을 지킨다.
- 이미지를 내려받아 로컬 경로로 job.json `assets`에 넣는다(형식 `studio/assets.py`). 출처·라이선스도 넣고, 결과 메타의 `assets`를 영상 설명란에 표기한다.
- 다중 LLM 검수 흐름을 제거한다.

### 샘플 자료 만들기 (public/samples)
```bash
cd public/samples && F=../fonts/Noto_Sans_TC/NotoSansTC-Bold.ttf
# 예: 사진 대용
ffmpeg -f lavfi -i "gradients=s=1920x1280:c0=0x1d2b53:c1=0xff8a3d:c2=0xffd166:n=3:type=radial:seed=7,format=rgb24" -frames:v 1 \
  -vf "drawtext=fontfile=$F:text='SAMPLE PHOTO A':fontsize=34:fontcolor=white@0.85:x=w-tw-36:y=h-th-30:box=1:boxcolor=black@0.35:boxborderw=10" photo_a.jpg
```
(photo_b~d는 색과 type만 다르고, clip_a.mp4는 `gradients … speed=0.02 -t 4`, screen_a.png는 `color` + `drawbox`/`drawtext`로 만든 웹페이지 모양이다)
