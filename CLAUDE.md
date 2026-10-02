# video-studio 작업 규칙 (에이전트용)

이 저장소는 영상 **렌더링 전용**이다. 여기서 일하는 에이전트는 템플릿을 만들고 고치고, 렌더링 결과를 확인한다.

## 지켜야 할 것

- **외부 호출 금지.** LLM/TTS/DB/업로드 API를 부르는 코드를 넣지 않는다. 네트워크가 필요한 패키지를 새로 들이지 않는다 (필요하면 사람에게 먼저 묻는다).
- **이 저장소 밖을 쓰지 않는다.** 결과는 `out/` 또는 작업 파일(job.json)이 지정한 `out_dir`에만.
- **템플릿 규칙은 [TEMPLATE_GUIDE.md](TEMPLATE_GUIDE.md)를 따른다.** 특히:
  - 색은 스타일 값(`surf`, `t.primary` …)으로만, 도형은 그림 재료 층(`src/kit/media.tsx`) 부품으로만 그린다.
  - 템플릿마다 `manifest.json`(명세)과 실제 예시(`examples`)를 둔다.
- **끝내기 전에 반드시:**
  1. `bin/studio check` → 문제 0건
  2. `bin/studio gallery --only <템플릿>` → `out/gallery/<스타일>/<템플릿>_0.png`를 직접 열어 보고, 글자 넘침·겹침·안 보이는 요소가 없는지 확인 (모든 스타일)
  3. 무대 템플릿이면 릴 영상(`out/gallery/reel_<스타일>_partial.mp4`)에서 비트마다 프레임을 뽑아 확인
- 기존 템플릿을 고치면 같은 계획으로 렌더링한 결과가 바뀐다. 바꾸려는 것 외에는 결과가 그대로인지 갤러리로 비교한다.

## 명령

```bash
bin/studio check | list | styles
bin/studio gallery [스타일 …] [--only id,id]
bin/studio render job.json [--no-render]
npx -y -p typescript@5 tsc --noEmit --jsx react-jsx --esModuleInterop --resolveJsonModule --skipLibCheck --strict \
  --moduleResolution bundler --module esnext --target es2022 src/motion/MotionVideo.tsx   # 타입 검사
```

프레임 하나 뽑기: `ffmpeg -ss <초> -i <영상> -frames:v 1 out/frame.png`
