import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps, MotionTheme, Surface } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { Icon, Panel, SLine, SPath } from '../../kit/media';
import { Figure, POSES, blendPose } from '../../kit/doodle';
import { BeatEv, BeatNote, BeatTitle, useBeat } from '../../kit/stage';

type Tone = 'ink' | 'accent' | 'danger' | 'muted';
type Add = { kind: 'person' | 'prop'; pose?: string; prop?: string; label?: string; tone?: Tone };
type Change = { target: number; pose?: string; tone?: Tone; label?: string };
type Mark = { target: number; kind: 'circle' | 'cross' | 'check' | 'arrow'; text?: string };
type Beat = { add?: Add[]; change?: Change[]; remove?: number[]; mark?: Mark; title?: string; note?: string };
type El = { id: number; kind: 'person' | 'prop'; pose: string; prop: string; label?: string; tone: Tone; bornBeat: number; bornAt: number; goneBeat?: number };

const PERSON_H = 360, PROP = 220, SLOT_MAX = 360;

const toneColor = (t: MotionTheme, surf: Surface, tone: Tone) =>
  tone === 'accent' ? t.accent : tone === 'danger' ? t.danger : tone === 'muted' ? surf.fillStrong : surf.ink;

/**
 * 낙서 장면 (무대). 비트마다 사람·소품이 바닥선 위에 하나씩 그려져 쌓이고, 자세가 바뀌고, 표시(동그라미/X/체크/화살표)가 붙는다.
 * 요소 번호 = 추가된 순서 (1부터, 지워져도 번호는 그대로). change/mark/remove 는 이 번호로 가리킨다.
 */
