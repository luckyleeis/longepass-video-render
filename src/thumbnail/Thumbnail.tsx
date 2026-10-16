import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import { MotionTheme, Surface } from '../kit/types';
import { MotionThemeProvider } from '../kit/theme';
import { useFontsReady } from '../kit/fonts';
import { highlightInk, highlightStyle } from '../kit/skin';
import { keepAll } from '../kit/parts';
import { Dot, Mark, Panel, SCircle } from '../kit/media';
import {
  Bill, CalendarPage, Certificate, DocumentSheet, IdCard, Passbook,
  Car, Scooter, WarningSign, SpeedLimitSign, TrafficLight, StampMark
} from '../kit/objects';

export type ThumbnailLayout = 'focus' | 'split' | 'stat' | 'quiz' | 'photo_hero' | 'vs_split' | 'warning_dark' | 'evidence_doc';

export interface SplitItem {
  text: string;
  tag?: string;
  object?: string;
  label?: string;
  is_good?: boolean;
  photo?: string;
  sub_text?: string;
}

/**
 * 유튜브 썸네일: 가로 롱폼 (1280x720 기준), 세로 쇼츠 표지 (1080x1920, H > W 이면).
 * layout:
 *   - 'focus' (기본): 텍스트 + 대형 사물 1개
 *   - 'split': 좌우 (또는 상하) 비교/대조 (VS)
 *   - 'stat': 초대형 수치/통계 강조
 *   - 'quiz': 문제/표지판 중심의 퀴즈형
 *   - 'photo_hero': 실사 사진 배경/중심 + 고대비 볼드 타이포 + 다크 비네팅 (클릭률 극대화)
 *   - 'vs_split': 실사/컬러 극적 대조 비교 (Red vs Green, ❌ vs ⭕)
 *   - 'warning_dark': 칠흑 같은 다크 배경 + 옐로우/레드 경고 테이프/마크
 */
export interface ThumbnailProps {
  width: number;
  height: number;
  theme: MotionTheme;
  text: string;
  emphasis?: string;
  badge?: string;
  sub_text?: string;
  object?: string;
  object_label?: string;
  layout?: ThumbnailLayout;
  surface?: string;
  stat?: string;
  stat_unit?: string;
  split_left?: SplitItem;
  split_right?: SplitItem;
  photo?: string;
  photo_dim?: number;
  kicker?: string;
  tag?: string;
  stamp?: string;
  accent_bar?: string;
}

/**
 * WCAG 2.1 상대 휘도 (Relative Luminance) 계산
 */
export const getLuminance = (hex: string): number => {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return 0.5;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
};

/**
 * WCAG 대비율 (Contrast Ratio) 계산
 */
export const getContrastRatio = (fgHex: string, bgHex: string): number => {
  const l1 = getLuminance(fgHex);
  const l2 = getLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * 배경과 최소 4.5:1 대비를 보장하는 전경색 선택.
 * preferred 대비가 4.5 이상이면 유지, 미만이면 fallback(surf.ink 등) 사용.
 */
export const contrastSafe = (preferred: string, bg: string, fallback: string): string => {
  const ratio = getContrastRatio(preferred, bg);
  if (ratio >= 4.5) return preferred;
  const fbRatio = getContrastRatio(fallback, bg);
  if (fbRatio >= 4.5) return fallback;
  return fbRatio >= ratio ? fallback : preferred;   // 둘 다 모자라면 그나마 나은 쪽 (스타일 밖의 색을 만들지 않는다)
};

/**
 * 썸네일 수치 강조용 안전 색상 및 그림자
 */
export const getStatColor = (surf: Surface, t: MotionTheme): string => {
  return contrastSafe(t.primary, surf.bg, surf.ink);
};

export const getStatShadow = (statColor: string, surf: Surface): string => {
  const isDarkBg = getLuminance(surf.bg) < 0.4;
  return isDarkBg ? `0 4px 20px ${statColor}60` : `0 4px 16px rgba(0,0,0,0.12)`;
};

const BRACKET_PAIRS: [string, string][] = [
  ['【', '】'],
  ['（', '）'],
  ['(', ')'],
  ['「', '」'],
  ['『', '』'],
  ['[', ']'],
  ['《', '》'],
  ['〈', '〉'],
];

// 행두 금칙 문자 (줄의 시작에 올 수 없는 문자)
const LINE_START_FORBIDDEN = new Set([
  '】', '）', ')', '」', '』', ']', '》', '〉',
  '，', '。', '、', '！', '？', '：', '；',
  ',', '.', '!', '?', ':', ';'
]);

// 행말 금칙 문자 (줄의 끝에 올 수 없는 문자)
const LINE_END_FORBIDDEN = new Set([
  '【', '（', '(', '「', '『', '[', '《', '〈'
]);

/**
 * 큰 글자를 2줄로 분할.
 * - \n 우선 분할
 * - 괄호 쌍 내부 분할 절대 금지 (괄호 찢어짐 방지)
 * - 행두/행말 금칙 처리 준수
 * - 괄호 직전/직후 및 의미 단위 경계 최우선 분할
 */
export const splitLines = (text: string, emphasis?: string): string[] => {
  if (text.includes('\n')) return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
  const t = text.trim();
  if (t.length <= 8) return [t];

  // 1. 괄호 쌍 범위 [start, end] 수집 (구간 내부 분할 방지)
  const forbiddenRanges: [number, number][] = [];
  for (const [openCh, closeCh] of BRACKET_PAIRS) {
    let startIdx = 0;
    while ((startIdx = t.indexOf(openCh, startIdx)) !== -1) {
      const endIdx = t.indexOf(closeCh, startIdx + 1);
      if (endIdx !== -1) {
        forbiddenRanges.push([startIdx, endIdx]);
        startIdx = endIdx + 1;
      } else {
        break;
      }
    }
  }

  const isInsideBracket = (idx: number) => {
    return forbiddenRanges.some(([s, e]) => idx > s && idx <= e);
  };

  const mid = t.length / 2;
  const isWord = (c: string) => /[A-Za-z0-9]/.test(c);

  // 2. 분할 후보점 점수 평가
  interface Candidate {
    pos: number;
    score: number;
  }
  const cands: Candidate[] = [];

  for (let i = 2; i < t.length - 1; i++) {
    // 괄호 쌍 내부 분할 절대 금지
    if (isInsideBracket(i)) continue;

    // 행두 금칙 위반 배제
    if (LINE_START_FORBIDDEN.has(t[i])) continue;

    // 행말 금칙 위반 배제
    if (LINE_END_FORBIDDEN.has(t[i - 1])) continue;

    // 영문/숫자 단어 중간 분할 금지
    if (isWord(t[i - 1]) && isWord(t[i])) continue;

    let bonus = 0;

    // 괄호 열리기 직전 또는 닫힌 직후 가중치
    for (const [s, e] of forbiddenRanges) {
      if (i === s) bonus += 50;
      if (i === e + 1) bonus += 40;
    }

    // 공백 위치 분할 가중치
    if (t[i - 1] === ' ') bonus += 35;

    // 문장 부호 뒤 분할 가중치
    if ('，,！!？?：: 、'.includes(t[i - 1])) bonus += 35;

    // 강조 구절 경계
    if (emphasis && t.includes(emphasis)) {
      const a = t.indexOf(emphasis);
      if (i === a || i === a + emphasis.length) bonus += 25;
    }

    // 가운데(mid)와의 거리 페널티 (1자당 -3점)
    const distPenalty = Math.abs(i - mid) * 3;
    cands.push({ pos: i, score: bonus - distPenalty });
  }

  if (cands.length > 0) {
    cands.sort((a, b) => b.score - a.score);
    const best = cands[0].pos;
    return [t.slice(0, best).trim(), t.slice(best).trim()].filter(Boolean);
  }

  // 후보가 없을 경우 안전한 폴백 위치 탐색
  let cut = Math.ceil(mid);
  for (const [s, e] of forbiddenRanges) {
    if (cut > s && cut <= e) {
      cut = Math.abs(s - mid) < Math.abs(e + 1 - mid) ? s : e + 1;
      break;
    }
  }

  if (cut < t.length && LINE_START_FORBIDDEN.has(t[cut])) cut += 1;
  if (cut > 0 && LINE_END_FORBIDDEN.has(t[cut - 1])) cut -= 1;
  while (cut < t.length - 1 && isWord(t[cut - 1]) && isWord(t[cut])) cut += 1;

  cut = Math.max(1, Math.min(cut, t.length - 1));
  return [t.slice(0, cut).trim(), t.slice(cut).trim()].filter(Boolean);
};

/**
 * 문자열의 시각적 너비 가중치 계산 (CJK = 1.0, 영문/숫자/기호/공백 = 0.55)
 */
export const getVisualTextLength = (str: string): number => {
  let len = 0;
  for (const ch of str) {
    len += /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\uac00-\ud7af]/.test(ch) ? 1.0 : 0.55;
  }
  return Math.max(len, 1);
};

