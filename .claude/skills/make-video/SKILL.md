---
name: make-video
description: 초안(글·메모·기사·링크)을 받아 에이전트가 직접 분석·조사·자료 수집·구성·렌더링까지 해서 최종 영상(mp4)을 만든다. "이 초안으로 영상 만들어줘", "에이전트 방식으로 영상", /make-video 일 때 쓴다. 백엔드(py-macmini-server)가 job.json을 보내는 방식과는 별개다.
---

# 에이전트 방식 영상 제작

영상 제작 방식은 두 가지다 (WORKLOG.md 참고).
1. **백엔드 방식** — py-macmini-server가 계획·음성·이미지를 담은 job.json을 보내고 이 저장소는 렌더링만 한다.
2. **에이전트 방식 (이 스킬)** — 사람이 초안을 주면 에이전트가 내용을 분석하고, 이미지·관련 자료·추가 정보를 직접 찾아 넣어 최종 영상까지 렌더링한다.

렌더링 엔진과 템플릿은 두 방식이 같다. 다른 점은 계획(plan)과 자료(assets)를 누가 만드느냐뿐이다.

## 지켜야 할 것

- **저장소 코드에는 외부 호출을 넣지 않는다.** 자료 검색·다운로드·화면 캡처는 에이전트가 자기 도구(웹 검색, 웹 가져오기, 브라우저, 이미지 생성 도구 등 그 세션에서 쓸 수 있는 것)로 한다. 렌더링은 로컬 파일만 읽는다 (`assets`에 인터넷 주소를 넣으면 무시된다).
- **작업 파일은 전부 `out/agent/<slug>/` 안에.** (`out/`은 git에 들어가지 않는다)
- **지어내지 않는다.** 숫자·날짜·규정·인용은 출처를 확인한 것만 쓴다. 확인 못 한 것은 영상에 넣지 않거나 "확인 필요"로 사람에게 보고한다. `quote_card`는 실제 출처가 있을 때만 쓴다.
- **자료는 쓸 권리가 분명한 것만.** 다음 중 하나만 쓴다:
  - 직접 만든 것 (화면 캡처, 생성 이미지, 직접 그린 것)
  - 퍼블릭 도메인이나 CC0
  - CC BY 계열 (`credit`에 저작자와 라이선스를 적는다)
  - 정부 공개 자료 (출처를 적는다)
  - 사람이 준 것

  라이선스를 모르면 쓰지 않는다. 자료 칸을 비워 두면 템플릿이 아이콘 화면으로 대신 그린다.
- 운영 스타일은 **showreel** 하나다 (`--style showreel`). 다른 스타일은 고려하지 않는다.
- 화면 글자와 내레이션은 스타일 언어(**zh-tw, 대만 번체**)로 쓴다. 초안이 다른 언어여도 그렇다. 사람이 다르게 말하면 그 말을 따른다.

## 작업 폴더

```
out/agent/<slug>/
  draft.md          받은 초안 그대로
  notes.md          분석·조사 메모: 핵심 메시지, 확인한 사실과 출처 URL, 못 찾은 것
  assets/           모은 자료 (이미지·짧은 영상·화면 캡처)
  raw_plan.json     내가 쓴 계획
  plan.json         bin/studio validate 결과
  job.json          렌더링 작업 파일 (상대 경로는 이 폴더 기준)
  render/           최종 mp4·srt·json (render/preview/ = bin/studio preview 정지 화면)
```

## 순서

### 1. 분석 → notes.md
- 누가 보는 영상인지, 보고 나서 무엇을 하게 할지 (행동 하나).
- 핵심 메시지 3개 이내. 영상 길이는 초안 분량에 맞춘다 (보통 1~3분, 장 2~5개).
- 사실 확인이 필요한 문장, 그림이 필요한 장면 (사진 / 화면 캡처 / 인용), 숫자 장면 (counter, bar_chart …) 목록.

### 2. 조사와 자료 모으기 → notes.md, assets/
- 숫자와 규정은 공식 출처(정부·기관 원문)를 우선한다. 출처 URL과 확인 날짜를 notes.md에 남긴다.
- 그림이 필요한 장면마다 하나씩 구한다:

  | 장면 | 자료 | 템플릿 |
  |---|---|---|
  | 장소·사람·사물·현장 | 사진, 짧은 영상 (무음으로 쓰임) | `photo_full`, `photo_split`, `photo_collage` |
  | 근거가 되는 공식 페이지·앱 화면·문서 | 화면 캡처 PNG | `screen_focus` (확대할 영역을 0~1 비율로) |
  | 기관·기사·사람의 말 | (선택) 인물·기관 사진 | `quote_card` |

- 파일은 `assets/` 에 저장하고, 각 자료의 `credit`, `source`, `license`를 기록한다.
- 화면 캡처는 글자가 읽히게 폭 1200~1600px로 찍는다. `screen_focus.focus`에는 강조할 부분의 위치를 캡처 기준 비율로 적는다.
- 못 구하면 비워 둔다. 템플릿마다 `icon` 칸이 대체 그림이다.

### 3. 계획 쓰기 → raw_plan.json
- 쓸 수 있는 템플릿과 칸 목록:
  ```bash
  bin/studio catalog --project longepass --style showreel
  ```
