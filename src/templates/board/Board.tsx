import React from 'react';
import { random, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { cardPanel, enter } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { Panel, Person } from '../../kit/media';
import { BeatEv, BeatNote, BeatTitle, Camera, ItemCard, Pose, StageCamera, poseAt, poseStyle, tween, useBeat } from '../../kit/stage';

const CW = 220, CH = 150;   // 카드 기본 크기 (아이콘 위, 이름 아래)

type Item = { label: string; icon?: string; value?: string; group?: number };
type Beat = { layout: 'scatter' | 'row' | 'group' | 'focus'; title?: string; focus?: string[]; note?: string };
type Frame = { poses: Record<string, Pose>; values: number; groups: number; focus: Set<number>; cam: Camera };

/**
 * 카드 보드 (무대). 같은 카드들이 비트마다 배치를 바꾼다.
 * scatter: 가운데 주인공 주위에 흩어짐 → row: 한 줄 정렬 + 값 → group: 묶음별 칸 → focus: 일부 강조
 */
const Board: React.FC<TemplateProps> = ({ data, ev, ink, surf }) => {
  const t = useMotionTheme();
  const L = useLayout();
  const { fps } = useVideoConfig();
  const items: Item[] = data.items || [];
  const groups: string[] = data.groups || [];
  const beatsData: Beat[] = data.beats || [];
  const beats: BeatEv[] = ev.beats?.length ? ev.beats : [{ at: 0 }];
  const { i, p, frame } = useBeat(beats);
  const n = items.length;
  const cy = L.H * 0.47;   // 아래는 비트 설명(note)과 자막 자리
  const center: Camera = { cx: L.W / 2, cy: L.H / 2, zoom: 1 };

  const scatter = (): Frame => {
    const poses: Record<string, Pose> = {};
    const rx = Math.min(640, L.contentW / 2 - CW / 2), ry = Math.min(170, L.H * 0.16);
    items.forEach((_, k) => {
      const a = -Math.PI / 2 + ((k + 0.5) * 2 * Math.PI) / n;
      poses[`i${k}`] = {
        x: L.W / 2 + Math.cos(a) * rx + (random(`bx${k}`) - 0.5) * 60,
        y: cy + Math.sin(a) * ry + (random(`by${k}`) - 0.5) * 40,
        r: (random(`br${k}`) - 0.5) * 8, s: 0.9,
      };
    });
    if (data.subject) poses.subject = { x: L.W / 2, y: cy, s: 1 };
    return { poses, values: 0, groups: 0, focus: new Set(), cam: center };
  };

  const row = (): Frame => {
    const poses: Record<string, Pose> = {};
    const left = L.padX + (data.subject ? 230 : 0), avail = L.W - L.padX - left, gap = 24;
    const cw = Math.min(CW, (avail - gap * (n - 1)) / n);
    const start = left + (avail - (cw * n + gap * (n - 1))) / 2;
    items.forEach((_, k) => { poses[`i${k}`] = { x: start + cw / 2 + k * (cw + gap), y: cy + 40, s: cw / CW }; });
    if (data.subject) poses.subject = { x: L.padX + 100, y: cy + 40, s: 0.6 };
    return { poses, values: 1, groups: 0, focus: new Set(), cam: center };
  };

  const G = Math.max(1, groups.length);
  const colW = Math.min(620, (L.contentW - 40 * (G - 1)) / G);
  const colX = (g: number) => L.padX + (L.contentW - (colW * G + 40 * (G - 1))) / 2 + colW / 2 + g * (colW + 40);
  const colTop = L.contentTop + 10, colBottom = L.H * 0.66;  // 아래는 비트 설명(note)과 자막 자리
  const group = (): Frame => {
    const poses: Record<string, Pose> = {};
    for (let g = 0; g < G; g++) {
      const members = items.map((it, k) => ({ it, k })).filter(({ it }) => Math.min(G - 1, Math.max(0, it.group ?? 0)) === g);
      // 칸 안에 한 줄에 여러 장씩 (들어가는 만큼 크게)
      const room = colBottom - colTop - 100, gap = 16, m = Math.max(1, members.length);
      let s = 0.85, perRow = 1, rows = m;
      for (; s >= 0.4; s -= 0.05) {
        perRow = Math.max(1, Math.min(m, Math.floor((colW - 24 + gap) / (CW * s + gap))));
        rows = Math.ceil(m / perRow);
        if (rows * (CH * s + gap) - gap <= room) break;
      }
      members.forEach(({ k }, j) => {
        const r = Math.floor(j / perRow), c = j % perRow, inRow = Math.min(perRow, m - r * perRow);
        poses[`i${k}`] = { x: colX(g) + (c - (inRow - 1) / 2) * (CW * s + gap), y: colTop + 100 + (CH * s) / 2 + r * (CH * s + gap), s };
      });
      poses[`g${g}`] = { x: colX(g), y: (colTop + colBottom) / 2 };
    }
    return { poses, values: 0, groups: 1, focus: new Set(), cam: center };
  };

  // 비트별 자리표 (focus는 직전 배치를 그대로 두고 강조만)
  const frames: Frame[] = [];
  let base: Frame | null = null;   // 마지막 일반 배치 (강조 비트가 이어져도 흐림·확대가 쌓이지 않게 여기서 계산)
  beatsData.forEach((b) => {
    if (b.layout === 'focus') {
      const prev = base || scatter();
      const focus = new Set(items.map((it, j) => ((b.focus || []).includes(it.label) ? j : -1)).filter((j) => j >= 0));
      const poses: Record<string, Pose> = {};
      Object.entries(prev.poses).forEach(([id, ps]) => {
        const j = id.startsWith('i') ? Number(id.slice(1)) : -1;
        poses[id] = j < 0 ? ps : focus.has(j) ? { ...ps, s: (ps.s ?? 1) * 1.1, r: 0, o: 1 } : { ...ps, o: 0.3 };
      });
      // 카메라는 움직이지 않는다 (강조 카드 쪽으로 화면이 밀리면 어긋나 보이고 아래 카드가 설명 상자에 가려진다)
      frames.push({ ...prev, poses, focus, cam: prev.cam });
    } else {
      base = b.layout === 'row' ? row() : b.layout === 'group' ? group() : scatter();
      frames.push(base);
    }
  });
  if (!frames.length) frames.push(scatter());
  const layouts = frames.map((f) => f.poses);
  const k = Math.min(i, frames.length - 1);
  const cur = frames[k], prev = frames[Math.max(0, k - 1)];
  const q = k > 0 ? p : 1;
  const valuesO = prev.values + (cur.values - prev.values) * q;
  const groupsO = prev.groups + (cur.groups - prev.groups) * q;
  const itemAt: number[] = beats[0]?.items || [];

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <StageCamera cams={frames.map((f) => f.cam)} i={k} p={p} width={L.W}>
        {/* 묶음 칸 */}
        {groups.map((label, g) => {
          const ps = { x: colX(g), y: (colTop + colBottom) / 2, o: groupsO };
          if ((ps.o ?? 0) <= 0.01) return null;
          return (
            <div key={g} style={{ ...poseStyle(ps, colW, colBottom - colTop) }}>
              <Panel fill={surf.fill} radius={t.skin.radius} seed={`col${g}`} fillStyle="hachure" style={{ width: '100%', height: '100%', opacity: 0.55 }} />
              <div style={{ ...keepAll, position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center', fontSize: 40, fontWeight: 900, color: ink }}>{label}</div>
            </div>
          );
        })}
        {/* 주인공 */}
        {data.subject && (() => {
          const ps = k === 0 ? { ...layouts[0].subject, o: enter(t, frame, 0, fps) } : tween(layouts[k - 1].subject, layouts[k].subject, p);
          if (!ps || (ps.o ?? 1) <= 0.01) return null;
          return (
            <div style={{ ...poseStyle(ps, 240, 300), display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Person size={200} color={ink} seed="board-subject" />
              <Panel {...cardPanel(t, surf)} radius={999} seed="subject-label" style={{ ...keepAll, marginTop: 8, padding: '6px 22px', color: surf.cardInk, fontSize: 32, fontWeight: 900 }}>{data.subject}</Panel>
            </div>
          );
        })()}
        {/* 카드 */}
        {items.map((it, j) => {
          const id = `i${j}`;
          let ps: Pose;
          if (k === 0) {
            const a = enter(t, frame, itemAt[j] ?? 6 + j * 6, fps);
            ps = tween(undefined, layouts[0][id], a, t.skin.motion.distance);
          } else {
            ps = poseAt(layouts, id, k, p);
          }
          const focusNow = cur.focus.has(j) ? q : prev.focus.has(j) ? 1 - q : 0;
          return (
            <div key={id} style={poseStyle(ps, CW, CH)}>
              <ItemCard label={it.label} icon={it.icon} w={CW} h={CH} surf={surf} focus={focusNow} vertical seed={`card${j}`} draw={k === 0 ? Math.min(1, (ps.o ?? 1) * 1.2) : 1} />
              {it.value && valuesO > 0.01 && (
                <div style={{ position: 'absolute', left: -20, right: -20, top: -64, display: 'flex', justifyContent: 'center', opacity: valuesO }}>
                  <Panel fill={t.primary} radius={999} seed={`val${j}`} style={{ ...keepAll, padding: '4px 18px', color: t.skin.onColorInk, fontSize: 32, fontWeight: 900, whiteSpace: 'nowrap' }}>{it.value}</Panel>
                </div>
              )}
            </div>
          );
        })}
      </StageCamera>
      <BeatTitle titles={beatsData.map((b) => b.title)} beats={beats} i={k} ink={ink} />
      <BeatNote text={beatsData[k]?.note} at={beats[k]?.at ?? 0} surf={surf} />
    </div>
  );
};


export default Board;