/**
 * 줄바꿈 없는(whiteSpace: nowrap) 텍스트를 위해 가용 너비(availWidth)에 맞춰
 * 폰트 크기를 자동으로 계산. 절대 줄바꿈이 일어나지 않도록 보장.
 */
export const calcAutoFontSize = (
  lines: string[],
  availWidth: number,
  maxSize: number,
  minSize: number = 40
): number => {
  if (!lines || lines.length === 0) return maxSize;
  const maxLineLen = Math.max(...lines.map(getVisualTextLength));
  const fitted = Math.floor(availWidth / (maxLineLen * 1.02));
  return Math.max(minSize, Math.min(maxSize, fitted));
};

/**
 * 텍스트 라인 분할: 사용자가 명시한 \n이 있으면 \n 기준 분할.
 * autoSplit이 false이면 임의로 줄을 쪼개지 않고 단일 라인 유지 (auto-fit 폰트 크기로 한 줄 보장).
 */
export const getTitleLines = (text: string, autoSplit = false, emphasis?: string): string[] => {
  if (!text) return [];
  if (text.includes('\n')) {
    return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
  }
  if (!autoSplit) {
    return [text.trim()];
  }
  return splitLines(text, emphasis);
};

const ObjectArt: React.FC<{ name?: string; label?: string; t: MotionTheme; size: number }> = ({ name, label, t, size }) => {
  const ink = t.skin.onColorInk, sw = t.skin.objectStroke + 1;
  switch (name) {
    case 'cash': return <Bill w={size} sw={sw} color={t.accent2} ink={ink} />;
    case 'document': return <DocumentSheet w={size * 0.72} sw={sw} ink={ink} accent={t.primary} title={label || '申請書'} />;
    case 'calendar': return <CalendarPage w={size * 0.75} sw={sw} ink={ink} accent={t.danger} big={label || '90'} />;
    case 'idcard': return <IdCard w={size} sw={sw} ink={ink} accent={t.accent} />;
    case 'passbook': return <Passbook w={size * 0.68} sw={sw} ink={ink} accent={t.accent2} />;
    case 'car': return <Car w={size} sw={sw} color={t.accent} ink={ink} accent={t.primary} />;
    case 'scooter': return <Scooter w={size * 0.85} sw={sw} color={t.primary} ink={ink} accent={t.accent} />;
    case 'sign_warning': return <WarningSign w={size * 0.85} sw={sw} color={t.primary} ink={ink} label={label || '!'} />;
    case 'speed_limit': return <SpeedLimitSign w={size * 0.8} sw={sw} ink={ink} label={label || '50'} danger={t.danger} />;
    case 'traffic_light': return <TrafficLight w={size * 0.45} sw={sw} ink={ink} active="red" />;
    case 'stamp': return <StampMark d={size * 0.75} color={t.danger} text={label || '合格'} />;
    default: return <Certificate w={size} sw={sw} primary={t.primary} ink={ink} title={label || '技術士證'} />;
  }
};

/** 큰 글자 줄들 (강조 구절은 형광펜) */
/** 전각 여는 괄호: 글리프가 칸의 오른쪽 절반에 그려져 줄 첫머리에서 들여쓴 것처럼 보인다 */
const OPEN_BRACKETS = ['【', '（', '「', '『', '《', '〈', '〔'];

const BigLines: React.FC<{ lines: string[]; emphasis?: string; size: number; surf: Surface; t: MotionTheme; align?: 'left' | 'center' }> = ({
  lines, emphasis, size, surf, t, align = 'left'
}) => (
  <>
    {lines.map((line, i) => {
      const parts = emphasis && line.includes(emphasis) ? line.split(emphasis) : null;
      return (
        <div key={i} style={{ ...keepAll, fontSize: size, fontWeight: 900, lineHeight: 1.15, color: surf.ink, letterSpacing: '-0.03em', whiteSpace: 'nowrap', textAlign: align,
          marginLeft: align === 'left' && OPEN_BRACKETS.includes(line[0]) ? -size * 0.5 : 0 }}>
          {parts ? (
            <>
              {parts[0]}
              <span style={{ position: 'relative', display: 'inline-block' }}>
                <Mark style={highlightStyle(t, surf, 1, size)} seed={`thumb-hl${i}`} />
                <span style={{ position: 'relative', zIndex: 1, color: highlightInk(t, surf, surf.ink) }}>{emphasis}</span>
              </span>
              {parts.slice(1).join(emphasis)}
            </>
          ) : line}
        </div>
      );
    })}
  </>
);

const BrandFooter: React.FC<{ t: MotionTheme; surf: Surface; s: number }> = ({ t, surf, s }) => (
  <div style={{ position: 'absolute', left: 64 * s, bottom: 36 * s, fontSize: 32 * s, fontWeight: 900, letterSpacing: '-0.01em' }}>
    {t.brand.parts.map((p, i) => (
      <span key={i} style={{ color: p.accent ? t.primary : surf.ink }}>{p.text}</span>
    ))}
    {t.brand.suffix && <span style={{ color: surf.sub, fontSize: 24 * s, marginLeft: 10 * s }}>{t.brand.suffix}</span>}
  </div>
);

// ----------------------------------------------------
// 16:9 가로 레이아웃들
// ----------------------------------------------------

