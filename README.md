# video-studio

LONGEPASS 템플릿 기반 모션 영상 저장소. 사용자의 맥에서 로컬로 돌아간다.
- **렌더링 엔진** (`studio/`, `src/`, `bin/studio`): 외부 API(LLM, TTS, DB, 업로드)를 부르지 않는다. 로컬 파일만 읽는다.
- **에이전트 방식 도구** (`agent/`, `bin/lp`): DB(글·업로드 대기열), TTS 서버, 스톡·커먼즈 소재 검색, 화면 캡처. 네트워크는 여기서만 쓴다. 채널 규칙은 [CHANNEL.md](CHANNEL.md)에 있다.

영상을 만드는 방식은 두 가지다.

```
1. 백엔드 방식   서버(py-macmini-server): 아티클 → LLM 계획 → TTS·글자 정렬 → 이미지 → job.json → [video-studio] → 영상 → 업로드
2. 에이전트 방식 DB 글 → [에이전트가 이 저장소에서: 분석 → 조사로 정보 보태기 → 계획(롱폼 + 쇼츠) → 프리뷰로 고치기 → 렌더링]
                 → (사람이 확인) bin/lp publish → 같은 업로드 대기열(longform_videos ready) → 서버가 업로드
```
에이전트 방식의 순서는 [.claude/skills/make-video/SKILL.md](.claude/skills/make-video/SKILL.md)에 있다.
작업 기록과 남은 일은 [WORKLOG.md](WORKLOG.md)를 본다. 운영 스타일은 **showreel** 하나다.

| 이 저장소 | 서버 |
|---|---|
| 템플릿(명세 + 컴포넌트), 스타일, 그림 재료, Remotion | 아티클/문제 불러오기, LLM 계획, TTS |
| 계획 검증, 박자 맞춤 타임라인, 렌더링, 음량, 자막 | 업로드, 발행 기록, 일정 |

## 설치

```bash
npm ci && npx remotion browser ensure
```
Python은 표준 라이브러리만 쓴다 (3.9+). ffmpeg 필요. 예외: `agent/pg_run.py`만 psycopg를 쓰고, `uv`가 그때만 따로 띄운다.

에이전트 방식을 쓰려면 다음을 준비한다 (둘 다 git에 올라가지 않는다).
- `.env.example`을 `.env`로 복사하고 `LP_WORKSPACE`에 NAS 작업 폴더 경로를 적는다.
- `longepass.config.example.json`을 `longepass.config.json`으로 복사한다 (TTS는 다큐 그곳 서버, `gemini`·`Aoede`·`zh-tw`).
- `longepass.keys.json`에 `{"pexels": "…", "pixabay": "…", "unsplash": "…"}`를 넣는다 (있는 것만).
- `.env`에 `DATABASE_URL`(서버와 같은 certificate_tw DB)을 적는다. DB는 `uv run --with psycopg[binary]`로 따로 띄워 읽는다 (`uv` 필요, 저장소에 패키지가 남지 않음).
- 화면 캡처에는 Google Chrome이 필요하다.
- 확인: `bin/lp where`

## 명령

```bash
bin/studio catalog  --project longepass --style showreel    # LLM 프롬프트용 템플릿 설명
bin/studio validate raw_plan.json --project longepass --style showreel
bin/studio render   job.json                                 # 형식은 studio/render.py 맨 위
bin/studio thumbnail thumb.json                             # 유튜브 썸네일 JPEG, 형식은 studio/thumbnail.py 맨 위
# 세로 쇼츠: render 작업에 "aspect": "9:16" + "header"(위 제목 띠), thumbnail 작업에 "aspect": "9:16", catalog/validate 에 --aspect 9:16
bin/studio preview  job.json [--all]                         # 샷별 정지 화면만 빠르게 (전체 렌더링 전 확인)
bin/studio check                                             # 템플릿 명세·코드 규칙 검사
bin/studio gallery  [스타일 …] [--only 템플릿,…]               # out/gallery/index.html (스타일을 빼면 showreel만)
bin/studio gallery  showreel --aspect 9:16                 # 세로 쇼츠 화면에서 (out/gallery/9x16)
bin/studio list | styles

bin/lp                                                       # 에이전트 방식 명령 전체 (작업 폴더·소재·TTS·점검·렌더링)
```

## 템플릿 눈으로 보기 (로컬 웹서버)

