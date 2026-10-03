# 모션 템플릿 작성 가이드

영상 한 편 = **프로젝트 스타일 × 그림 재료 × 장면마다 고른 템플릿**.
템플릿은 "무엇을 어떤 연출로 보여주나"만 정하고, 색·테두리·그림자·움직임 세기·음악·효과음 양은 스타일이,
선과 면을 어떤 재료로 그리나(깔끔한 벡터 / 손그림)는 그림 재료 층이 정한다.
그래서 같은 템플릿이 롱이패스에서는 남색/노랑으로, 다른 프로젝트에서는 그 프로젝트 모습으로 그려진다.

레퍼런스 영상에서 가져오는 것은 **연출 기법**(숫자가 올라가며 쌓이는 방식, 카드가 펼쳐지며 체크되는 방식 …)이지 겉모습이 아니다.

---

## 1. 폴더 구조

```
video-studio/
  styles/<name>.json            프로젝트 기본 스타일
  src/kit/                      모든 템플릿이 쓰는 공용 부품
    media.tsx                   그림 재료 층: Panel, Dot, Bar, Mark, SRect, SCircle, SPath, SLine, Icon, Person
    types.ts                    TemplateProps, Surface, Skin
    skin.ts                     enter/bounce/ease, cardStyle, colorCardStyle, highlightStyle …
    layout.ts                   useLayout(): 안전 영역 (여백, 제목 위치)
    parts.tsx                   Title, HighlightedText, Badge, CheckMark, tokenize, keepAll, fmt
    kinetic.tsx                 줄 단위로 떠오르는 큰 글자
    doodle.tsx                  관절 인형 (사람 픽토그램): Figure, POSES, blendPose
    stage.tsx                   무대 템플릿 공용: useBeat, poseAt/tween, StageCamera, BeatTitle, BeatNote, ItemCard
    objects.tsx                 사물 그림 (자격증, 지폐, 달력, 도장 …)
  src/templates/<id>/
    manifest.json               명세 (기준)
    <Component>.tsx             그리는 코드 (export default)
  src/templates/index.ts        자동 생성 (손으로 고치지 않음)
  studio/                       Python (표준 라이브러리만, 외부 호출 없음)
    catalog.py                  명세 로더/검증/LLM 설명/검사
    plan.py                     LLM 계획 검증·보정
    timeline.py                 박자 맞춤 타임라인 → Remotion props
    render.py                   작업 파일 → 영상/자막/메타
    gallery.py                  갤러리 렌더링
    styles.py                   스타일 로더/검사
  bin/studio                    명령 (catalog / validate / render / check / list / styles / gallery)
```

## 2. 새 템플릿 만드는 순서

1. `src/templates/<id>/` 폴더를 만든다. id는 소문자·숫자·밑줄.
2. `manifest.json`을 쓴다 (3장).
3. 컴포넌트를 쓴다 (4장의 규칙).
4. `bin/studio check` — 문제 0건이어야 하고, 통과하면 `index.ts`가 갱신된다.
5. `bin/studio gallery --only <id>` — 모든 스타일로 예시를 렌더링해 `out/gallery/index.html`에서 확인한다.
   글자가 넘치거나 겹치지 않는지, 어두운 면/밝은 면 모두에서 읽히는지 눈으로 본다.

## 3. manifest.json