/** 1. 기본 집중형: 좌측 텍스트 + 우측 대형 사물 */
const LandscapeFocus: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, theme: t, text, emphasis, badge, sub_text, object, object_label, s, surf } = props;
  const lines = getTitleLines(text || '', true, emphasis);
  const size = calcAutoFontSize(lines, (W * 0.56) * s, 132 * s, 44 * s);

  return (
    <>
      {/* 우측 사물 + 은은한 원광 */}
      <div style={{ position: 'absolute', right: -60 * s, top: '50%', width: 560 * s, height: 560 * s, marginTop: -280 * s, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.primary}40 0%, ${t.primary}10 55%, transparent 70%)` }} />
      <div style={{ position: 'absolute', right: 70 * s, top: '50%', transform: 'translateY(-50%) rotate(-6deg)' }}>
        <ObjectArt name={object} label={object_label} t={t} size={420 * s} />
      </div>

      {/* 좌측 글자 영역 */}
      <div style={{ position: 'absolute', left: 64 * s, top: 0, bottom: 0, width: W * 0.6, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {badge && (
          <div style={{ display: 'flex', marginBottom: 24 * s }}>
            <Panel fill={t.primary} radius={10 * s} seed="thumb-badge" style={{ ...keepAll, padding: `${8 * s}px ${22 * s}px`, color: t.skin.onColorInk, fontSize: 36 * s, fontWeight: 900 }}>
              {badge}
            </Panel>
          </div>
        )}
        <BigLines lines={lines} emphasis={emphasis} size={size} surf={surf} t={t} />
        {sub_text && (
          <div style={{ marginTop: 22 * s, fontSize: 34 * s, fontWeight: 700, color: surf.sub, letterSpacing: '-0.02em' }}>
            {sub_text}
          </div>
        )}
      </div>
      <BrandFooter t={t} surf={surf} s={s} />
    </>
  );
};

/** 2. 분할 대비형 (Split): 좌우 2분할 비교 (VS) */
const LandscapeSplit: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, height: H, theme: t, text, badge, split_left, split_right, s, surf } = props;
  const left = split_left || { text: '這情況會開罰？', tag: '注意', object: 'sign_warning' };
  const right = split_right || { text: '正確做法一覽', tag: '解答', object: 'certificate', is_good: true };
  const cardAvailWidth = ((W / 2) - 100 * s);
  const leftSize = calcAutoFontSize([left.text], cardAvailWidth, 44 * s, 26 * s);
  const rightSize = calcAutoFontSize([right.text], cardAvailWidth, 44 * s, 26 * s);

  return (
    <>
      {/* 상단 공통 헤더/배지 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 40 * s, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        {badge ? (
          <Panel fill={t.primary} radius={10 * s} seed="thumb-split-badge" style={{ ...keepAll, padding: `${8 * s}px ${24 * s}px`, color: t.skin.onColorInk, fontSize: 32 * s, fontWeight: 900 }}>
            {badge}
          </Panel>
        ) : (
          <div style={{ fontSize: 36 * s, fontWeight: 900, color: surf.ink }}>{text}</div>
        )}
      </div>

      {/* 좌측 카드 */}
      <Panel fill={left.is_good ? `${t.accent2}18` : `${t.danger}18`} stroke={left.is_good ? t.accent2 : t.danger} sw={3} radius={24 * s} seed="thumb-split-l"
        style={{ position: 'absolute', left: 40 * s, top: 110 * s, bottom: 80 * s, width: (W / 2) - 60 * s, boxSizing: 'border-box',
          padding: 32 * s, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
        {left.tag && (
          <Panel fill={left.is_good ? t.accent2 : t.danger} radius={12 * s} seed="thumb-split-ltag"
            style={{ padding: `${6 * s}px ${20 * s}px`, color: left.is_good ? t.skin.onColorInk : t.skin.onAccentInk, fontSize: 28 * s, fontWeight: 900 }}>
            {left.tag}
          </Panel>
        )}
        <div style={{ transform: 'scale(0.85)' }}>
          <ObjectArt name={left.object} label={left.label} t={t} size={280 * s} />
        </div>
        <div style={{ fontSize: leftSize, fontWeight: 900, color: surf.ink, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
          {left.text}
        </div>
      </Panel>

      {/* 중앙 VS 배지 */}
      <Dot size={86 * s} fill={t.primary} stroke={surf.bg} sw={4} seed="thumb-vs"
        style={{ position: 'absolute', left: '50%', top: '52%', transform: 'translate(-50%, -50%)', zIndex: 20, boxSizing: 'border-box',
          color: t.skin.onColorInk, fontSize: 34 * s, fontWeight: 900, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
        VS
      </Dot>

      {/* 우측 카드 */}
      <Panel fill={right.is_good ? `${t.accent2}18` : `${t.accent}18`} stroke={right.is_good ? t.accent2 : t.primary} sw={3} radius={24 * s} seed="thumb-split-r"
        style={{ position: 'absolute', right: 40 * s, top: 110 * s, bottom: 80 * s, width: (W / 2) - 60 * s, boxSizing: 'border-box',
          padding: 32 * s, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
        {right.tag && (
          <Panel fill={right.is_good ? t.accent2 : t.primary} radius={12 * s} seed="thumb-split-rtag"
            style={{ padding: `${6 * s}px ${20 * s}px`, color: t.skin.onColorInk, fontSize: 28 * s, fontWeight: 900 }}>
            {right.tag}
          </Panel>
        )}
        <div style={{ transform: 'scale(0.85)' }}>
          <ObjectArt name={right.object} label={right.label} t={t} size={280 * s} />
        </div>
        <div style={{ fontSize: rightSize, fontWeight: 900, color: surf.ink, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
          {right.text}
        </div>
      </Panel>

      <BrandFooter t={t} surf={surf} s={s} />
    </>
  );
};

/** 3. 수치/핵심 강조형 (Stat): 거대한 숫자 + 핵심 카피 */
const LandscapeStat: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, theme: t, text, emphasis, badge, sub_text, stat, stat_unit, object, object_label, s, surf } = props;
  const lines = getTitleLines(text || '', true, emphasis);
  const displayStat = stat || '3,600';
  const displayUnit = stat_unit || '元';
  const statColor = getStatColor(surf, t);
  const statShadow = getStatShadow(statColor, surf);

  // 긴 텍스트 줄바꿈 시 우측 사물과 겹치지 않도록 자동 크기 스케일링
  const textSize = calcAutoFontSize(lines, (W * 0.58) * s, 72 * s, 34 * s);

  return (
    <>
      {/* 우측 사물 배경 */}
      <div style={{ position: 'absolute', right: 60 * s, top: '50%', transform: 'translateY(-50%) rotate(5deg)', opacity: 0.85 }}>
        <ObjectArt name={object || 'cash'} label={object_label} t={t} size={380 * s} />
      </div>

      {/* 좌측 콘텐츠 */}
      <div style={{ position: 'absolute', left: 70 * s, top: 0, bottom: 0, width: W * 0.65, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {badge && (
          <div style={{ display: 'flex', marginBottom: 16 * s }}>
            <Panel fill={t.primary} radius={10 * s} seed="thumb-stat-badge" style={{ ...keepAll, padding: `${6 * s}px ${20 * s}px`, color: t.skin.onColorInk, fontSize: 32 * s, fontWeight: 900 }}>
              {badge}
            </Panel>
          </div>
        )}
        {/* 초대형 수치 (대비 보장 색상 적용) */}
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 12 * s, fontFamily: t.mono || t.font }}>
          <span style={{ fontSize: 136 * s, fontWeight: 900, color: statColor, lineHeight: 1, letterSpacing: '-0.04em', textShadow: statShadow }}>
            {displayStat}
          </span>
          <span style={{ fontSize: 64 * s, fontWeight: 900, color: surf.ink, marginLeft: 14 * s }}>
            {displayUnit}
          </span>
        </div>
        {/* 메인 텍스트 */}
        <BigLines lines={lines} emphasis={emphasis} size={textSize} surf={surf} t={t} />
        {sub_text && (
          <div style={{ marginTop: 18 * s, fontSize: 34 * s, fontWeight: 800, color: t.danger, letterSpacing: '-0.01em' }}>
            {sub_text}
          </div>
        )}
      </div>
      <BrandFooter t={t} surf={surf} s={s} />
    </>
  );
};

/** 4. 퀴즈/의문형 (Quiz): 호기심 유발 및 문제 그래픽 중심 */
const LandscapeQuiz: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, theme: t, text, emphasis, badge, sub_text, object, object_label, s, surf } = props;
  const lines = getTitleLines(text || '', true, emphasis);
  const size = calcAutoFontSize(lines, (W * 0.58) * s, 84 * s, 40 * s);

  return (
    <>
      {/* 우측 문제/표지판 그래픽 + 물음표 도장 */}
      <div style={{ position: 'absolute', right: 90 * s, top: '50%', transform: 'translateY(-50%)' }}>
        <div style={{ position: 'relative' }}>
          <ObjectArt name={object || 'sign_warning'} label={object_label} t={t} size={420 * s} />
          {/* 거대 물음표/퀴즈 표식 */}
          <Dot size={110 * s} fill={t.danger} seed="thumb-quiz-mark"
            style={{ position: 'absolute', right: -24 * s, top: -24 * s, color: t.skin.onAccentInk,
              fontSize: 72 * s, fontWeight: 900, boxShadow: '0 6px 20px rgba(0,0,0,0.3)', transform: 'rotate(12deg)' }}>
            ?
          </Dot>
        </div>
      </div>

      {/* 좌측 질문 카피 */}
      <div style={{ position: 'absolute', left: 70 * s, top: 0, bottom: 0, width: W * 0.58, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 12 * s, marginBottom: 24 * s }}>
          <Panel fill={t.danger} radius={10 * s} seed="thumb-q-badge" style={{ ...keepAll, padding: `${8 * s}px ${20 * s}px`, color: t.skin.onAccentInk, fontSize: 34 * s, fontWeight: 900 }}>
            {badge || '考照必答'}
          </Panel>
          <Panel fill={t.primary} radius={10 * s} seed="thumb-q-badge2" style={{ ...keepAll, padding: `${8 * s}px ${20 * s}px`, color: t.skin.onColorInk, fontSize: 34 * s, fontWeight: 900 }}>
            這題你會嗎？
          </Panel>
        </div>
        <BigLines lines={lines} emphasis={emphasis} size={size} surf={surf} t={t} />
        {sub_text && (
          <div style={{ marginTop: 22 * s, fontSize: 36 * s, fontWeight: 800, color: surf.sub }}>
            {sub_text}
          </div>
        )}
      </div>
      <BrandFooter t={t} surf={surf} s={s} />
    </>
  );
};

const StampBadge: React.FC<{ text: string; color: string; size?: number; rotate?: number }> = ({ text, color, size = 32, rotate = -8 }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `3px solid ${color}`,
    borderRadius: 8,
    padding: '4px 14px',
    color: color,
    fontWeight: 900,
    fontSize: size,
    letterSpacing: '0.04em',
    transform: `rotate(${rotate}deg)`,
    boxShadow: `0 0 16px ${color}33`,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(4px)',
    whiteSpace: 'nowrap',
  }}>
    {text}
  </div>
);

/** 5. 실사 포커스형 (Photo Hero): 고화질 사진 배경 + 다크 비네팅 + 초강력 볼드 타이포 */
const LandscapePhotoHero: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, theme: t, text, emphasis, badge, sub_text, stat, stat_unit, photo, kicker, tag, stamp, s } = props;
  const lines = getTitleLines(text || '', false, emphasis);
  const size = calcAutoFontSize(lines, (W * 0.62) * s, 120 * s, 48 * s);

  return (
    <>
      {/* 배경 사진 + 다크 비네팅 오버레이 */}
      {photo && (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <Img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* 어두운 그라디언트: 좌측 텍스트 영역을 집중적으로 어둡게, 우측 인물은 살림 */}
          <AbsoluteFill style={{
            background: `linear-gradient(90deg, rgba(8,14,26,0.98) 0%, rgba(8,14,26,0.90) 44%, rgba(8,14,26,0.45) 75%, rgba(8,14,26,0.2) 100%)`
          }} />
          <AbsoluteFill style={{
            background: `radial-gradient(circle at 75% 50%, transparent 40%, rgba(8,14,26,0.7) 100%)`
          }} />
        </AbsoluteFill>
      )}

      {/* 우측 상단/중앙 스탬프 */}
      {stamp && (
        <div style={{ position: 'absolute', right: 80 * s, top: 60 * s, zIndex: 10 }}>
          <StampBadge text={stamp} color={t.danger} size={42 * s} rotate={10} />
        </div>
      )}

      {/* 좌측 메인 콘텐츠 */}
      <div style={{ position: 'absolute', left: 80 * s, top: 0, bottom: 0, width: W * 0.62, display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 5 }}>
        {/* 상단 키커 / 배지 묶음 (간결하게 1~2개만) */}
        {(tag || badge || kicker) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 * s, marginBottom: 18 * s, flexWrap: 'wrap' }}>
            {tag && (
              <Panel fill={t.danger} radius={10 * s} seed="thumb-tag" style={{ ...keepAll, padding: `${6 * s}px ${20 * s}px`, color: '#FFFFFF', fontSize: 32 * s, fontWeight: 900 }}>
                {tag}
              </Panel>
            )}
            {badge && (
              <Panel fill={t.primary} radius={10 * s} seed="thumb-hero-badge" style={{ ...keepAll, padding: `${6 * s}px ${22 * s}px`, color: t.skin.onColorInk, fontSize: 32 * s, fontWeight: 900 }}>
                {badge}
              </Panel>
            )}
            {kicker && (
              <div style={{ color: '#E2E8F0', fontSize: 30 * s, fontWeight: 800, letterSpacing: '-0.01em', textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}>
                {kicker}
              </div>
            )}
          </div>
        )}

        {/* 수치가 있을 경우 초대형 수치 표시 */}
        {stat && (
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 14 * s, fontFamily: t.mono || t.font }}>
            <span style={{ fontSize: 148 * s, fontWeight: 900, color: t.primary, lineHeight: 1, letterSpacing: '-0.04em', textShadow: '0 6px 24px rgba(0,0,0,0.95)' }}>
              {stat}
            </span>
            <span style={{ fontSize: 64 * s, fontWeight: 900, color: '#FFFFFF', marginLeft: 16 * s, textShadow: '0 3px 12px rgba(0,0,0,0.9)' }}>
              {stat_unit || ''}
            </span>
          </div>
        )}

        {/* 메인 텍스트 */}
        <div style={{ textShadow: '0 6px 24px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,0.9)' }}>
          {lines.map((line, i) => {
            const parts = emphasis && line.includes(emphasis) ? line.split(emphasis) : null;
            return (
              <div key={i} style={{ ...keepAll, fontSize: size * s, fontWeight: 900, lineHeight: 1.16, color: '#FFFFFF', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
                {parts ? (
                  <>
                    {parts[0]}
                    <span style={{ color: t.primary, padding: `0 ${4 * s}px`, textShadow: `0 0 30px ${t.primary}88` }}>
                      {emphasis}
                    </span>
                    {parts.slice(1).join(emphasis)}
                  </>
                ) : line}
              </div>
            );
          })}
        </div>

        {/* 서브 텍스트 / 배너 */}
        {sub_text && (
          <div style={{ marginTop: 24 * s, display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
            borderLeft: `5px solid ${t.primary}`, padding: `${10 * s}px ${22 * s}px`, borderRadius: `0 ${10 * s}px ${10 * s}px 0` }}>
            <span style={{ fontSize: 32 * s, fontWeight: 800, color: '#F8FAFC', letterSpacing: '-0.01em' }}>
              {sub_text}
            </span>
          </div>
        )}
      </div>

      {/* 브랜드 푸터 */}
      <div style={{ position: 'absolute', left: 80 * s, bottom: 32 * s, fontSize: 30 * s, fontWeight: 900, zIndex: 5, letterSpacing: '-0.01em' }}>
        {t.brand.parts.map((p, i) => (
          <span key={i} style={{ color: p.accent ? t.primary : '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>{p.text}</span>
        ))}
        {t.brand.suffix && <span style={{ color: '#94A3B8', fontSize: 22 * s, marginLeft: 10 * s }}>{t.brand.suffix}</span>}
      </div>
    </>
  );
};

/** 6. 양극 대조형 (VS Split): 좌우 실사 사진 / 컬러 극적 대조 */
/** 6. 양극 대조형 (VS Split): 실사 사진 중심의 방송 다큐형 클린 스플릿 + 수직 대결 엠블럼 */
const LandscapeVsSplit: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, theme: t, text, kicker, badge, split_left, split_right, s } = props;
  const left = split_left || { text: '時薪制：居服員', tag: '注意', sub_text: '只多最低工資4元？' };
  const right = split_right || { text: '月薪制：機構夜班', tag: '解答', sub_text: '起薪38,100元起', is_good: true };

  // 좌우 콘텐츠 가용 폭에 맞춘 자동 폰트 크기 조절 (절대 줄바꿈 방지)
  const leftSize = calcAutoFontSize([left.text], (W * 0.42) * s, 88 * s, 48 * s);
  const rightSize = calcAutoFontSize([right.text], (W * 0.42) * s, 88 * s, 48 * s);

  // 숫자 하이라이트 헬퍼 (디자이너 손길처럼 숫자를 자연스럽게 강조)
  const renderValueText = (txt: string, highlightColor: string) => {
    const match = txt.match(/\d[\d,]*/);
    if (match) {
      const num = match[0];
      const parts = txt.split(num);
      return (
        <>
          {parts[0]}
          <span style={{ color: highlightColor, textShadow: `0 0 30px ${highlightColor}88` }}>{num}</span>
          {parts.slice(1).join(num)}
        </>
      );
    }
    return txt;
  };

  return (
    <AbsoluteFill style={{ background: '#080C16', overflow: 'hidden' }}>
      {/* 우측 진영 (바닥 레이어): 실제 사진의 생생함을 살리고 하단에만 자연스러운 다크 그라디언트 부여 */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: W * 0.54, overflow: 'hidden' }}>
        {right.photo && (
          <Img src={right.photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
        <AbsoluteFill style={{
          background: 'linear-gradient(180deg, rgba(8,12,22,0.20) 0%, rgba(8,12,22,0.50) 45%, rgba(8,12,22,0.92) 80%, rgba(8,12,22,0.98) 100%)'
        }} />
        <AbsoluteFill style={{
          background: 'radial-gradient(circle at 85% 30%, rgba(16,185,129,0.30) 0%, transparent 65%)'
        }} />
        <div style={{
          position: 'absolute', left: 40 * s, right: 40 * s, bottom: 90 * s,
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 12
        }}>
          {right.tag && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              color: '#4ADE80',
              fontSize: 32 * s,
              fontWeight: 900,
              letterSpacing: '0.04em',
              marginBottom: 14 * s,
              textShadow: '0 2px 12px rgba(0,0,0,0.95)',
              whiteSpace: 'nowrap',
            }}>
              {right.tag}
            </div>
          )}
          <div style={{
            fontSize: rightSize * s,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            textShadow: '0 6px 30px #000000, 0 2px 8px #000000',
            whiteSpace: 'nowrap',
          }}>
            {renderValueText(right.text, '#38BDF8')}
          </div>
          {right.sub_text && (
            <div style={{
              marginTop: 18 * s,
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(16,185,129,0.22)',
              border: `${1.5 * s}px solid #10B981`,
              borderRadius: 8 * s,
              padding: `${6 * s}px ${22 * s}px`,
              color: '#A7F3D0',
              fontSize: 32 * s,
              fontWeight: 800,
              textShadow: '0 2px 8px rgba(0,0,0,0.9)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              whiteSpace: 'nowrap',
            }}>
              {right.sub_text}
            </div>
          )}
        </div>
      </div>

      {/* 좌측 진영: 약간의 사선(-4°)으로 세련되게 분할 */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: W,
        clipPath: 'polygon(0 0, 52% 0, 48% 100%, 0 100%)',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        {left.photo && (
          <Img src={left.photo} style={{ width: '54%', height: '100%', objectFit: 'cover' }} />
        )}
        {/* 자연스러운 시네마틱 비네팅 */}
        <AbsoluteFill style={{
          width: '54%',
          background: 'linear-gradient(180deg, rgba(8,12,22,0.20) 0%, rgba(8,12,22,0.50) 45%, rgba(8,12,22,0.92) 80%, rgba(8,12,22,0.98) 100%)'
        }} />
        <AbsoluteFill style={{
          width: '54%',
          background: 'radial-gradient(circle at 15% 30%, rgba(220,38,38,0.30) 0%, transparent 65%)'
        }} />
        <div style={{
          position: 'absolute', left: 40 * s, width: W * 0.44, bottom: 90 * s,
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', zIndex: 12
        }}>
          {left.tag && (
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              color: '#F87171',
              fontSize: 32 * s,
              fontWeight: 900,
              letterSpacing: '0.04em',
              marginBottom: 14 * s,
              textShadow: '0 2px 12px rgba(0,0,0,0.95)',
              whiteSpace: 'nowrap',
            }}>
              {left.tag}
            </div>
          )}
          <div style={{
            fontSize: leftSize * s,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            textShadow: '0 6px 30px #000000, 0 2px 8px #000000',
            whiteSpace: 'nowrap',
          }}>
            {renderValueText(left.text, '#FDE047')}
          </div>
          {left.sub_text && (
            <div style={{
              marginTop: 18 * s,
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(239,68,68,0.22)',
              border: `${1.5 * s}px solid #EF4444`,
              borderRadius: 8 * s,
              padding: `${6 * s}px ${22 * s}px`,
              color: '#FECACA',
              fontSize: 32 * s,
              fontWeight: 800,
              textShadow: '0 2px 8px rgba(0,0,0,0.9)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
              whiteSpace: 'nowrap',
            }}>
              {left.sub_text}
            </div>
          )}
        </div>
      </div>

      {/* 중앙 미세 사선 분할선 (-4도 정밀 각도: 52% 상단 -> 48% 하단) */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '-15%',
        bottom: '-15%',
        width: 3.5 * s,
        transform: 'translateX(-50%) rotate(-4deg)',
        background: 'rgba(255,255,255,0.65)',
        boxShadow: '0 0 16px rgba(0,0,0,0.95), 0 0 6px rgba(255,255,255,0.4)',
        zIndex: 15,
      }} />

      {/* 중앙 VS 배지 (완전 수직, 정중앙 정렬, 삐뚤어짐 없는 클린 디자인) */}
      <div style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 120 * s,
          height: 120 * s,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #FDE047 0%, #EAB308 55%, #CA8A04 100%)',
          border: `${5 * s}px solid #FFFFFF`,
          boxShadow: '0 10px 35px rgba(0,0,0,0.95), 0 0 25px rgba(234,179,8,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontSize: 54 * s,
            fontWeight: 900,
            color: '#0F172A',
            letterSpacing: '0.02em',
            lineHeight: 1,
            fontStyle: 'normal',
            textAlign: 'center',
            marginTop: -2 * s,
          }}>
            VS
          </span>
        </div>
      </div>

      {/* 상단 가운데 대형 타이틀 바 (방송 다큐 헤드라인 그래픽 - 굵고 크게) */}
      {(text || kicker) && (() => {
        const title = text || kicker || '';
        const titleSize = calcAutoFontSize([title], (badge ? W * 0.72 : W * 0.86) * s, 58 * s, 32 * s);
        return (
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 28 * s,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 35,
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'linear-gradient(180deg, rgba(8,12,22,0.92) 0%, rgba(15,23,42,0.85) 100%)',
              border: `${2 * s}px solid rgba(255,255,255,0.28)`,
              borderRadius: 36 * s,
              padding: `${10 * s}px ${36 * s}px`,
              boxShadow: '0 12px 36px rgba(0,0,0,0.9), 0 0 25px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(12px)',
              whiteSpace: 'nowrap',
            }}>
              {badge && (
                <Panel fill={t.primary} radius={12 * s} seed="thumb-vs-badge" style={{
                  ...keepAll,
                  padding: `${6 * s}px ${20 * s}px`,
                  color: t.skin.onColorInk,
                  fontSize: Math.min(titleSize * 0.72, 38 * s),
                  fontWeight: 900,
                  marginRight: 16 * s,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                }}>
                  {badge}
                </Panel>
              )}
              <span style={{
                color: '#FFFFFF',
                fontSize: titleSize,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                textShadow: '0 3px 14px rgba(0,0,0,0.95)',
                whiteSpace: 'nowrap',
              }}>
                {title}
              </span>
            </div>
          </div>
        );
      })()}

      {/* 하단 브랜드 */}
      <div style={{ position: 'absolute', left: 40 * s, bottom: 24 * s, zIndex: 30, fontSize: 26 * s, fontWeight: 900 }}>
        <span style={{ color: t.primary }}>LONGE</span><span style={{ color: '#FFFFFF' }}>PASS</span>
      </div>
    </AbsoluteFill>
  );
};