const DoodleScene: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const beatsData: Beat[] = data.beats || [];
  const beats: BeatEv[] = ev.beats?.length ? ev.beats : [{ at: 0 }];
  const { i, p } = useBeat(beats);
  const k = Math.min(i, Math.max(0, beatsData.length - 1));
  const ground = L.H * 0.62;  // 바닥선 (아래로 이름표 → 비트 설명 → 자막 순서로 자리)

  // 비트별 상태 계산: 요소 목록, 자세/색/이름표 이력
  const els: El[] = [];
  const poseAt: Array<Record<number, string>> = [], toneAt: Array<Record<number, Tone>> = [], labelAt: Array<Record<number, string | undefined>> = [];
  beatsData.forEach((b, bi) => {
    const bev = beats[bi] || { at: 0 };
    (b.add || []).forEach((a, j) => {
      els.push({ id: els.length + 1, kind: a.kind === 'prop' ? 'prop' : 'person', pose: a.pose && POSES[a.pose] ? a.pose : 'stand', prop: a.prop || 'box',
        label: a.label, tone: a.tone || (a.kind === 'prop' ? 'ink' : 'ink'), bornBeat: bi, bornAt: (bev.add || [])[j] ?? bev.at + 4 + j * 8 });
    });
    (b.remove || []).forEach((id) => { const e = els.find((x) => x.id === id); if (e && e.goneBeat === undefined) e.goneBeat = bi; });
    const prevPose = bi ? { ...poseAt[bi - 1] } : {}, prevTone = bi ? { ...toneAt[bi - 1] } : {}, prevLabel = bi ? { ...labelAt[bi - 1] } : {};
    els.forEach((e) => { if (e.bornBeat === bi) { prevPose[e.id] = e.pose; prevTone[e.id] = e.tone; prevLabel[e.id] = e.label; } });
    (b.change || []).forEach((c) => {
      if (c.pose && POSES[c.pose]) prevPose[c.target] = c.pose;
      if (c.tone) prevTone[c.target] = c.tone;
      if (c.label !== undefined) prevLabel[c.target] = c.label;
    });
    poseAt.push(prevPose); toneAt.push(prevTone); labelAt.push(prevLabel);
  });

  // 비트별 자리: 보이는 요소를 바닥선 위에 고르게
  const slotsAt = beatsData.map((_, bi) => {
    const vis = els.filter((e) => e.bornBeat <= bi && (e.goneBeat === undefined || e.goneBeat > bi));
    const n = Math.max(1, vis.length), w = Math.min(SLOT_MAX, L.contentW / n);
    const x0 = L.W / 2 - (w * n) / 2 + w / 2;
    const m: Record<number, number> = {};
    vis.forEach((e, j) => { m[e.id] = x0 + j * w; });
    return m;
  });
  const xOf = (e: El) => {
    const cur = slotsAt[k]?.[e.id], prev = k > 0 ? slotsAt[k - 1]?.[e.id] : undefined;
    if (cur === undefined) return prev ?? L.W / 2;
    return prev === undefined ? cur : prev + (cur - prev) * p;
  };
  const changeAt = beats[k]?.change ?? beats[k]?.at ?? 0;
  const cp = k > 0 ? enter(t, frame, changeAt, fps) : 1;
  // 표시: 다음 표시가 나타날 때까지 남아 있다 (말 끝에 붙은 표시가 바로 사라지지 않게)
  const markAtOf = (b: number) => beats[b]?.mark ?? (beats[b]?.at ?? 0) + 10;
  let mb = -1;
  for (let b = 0; b <= k; b++) if (beatsData[b]?.mark && frame >= markAtOf(b)) mb = b;
  const mark = mb >= 0 ? beatsData[mb].mark : undefined;
  const markAt = mb >= 0 ? markAtOf(mb) : 0;
  const mp = mark ? ease(frame, markAt, markAt + 16) : 0;
  let nextMark = -1;
  for (let b = mb + 1; b < beatsData.length; b++) if (beatsData[b]?.mark) { nextMark = b; break; }
  const markOut = nextMark >= 0 ? 1 - ease(frame, markAtOf(nextMark) - 6, markAtOf(nextMark)) : 1;
  const target = mark ? els.find((e) => e.id === mark.target) : undefined;
  const elBox = (e: El) => (e.kind === 'person' ? { w: PERSON_H / 2, h: PERSON_H } : { w: PROP, h: PROP });

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg width={L.W} height={L.H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {data.ground !== false && <SLine x1={L.padX} y1={ground} x2={L.W - L.padX} y2={ground} stroke={surf.line} sw={3} reveal={ease(frame, 0, 20)} seed="ground" />}
      </svg>
      {els.map((e) => {
        if (e.bornBeat > k) return null;
        const born = enter(t, frame, e.bornAt, fps);
        const gone = e.goneBeat !== undefined && e.goneBeat <= k ? (e.goneBeat === k ? p : 1) : 0;
        const o = Math.min(1, born * 1.4) * (1 - gone);
        if (o <= 0.001) return null;
        const prevPose = k > 0 && poseAt[k - 1][e.id] ? POSES[poseAt[k - 1][e.id]] : POSES[poseAt[k][e.id] || e.pose];
        const pose = blendPose(prevPose, POSES[poseAt[k][e.id] || e.pose], cp);
        const tone = toneAt[k][e.id] || e.tone;
        const color = toneColor(t, surf, tone);
        const label = labelAt[k][e.id];
        const { w, h } = elBox(e);
        const x = xOf(e);
        const dimmed = target && mark?.kind !== 'arrow' && target.id !== e.id ? 1 - 0.45 * mp * markOut : 1;
        return (
          <div key={e.id} style={{ position: 'absolute', left: x - w / 2, top: ground - h - 4, width: w, height: h, opacity: o * dimmed, transform: `translateY(${(1 - born) * t.skin.motion.distance}px)` }}>
            {e.kind === 'person'
              ? <Figure pose={pose} size={h} color={color} draw={Math.min(1, born * 1.2)} seed={`p${e.id}`} paper={surf.card} />
              : <Icon name={e.prop} size={w} color={color} sw={1.5} draw={Math.min(1, born * 1.2)} />}
            {label && (
              <div style={{ position: 'absolute', left: -60, right: -60, top: h + 22, display: 'flex', justifyContent: 'center' }}>
                <Panel fill={surf.card} stroke={surf.line} sw={2} radius={999} seed={`lab${e.id}`} style={{ ...keepAll, padding: '4px 18px', color: surf.cardInk, fontSize: 30, fontWeight: 900, whiteSpace: 'nowrap' }}>{label}</Panel>
              </div>
            )}
          </div>
        );
      })}
      {/* 표시 */}
      {mark && target && mp > 0 && (() => {
        const { w, h } = elBox(target);
        const cx = xOf(target), cy = ground - h / 2;
        const rx = Math.max(w, h * 0.55) * 0.75, ry = h * 0.62;
        const o = markOut;
        let shape: React.ReactNode = null;
        if (mark.kind === 'circle') {
          const d = `M${cx + rx} ${cy} A${rx} ${ry} 0 1 1 ${cx + rx - 1} ${cy - 8}`;
          shape = <SPath d={d} stroke={t.danger} sw={7} strokeLinecap="round" reveal={mp} seed="mark-circle" />;
        } else if (mark.kind === 'cross') {
          const s = Math.min(w, h) * 0.55;
          shape = (
            <>
              <SLine x1={cx - s} y1={cy - s} x2={cx + s} y2={cy + s} stroke={t.danger} sw={12} reveal={Math.min(1, mp * 2)} seed="x1" />
              <SLine x1={cx + s} y1={cy - s} x2={cx - s} y2={cy + s} stroke={t.danger} sw={12} reveal={Math.max(0, mp * 2 - 1)} seed="x2" />
            </>
          );
        } else if (mark.kind === 'check') {
          const y = ground - h - 70;
          shape = <SPath d={`M${cx - 40} ${y} l28 30 l58 -66`} stroke={t.accent2} sw={14} strokeLinecap="round" strokeLinejoin="round" reveal={mp} seed="check" />;
        } else if (mark.kind === 'arrow') {
          const prev = els.filter((e) => e.id < target.id && slotsAt[k]?.[e.id] !== undefined).pop();
          if (prev) {
            const x1 = xOf(prev) + elBox(prev).w / 2 + 20, x2 = cx - w / 2 - 30, y = ground - Math.min(elBox(prev).h, h) * 0.55;
            shape = (
              <>
                <SPath d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y - 60} ${x2} ${y}`} stroke={t.primary} sw={7} strokeLinecap="round" reveal={mp} seed="arrow" />
                {mp > 0.9 && <SPath d={`M${x2 - 22} ${y - 18} L${x2} ${y} L${x2 - 24} ${y + 14}`} stroke={t.primary} sw={7} strokeLinecap="round" strokeLinejoin="round" seed="arrowhead" />}
              </>
            );
          }
        }
        return (
          <>
            <svg width={L.W} height={L.H} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: o }}>{shape}</svg>
            {mark.text && (
              <div style={{ position: 'absolute', left: cx + rx * 0.55, top: cy - ry - 30, opacity: o * Math.min(1, mp * 2), transform: 'rotate(-4deg)' }}>
                <Panel fill={mark.kind === 'check' ? t.accent2 : mark.kind === 'arrow' ? t.primary : t.danger} radius={12} seed="mark-text"
                  style={{ ...keepAll, padding: '6px 18px', color: mark.kind === 'arrow' || mark.kind === 'check' ? t.skin.onColorInk : t.skin.onAccentInk, fontSize: 34, fontWeight: 900, whiteSpace: 'nowrap' }}>{mark.text}</Panel>
              </div>
            )}
          </>
        );
      })()}
      <BeatTitle titles={beatsData.map((b) => b.title)} beats={beats} i={k} ink={ink} />
      <BeatNote text={beatsData[k]?.note} at={beats[k]?.at ?? 0} surf={surf} />
    </div>
  );
};

export default DoodleScene;
