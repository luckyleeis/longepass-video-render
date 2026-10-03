# video-studio

템플릿 기반 모션 영상 **렌더링 전용** 저장소. 외부 API(LLM, TTS, DB, 업로드)를 부르지 않는다.

```
서버(py-macmini-server): 아티클 → LLM 계획 → TTS·글자 정렬 → job.json → [video-studio] → 영상 → 업로드
```

| 이 저장소 | 서버 |
|---|---|
| 템플릿(명세 + 컴포넌트), 스타일, 그림 재료, Remotion | 아티클/문제 불러오기, LLM 계획, TTS |
| 계획 검증, 박자 맞춤 타임라인, 렌더링, 음량, 자막 | 업로드, 발행 기록, 일정 |

## 설치

```bash
npm ci && npx remotion browser ensure
```
Python은 표준 라이브러리만 쓴다 (3.9+). ffmpeg 필요.

## 명령

```bash
bin/studio catalog  --project longepass --style longepass   # LLM 프롬프트용 템플릿 설명
bin/studio validate raw_plan.json --project longepass --style longepass
bin/studio render   job.json                                 # 형식은 studio/render.py 맨 위
bin/studio thumbnail thumb.json                             # 유튜브 썸네일 JPEG, 형식은 studio/thumbnail.py 맨 위
bin/studio check                                             # 템플릿 명세·코드 규칙 검사
bin/studio gallery  [스타일 …] [--only 템플릿,…]               # out/gallery/index.html
bin/studio list | styles
```

## 구조

- `src/templates/<id>/` — 템플릿 (manifest.json + 컴포넌트). 작성법: [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md)
- `src/kit/` — 공용 부품 (그림 재료 층, 스킨, 무대, 관절 인형 …)
- `styles/` — 프로젝트 스타일 (색·글꼴·움직임·음악·효과음 양)
- `public/music` — 배경음악 17곡, 모두 **Mixkit Stock Music Free License** (상업·유튜브 사용 가능, **출처 표기 불필요**, 원본 단독 재판매 금지).
  `library.json`의 `mood`(calm/bright/warm/playful/motivating)로 영상마다 고른다 (계획의 `music_mood`, 스타일의 `music_moods`).
  새 곡도 출처 표기가 필요 없는 라이선스만 넣는다.
- `public/sfx` — 효과음 (Kenney CC0 등)
- `public/fonts` — Noto Sans TC (SIL OFL), 清松手寫體 JasonHandwriting (SIL OFL로 알려짐, 운영 사용 전 확인)
- `studio/` — Python 명령

## 서버에서 부르는 법

서버는 `VIDEO_STUDIO_DIR`(기본 `~/Project/video-studio`)에서 `python -m studio …`를 실행한다.
비밀값은 넘기지 않는다 (PATH/HOME/언어/임시폴더만).
