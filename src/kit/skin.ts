import React from 'react';
import { Easing, interpolate, spring } from 'remotion';
import { MotionTheme, Surface } from './types';
import type { PanelProps } from './media';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/**
 * 스킨의 움직임 값으로 등장 (0→1).
 * 스프링은 1에 끝없이 가까워지기만 해서, 다 나타난 글자가 0.01px씩 계속 움직이며 매 프레임 다시 그려진다 (떨림).
 * 1에 충분히 가까워지면 정확히 1로 맞춘다.
 */
export const enter = (t: MotionTheme, frame: number, at: number, fps: number, extraDamping = 0) => {
  const v = spring({ frame: frame - at, fps, config: { damping: t.skin.motion.damping + extraDamping, stiffness: t.skin.motion.stiffness, mass: t.skin.motion.mass } });
  return frame - at > 4 && Math.abs(1 - v) < 0.004 ? 1 : v;
};

/** 튀는 등장: 충격 연출이 켜진 스킨에서만 감쇠를 낮춰 더 튀게 한다 */
export const bounce = (t: MotionTheme, frame: number, at: number, fps: number, extraDamping: number) =>
  enter(t, frame, at, fps, t.skin.motion.impact ? extraDamping : 0);

/** 등장 진행도 p(0→1)에 맞춘 이동 + 기울기. 다른 transform 뒤에 이어 붙여 쓰므로 'none' 대신 0 이동을 돌려준다 (p=1 이면 매 프레임 같은 값) */
export const riseTransform = (t: MotionTheme, p: number, scale = 1, axis: 'x' | 'y' = 'y') =>
  `translate${axis.toUpperCase()}(${(1 - p) * t.skin.motion.distance * scale}px) rotate(${(1 - p) * -t.skin.motion.tilt}deg)`;

/** a→b 프레임 동안 0→1. 내레이션 단서로 정한 시점은 같거나 뒤집힐 수 있어서 b <= a 면 a에서 바로 1 (렌더링이 멈추지 않게) */
export const ease = (frame: number, a: number, b: number) =>
  b > a ? interpolate(frame, [a, b], [0, 1], { ...clamp, easing: Easing.bezier(0.22, 1, 0.36, 1) }) : frame >= a ? 1 : 0;

export const shadowOf = (t: MotionTheme, surf: Surface, strength = 1) => {
  if (t.skin.shadow === 'none') return 'none';
  if (t.skin.shadow === 'offset') return `${10 * strength}px ${10 * strength}px 0 ${surf.ink}22`;
  return surf.dark
    ? `0 ${14 * strength}px ${36 * strength}px rgba(0,0,0,0.40)`
    : `0 ${12 * strength}px ${32 * strength}px rgba(15,23,42,0.10)`;
};

export const borderOf = (t: MotionTheme, surf: Surface) =>
  `${t.skin.cardBorder}px solid ${t.skin.cardBorderColor === 'ink' ? surf.ink : surf.line}`;

/** 기본 카드 (표·목록·박스) */
export const cardStyle = (t: MotionTheme, surf: Surface): React.CSSProperties => ({
  background: surf.card,
  color: surf.cardInk,
  border: borderOf(t, surf),
  borderRadius: t.skin.radius,
  boxShadow: shadowOf(t, surf),
});

/** 기본 카드를 그림 재료 층 Panel로 (글자색은 surf.cardInk) */
export const cardPanel = (t: MotionTheme, surf: Surface): PanelProps => ({
  fill: surf.card, stroke: t.skin.cardBorderColor === 'ink' ? surf.ink : surf.line, sw: t.skin.cardBorder,
  radius: t.skin.radius, shadow: shadowOf(t, surf),
});

/** 색 면 카드를 Panel로 (글자색은 skin.onColorInk) */
export const colorPanel = (t: MotionTheme, surf: Surface, color: string): PanelProps => ({
  fill: color, stroke: t.skin.cardBorderColor === 'ink' ? surf.ink : null, sw: t.skin.cardBorder,
  radius: t.skin.radius, shadow: shadowOf(t, surf),
});

/** 색 면 카드 (노랑·초록 등) */
export const colorCardStyle = (t: MotionTheme, surf: Surface, color: string): React.CSSProperties => ({
  background: color,
  color: t.skin.onColorInk,
  border: t.skin.cardBorderColor === 'ink' ? `${t.skin.cardBorder}px solid ${surf.ink}` : 'none',
  borderRadius: t.skin.radius,
  boxShadow: shadowOf(t, surf),
});

/** 강조 배경: 형광펜(아래쪽 굵은 획) 또는 알약. 어두운 면에서는 형광펜 대신 밑줄 (글자는 highlightInk 색) */
export const highlightStyle = (t: MotionTheme, surf: Surface, progress: number, size: number): React.CSSProperties =>
  t.skin.highlight === 'marker' && surf.dark
    ? {
        position: 'absolute', left: -size * 0.02, right: -size * 0.02, top: size * 0.98, height: size * 0.08,
        background: t.primary, borderRadius: size * 0.04,
        transform: `scaleX(${progress})`, transformOrigin: 'left center', zIndex: 0,
      }
    : t.skin.highlight === 'marker'
    ? {
        position: 'absolute', left: -size * 0.06, right: -size * 0.06, top: size * 0.52, bottom: size * 0.02,
        background: t.primary, opacity: surf.dark ? 0.85 : 0.55, borderRadius: size * 0.06,
        transform: `scaleX(${progress}) skewX(-8deg)`, transformOrigin: 'left center', zIndex: 0,
      }
    : {
        position: 'absolute', left: -size * 0.08, right: -size * 0.08, top: size * 0.12, bottom: size * 0.02,
        background: t.primary, borderRadius: size * 0.16, transform: `scaleX(${progress})`, transformOrigin: 'left center', zIndex: 0,
      };

/** 강조된 글자색: 어두운 면의 형광펜 스킨은 글자 자체를 강조색으로 */
export const highlightInk = (t: MotionTheme, surf: Surface, ink: string) =>
  t.skin.highlight === 'marker' && surf.dark ? t.primary : ink;

const lum = (hex: string) => {
  const c = hex.replace('#', '');
  if (c.length < 6) return 0.5;
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
/** 두 색의 대비율 (WCAG) */
export const contrastRatio = (a: string, b: string) => {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
/** 강조색 글자: 배경과 대비가 min(큰 굵은 글자 기준 3) 미만이면 그 면의 글자색으로 (노랑 글자가 크림 바탕에서 안 보이는 문제) */
export const readableAccent = (color: string, surf: Surface, min = 3) => (contrastRatio(color, surf.bg) >= min ? color : surf.ink);
