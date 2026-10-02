import React from 'react';
import { SCircle, SPath, SRect } from './media';

/**
 * 관절 인형 (픽토그램 사람). 머리 + 몸통 + 팔다리 두 마디를 관절 각도로 그린다.
 * - 코드로만 그려서 라이선스가 없고, 같은 사람이 영상 내내 같은 모습으로 나온다
 * - 자세(pose)끼리 각도를 섞어 부드럽게 바뀐다 (blendPose)
 * - 선/원은 그림 재료 층 부품이라 손그림 재료에서는 마커로 그린 사람이 되고, 그려지며 등장한다(draw)
 *
 * 좌표: 100 x 200 상자, 발끝 y≈196. 각도: 0 = 아래, +90 = 화면 오른쪽, ±180 = 위
 */

type Limb = [number, number];  // [윗마디 각도, 아랫마디 각도] (절대 각도)
export type PoseDef = { armL: Limb; armR: Limb; legL: Limb; legR: Limb; lean?: number; headDy?: number; prop?: 'phone' };

export const POSES: Record<string, PoseDef> = {
  stand: { armL: [-8, -4], armR: [8, 4], legL: [-5, -2], legR: [5, 2] },
  walk: { armL: [-28, -10], armR: [24, 40], legL: [-22, -6], legR: [20, 4], lean: 4 },
  run: { armL: [-50, -100], armR: [50, 125], legL: [-38, -8], legR: [42, -25], lean: 10 },
  wait: { armL: [-8, -4], armR: [25, 130], legL: [-5, -2], legR: [5, 2], headDy: 3 },
  think: { armL: [-20, 70], armR: [15, 160], legL: [-5, -2], legR: [5, 2] },
  point: { armL: [-8, -4], armR: [95, 90], legL: [-8, -4], legR: [8, 4] },
  cheer: { armL: [-150, -165], armR: [150, 165], legL: [-12, -6], legR: [12, 6] },
  sad: { armL: [6, 14], armR: [-6, -14], legL: [-3, -1], legR: [3, 1], headDy: 13, lean: -6 },
  phone: { armL: [-8, -4], armR: [20, 150], legL: [-5, -2], legR: [5, 2], headDy: 2, prop: 'phone' },
  shrug: { armL: [-55, -140], armR: [55, 140], legL: [-6, -3], legR: [6, 3] },
  hold: { armL: [-20, 60], armR: [20, -60], legL: [-5, -2], legR: [5, 2] },
};
export const POSE_NAMES = Object.keys(POSES);

const mix = (a: number, b: number, p: number) => a + (b - a) * p;
const mixLimb = (a: Limb, b: Limb, p: number): Limb => [mix(a[0], b[0], p), mix(a[1], b[1], p)];

/** 두 자세 사이 (p = 0 → a, 1 → b) */
export const blendPose = (a: PoseDef, b: PoseDef, p: number): PoseDef => ({
  armL: mixLimb(a.armL, b.armL, p), armR: mixLimb(a.armR, b.armR, p),
  legL: mixLimb(a.legL, b.legL, p), legR: mixLimb(a.legR, b.legR, p),
  lean: mix(a.lean ?? 0, b.lean ?? 0, p), headDy: mix(a.headDy ?? 0, b.headDy ?? 0, p),
  prop: p < 0.5 ? a.prop : b.prop,
});

const RAD = Math.PI / 180;
const step = (x: number, y: number, deg: number, len: number): [number, number] => [x + Math.sin(deg * RAD) * len, y + Math.cos(deg * RAD) * len];

/** 사람 하나. size = 높이(px). mirror = 좌우 반전 (오른쪽을 보는 자세를 왼쪽으로) */
export const Figure: React.FC<{ pose: string | PoseDef; size: number; color: string; mirror?: boolean; draw?: number; seed?: string; paper?: string }> = ({
  pose, size, color, mirror, draw, seed = 'fig', paper = '#ffffff',
}) => {
  const P = typeof pose === 'string' ? POSES[pose] || POSES.stand : pose;
  const lean = P.lean ?? 0;
  const hip: [number, number] = [50, 118];
  const neck = step(hip[0], hip[1], 180 - lean, 52);
  const head: [number, number] = [neck[0] + Math.sin(lean * RAD) * 4, neck[1] - 20 + (P.headDy ?? 0)];
  const chest = step(hip[0], hip[1], 180 - lean, 42);
  // 어깨 두 점 (몸통이 기울면 같이 돈다)
  const sx = Math.cos(lean * RAD) * 15, sy = Math.sin(lean * RAD) * 15;
  const shoulderL: [number, number] = [chest[0] - sx, chest[1] + sy], shoulderR: [number, number] = [chest[0] + sx, chest[1] - sy];
  const limb = (from: [number, number], l: Limb, a: number, b: number) => {
    const m = step(from[0], from[1], l[0], a);
    const e = step(m[0], m[1], l[1], b);
    return { d: `M${from[0].toFixed(1)} ${from[1].toFixed(1)} L${m[0].toFixed(1)} ${m[1].toFixed(1)} L${e[0].toFixed(1)} ${e[1].toFixed(1)}`, end: e };
  };
  const armL = limb(shoulderL, P.armL, 31, 29), armR = limb(shoulderR, P.armR, 31, 29);
  const legL = limb([hip[0] - 8, hip[1]], P.legL, 38, 38), legR = limb([hip[0] + 8, hip[1]], P.legR, 38, 38);
  const common = { stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, draw, rough: 0.6 };
  return (
    <svg width={size / 2} height={size} viewBox="0 0 100 200" style={{ overflow: 'visible', transform: mirror ? 'scaleX(-1)' : undefined }}>
      <SPath d={legL.d} sw={14} seed={`${seed}ll`} {...common} />
      <SPath d={legR.d} sw={14} seed={`${seed}lr`} {...common} />
      <SPath d={`M${(hip[0] - 4).toFixed(1)} ${hip[1]} L${shoulderL[0].toFixed(1)} ${shoulderL[1].toFixed(1)} L${shoulderR[0].toFixed(1)} ${shoulderR[1].toFixed(1)} L${(hip[0] + 4).toFixed(1)} ${hip[1]} Z`} fill={color} sw={14} seed={`${seed}body`} {...common} />
      <SPath d={armL.d} sw={12} seed={`${seed}al`} {...common} />
      <SPath d={armR.d} sw={12} seed={`${seed}ar`} {...common} />
      <SCircle cx={head[0]} cy={head[1]} r={16} fill={color} stroke={color} sw={3} draw={draw} seed={`${seed}head`} />
      {P.prop === 'phone' && (
        <SRect x={armR.end[0] - 6} y={armR.end[1] - 14} w={13} h={22} rx={3} fill={paper} stroke={color} sw={3} draw={draw} seed={`${seed}phone`} />
      )}
    </svg>
  );
};