| 항목 | 뜻 |
|---|---|
| `id` | 폴더 이름과 같아야 함 |
| `version` | 데이터 형식이 바뀌면 올린다 |
| `name` | 사람이 읽는 이름 (갤러리) |
| `component` | 컴포넌트 파일 이름 |
| `category` | opener · structure · emphasis · number · organize · compare · chart · space · outro |
| `inspired_by` | 어느 레퍼런스의 어떤 연출 기법에서 왔는지 |
| `scope` | `"common"`(모든 프로젝트) 또는 `["longepass"]`(전용) |
| `media` | 지원하는 그림 재료. `clean`(깔끔한 벡터), `sketch`(손그림). 재료 층 부품만 쓰면 둘 다 지원된다 |
| `continuity` | 지원하는 이어짐 방식. 지금은 `cut`(장면마다 새 화면) |
| `aspect` | 지원하는 화면비. `16:9`, 나중에 `9:16` |
| `llm` | false면 LLM 후보에서 빠짐 (챕터 카드처럼 시스템이 넣는 것) |
| `use_when` / `avoid_when` | LLM이 고르는 기준. **영어로**, 특정 프로젝트 내용 없이 |
| `fields` | LLM이 채울 칸 (아래) |
| `events` | 화면에서 일어나는 순간 (아래) |
| `sfx` | 이벤트별 효과음 종류 |
| `sfx_when` | data 조건에 따른 효과음 덮어쓰기. 예: `{"if": {"tone": "warning"}, "sfx": {"in": "error"}}` |
| `bg` | 강제 배경 역할 `base`·`alt`·`accent`·`deep`, 또는 `null`(챕터 기본 배경) |
| `duration` | 샷 길이 권장 범위(초) |
| `examples` | 실제로 채운 예시 1개 이상: `narration`, `data`, `cues`. 갤러리와 검사에 쓰인다 |

### fields

```json
"title": {"type": "text", "max": 16, "required": true, "desc": "선택: LLM에게 주는 힌트"}
```
- `text`(max 필수) · `number` · `int` · `bool` · `enum`(options) · `list`(item, min, max) · `object`(fields)
- 글자 수 `max`는 화면에 실제로 들어가는 길이로 정한다. 넘으면 경고가 남는다.
- 강조 칸 이름은 `highlight`, 취소선은 `strike`로 쓰면 "실제 문구 안에 있는지" 자동 검사된다.

### events

내레이션과 화면을 맞추는 핵심. LLM은 `cues`에 "이 순간에 말하는 단어"를 적고, 타임라인이 그 단어가 발화되는 프레임을 음악 박자에 맞춰 넣는다.

| kind | 뜻 | 단서가 없을 때 |
|---|---|---|
| `single` | 한 번 일어남. `at`=발화 구간 비율(0~1) | `at` 위치 (없거나 0이면 샷 시작 직후) |
| `each` | `of` 칸의 항목마다 하나 | 발화 구간에 고르게 (`start` 비율부터) |
| `stagger` | `of` 칸의 항목이 박자 간격으로 차오름 | 스타일의 `stagger_beats` 간격 |

선택 옵션: `when`(그 칸이 참일 때만), `after: {"event": "...", "gap": 프레임}`(다른 이벤트보다 늦게).
컴포넌트는 `ev.<이름>`으로 프레임(샷 시작 기준)을 받는다. `each/stagger`는 배열.

효과음 종류: pop, click, check, ding, glass, bong, swish_up, swish_down, glitch, scratch, error, question, whoosh, riser, impact, stamp
(차분한 스타일은 `sfx_replace`로 impact/stamp 등을 부드러운 소리로 바꾼다. 템플릿은 신경 쓰지 않아도 된다.)

### 무대 템플릿 (kind: "stage")

내레이션 여러 문장(비트)에 걸쳐 **같은 요소가 화면에 남아** 자리·크기·강조만 바뀌는 장면 (예: `board`, `flow`).

| 항목 | 뜻 |
|---|---|
| `kind` | `"stage"` (없으면 `"shot"`) |
| `fields` | 무대 전체 데이터 (카드 목록 등) |
| `beat_fields` | 비트마다 바뀌는 값 (배치, 제목, 강조 대상, 한 줄 설명) |
| `beat_events` / `beat_sfx` | 비트 안의 순간과 효과음. `beat_sfx.at` = 비트가 바뀌는 순간 (첫 비트 제외). 첫 비트에서만 일어나는 이벤트(요소 첫 등장)는 `"once": true` |
| `beats` | `{"min": 2, "max": 5}` |
| `examples[].beats` | `[{narration, data, cues}]` (예시의 내레이션은 비트들을 이은 것) |

컴포넌트는 `data.beats[i]`(비트 데이터)와 `ev.beats[i].at`(비트 시작 프레임) + 비트 이벤트를 받는다.
`kit/stage.tsx`를 쓴다:
- `useBeat(ev.beats)` → 지금 비트 `i`와 넘어가는 진행도 `p`
- 비트마다 "요소 id → 자리(Pose)" 표를 만들고 `poseAt(layouts, id, i, p)` / `tween()`으로 잇는다
  (이전 비트에 없던 요소는 떠오르며 나타나고, 지금 없는 요소는 사라진다)
