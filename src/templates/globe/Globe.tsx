import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { TemplateProps } from '../../kit/types';
import { useMotionTheme } from '../../kit/theme';
import { useLayout } from '../../kit/layout';
import { ease, enter } from '../../kit/skin';
import { keepAll } from '../../kit/parts';
import { KineticLines, kineticSize } from '../../kit/kinetic';
import { Panel, SCircle, SDots, SPath } from '../../kit/media';
import LAND from './land_dots.json';
import PLACES from './places.json';

type Place = { lon: number; lat: number; name: Record<string, string> };
const places = PLACES as unknown as Record<string, Place>;
const land = (LAND as unknown as { points: Array<[number, number]> }).points;
const RAD = Math.PI / 180;

/** 정사영(지구본) 투영. 반환 [x, y, 앞면 정도(>0이면 보임)] */
const project = (lon: number, lat: number, lon0: number, lat0: number, R: number, cx: number, cy: number, lift = 1): [number, number, number] => {
  const l = (lon - lon0) * RAD, p = lat * RAD, p0 = lat0 * RAD;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  const x = R * lift * Math.cos(p) * Math.sin(l);
  const y = R * lift * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l));
  return [cx + x, cy - y, cosc];
};

/** 두 지점 사이 대원(최단 경로) 위의 점들 (경도, 위도, 0~1 위치) */
const greatCircle = (a: Place, b: Place, steps: number): Array<[number, number, number]> => {
  const toV = (q: Place) => [Math.cos(q.lat * RAD) * Math.cos(q.lon * RAD), Math.cos(q.lat * RAD) * Math.sin(q.lon * RAD), Math.sin(q.lat * RAD)];
  const va = toV(a), vb = toV(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const om = Math.acos(dot) || 1e-6;
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const k1 = Math.sin((1 - s) * om) / Math.sin(om), k2 = Math.sin(s * om) / Math.sin(om);
    const v = [k1 * va[0] + k2 * vb[0], k1 * va[1] + k2 * vb[1], k1 * va[2] + k2 * vb[2]];
    out.push([Math.atan2(v[1], v[0]) / RAD, Math.asin(Math.max(-1, Math.min(1, v[2]))) / RAD, s]);
  }
  return out;
};

/**
 * 지구본: 점으로 된 육지가 천천히 돌고, 출발지에서 목적지들로 호가 차례로 그려진다.
 * 장소는 places.json의 키(taiwan, japan …). label이 없으면 스타일 언어의 이름을 쓴다.
 */