/** 7. 경고/폭로형 (Warning Dark): 다크 차콜 배경 + 사진 위 오버레이 + 억지 줄바꿈 절대 방지 */
const LandscapeWarningDark: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, theme: t, text, emphasis, badge, sub_text, photo, stamp, tag, s } = props;
  const lines = getTitleLines(text || '', false, emphasis);
  // 긴 문장도 화면 전체(최대 86%)에 걸쳐 사진 위로 시원하게 뻗어나가도록 가용 폭 설정
  const availWidth = (W * 0.86) * s;
  const size = calcAutoFontSize(lines, availWidth, 126 * s, 48 * s);

  return (
    <AbsoluteFill style={{ background: '#0A0E17', overflow: 'hidden' }}>
      {/* 우측 사진 카드 (z-index 5 로 텍스트 뒤에 안정적으로 안착) */}
      {photo && (
        <div style={{
          position: 'absolute', right: 50 * s, top: '50%', transform: 'translateY(-50%)',
          width: 500 * s, height: 500 * s, borderRadius: 28 * s, overflow: 'hidden',
          border: `${4 * s}px solid ${t.danger}`, boxShadow: '0 20px 60px rgba(0,0,0,0.95)',
          zIndex: 5,
        }}>
          <Img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* 좌측 엣지 다크 비네팅: 긴 텍스트가 사진 위로 뻗어나와도 완벽한 가독성 보장 */}
          <AbsoluteFill style={{
            background: 'linear-gradient(90deg, rgba(10,14,23,0.92) 0%, rgba(10,14,23,0.40) 35%, transparent 70%)'
          }} />
          <AbsoluteFill style={{
            background: 'linear-gradient(180deg, transparent 55%, rgba(10,14,23,0.88) 100%)'
          }} />
        </div>
      )}

      {/* 우측 도장 */}
      {stamp && (
        <div style={{ position: 'absolute', right: 80 * s, top: 60 * s, zIndex: 25 }}>
          <StampBadge text={stamp} color={t.danger} size={44 * s} rotate={-10} />
        </div>
      )}

      {/* 텍스트 영역 (z-index 20 으로 사진 위로 자연스럽게 오버레이) */}
      <div style={{
        position: 'absolute', left: 80 * s, top: 0, bottom: 0, width: W * 0.86,
        display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 20
      }}>
        {(tag || badge) && (
          <div style={{ display: 'flex', gap: 14 * s, marginBottom: 20 * s, alignItems: 'center' }}>
            {tag && (
              <div style={{
                background: t.danger, color: '#FFFFFF', padding: `${8 * s}px ${22 * s}px`,
                borderRadius: 10 * s, fontSize: 34 * s, fontWeight: 900, whiteSpace: 'nowrap'
              }}>
                {tag}
              </div>
            )}
            {badge && (
              <div style={{
                background: t.primary, color: '#000000', padding: `${8 * s}px ${22 * s}px`,
                borderRadius: 10 * s, fontSize: 34 * s, fontWeight: 900, whiteSpace: 'nowrap'
              }}>
                {badge}
              </div>
            )}
          </div>
        )}

        <div style={{ textShadow: '0 4px 24px #000000, 0 8px 45px rgba(0,0,0,0.98), 0 2px 4px #000000' }}>
          {lines.map((line, i) => {
            const parts = emphasis && line.includes(emphasis) ? line.split(emphasis) : null;
            return (
              <div key={i} style={{
                ...keepAll, fontSize: size * s, fontWeight: 900, lineHeight: 1.15,
                color: '#FFFFFF', letterSpacing: '-0.03em', whiteSpace: 'nowrap'
              }}>
                {parts ? (
                  <>
                    {parts[0]}
                    <span style={{ color: t.primary, textDecoration: `underline ${t.danger} 6px` }}>
                      {emphasis}
                    </span>
                    {parts.slice(1).join(emphasis)}
                  </>
                ) : line}
              </div>
            );
          })}
        </div>

        {sub_text && (
          <div style={{
            marginTop: 22 * s, fontSize: 30 * s, lineHeight: 1.35, fontWeight: 800,
            color: '#FCA5A5', background: 'rgba(239,68,68,0.22)', padding: `${10 * s}px ${22 * s}px`,
            borderRadius: 10 * s, borderLeft: `5px solid ${t.danger}`, alignSelf: 'flex-start',
            boxShadow: '0 6px 20px rgba(0,0,0,0.8)', whiteSpace: 'nowrap'
          }}>
            {sub_text}
          </div>
        )}
      </div>

      {/* 하단 브랜드 */}
      <div style={{ position: 'absolute', left: 70 * s, bottom: 32 * s, fontSize: 28 * s, fontWeight: 900, color: '#94A3B8', zIndex: 20 }}>
        <span style={{ color: t.primary }}>LONGE</span><span style={{ color: '#FFFFFF' }}>PASS</span> 容易通
      </div>
    </AbsoluteFill>
  );
};