- `StageCamera`(비트마다 보는 곳과 확대), `BeatTitle`(제목이 바뀔 때만 새로 등장), `BeatNote`, `ItemCard`(아이콘+이름 카드)

LLM은 무대 템플릿을 `{"module", "data", "beats": [{"narration", "data", "cues"}]}`로 쓴다 (프롬프트에 설명이 있다).

## 4. 컴포넌트 규칙

```tsx
const MyTemplate: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => { … };
export default MyTemplate;
```

0. **도형은 그림 재료 층으로만 그린다.** `<rect>`, `<path>`, `background:`, `borderRadius:`가 있으면 검사에서 실패한다.
   직접 그리면 손그림 같은 다른 재료에서 그 부분만 모습이 안 바뀐다.

   | 그리려는 것 | 부품 |
   |---|---|
   | 카드/상자/알약 (안에 글자) | `<Panel {...cardPanel(t, surf)}>`, `colorPanel(t, surf, color)`, 한쪽 색 띠는 `edge` |
   | 원 (번호, VS) | `<Dot size fill stroke>` |
   | 막대/선/밑줄/진행선/차트 막대 | `<Bar color style={{ width, height }}>` (세로는 `vertical`) |
   | 형광펜/알약 강조 | `<Mark style={highlightStyle(...)} />` |
   | SVG 안의 도형 | `SRect`, `SCircle`, `SPath`, `SLine` (`reveal`=선이 그려지는 진행도, `subtle`=손그림에서 윤곽만) |
   | 아이콘 | `<Icon name size color>` (Tabler 선 아이콘, 이름 목록은 `ICON_NAMES`) |
   | 사람 | `<Person variant="bust"|"standing">` |

   손그림 모양은 `seed`로 고정된다 (매 프레임 같은 모양). 같은 템플릿 안에서 반복되는 부품은 `seed={`row${i}`}`처럼 다르게 준다.
   `draw={p}`를 넘기면 손그림 재료에서 테두리가 그려지며 등장한다 (깔끔한 재료에서는 무시).
1. **색을 직접 쓰지 않는다.** `'#...'`가 있으면 검사에서 실패한다.
   - 배경 면 위 글자: `ink`, 보조 글자: `sub`
   - 카드: `cardStyle(t, surf)` / 색 카드: `colorCardStyle(t, surf, t.primary)`
   - 강조색: `t.primary`, `t.accent`, `t.accent2`, `t.danger`
   - 비활성 면: `surf.fill`, 한 단계 진한 중립: `surf.fillStrong`, 얇은 선: `surf.line`
   - 밝은 색 면 위 글자: `t.skin.onColorInk`, 진한 색 면 위 글자: `t.skin.onAccentInk`
2. **움직임은 스킨에서.** 등장은 `enter(t, frame, at, fps)`, 튀는 등장은 `bounce(…, extraDamping)`,
   이동은 `riseTransform(t, p)`. 직접 spring 값을 쓰지 않는다. 쾅/흔들림 같은 충격 연출은
   `t.skin.motion.impact`가 true일 때만.
3. **위치는 안전 영역에서.** 좌우 여백·제목 위치는 `useLayout()`(`padX`, `titleTop`, `contentTop`)을 쓴다.
4. **강조는 공용 부품으로.** 형광펜/알약은 `highlightStyle`, 문장 속 구절 강조는 `HighlightedText`.
   (어두운 면에서는 자동으로 밑줄 + 강조색 글자로 바뀐다)
5. **데이터 가공은 컴포넌트 안에서.** 글자 길이에 따른 크기, 열 수 같은 계산을 Python에 두지 않는다.
6. **선 두께는 `t.skin.objectStroke`.** 사물 그림(`kit/objects.tsx`)에 `sw`로 넘긴다.
7. 한중일 문장은 `keepAll`로 단어 중간 줄바꿈을 막는다.

## 5. 스타일 (styles/<name>.json)

새 프로젝트는 `longepass.json`을 복사해 바꾼다. 서버의 프로젝트 설정(`py-macmini-server/src/video_engine/projects.py`)의 `style`에 이름을 적으면 끝.