```bash
npm run studio     # Remotion Studio → http://localhost:3333
                   #   왼쪽 Templates/<갈래>/<템플릿> 를 고르면 예시가 움직이며 재생된다 (사진 템플릿은 public/samples 샘플)
                   #   Motion / Thumbnail 은 작업 파일(props)을 넣어 볼 때
npm run gallery    # 정지 화면 표 → http://localhost:3334 (먼저 bin/studio gallery 로 out/gallery 를 만든다)
```
- Studio의 템플릿 목록과 예시는 `bin/studio check`가 만드는 `src/templates/mockProps.json`에서 온다. 새 템플릿을 만들었으면 check를 한 번 돌린다.

## 구조

- `src/templates/<id>/` — 템플릿 (manifest.json + 컴포넌트). 작성법: [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md)
- `src/kit/` — 공용 부품 (그림 재료 층, 스킨, 무대, 관절 인형 …)
- `styles/` — 프로젝트 스타일 (색·글꼴·움직임·음악·효과음 양)
- `public/music` — 배경음악 17곡, 모두 **Mixkit Stock Music Free License** (상업·유튜브 사용 가능, **출처 표기 불필요**, 원본 단독 재판매 금지).
  `library.json`의 `mood`(calm/bright/warm/playful/motivating)로 영상마다 고른다 (계획의 `music_mood`, 스타일의 `music_moods`).
  새 곡도 출처 표기가 필요 없는 라이선스만 넣는다.
- `public/sfx` — 효과음 (Kenney CC0 등)
- `public/samples` — 갤러리 예시용 대용 자료 (ffmpeg로 만든 그라데이션, 실제 사진 아님)
- `public/fonts` — Noto Sans TC (SIL OFL), 清松手寫體 JasonHandwriting (SIL OFL로 알려짐, 운영 사용 전 확인)
- `studio/` — Python 명령

## 서버에서 부르는 법

서버는 `VIDEO_STUDIO_DIR`(기본 `~/Project/video-studio`)에서 `python -m studio …`를 실행한다.
비밀값은 넘기지 않는다 (PATH/HOME/언어/임시폴더만).

**예전 job.json 그대로 쓸 수 있다** (2026-10-14 확인: `style: longepass`, 절대 경로 음성·out_dir).
- 달라진 점 1: 상대 경로(음성, out_dir, 자료)는 **작업 파일이 있는 폴더 기준**으로 바뀌었다. 예전에는 실행한 폴더 기준이었다. 서버는 절대 경로를 쓰므로 영향이 없다.
- 달라진 점 2: `style`을 빼면 showreel이다.
- 달라진 점 3: `voices`·`assets`는 선택이다.

### 스타일의 주 바탕과 채널 인트로
- `theme.primary_surface`: 주 바탕 (첫 장·첫 화면·마지막 화면·썸네일·쇼츠). 본문 챕터는 주 바탕과 반대 바탕을 번갈아 쓴다
- `theme.brand.tagline`, `pacing.brand_intro: {"sec": 2.2, "sfx": [[종류, 위치 0~1, gain_db]]}`: 있으면 롱폼의 훅(첫 샷) 바로 뒤에 채널 인트로(brand_intro)를 자동으로 넣는다 (첫 장 음성은 그 자리에서 나눠 재생)

### 사진·영상 자료 (백엔드 방식에서 이미지 넘기기)
- 자료 칸이 있는 템플릿은 `photo_full`, `photo_split`, `photo_collage`, `screen_focus`, `quote_card`다.
  `bin/studio catalog` 출력에 `asset(...)` 칸으로 나온다.
- LLM 계획에는 자료 **id**를 적고, job.json의 `assets`에 id → 로컬 파일 경로·출처를 넣는다
  (형식은 `studio/assets.py` 맨 위). 렌더링은 인터넷 주소를 받지 않는다. 서버가 미리 내려받아 경로로 넘긴다.
- 파일이 없거나 형식이 틀리면 그 칸만 비우고 렌더링을 계속한다. 템플릿은 `icon` 칸의 아이콘 화면으로 대신 그린다.
  결과 메타(`<name>.json`)의 `assets`는 쓴 자료의 출처 목록(영상 설명란용)이고, `warnings`는 못 읽은 자료다.
- `voices`는 선택이다. 음성이 없는 장은 자막만 나오고, 글자 정렬(`char_times`)이 없으면 음성 길이에 고르게 나눈다.
