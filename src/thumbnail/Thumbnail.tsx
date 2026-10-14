import React from 'react';
import { AbsoluteFill } from 'remotion';
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

export type ThumbnailLayout = 'focus' | 'split' | 'stat' | 'quiz';

export interface SplitItem {
  text: string;
  tag?: string;
  object?: string;
  label?: string;
  is_good?: boolean;
}

/**
 * 유튜브 썸네일: 가로 롱폼 (1280x720 기준), 세로 쇼츠 표지 (1080x1920, H > W 이면).
 * layout:
 *   - 'focus' (기본): 텍스트 + 대형 사물 1개
 *   - 'split': 좌우 (또는 상하) 비교/대조 (VS)
 *   - 'stat': 초대형 수치/통계 강조
 *   - 'quiz': 문제/표지판 중심의 퀴즈형
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
  const lines = splitLines(text || '', emphasis);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const size = Math.min(132, (W * 0.56) / longest);

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
        <BigLines lines={lines} emphasis={emphasis} size={size * s} surf={surf} t={t} />
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
        <div style={{ fontSize: 44 * s, fontWeight: 900, color: surf.ink, textAlign: 'center', lineHeight: 1.2 }}>
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
        <div style={{ fontSize: 44 * s, fontWeight: 900, color: surf.ink, textAlign: 'center', lineHeight: 1.2 }}>
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
  const lines = splitLines(text || '', emphasis);
  const displayStat = stat || '3,600';
  const displayUnit = stat_unit || '元';
  const statColor = getStatColor(surf, t);
  const statShadow = getStatShadow(statColor, surf);

  // 긴 텍스트 줄바꿈 시 우측 사물과 겹치지 않도록 자동 크기 스케일링
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const textSize = Math.min(72, (W * 0.58) / longest);

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
        <BigLines lines={lines} emphasis={emphasis} size={textSize * s} surf={surf} t={t} />
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
  const lines = splitLines(text || '', emphasis);

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
        <BigLines lines={lines} emphasis={emphasis} size={84 * s} surf={surf} t={t} />
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

// ----------------------------------------------------
// 9:16 세로 쇼츠 레이아웃 (Portrait)
// ----------------------------------------------------

const Portrait: React.FC<ThumbnailProps & { s: number; surf: Surface }> = (props) => {
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

// ----------------------------------------------------
// 컨테이너
// ----------------------------------------------------

const Inner: React.FC<ThumbnailProps> = (props) => {
  const { width: W, height: H, theme: t, layout = 'focus' } = props;
  useFontsReady(t.font);

  // surface 선택: 지정값이 있으면 그것을 쓰고, 없으면 theme.primary_surface 혹은 base 사용
  const surfKey = props.surface || t.primary_surface || 'base';
  const surf = t.surfaces[surfKey] || t.surfaces[t.primary_surface || 'base'] || Object.values(t.surfaces)[0];

  if (H > W) {
    const s = W / 1080;
    return <Portrait {...props} s={s} surf={surf} />;
  }

  const s = W / 1280;

  return (
    <AbsoluteFill style={{ background: surf.bg, fontFamily: t.font, overflow: 'hidden' }}>
      <AbsoluteFill style={{ backgroundImage: `radial-gradient(${surf.grid} ${2.5 * s}px, transparent ${3 * s}px)`, backgroundSize: `${40 * s}px ${40 * s}px`, opacity: 0.8 }} />
      {layout === 'split' && <LandscapeSplit {...props} s={s} surf={surf} />}
      {layout === 'stat' && <LandscapeStat {...props} s={s} surf={surf} />}
      {layout === 'quiz' && <LandscapeQuiz {...props} s={s} surf={surf} />}
      {layout === 'focus' && <LandscapeFocus {...props} s={s} surf={surf} />}
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
