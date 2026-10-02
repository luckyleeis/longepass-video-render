import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter, riseTransform } from '../../kit/skin';
import { Title, keepAll } from '../../kit/parts';
import { Panel, SPath, SRect } from '../../kit/media';
import TW from './taiwan_counties.json';

type TWData = { viewBox: number[]; insets: Array<{ name: string; x: number; y: number; w: number; h: number }>; counties: Record<string, { d: string; cx: number; cy: number }> };
const tw = TW as unknown as TWData;


/** 대만 지도. data: {title, groups: [{counties, label, color, value}]}, ev: {title, groups[]} */
const TaiwanMap: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const inkBorder = t.skin.cardBorderColor === 'ink';
  // 굵은 테두리 스킨: 흰 땅 + 글자색 경계선 / 차분한 스킨: 회색 땅 + 배경색 경계(틈)
  const base = inkBorder ? surf.card : surf.fill;
  const stroke = inkBorder ? ink : surf.bg;
  const muted = inkBorder ? surf.sub : surf.fillStrong;
  const colorOf = (c?: string) => ({ primary: t.primary, accent: t.accent, accent2: t.accent2, danger: t.danger, muted } as Record<string, string>)[c || 'primary'] || t.primary;
  const groups: Array<{ counties: string[]; label?: string; color?: string; value?: string }> = data.groups || [];
  const fillOf: Record<string, { color: string; at: number; gi: number }> = {};
  groups.forEach((g, gi) => (g.counties || []).forEach((c) => { fillOf[c.replace('臺', '台')] = { color: colorOf(g.color), at: (ev.groups || [])[gi] ?? 10 + gi * 20, gi }; }));
  const mapIn = enter(t, frame, 0, fps);
  const sw = Math.max(2, t.skin.objectStroke * 0.5);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <Title text={data.title} at={ev.title ?? 0} ink={ink} />
      <svg viewBox={tw.viewBox.join(' ')} style={{ position: 'absolute', left: 1000, top: 100, height: 900, opacity: mapIn, transform: riseTransform(t, mapIn) }}>
        {tw.insets.map((b) => (
          <g key={b.name}>
            <SRect x={b.x} y={b.y} w={b.w} h={b.h} rx={14} fill="none" stroke={inkBorder ? ink : surf.line} sw={3} strokeDasharray="10 8" opacity={inkBorder ? 0.5 : 1} seed={`inset${b.name}`} />
            <text x={b.x + 12} y={b.y + 24} fontSize="22" fontWeight="900" fill={ink} opacity="0.6">{b.name}</text>
          </g>
        ))}
        {Object.entries(tw.counties).map(([name, c]) => {
          const f = fillOf[name];
          const p = f ? ease(frame, f.at, f.at + 14) : 0;
          return (
            <SPath key={name} d={c.d} fill={f ? (p > 0.5 ? f.color : base) : base} subtle={!f || p <= 0.5} stroke={stroke} sw={sw} strokeLinejoin="round" seed={`county${name}`}
              style={{ transformOrigin: `${c.cx}px ${c.cy}px`, transform: `scale(${1 + (f ? Math.sin(Math.min(1, p) * Math.PI) * (t.skin.motion.impact ? 0.08 : 0.04) : 0)})` }} />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: L.padX, top: 300, display: 'flex', flexDirection: 'column', gap: 26, width: 780 }}>
        {groups.map((g, gi) => {
          const p = enter(t, frame, (ev.groups || [])[gi] ?? 10 + gi * 20, fps);
          return (
            <div key={gi} style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: p, transform: riseTransform(t, p, -1.2, 'x') }}>
              <Panel fill={colorOf(g.color)} radius={14} stroke={inkBorder ? ink : null} sw={4} seed={`chip${gi}`} style={{ width: 54, height: 54, flexShrink: 0 }} />
              <div>
                <div style={{ ...keepAll, fontSize: 48, fontWeight: 900, color: ink }}>{g.label}{g.value && <Panel fill={colorOf(g.color)} radius={12} seed={`value${gi}`} fillStyle="solid" style={{ display: 'inline-block', marginLeft: 16, color: t.skin.onColorInk, padding: '0 14px' }}>{g.value}</Panel>}</div>
                <div style={{ ...keepAll, fontSize: 30, fontWeight: 700, color: ink, opacity: 0.6, marginTop: 4 }}>{(g.counties || []).join('・')}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaiwanMap;
