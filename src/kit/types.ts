import type { MediaSpec } from './media';

/** 배경 면 하나의 색 세트 */
export interface Surface {
  bg: string;
  ink: string;      // 글자
  sub: string;      // 보조 글자/그림자 색
  grid: string;     // 배경 무늬
  card: string;     // 카드 배경
  cardInk: string;  // 카드 위 글자
  line: string;     // 얇은 선
  fill: string;     // 비활성 데이터 면 (선택 안 된 막대, 지도 땅)
  fillStrong: string; // 한 단계 진한 중립색 (지도 '그 외' 그룹 등)
  dark?: boolean;
}

/**
 * 프로젝트 스타일 프로필의 "겉모습" 값.
 * 모듈은 색/테두리/그림자/움직임을 직접 정하지 않고 여기서 받는다 (같은 모듈, 다른 프로젝트 모습).
 */
export interface Skin {
  cardBorder: number;                  // 카드 테두리 두께
  cardBorderColor: 'ink' | 'line';     // 굵은 글자색 테두리 vs 얇은 선
  radius: number;
  shadow: 'soft' | 'offset' | 'none';
  objectStroke: number;                // 사물 그래픽 선 두께
  grid: 'lines' | 'squares' | 'dots' | 'none';  // 배경 무늬 (노트 줄 / 격자 / 점 / 없음)
  ring: boolean;                       // 회전하는 장식 링
  beatPulse: boolean;                  // 박자마다 배경이 숨쉬는 효과
  highlight: 'marker' | 'pill';        // 강조: 형광펜 / 알약 배경
  onColorInk: string;                  // 밝은 색 면(노랑·초록) 위 글자색
  onAccentInk: string;                 // 진한 색 면(파랑·빨강) 위 글자색
  colorful: boolean;                   // 타일/카드를 여러 색으로 칠할지 (false = 흰 카드 + 강조색 일부)
  captionBg: string;                   // 자막 바탕
  motion: {
    damping: number; stiffness: number; mass: number;
    distance: number;  // 등장 시 이동 거리(px)
    tilt: number;      // 등장 시 기울기(도). 0이면 기울지 않음
    impact: boolean;   // 숫자 쾅/화면 흔들림/도장 낙하 같은 충격 연출
  };
}

export interface MotionTheme {
  font: string;
  mono: string;
  surfaces: Record<string, Surface>;
  primary: string;
  accent: string;
  accent2: string;
  danger: string;
  brand: { parts: Array<{ text: string; accent?: boolean }>; suffix?: string; tagline?: string };
  primary_surface?: string;   // 주 바탕 (첫 화면·마지막 화면·썸네일·쇼츠). 없으면 base
  skin: Skin;
  media?: MediaSpec;   // 그림 재료 (없으면 clean)
  lang?: string;       // 화면 글자 언어 (zh-tw, ko, en …). 템플릿 기본 이름표 등에 쓴다
}

/** 한 샷 안에 겹쳐 그리는 레이어. ev는 Python이 계산한 이벤트 프레임(샷 시작 기준) */
export interface Layer {
  module: string;
  data: Record<string, any>;
  ev: Record<string, any>;
}

export interface Shot {
  id: string;
  label: string;
  bg: string;
  start: number;
  duration: number;
  layers: Layer[];
  exit?: boolean;
}

export interface Transition {
  type: 'stripes' | 'glitch' | 'flash' | 'iris' | 'fade' | 'slide';
  frame: number;        // 컷이 일어나는 프레임 (전환의 가운데)
  duration: number;
  colors?: string[];
}

export interface AudioClip { src: string; from: number; duration: number; volume?: number; trimBefore?: number }

export interface MotionCaption { text: string; start: number; end: number; highlight?: string[] }

export interface MotionProps {
  width: number;
  height: number;
  fps: number;
  total_frames: number;
  bpm: number;
  beat_frames: number[];
  theme: MotionTheme;
  shots: Shot[];
  transitions: Transition[];
  voice: AudioClip[];
  sfx: AudioClip[];
  music?: { src: string; trimBefore: number; open: number; under_voice: number } | null;
  narration_intervals: Array<[number, number]>;
  captions: MotionCaption[];
  hud?: { title?: string; meta?: string; emphasis?: string };   // 세로 쇼츠: title = 위 제목 띠(\n 줄바꿈), emphasis = 그중 강조
  chapters?: Array<{ title: string; start: number }>;
}

/** 모든 템플릿이 받는 값. data = 명세(manifest.json)의 fields, ev = 명세의 events (샷 시작 기준 프레임) */
export interface TemplateProps {
  data: Record<string, any>;
  ev: Record<string, any>;
  dur: number;
  ink: string;
  sub: string;
  surf: Surface;
}
