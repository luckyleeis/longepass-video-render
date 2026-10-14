# video-studio 작업 규칙 (에이전트용)

이 저장소는 LONGEPASS 영상의 **렌더링 엔진**(`studio/`, `src/`)과 **에이전트 방식 도구**(`agent/`, `bin/lp`)다.
사용자의 맥에서 로컬로 돌아간다. 여기서 일하는 에이전트는 템플릿을 만들고 고치고, 초안으로 영상을 만든다.
에이전트 방식으로 초안에서 영상을 만들 때는 [CHANNEL.md](CHANNEL.md)(채널 규칙)와 [.claude/skills/make-video/SKILL.md](.claude/skills/make-video/SKILL.md)를 따른다.
지난 작업 기록과 남은 일은 [WORKLOG.md](WORKLOG.md)에 있다. 작업을 시작하기 전에 먼저 읽는다.

## 영상 만드는 방식 (두 가지)
1. **백엔드 방식**: py-macmini-server(다른 저장소)가 계획·음성·이미지를 담은 job.json을 보낸다. 이 저장소는 렌더링만 한다.
2. **에이전트 방식**: 사람이 초안을 주면 에이전트가 사실 확인·대본·소재·TTS·렌더링을 한다 (make-video 스킬, `bin/lp`).

예전의 "LLM 여러 번 호출(초안 → 검수 → 렌더 → 검수)" 방식은 쓰지 않는다. `bin/studio preview`는 에이전트 방식의 빠른 확인용으로 남겨 두었다.

## 지켜야 할 것

- **네트워크는 `agent/`(bin/lp)에서만 쓴다.** 렌더링 엔진(`studio/`, `src/`)에는 외부 호출(LLM/TTS/DB/업로드/다운로드)을 넣지 않는다. 엔진은 로컬 파일만 읽는다 — 백엔드 방식도 같은 엔진을 쓴다.
  - `agent/`가 부르는 것: 설정된 TTS 서버(다큐 그곳과 같은 서버, 응답의 audio_url), 스톡 API(Pexels·Pixabay·Unsplash), 위키미디어 커먼즈, 로컬 크롬(화면 캡처). 표준 라이브러리만 쓴다. 네트워크가 필요한 패키지를 새로 들이지 않는다 (필요하면 사람에게 먼저 묻는다).
  - **API 키는 `longepass.keys.json`(git 제외)에서만 읽는다.** 출력하거나 다른 파일·로그·커밋에 옮기지 않는다. 설정은 `longepass.config.json`(git 제외, 예시 `longepass.config.example.json`).
  - 작업 폴더(NAS) 경로는 `.env`의 `LP_WORKSPACE`다 (git 제외, 예시 `.env.example`).
- **이 저장소 밖을 쓰지 않는다.** 결과는 `out/`, 작업 파일(job.json)이 지정한 `out_dir`, 또는 설정의 `workspace`(에이전트 작업 폴더)에만 둔다.
- **운영 스타일은 showreel 하나다.** longepass, sketch_demo는 보관용이라 템플릿을 만들거나 고칠 때 고려하지 않는다 (지우지도 않는다).
- **템플릿 규칙은 [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md)를 따른다.** 특히:
  - 색은 스타일 값(`surf`, `t.primary` …)으로만, 도형은 그림 재료 층(`src/kit/media.tsx`) 부품으로만 그린다.
  - 사진·영상은 `src/kit/picture.tsx`의 `Picture`로만 넣는다. 자료가 없을 때 쓸 대체 화면도 반드시 만든다.
  - 템플릿마다 `manifest.json`(명세)과 실제 예시(`examples`)를 둔다.
- **끝내기 전에 반드시:**
  1. `bin/studio check` → 문제 0건
  2. 타입 검사 (아래 명령) → 오류 0건
  3. `bin/studio gallery --only <템플릿>` (스타일을 빼면 showreel만) → `out/gallery/showreel/<템플릿>_0.png`를 직접 열어 보고, 글자 넘침·겹침·안 보이는 요소가 없는지 확인
  4. 무대 템플릿이면 릴 영상(`out/gallery/reel_showreel_partial.mp4`)에서 비트마다 프레임을 뽑아 확인
  5. 무엇을 했는지 [WORKLOG.md](WORKLOG.md)에 남긴다 (다른 세션의 에이전트가 이어받을 수 있게)
- 기존 템플릿을 고치면 같은 계획으로 렌더링한 결과가 바뀐다. 바꾸려는 것 외에는 결과가 그대로인지 갤러리로 비교한다.

## 명령

```bash
bin/studio check | list | styles
bin/studio gallery [스타일 …] [--only id,id]          # 스타일을 빼면 showreel만
bin/studio catalog --project longepass --style showreel
bin/studio validate raw.json --project longepass --style showreel --out plan.json
bin/studio preview job.json [--all]                   # 샷별 정지 화면만 빠르게
bin/studio render job.json [--no-render]
bin/lp where | new | status | plan | search | get | capture | add | tts | job | preview | render | thumb   # 에이전트 방식 (bin/lp 만 치면 사용법)
npx -y -p typescript@5 tsc --noEmit --jsx react-jsx --esModuleInterop --resolveJsonModule --skipLibCheck --strict \
  --moduleResolution bundler --module esnext --target es2022 src/motion/MotionVideo.tsx src/thumbnail/Thumbnail.tsx   # 타입 검사
```

새 세션에서 `node_modules`가 없으면 `npm ci`부터 한다 (없으면 타입 검사가 수백 개의 JSX 오류를 낸다).
프레임 하나 뽑기: `ffmpeg -ss <초> -i <영상> -frames:v 1 out/frame.png`