- 형식 (백엔드 LLM이 쓰는 것과 같다):
  ```json
  {
    "video_title": "…", "description": "…", "hashtags": ["…"], "music_mood": "motivating",
    "thumbnail": {"layout": "focus", "text": "…", "emphasis": "…", "object": "certificate"},
    "chapters": [
      {"title": "장 제목", "shots": [
        {"module": "photo_full", "narration": "이 샷에서 읽을 문장", "data": {"image": "hero", "lines": ["…"], "icon": "train"},
         "cues": {"lines": ["내레이션 속 단어", "…"]}},
        {"module": "board", "data": {…}, "beats": [{"narration": "…", "data": {…}, "cues": {…}}]}
      ]}
    ]
  }
  ```
  - `data`의 asset 칸에는 job.json `assets`의 id를 쓴다 (또는 job 폴더 기준 파일 경로).
  - `cues`는 "이 요소가 나타날 때 말하는 단어"다. 그 샷의 내레이션에 실제로 있어야 한다.
  - `examples`의 모양은 `src/templates/<id>/manifest.json`의 `examples`를 본다.
- **화면이 단조롭지 않게** (이 저장소의 템플릿은 디자인을 공유해서 섞지 않으면 비슷해 보인다):
  - 같은 템플릿을 연달아 쓰지 않는다. 같은 갈래(category)를 세 번 연달아 쓰지 않는다.
  - 4~5샷마다 카드가 없는 화면을 하나 넣는다: `photo_full`, `word_slam`, `quote_card`, `contrast`, `counter`.
  - 근거가 있는 주장은 `screen_focus`나 `quote_card`로 출처를 직접 보여 준다.
  - `photo_split`의 `side`는 번갈아 쓴다.
  - 첫 샷(훅)은 `photo_full` 또는 `title_card`나 `headline`으로 강하게 연다. 마지막은 `outro`로 닫는다.

### 4. 검증 → plan.json
```bash
bin/studio validate out/agent/<slug>/raw_plan.json --project longepass --style showreel --out out/agent/<slug>/plan.json
```
- `report.replaced`: 형식이 틀려 `headline`으로 바뀐 샷이다. 반드시 고친다.
- `report.warnings`: 글자 수 초과 등. 화면에서 넘칠 수 있으니 줄인다.
- `report.variety`: 반복 경고. 가능하면 고친다.

### 5. 작업 파일 → job.json
```json
{
  "style": "showreel",
  "plan": { plan.json 내용 },
  "out_dir": "render",
  "name": "<slug>",
  "voices": [],
  "assets": {
    "hero": {"path": "assets/hero.jpg", "credit": "攝影：… / CC BY 4.0", "source": "https://…", "license": "CC BY 4.0", "focus": [0.5, 0.4]}
  }
}
```
**음성 (`voices`, 장마다 하나)**
- 음성 파일과 글자별 시각이 있으면 `{"audio": "ch00.mp3", "char_times": [[ms, ms], …], "clip_end": ms}`. 가장 정확하다.
- 음성 파일만 있으면 `{"audio": "ch00.mp3"}`. 글자를 음성 길이에 고르게 나눈다. 대략 맞는 수준이다.
- 비워 두면 `[]`. 음성 없이 자막과 음악만 나오고, 글자당 0.2초로 시각을 가정한다.
- 이 세션에서 TTS를 쓸 수 없으면 무음으로 만들고 그 사실을 보고한다. 음성 API를 저장소 코드에 넣지 않는다.

자세한 형식: `studio/render.py`, `studio/assets.py` 맨 위.

### 6. 프리뷰로 고치기 (전체 렌더링 전에 꼭)
```bash
bin/studio preview out/agent/<slug>/job.json --all
```
- `out/agent/<slug>/render/preview/shot_XX_<template>.png`를 하나씩 직접 열어 본다.
- 글자 넘침·겹침, 안 보이는 글자, 빈 화면, 자료가 잘못 잘림(→ `focus` 조정), 엉뚱한 사진이 있으면 고친다.
- 고칠 때는 raw_plan.json → 4번 → 6번을 반복한다.

### 7. 렌더링
```bash
bin/studio render out/agent/<slug>/job.json
bin/studio thumbnail <썸네일 작업 파일>      # 형식은 studio/thumbnail.py 맨 위 (style 생략 시 showreel)
```
- 결과는 `render/<slug>.mp4`, `.srt`, `.json`이다. `.json`의 `assets`가 출처 목록이고, `warnings`는 못 읽은 자료다.
- 장이 시작하는 곳과 사진 장면에서 프레임을 뽑아 다시 본다:
  ```bash
  ffmpeg -ss <초> -i render/<slug>.mp4 -frames:v 1 render/check_<초>.png
  ```

### 8. 보고
- 영상, 자막, 썸네일 경로.
- 영상 설명란에 넣을 출처 목록: `render/<slug>.json`의 `assets`와 `music`.
- 확인하지 못한 사실, 못 구한 자료(아이콘으로 대체된 장면), 음성이 없는지 여부.

## 템플릿이 모자랄 때
새 장면 모양이 필요하면 TEMPLATE_GUIDE.md를 따라 템플릿을 추가한다. 이때는 `CLAUDE.md`의 끝내기 전 확인을 지킨다.
