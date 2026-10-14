import React from 'react';
import { useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { SCircle, SPath } from '../../kit/media';
import { BeatEv, BeatNote, BeatTitle, Camera, ItemCard, StageCamera, useBeat } from '../../kit/stage';

const NW = 300, NH = 112, GAP_X = 120, GAP_Y = 28;

type Node = { label: string; sub?: string; icon?: string };
type Column = { label?: string; nodes: Node[] };
type Beat = { show?: number; title?: string; focus?: string[]; note?: string };

/**
 * 흐름도 (무대). 열(column)이 비트마다 하나씩 그려지고, 카메라가 새로 생긴 열을 따라간다.
 * 한 열에 노드가 여럿이면 갈래, 다시 하나면 합류. 앞 열의 모든 노드가 다음 열의 모든 노드로 이어진다.
 */
const Flow: React.FC<TemplateProps> = ({ data, ev, ink, sub, surf }) => {
  const t = useMotionTheme();
  const L = useLayout();
  const { fps } = useVideoConfig();
  const cols: Column[] = data.columns || [];
  const C = cols.length;
  const beatsData: Beat[] = data.beats || [];
  const beats: BeatEv[] = ev.beats?.length ? ev.beats : [{ at: 0 }];
  const { i, p, frame } = useBeat(beats);
  const B = Math.max(1, beatsData.length);
  const k = Math.min(i, B - 1);

  // 비트마다 몇 번째 열까지 보이나 (지정이 없으면 비트 수에 맞춰 고르게)
  const shows: number[] = [];
  for (let b = 0; b < B; b++) {
    const auto = B > 1 ? Math.round((b * (C - 1)) / (B - 1)) : C - 1;
    const v = Math.max(0, Math.min(C - 1, beatsData[b]?.show ?? auto));
    shows.push(Math.max(v, b ? shows[b - 1] : 0));
  }
  // 열이 처음 보이는 비트
  const firstBeat = cols.map((_, c) => shows.findIndex((s) => s >= c));

  const worldW = L.padX * 2 + C * NW + (C - 1) * GAP_X;
  const colX = (c: number) => L.padX + NW / 2 + c * (NW + GAP_X);
  const cy = L.H * 0.55;
  const nodeY = (c: number, j: number) => cy + (j - (cols[c].nodes.length - 1) / 2) * (NH + GAP_Y);

  // 카메라: 지금까지 보이는 열들을 화면에 담는다
  const noteTop = L.H - 236 - 100;   // BeatNote(아래 236px, 높이 약 84) 윗변 + 여유
  const cams: Camera[] = shows.map((s, b) => {
    const left = colX(0) - NW / 2 - 40, right = colX(s) + NW / 2 + 40;
    // 내용이 적으면 1.35배까지 다가가고, 많으면 화면에 담기도록 물러난다
    let zoom = Math.min(1.35, L.contentW / (right - left));
    let cy = L.H / 2;
    if (beatsData[b]?.note) {
      // 메모가 있는 비트: 보이는 내용(열 이름 ~ 맨 아래 노드)을 제목 아래 ~ 메모 위 사이에 맞춘다 (확대는 필요한 만큼만 줄이고 카메라를 옮긴다)
      let top = Infinity, bottom = -Infinity;
      for (let c = 0; c <= s; c++) {
        top = Math.min(top, nodeY(c, 0) - NH / 2 - 70);
        bottom = Math.max(bottom, nodeY(c, cols[c].nodes.length - 1) + NH / 2 + 12);
      }
      const screenTop = L.contentTop - 20;
      zoom = Math.min(zoom, (noteTop - screenTop) / (bottom - top));
      cy = (top + bottom) / 2 - ((screenTop + noteTop) / 2 - L.H / 2) / zoom;
    }
    return { cx: (left + right) / 2, cy, zoom };
  });

  // 열이 나타나는 진행도
  const colIn = (c: number) => {
    const fb = firstBeat[c];
    if (fb < 0 || fb > k) return 0;
    return enter(t, frame, beats[fb]?.at ?? 0, fps);
  };
  const focus = new Set(beatsData[k]?.focus || []);
  const prevFocus = new Set(k > 0 ? beatsData[k - 1]?.focus || [] : []);
  const focusOf = (label: string) => (focus.has(label) ? (prevFocus.has(label) ? 1 : p) : prevFocus.has(label) ? 1 - p : 0);
  const anyFocus = focus.size > 0 ? (prevFocus.size > 0 ? 1 : p) : prevFocus.size > 0 ? 1 - p : 0;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <StageCamera cams={cams} i={k} p={p} width={worldW}>
        {/* 연결선 */}
        <svg width={worldW} height={L.H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          {cols.slice(0, -1).map((col, c) => col.nodes.map((a, ja) => cols[c + 1].nodes.map((b, jb) => {
            const reveal = colIn(c + 1);
            if (reveal <= 0) return null;
            const x1 = colX(c) + NW / 2, y1 = nodeY(c, ja), x2 = colX(c + 1) - NW / 2 - 10, y2 = nodeY(c + 1, jb);
            const mx = (x1 + x2) / 2;
            const hot = Math.max(focusOf(a.label), focusOf(b.label));
            const color = hot > 0.5 ? t.primary : surf.line;
            return (
              <g key={`${c}-${ja}-${jb}`} opacity={1 - anyFocus * 0.6 * (1 - hot)}>
                <SPath d={`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`} stroke={color} sw={hot > 0.5 ? 5 : 3} reveal={ease(frame, (beats[firstBeat[c + 1]]?.at ?? 0), (beats[firstBeat[c + 1]]?.at ?? 0) + 16)} seed={`edge${c}${ja}${jb}`} />
                {reveal > 0.8 && <SCircle cx={x2 + 4} cy={y2} r={7} fill={color} stroke={color} sw={2} seed={`dot${c}${ja}${jb}`} />}
              </g>
            );
          })))}
        </svg>
        {/* 열 이름 + 노드 */}
        {cols.map((col, c) => {
          const cin = colIn(c);
          if (cin <= 0.001) return null;
          const top = nodeY(c, 0) - NH / 2;
          return (
            <React.Fragment key={c}>
              {col.label && (
                <div style={{ ...keepAll, position: 'absolute', left: colX(c) - NW / 2 - 20, width: NW + 40, top: top - 62, textAlign: 'center', fontSize: 30, fontWeight: 800, color: sub, opacity: cin * (1 - anyFocus * 0.4) }}>{col.label}</div>
              )}
              {col.nodes.map((nd, j) => {
                const nin = enter(t, frame, (beats[firstBeat[c]]?.at ?? 0) + j * 6, fps);
                const f = focusOf(nd.label);
                const dim = 1 - anyFocus * 0.6 * (1 - f);
                return (
                  <div key={j} style={{ position: 'absolute', left: colX(c) - NW / 2, top: nodeY(c, j) - NH / 2, width: NW, height: NH,
                    opacity: Math.min(1, nin * 1.3) * dim, transform: `translateY(${(1 - nin) * t.skin.motion.distance}px) scale(${1 + 0.06 * f})` }}>
                    <ItemCard label={nd.label} sub={nd.sub} icon={nd.icon} w={NW} h={NH} surf={surf} focus={f} seed={`node${c}${j}`} draw={nin} />
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}
      </StageCamera>
      <BeatTitle titles={beatsData.map((b) => b.title)} beats={beats} i={k} ink={ink} />
      <BeatNote text={beatsData[k]?.note} at={beats[k]?.at ?? 0} surf={surf} />
    </div>
  );
};

export default Flow;