const Globe: React.FC<TemplateProps> = ({ data, ev, dur, ink, sub, surf }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useMotionTheme();
  const L = useLayout();
  const lang = t.lang || 'en';
  const nameOf = (key: string, label?: string) => label || places[key]?.name?.[lang] || places[key]?.name?.en || key;
  const origin = places[data.origin] || places.taiwan;
  const targets: Array<{ place: string; label?: string }> = (data.targets || []).filter((x: any) => places[x.place]);
  const lines: string[] = data.lines || [];
  const cx = L.W * 0.71, cy = L.H * 0.54, R = 370;
  const appear = enter(t, frame, 0, fps);
  // 시점: 출발지 쪽으로 돌아오며 아주 천천히 계속 돈다
  // 시점: 출발지와 목적지들의 가운데를 보며(모든 호가 앞면에 오도록) 천천히 돈다
  const all = [origin, ...targets.map((x) => places[x.place])];
  const vs = all.map((q) => [Math.cos(q.lat * RAD) * Math.cos(q.lon * RAD), Math.cos(q.lat * RAD) * Math.sin(q.lon * RAD), Math.sin(q.lat * RAD)]);
  const mv = [0, 1, 2].map((a) => vs.reduce((s, v) => s + v[a], 0) + (a < 2 ? vs[0][a] : vs[0][2]));  // 출발지에 가중치 2배
  const cLon = Math.atan2(mv[1], mv[0]) / RAD, cLat = Math.atan2(mv[2], Math.hypot(mv[0], mv[1])) / RAD;
  const lon0 = cLon + 28 * (1 - ease(frame, 0, Math.min(90, dur * 0.4))) - frame * 0.03;
  const lat0 = Math.max(-35, Math.min(35, cLat));

  const dots: Array<[number, number, number]> = [];
  for (const [lon, lat] of land) {
    const [x, y, c] = project(lon, lat, lon0, lat0, R, cx, cy);
    if (c > 0) dots.push([x, y, Math.min(1, c * 2.2) * 0.85]);
  }
  const [ox, oy, oc] = project(origin.lon, origin.lat, lon0, lat0, R, cx, cy);
  const tAt: number[] = ev.targets || targets.map((_, i) => 20 + i * 18);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '50%' }}>
        <KineticLines lines={lines} highlight={data.highlight} size={kineticSize(lines, 140)} align="left" at={ev.lines || []} ink={ink} sub={sub} surf={surf} />
      </div>
      <svg width={L.W} height={L.H} style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: appear }}>
        <SCircle cx={cx} cy={cy} r={R} fill={surf.fill} stroke={surf.line} sw={2} opacity={0.35} subtle seed="globe" />
        <SDots points={dots} r={3.4} color={surf.fillStrong} seed="land" />
        {targets.map((tg, i) => {
          const p = ease(frame, tAt[i], tAt[i] + 26);
          if (p <= 0) return null;
          const arc = greatCircle(origin, places[tg.place], 48);
          const n = Math.max(2, Math.round(arc.length * p));
          const pts = arc.slice(0, n).map(([lon, lat, s]) => project(lon, lat, lon0, lat0, R, cx, cy, 1 + 0.18 * Math.sin(Math.PI * s)));
          // 지구 뒤로 넘어가는 부분은 끊어서 그리지 않는다
          const d = pts.map(([x, y, c], j) => `${j && pts[j - 1][2] > -0.05 && c > -0.05 ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
          const [tx, ty, tc] = project(places[tg.place].lon, places[tg.place].lat, lon0, lat0, R, cx, cy);
          return (
            <g key={i}>
              <SPath d={d} stroke={t.primary} sw={5} strokeLinecap="round" seed={`arc${i}`} />
              {p > 0.98 && tc > -0.1 && <SCircle cx={tx} cy={ty} r={9} fill={t.accent} stroke={surf.bg} sw={3} seed={`tg${i}`} />}
            </g>
          );
        })}
        {oc > 0 && (
          <>
            <SCircle cx={ox} cy={oy} r={14 + 10 * ((frame % 45) / 45)} stroke={t.primary} sw={3} opacity={1 - (frame % 45) / 45} seed="pulse" />
            <SCircle cx={ox} cy={oy} r={12} fill={t.primary} stroke={surf.bg} sw={3} seed="origin" />
          </>
        )}
      </svg>
      {/* 장소 이름 */}
      {oc > 0 && (
        <div style={{ position: 'absolute', left: ox - 150, width: 300, top: oy + 22, display: 'flex', justifyContent: 'center', opacity: appear }}>
          <Panel fill={t.primary} radius={999} seed="origin-label" style={{ ...keepAll, padding: '4px 18px', color: t.skin.onColorInk, fontSize: 30, fontWeight: 900, whiteSpace: 'nowrap' }}>{nameOf(data.origin, data.origin_label)}</Panel>
        </div>
      )}
      {(() => {
        // 이름표가 겹치면 아래로 밀어낸다
        const placed: Array<[number, number]> = [[ox, oy + 40]];
        return targets.map((tg, i) => {
          const p = enter(t, frame, tAt[i] + 24, fps);
          const [tx, ty, tc] = project(places[tg.place].lon, places[tg.place].lat, lon0, lat0, R, cx, cy);
          let ly = ty - 58;
          for (let tries = 0; tries < 4 && placed.some(([px, py]) => Math.abs(px - tx) < 130 && Math.abs(py - ly) < 40); tries++) ly += 44;
          placed.push([tx, ly]);
          if (p <= 0.01 || tc < -0.1) return null;
          return (
          <div key={i} style={{ ...keepAll, position: 'absolute', left: tx - 120, width: 240, top: ly, textAlign: 'center', fontSize: 30, fontWeight: 900, color: ink, opacity: p * Math.min(1, (tc + 0.1) * 4), whiteSpace: 'nowrap' }}>
            {nameOf(tg.place, tg.label)}
          </div>
          );
        });
      })()}
    </div>
  );
};

export default Globe;
