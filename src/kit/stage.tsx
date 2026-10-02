import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Surface } from './types';
import { useMotionTheme } from './theme';
import { useLayout } from './layout';
import { cardPanel, ease, enter, riseTransform } from './skin';
import { Icon, Panel } from './media';
import { Title, keepAll } from './parts';

/**
 * 무대(stage) 템플릿 공용 부품.
 * 무대 = 내레이션 여러 문장(비트)에 걸쳐 같은 요소들이 화면에 남아 위치/크기/강조만 바뀌는 장면.
 * 템플릿은 비트마다 "요소 id → 자리(Pose)"를 계산하고, 여기 부품이 비트 사이를 부드럽게 잇는다.
 * ev.beats[i].at = i번째 비트가 시작하는 프레임 (샷 시작 기준)
 */

export type BeatEv = { at: number; [k: string]: any };
export type Pose = { x: number; y: number; s?: number; o?: number; r?: number };

/** 지금 몇 번째 비트이고, 그 비트로 넘어가는 진행도(0→1)가 얼마인지 */
export const useBeat = (beats: BeatEv[]) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  let i = 0;
  beats.forEach((b, k) => { if (frame >= b.at) i = k; });
  const p = i === 0 ? 1 : enter(t, frame, beats[i].at, fps);
  return { i, p, frame };
};

const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** 이전 비트 자리 → 지금 비트 자리. 이전에 없던 요소는 떠오르며 나타나고, 지금 없는 요소는 사라진다 */
export const tween = (from: Pose | undefined, to: Pose | undefined, p: number, rise = 24): Pose => {
  if (from && to) {
    return { x: mix(from.x, to.x, p), y: mix(from.y, to.y, p), s: mix(from.s ?? 1, to.s ?? 1, p), o: mix(from.o ?? 1, to.o ?? 1, p), r: mix(from.r ?? 0, to.r ?? 0, p) };
  }
  if (to) return { ...to, y: to.y + (1 - p) * rise, o: (to.o ?? 1) * p };
  if (from) return { ...from, o: (from.o ?? 1) * (1 - p) };
  return { x: 0, y: 0, o: 0 };
};

/** 비트별 자리표에서 지금 자리 */
export const poseAt = (layouts: Array<Record<string, Pose>>, id: string, i: number, p: number, rise?: number): Pose =>
  tween(i > 0 ? layouts[i - 1][id] : undefined, layouts[i][id], i > 0 ? p : 1, rise);

/** 자리를 CSS로 (자리 = 요소의 가운데) */
export const poseStyle = (pose: Pose, w: number, h: number): React.CSSProperties => ({
  position: 'absolute', left: pose.x - w / 2, top: pose.y - h / 2, width: w, height: h,
  opacity: pose.o ?? 1, transform: `scale(${pose.s ?? 1}) rotate(${pose.r ?? 0}deg)`,
});

/** 카메라: 비트마다 보는 곳(cx, cy)과 확대(zoom)가 바뀌고 그 사이를 부드럽게 움직인다 */
export type Camera = { cx: number; cy: number; zoom: number };
export const StageCamera: React.FC<{ cams: Camera[]; i: number; p: number; width: number; children: React.ReactNode }> = ({ cams, i, p, width, children }) => {
  const L = useLayout();
  const a = cams[Math.max(0, i - 1)], b = cams[i];
  const cx = mix(a.cx, b.cx, i > 0 ? p : 1), cy = mix(a.cy, b.cy, i > 0 ? p : 1), z = mix(a.zoom, b.zoom, i > 0 ? p : 1);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width, height: L.H, transformOrigin: '0 0',
      transform: `translate(${L.W / 2}px, ${L.H / 2}px) scale(${z}) translate(${-cx}px, ${-cy}px)` }}>
      {children}
    </div>
  );
};

/** 비트마다 바뀌는 위쪽 제목: 제목이 바뀌는 비트에서 새로 떠오른다 */
export const BeatTitle: React.FC<{ titles: Array<string | undefined>; beats: BeatEv[]; i: number; ink: string }> = ({ titles, beats, i, ink }) => {
  let k = i;
  while (k > 0 && !titles[k]) k -= 1;
  const text = titles[k];
  let first = k;
  while (first > 0 && titles[first - 1] === text) first -= 1;
  return text ? <Title key={`${first}-${text}`} text={text} at={beats[first]?.at ?? 0} ink={ink} /> : null;
};

/** 비트의 한 줄 설명 (화면 아래 알약) */
/** bottom 기본값은 자막(아래 110px + 높이 약 100px) 위로 */
export const BeatNote: React.FC<{ text?: string; at: number; surf: Surface; bottom?: number }> = ({ text, at, surf, bottom = 236 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  if (!text) return null;
  const p = enter(t, frame, at + 6, fps);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', opacity: p, transform: riseTransform(t, p, 0.6) }}>
      <Panel {...cardPanel(t, surf)} edge={{ side: 'left', color: t.primary, width: 10 }} seed={`note${text}`} style={{ ...keepAll, color: surf.cardInk, padding: '14px 32px', fontSize: 40, fontWeight: 800 }}>{text}</Panel>
    </div>
  );
};

/** 아이콘 + 이름 카드 (무대 요소 공용). focus=강조 테두리, vertical=아이콘 위/이름 아래 */
export const ItemCard: React.FC<{
  label: string; sub?: string; icon?: string; w: number; h: number; surf: Surface; focus?: number; vertical?: boolean; seed: string; draw?: number;
}> = ({ label, sub, icon, w, h, surf, focus = 0, vertical, seed, draw }) => {
  const t = useMotionTheme();
  const base = cardPanel(t, surf);
  // 글자 크기: 카드 안 실제 공간 기준 (가로 카드 = 폭 - 여백 - 아이콘 - 테두리)
  const fs = vertical
    ? Math.min(34, ((w - 24) / Math.max(3, Math.min(label.length, 6))) * 0.95)
    : Math.min(36, (w - 44 - (icon ? 64 : 0) - t.skin.cardBorder * 4) / Math.max(4, label.length));
  return (
    <Panel {...base} stroke={focus > 0.5 ? t.primary : base.stroke} sw={focus > 0.5 ? Math.max(4, t.skin.cardBorder * 2) : base.sw} draw={draw} seed={seed}
      style={{ width: w, height: h, color: surf.cardInk, display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: vertical ? 10 : 18, padding: vertical ? '12px 10px' : '0 22px', textAlign: vertical ? 'center' : 'left', boxSizing: 'border-box' }}>
      {icon && <Icon name={icon} size={vertical ? 52 : 46} color={t.accent} sw={2} />}
      <div style={{ minWidth: 0 }}>
        <div style={{ ...keepAll, fontSize: fs, fontWeight: 900, lineHeight: 1.15 }}>{label}</div>
        {sub && <div style={{ ...keepAll, fontSize: fs * 0.62, fontWeight: 700, opacity: 0.6, marginTop: 4 }}>{sub}</div>}
      </div>
    </Panel>
  );
};

export const fadeBetween = (frame: number, at: number, len = 12) => ease(frame, at, at + len);