// ----------------------------------------------------
// 9:16 세로 쇼츠 레이아웃 (Portrait)
// ----------------------------------------------------

/** 실사/임팩트 세로 쇼츠 표지 */
const PortraitPhotoHero: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, height: H, theme: t, text, emphasis, badge, sub_text, stat, stat_unit, photo, kicker, tag, stamp, accent_bar, s } = props;
  const lines = splitLines(text || '', emphasis);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(108, (W * 0.84) / longest);

  return (
    <AbsoluteFill style={{ background: '#0B1426', overflow: 'hidden' }}>
      {/* 배경 사진 */}
      {photo && (
        <AbsoluteFill>
          <Img src={photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <AbsoluteFill style={{
            background: 'linear-gradient(180deg, rgba(11,20,38,0.94) 0%, rgba(11,20,38,0.72) 22%, rgba(11,20,38,0.45) 55%, rgba(11,20,38,0.92) 85%, rgba(11,20,38,1) 100%)'
          }} />
        </AbsoluteFill>
      )}

      {/* 상단: 띠 배너 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 80 * s, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
        {accent_bar ? (
          <div style={{ background: t.primary, color: '#000000', padding: `${10 * s}px ${32 * s}px`, borderRadius: 12 * s, fontSize: 40 * s, fontWeight: 900,
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)', letterSpacing: '-0.02em' }}>
            {accent_bar}
          </div>
        ) : (tag || badge) ? (
          <div style={{ display: 'flex', gap: 12 * s }}>
            {tag && <div style={{ background: t.danger, color: '#fff', padding: `${8 * s}px ${24 * s}px`, borderRadius: 10 * s, fontSize: 36 * s, fontWeight: 900 }}>{tag}</div>}
            {badge && <div style={{ background: t.primary, color: '#000', padding: `${8 * s}px ${24 * s}px`, borderRadius: 10 * s, fontSize: 36 * s, fontWeight: 900 }}>{badge}</div>}
          </div>
        ) : null}

        {kicker && (
          <div style={{ marginTop: 14 * s, color: '#E2E8F0', fontSize: 32 * s, fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
            {kicker}
          </div>
        )}
      </div>

      {/* 중앙: 수치 & 메인 텍스트 */}
      <div style={{ position: 'absolute', left: 50 * s, right: 50 * s, top: H * 0.28, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
        {stat && (
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 * s, fontFamily: t.mono || t.font }}>
            <span style={{ fontSize: 160 * s, fontWeight: 900, color: t.primary, lineHeight: 1, textShadow: '0 6px 24px rgba(0,0,0,0.9)' }}>
              {stat}
            </span>
            {stat_unit && (
              <span style={{ fontSize: 72 * s, fontWeight: 900, color: '#FFFFFF', marginLeft: 16 * s, textShadow: '0 4px 16px rgba(0,0,0,0.9)' }}>
                {stat_unit}
              </span>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', textShadow: '0 4px 20px rgba(0,0,0,0.95)' }}>
          {lines.map((line, i) => {
            const parts = emphasis && line.includes(emphasis) ? line.split(emphasis) : null;
            return (
              <div key={i} style={{ ...keepAll, fontSize: size * s, fontWeight: 900, lineHeight: 1.22, color: '#FFFFFF', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
                {parts ? (
                  <>
                    {parts[0]}
                    <span style={{ color: t.primary, background: 'rgba(0,0,0,0.4)', padding: `0 ${10 * s}px`, borderRadius: 8 * s }}>
                      {emphasis}
                    </span>
                    {parts.slice(1).join(emphasis)}
                  </>
                ) : line}
              </div>
            );
          })}
        </div>

        {stamp && (
          <div style={{ marginTop: 28 * s }}>
            <StampBadge text={stamp} color={t.danger} size={44 * s} rotate={-6} />
          </div>
        )}
      </div>

      {/* 하단: 서브 텍스트 & 로고 */}
      <div style={{ position: 'absolute', left: 40 * s, right: 40 * s, bottom: H * 0.08, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
        {sub_text && (
          <div style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', border: `2px solid ${t.primary}`,
            borderRadius: 14 * s, padding: `${12 * s}px ${28 * s}px`, textAlign: 'center', marginBottom: 24 * s }}>
            <span style={{ fontSize: 34 * s, fontWeight: 800, color: '#FFFFFF' }}>{sub_text}</span>
          </div>
        )}
        <div style={{ fontSize: 38 * s, fontWeight: 900, letterSpacing: '-0.01em' }}>
          {t.brand.parts.map((p, i) => <span key={i} style={{ color: p.accent ? t.primary : '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{p.text}</span>)}
          {t.brand.suffix && <span style={{ color: '#94A3B8', fontSize: 26 * s, marginLeft: 12 * s }}>{t.brand.suffix}</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PortraitDefault: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, height: H, theme: t, text, emphasis, badge, object, object_label, layout = 'focus', stat, stat_unit, s, surf } = props;
  const lines = splitLines(text || '', emphasis);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(140, (W * 0.86) / longest);
  const statColor = getStatColor(surf, t);

  return (
    <AbsoluteFill style={{ background: surf.bg, fontFamily: t.font, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${surf.grid} ${3 * s}px, transparent ${3.5 * s}px)`, backgroundSize: `${48 * s}px ${48 * s}px`, opacity: 0.8 }} />
      <div style={{ position: 'absolute', left: '50%', top: H * 0.65, width: 900 * s, height: 900 * s, marginLeft: -450 * s, marginTop: -450 * s, borderRadius: '50%',
        background: `radial-gradient(circle, ${t.primary}40 0%, ${t.primary}10 55%, transparent 70%)` }} />

      {/* 상단 텍스트 영역 */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: H * 0.16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {badge && (
          <Panel fill={t.primary} radius={12 * s} seed="thumb-p-badge" style={{ ...keepAll, padding: `${10 * s}px ${28 * s}px`, color: t.skin.onColorInk, fontSize: 44 * s, fontWeight: 900, marginBottom: 28 * s }}>
            {badge}
          </Panel>
        )}
        {layout === 'stat' && stat && (
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 16 * s, fontFamily: t.mono || t.font }}>
            <span style={{ fontSize: 160 * s, fontWeight: 900, color: statColor, lineHeight: 1 }}>{stat}</span>
            <span style={{ fontSize: 68 * s, fontWeight: 900, color: surf.ink, marginLeft: 16 * s }}>{stat_unit || ''}</span>
          </div>
        )}
        <BigLines lines={lines} emphasis={emphasis} size={size} surf={surf} t={t} align="center" />
      </div>

      {/* 중앙/하단 사물 그래픽 */}
      <div style={{ position: 'absolute', left: '50%', top: H * 0.65, transform: 'translate(-50%, -50%) rotate(-6deg)' }}>
        <ObjectArt name={object} label={object_label} t={t} size={600 * s} />
      </div>

      {/* 하단 브랜드 로고 */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: H * 0.08, textAlign: 'center', fontSize: 44 * s, fontWeight: 900, letterSpacing: '-0.01em' }}>
        {t.brand.parts.map((p, i) => <span key={i} style={{ color: p.accent ? t.primary : surf.ink }}>{p.text}</span>)}
        {t.brand.suffix && <span style={{ color: surf.sub, fontSize: 30 * s, marginLeft: 12 * s }}>{t.brand.suffix}</span>}
      </div>
    </AbsoluteFill>
  );
};

/** 8. 실제 공문서/증거형 (Evidence Doc): 실제 정부 공문/규정 캡처 서류 + 도장 + 팩트 헤드라인 */
const LandscapeEvidenceDoc: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
  const { width: W, theme: t, text, emphasis, badge, sub_text, stat, stat_unit, photo, kicker, tag, stamp, s } = props;
  const lines = getTitleLines(text || '', false, emphasis);
  const kickerSize = kicker ? calcAutoFontSize([kicker], (tag || badge ? 395 : 560) * s, 54 * s, 30 * s) : 34 * s;
  const size = calcAutoFontSize(lines, 560 * s, 122 * s, 50 * s);

  return (
    <AbsoluteFill style={{ background: 'linear-gradient(135deg, #080D1A 0%, #151E33 60%, #080D1A 100%)', overflow: 'hidden' }}>
      {/* 우측 공문서 입체 카드 */}
      {photo && (
        <div style={{
          position: 'absolute', right: 35 * s, top: '50%', transform: 'translateY(-50%) rotate(2.5deg)',
          width: 570 * s, height: 430 * s, borderRadius: 20 * s, overflow: 'hidden',
          border: '4px solid #475569', boxShadow: '0 25px 60px rgba(0,0,0,0.9)', background: '#FFFFFF',
          zIndex: 4
        }}>
          <Img src={photo} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#FFFFFF' }} />
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 75%, rgba(0,0,0,0.3) 100%)' }} />
        </div>
      )}

      {/* 공문서 위 빨간색 검인 도장 */}
      <div style={{ position: 'absolute', right: 75 * s, top: 75 * s, zIndex: 10 }}>
        <StampBadge text={stamp || '【官方公文】'} color={t.danger} size={44 * s} rotate={-10} />
      </div>

      {/* 좌측 콘텐츠 */}
      <div style={{ position: 'absolute', left: 70 * s, top: 0, bottom: 0, width: 570 * s, display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 6 }}>
        {(tag || badge || kicker) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 * s, marginBottom: stat ? 16 * s : 30 * s }}>
            {tag && (
              <Panel fill={t.danger} radius={10 * s} seed="thumb-ev-tag" style={{ ...keepAll, padding: `${7 * s}px ${22 * s}px`, color: '#FFFFFF', fontSize: 32 * s, fontWeight: 900, whiteSpace: 'nowrap' }}>
                {tag}
              </Panel>
            )}
            {badge && (
              <Panel fill={t.primary} radius={10 * s} seed="thumb-ev-badge" style={{ ...keepAll, padding: `${7 * s}px ${22 * s}px`, color: t.skin.onColorInk, fontSize: 32 * s, fontWeight: 900, whiteSpace: 'nowrap' }}>
                {badge}
              </Panel>
            )}
            {kicker && (
              <div style={{ color: '#FFFFFF', fontSize: kickerSize * s, fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'nowrap', textShadow: '0 3px 12px rgba(0,0,0,0.9)' }}>
                {kicker}
              </div>
            )}
          </div>
        )}

        {stat && (
          <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 14 * s, fontFamily: t.mono || t.font }}>
            <span style={{ fontSize: 136 * s, fontWeight: 900, color: t.primary, lineHeight: 1, textShadow: '0 6px 24px rgba(0,0,0,0.9)' }}>
              {stat}
            </span>
            <span style={{ fontSize: 60 * s, fontWeight: 900, color: '#FFFFFF', marginLeft: 16 * s, textShadow: '0 2px 10px rgba(0,0,0,0.9)' }}>
              {stat_unit || ''}
            </span>
          </div>
        )}

        <div style={{ textShadow: '0 4px 16px rgba(0,0,0,0.9)' }}>
          {lines.map((line, i) => {
            const parts = emphasis && line.includes(emphasis) ? line.split(emphasis) : null;
            return (
              <div key={i} style={{ ...keepAll, fontSize: size * s, fontWeight: 900, lineHeight: 1.18, color: '#FFFFFF', letterSpacing: '-0.03em', whiteSpace: 'nowrap' }}>
                {parts ? (
                  <>
                    {parts[0]}
                    <span style={{ color: t.primary, textDecoration: `underline ${t.primary} 6px` }}>
                      {emphasis}
                    </span>
                    {parts.slice(1).join(emphasis)}
                  </>
                ) : line}
              </div>
            );
          })}
        </div>

        {sub_text && (
          <div style={{ marginTop: 22 * s, display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
            borderLeft: `5px solid ${t.primary}`, padding: `${8 * s}px ${18 * s}px`, borderRadius: `0 ${8 * s}px ${8 * s}px 0` }}>
            <span style={{ fontSize: 30 * s, fontWeight: 800, color: '#E2E8F0' }}>
              {sub_text}
            </span>
          </div>
        )}
      </div>

      {/* 브랜드 */}
      <div style={{ position: 'absolute', left: 70 * s, bottom: 32 * s, fontSize: 28 * s, fontWeight: 900, color: '#94A3B8' }}>
        <span style={{ color: t.primary }}>LONGE</span><span style={{ color: '#FFFFFF' }}>PASS</span> 容易通
      </div>
    </AbsoluteFill>
  );
};

const THUMB_FONT = "'Taipei Sans TC', 'Noto Sans TC', sans-serif";

// ----------------------------------------------------
// 컨테이너
// ----------------------------------------------------

const Inner: React.FC<ThumbnailProps> = (props) => {
  const { width: W, height: H, theme: t, layout = 'focus' } = props;
  useFontsReady('Taipei Sans TC');
  useFontsReady(t.font);

  // surface 선택
  const surfKey = props.surface || t.primary_surface || 'base';
  const surf = t.surfaces[surfKey] || t.surfaces[t.primary_surface || 'base'] || Object.values(t.surfaces)[0];

  const renderContent = () => {
    if (H > W) {
      const s = W / 1080;
      if (layout === 'photo_hero' || layout === 'warning_dark' || layout === 'evidence_doc' || props.photo) {
        return <PortraitPhotoHero {...props} s={s} surf={surf} />;
      }
      return <PortraitDefault {...props} s={s} surf={surf} />;
    }

    const s = W / 1280;

    if (layout === 'photo_hero' || (props.photo && layout === 'focus')) {
      return <LandscapePhotoHero {...props} s={s} surf={surf} />;
    }
    if (layout === 'vs_split') {
      return <LandscapeVsSplit {...props} s={s} surf={surf} />;
    }
    if (layout === 'warning_dark') {
      return <LandscapeWarningDark {...props} s={s} surf={surf} />;
    }
    if (layout === 'evidence_doc') {
      return <LandscapeEvidenceDoc {...props} s={s} surf={surf} />;
    }

    return (
      <AbsoluteFill style={{ background: surf.bg, overflow: 'hidden' }}>
        <AbsoluteFill style={{ backgroundImage: `radial-gradient(${surf.grid} ${2.5 * s}px, transparent ${3 * s}px)`, backgroundSize: `${40 * s}px ${40 * s}px`, opacity: 0.8 }} />
        {layout === 'split' && <LandscapeSplit {...props} s={s} surf={surf} />}
        {layout === 'stat' && <LandscapeStat {...props} s={s} surf={surf} />}
        {layout === 'quiz' && <LandscapeQuiz {...props} s={s} surf={surf} />}
        {layout === 'focus' && <LandscapeFocus {...props} s={s} surf={surf} />}
      </AbsoluteFill>
    );
  };

  return (
    <AbsoluteFill style={{ fontFamily: THUMB_FONT }}>
      {renderContent()}
    </AbsoluteFill>
  );
};

export const Thumbnail: React.FC<ThumbnailProps> = (props) => {
  if (!props || !props.theme) {
    return <AbsoluteFill style={{ background: '#0B1426', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Props not loaded</AbsoluteFill>;
  }
  return (
    <MotionThemeProvider theme={props.theme}>
      <Inner {...props} />
    </MotionThemeProvider>
  );
};