- `surfaces`: 역할별 면 색 (`base` 밝은 면, `alt` 어두운 면, `accent` 브랜드색 면, `deep` 챕터 카드)
  각 면: `bg, ink, sub, grid, card, cardInk, line, fill, fillStrong, dark?`
- `primary/accent/accent2/danger`, `font`, `mono`, `brand`
- `skin`: 테두리(`cardBorder`, `cardBorderColor`), `radius`, `shadow`(soft/offset/none), `objectStroke`,
  배경 무늬 `grid`(dots/lines/squares/none), `ring`, `beatPulse`, 강조 `highlight`(marker/pill),
  `colorful`, `captionBg`, `motion`(damping, stiffness, mass, distance, tilt, impact)
- `pacing`: `music`(기본 곡), `music_moods`(이 스타일이 허용하는 분위기 — 계획의 `music_mood`가 여기 있으면 그 분위기 곡 중 하나), 음악 크기(`music_open_lufs`, `music_under_voice_lufs`), `sfx_gain_db`,
  `stagger_sfx_every`, `stagger_beats`, `transition_frames`, `transitions`(chapter/counter/default),
  `transition_sfx`, `sfx_replace`
- `media`, `continuity`: 이 스타일이 쓰는 그림 재료와 이어짐 방식 (템플릿 후보를 거른다)
- `theme.media`: 재료 세부값. `{"kind": "clean"}` 또는
  `{"kind": "sketch", "roughness": 1.3, "bowing": 1.2, "fillStyle": "hachure", "hachureGap": 9, "fillWeight": 2.2}`
  손그림 스타일은 손글씨 글꼴(`'Jason Handwriting'`)과 `cardBorderColor: "ink"`, `shadow: "none"`이 잘 어울린다 (`styles/sketch_demo.json`)

## 7. 그림 재료 (사람·사물 일러스트) 확보 방식

| 재료 | 방식 | 쓰는 법 |
|---|---|---|
| 사람 | **관절 인형** `kit/doodle.tsx` — 코드로 그림, 라이선스 없음, 영상 내내 같은 사람 | `<Figure pose="cheer" size={360} color={...} draw={p} />`, 자세 사이는 `blendPose` |
| 사물 | **Tabler 선 아이콘 (MIT, react-icons/tb)** 중 `kit/media.tsx`의 `ICONS`에 등록한 것 | `<Icon name="calendar" size={220} color={...} sw={1.5} draw={p} />` |
| AI 생성 그림 | 쓰지 않음 (화풍·얼굴 일관성, 호출 비용, 벡터화하면 선 그리기 효과가 깨짐) | 꼭 필요하면 템플릿 단위로 별도 결정 |

- 자세 추가: `POSES`에 관절 각도를 더한다 (각도 0 = 아래, +90 = 오른쪽, ±180 = 위). 명세의 pose 선택지는 `POSE_NAMES`와 같아야 한다.
- 사물 추가: Tabler에서 이름을 찾아 `ICONS`에 `별명: 'Tb이름'`으로 더한다. 명세의 선택지는 검사가 `ICONS`와 대조한다.
- 둘 다 그림 재료 층 부품으로 그려져서 손그림 재료에서는 마커로 그린 모습이 되고, `draw`로 그려지며 등장한다.

## 8. 새 그림 재료 추가

`src/kit/media.tsx`의 부품마다 분기를 하나씩 더하고, `studio/styles.py`의 `MEDIA_KINDS`에 이름을 넣는다.
템플릿은 고칠 필요가 없다. 갤러리로 모든 템플릿이 새 재료에서 읽히는지 확인한 뒤 각 명세의 `media`에 추가한다.

## 6. 프로젝트 전용 규칙

LLM 계획 프롬프트와 프로젝트 전용 규칙(브랜드 표기, 통화 기호 등)은 서버 쪽에 있다
(`py-macmini-server/assets/prompts/video_engine/` 의 `script.md`(대본) · `direction.md`(연출, 템플릿 설명이 들어감) · `repair.md`(고치기), `projects.py`의 `plan_rules`).
studio는 그 프롬프트에 들어갈 템플릿 설명(`bin/studio catalog`)만 만든다.
