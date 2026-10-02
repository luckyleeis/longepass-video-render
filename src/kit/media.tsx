import React, { useLayoutEffect, useRef, useState } from 'react';
import rough from 'roughjs';
import type { Options as RoughOptions } from 'roughjs/bin/core';
import * as Tb from 'react-icons/tb';
import { useMotionTheme } from './theme';

/**
 * 그림 재료 층.
 * 템플릿은 박스/원/선/강조/아이콘/사람을 직접 그리지 않고 여기 부품을 쓴다.
 * 스타일의 theme.media.kind 에 따라 같은 부품이 다르게 그려진다.
 *   clean  : 깔끔한 벡터 (CSS/SVG 그대로)
 *   sketch : 손그림 (rough.js — 흔들리는 선, 빗금 채우기, 선이 그려지며 등장)
 * 새 재료를 추가할 때는 이 파일의 부품마다 분기를 하나씩 더한다.
 */

export type MediaKind = 'clean' | 'sketch';
export interface MediaSpec {
  kind: MediaKind;
  roughness?: number;   // 선이 얼마나 흔들리나
  bowing?: number;      // 직선이 얼마나 휘나
  fillStyle?: string;   // hachure | solid | zigzag | cross-hatch | dots
  hachureGap?: number;  // 빗금 간격
  fillWeight?: number;  // 빗금 굵기
}

export const useMedia = (): MediaSpec => useMotionTheme().media || { kind: 'clean' };

const gen = rough.generator();

/** 문자열 → 고정 시드 (매 프레임 같은 손그림 모양이 나오도록) */
const seedOf = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (Math.abs(h) % 2147483646) + 1;
};

const roughOpts = (m: MediaSpec, o: { fill?: string; stroke?: string; sw?: number; seed: string; fillStyle?: string; rough?: number }): RoughOptions => ({
  roughness: (m.roughness ?? 1.2) * (o.rough ?? 1),
  disableMultiStroke: (o.rough ?? 1) < 0.5,
  bowing: m.bowing ?? 1,
  stroke: o.stroke && o.stroke !== 'none' ? o.stroke : 'none',
  strokeWidth: o.sw ?? 2,
  fill: o.fill && o.fill !== 'none' && o.fill !== 'transparent' ? o.fill : undefined,
  fillStyle: o.fillStyle || m.fillStyle || 'hachure',
  hachureGap: m.hachureGap ?? 8,
  fillWeight: m.fillWeight ?? Math.max(1.5, (o.sw ?? 2) * 0.6),
  seed: seedOf(o.seed),
});

/** rough 도형 → SVG path들. draw(0→1)로 선이 그려지며 나타난다 */
const RoughPaths: React.FC<{ drawable: ReturnType<typeof gen.path>; draw?: number; opacity?: number }> = ({ drawable, draw = 1, opacity }) => (
  <g opacity={opacity}>
    {gen.toPaths(drawable).map((p, i) => (
      <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill || 'none'} strokeLinecap="round" strokeLinejoin="round"
        {...(draw < 1 ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - Math.max(0, draw) } : {})} />
    ))}
  </g>
);

const roundedRectPath = (x: number, y: number, w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + rr} ${y} H${x + w - rr} Q${x + w} ${y} ${x + w} ${y + rr} V${y + h - rr} Q${x + w} ${y + h} ${x + w - rr} ${y + h} H${x + rr} Q${x} ${y + h} ${x} ${y + h - rr} V${y + rr} Q${x} ${y} ${x + rr} ${y} Z`;
};

// ---------------------------------------------------------------- SVG 안에서 쓰는 도형
type ShapeStyle = {
  fill?: string; stroke?: string; sw?: number; opacity?: number;
  draw?: number;     // 손그림 재료에서 선이 그려지는 진행도 (clean에서는 무시)
  reveal?: number;   // 모든 재료에서 선이 그려지는 진행도 (체크 표시 등)
  subtle?: boolean;  // 배경 도형: 손그림 재료에서는 채우기 없이 윤곽만
  seed?: string;
  rough?: number;    // 손그림 흔들림 배율 (작은 도형·아이콘은 작게)
  strokeLinecap?: 'round' | 'butt' | 'square';
  strokeDasharray?: string;
  style?: React.CSSProperties;
};

const revealProps = (reveal?: number) => (reveal !== undefined && reveal < 1 ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - Math.max(0, reveal) } : {});

const sketchFill = (s: ShapeStyle) => (s.subtle ? undefined : s.fill);

export const SRect: React.FC<ShapeStyle & { x: number; y: number; w: number; h: number; rx?: number }> = (s) => {
  const m = useMedia();
  if (m.kind === 'sketch') {
    const d = roughOpts(m, { fill: sketchFill(s), stroke: s.stroke, sw: s.sw, seed: s.seed || `r${s.x},${s.y},${s.w}`, rough: s.rough });
    return <g style={s.style}><RoughPaths drawable={gen.path(roundedRectPath(s.x, s.y, s.w, s.h, s.rx || 0), d)} draw={s.draw ?? s.reveal} opacity={s.opacity} /></g>;
  }
  return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill || 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} strokeDasharray={s.strokeDasharray} style={s.style} />;
};

export const SCircle: React.FC<ShapeStyle & { cx: number; cy: number; r: number }> = (s) => {
  const m = useMedia();
  if (m.kind === 'sketch') {
    const d = roughOpts(m, { fill: sketchFill(s), stroke: s.stroke, sw: s.sw, seed: s.seed || `c${s.cx},${s.cy},${s.r}`, rough: s.rough });
    return <g style={s.style}><RoughPaths drawable={gen.circle(s.cx, s.cy, s.r * 2, d)} draw={s.draw ?? s.reveal} opacity={s.opacity} /></g>;
  }
  return <circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill || 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} strokeDasharray={s.strokeDasharray} style={s.style} />;
};

export const SPath: React.FC<ShapeStyle & { d: string; strokeLinejoin?: 'round' | 'miter' }> = (s) => {
  const m = useMedia();
  if (m.kind === 'sketch') {
    const d = roughOpts(m, { fill: sketchFill(s), stroke: s.stroke, sw: s.sw, seed: s.seed || `p${s.d.slice(0, 40)}`, rough: s.rough });
    return <g style={s.style}><RoughPaths drawable={gen.path(s.d, d)} draw={s.draw ?? s.reveal} opacity={s.opacity} /></g>;
  }
  return <path d={s.d} fill={s.fill || 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} strokeLinecap={s.strokeLinecap} strokeLinejoin={s.strokeLinejoin}
    strokeDasharray={s.strokeDasharray} style={s.style} {...revealProps(s.reveal)} />;
};

export const SLine: React.FC<ShapeStyle & { x1: number; y1: number; x2: number; y2: number }> = (s) => {
  const m = useMedia();
  if (m.kind === 'sketch') {
    const d = roughOpts(m, { stroke: s.stroke, sw: s.sw, seed: s.seed || `l${s.x1},${s.y1}`, rough: s.rough });
    return <g style={s.style}><RoughPaths drawable={gen.line(s.x1, s.y1, s.x2, s.y2, d)} draw={s.draw ?? s.reveal} opacity={s.opacity} /></g>;
  }
  return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} strokeLinecap={s.strokeLinecap || 'round'} style={s.style} {...revealProps(s.reveal)} />;
};

/**
 * 점 무리 (지구본 육지, 산점 등 수천 개). 손그림 재료에서는 점마다 위치/크기를 살짝 흔들어 점묘처럼.
 * points: [x, y, 투명도(0~1)?] — rough.js로 하나씩 그리기엔 많아서 두 재료 모두 원으로 그린다.
 */
export const SDots: React.FC<{ points: Array<[number, number, number?]>; r: number; color: string; seed?: string }> = ({ points, r, color, seed = 'dots' }) => {
  const m = useMedia();
  const jit = m.kind === 'sketch';
  const base = seedOf(seed);
  return (
    <g fill={color}>
      {points.map(([x, y, o], i) => {
        const h = jit ? ((Math.imul(base ^ (i + 1), 2654435761) >>> 0) % 1000) / 1000 : 0.5;
        return <circle key={i} cx={x + (jit ? (h - 0.5) * r : 0)} cy={y + (jit ? (0.5 - h) * r * 0.8 : 0)} r={r * (jit ? 0.7 + h * 0.6 : 1)} opacity={o ?? 1} />;
      })}
    </g>
  );
};

// ---------------------------------------------------------------- HTML 상자 (내용이 들어가는 것)
/** 요소의 레이아웃 크기 (transform 무시). 손그림 재료는 크기를 알아야 그릴 수 있다 */
const useBox = (enabled: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    if (!enabled || !ref.current) return;
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    if (w !== box.w || h !== box.h) setBox({ w, h });
  });
  return { ref, box };
};

export interface PanelProps {
  fill?: string;            // 바탕색 (없으면 투명)
  stroke?: string | null;   // 테두리 색
  sw?: number;              // 테두리 두께
  radius?: number;
  shadow?: string;          // CSS box-shadow (clean)
  edge?: { side: 'left' | 'top'; color: string; width: number };  // 한쪽 굵은 색 띠
  draw?: number;            // 손그림: 테두리가 그려지는 진행도
  fillStyle?: string;       // 손그림: 채우기 방식 (내용이 있으면 기본 solid — 빗금 위 글자는 읽기 어렵다, 없으면 재료 설정)
  seed?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/** 카드/상자. 내용(children)은 그대로 두고 바탕과 테두리만 재료에 맞게 그린다 */
export const Panel: React.FC<PanelProps> = ({ fill, stroke, sw = 0, radius = 0, shadow, edge, draw = 1, fillStyle, seed, style, children }) => {
  const m = useMedia();
  const sketch = m.kind === 'sketch';
  const { ref, box } = useBox(sketch);
  if (!sketch) {
    return (
      <div style={{
        background: fill, border: stroke && sw ? `${sw}px solid ${stroke}` : 'none', borderRadius: radius, boxShadow: shadow,
        ...(edge ? { [edge.side === 'left' ? 'borderLeft' : 'borderTop']: `${edge.width}px solid ${edge.color}` } : {}),
        ...style,
      }}>{children}</div>
    );
  }
  const pad = sw || 2;
  const { background, boxShadow, border, ...rest } = style || {};
  return (
    <div ref={ref} style={{ position: 'relative', isolation: 'isolate', ...rest }}>
      {box.w > 0 && (
        <svg width={box.w + pad * 4} height={box.h + pad * 4} style={{ position: 'absolute', left: -pad * 2, top: -pad * 2, overflow: 'visible', pointerEvents: 'none', zIndex: -1 }}>
          <g transform={`translate(${pad * 2}, ${pad * 2})`}>
            <RoughPaths draw={draw} drawable={gen.path(roundedRectPath(0, 0, box.w, box.h, radius), roughOpts(m, { fill, stroke: stroke || undefined, sw: Math.max(2, sw), seed: seed || `panel${box.w}x${box.h}`, fillStyle: fillStyle || (children ? 'solid' : undefined) }))} />
            {edge && (edge.side === 'left'
              ? <RoughPaths draw={draw} drawable={gen.line(edge.width / 2, 6, edge.width / 2, box.h - 6, roughOpts(m, { stroke: edge.color, sw: edge.width * 0.7, seed: `${seed}edge` }))} />
              : <RoughPaths draw={draw} drawable={gen.line(6, edge.width / 2, box.w - 6, edge.width / 2, roughOpts(m, { stroke: edge.color, sw: edge.width * 0.7, seed: `${seed}edge` }))} />)}
          </g>
        </svg>
      )}
      {children}
    </div>
  );
};

/** 원 (번호 배지, VS 등). 내용은 가운데 */
export const Dot: React.FC<{ size: number; fill?: string; stroke?: string | null; sw?: number; draw?: number; seed?: string; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  size, fill, stroke, sw = 0, draw = 1, seed, style, children,
}) => {
  const m = useMedia();
  const center: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
  if (m.kind !== 'sketch') {
    return <div style={{ width: size, height: size, borderRadius: '50%', background: fill, border: stroke && sw ? `${sw}px solid ${stroke}` : 'none', ...center, ...style }}>{children}</div>;
  }
  const { background, border, ...rest } = style || {};
  return (
    <div style={{ position: 'relative', isolation: 'isolate', width: size, height: size, ...center, ...rest }}>
      <svg width={size + 8} height={size + 8} style={{ position: 'absolute', left: -4, top: -4, overflow: 'visible', zIndex: -1 }}>
        <RoughPaths draw={draw} drawable={gen.circle(size / 2 + 4, size / 2 + 4, size, roughOpts(m, { fill, stroke: stroke || undefined, sw: Math.max(2, sw), seed: seed || `dot${size}`, fillStyle: children ? 'solid' : undefined }))} />
      </svg>
      {children}
    </div>
  );
};

/**
 * 막대/선 (진행선, 밑줄, 제목 옆 막대, 차트 막대). 위치/크기는 style로 (퍼센트 가능, 자라는 길이도 style.width로).
 * vertical이면 세로 막대. 굵기 18px 이하는 손그림에서 한 획 선으로 그린다.
 */
export const Bar: React.FC<{ color: string; radius?: number; vertical?: boolean; outline?: string | null; sw?: number; seed?: string; style?: React.CSSProperties }> = ({
  color, radius = 0, vertical, outline, sw = 0, seed, style,
}) => {
  const m = useMedia();
  const sketch = m.kind === 'sketch';
  const { ref, box } = useBox(sketch);
  if (!sketch) {
    return <div style={{ background: color, borderRadius: radius, border: outline && sw ? `${sw}px solid ${outline}` : 'none', ...style }} />;
  }
  const { background, border, ...rest } = style || {};
  const thin = vertical ? box.w <= 18 : box.h <= 18;
  return (
    <div ref={ref} style={rest}>
      {box.w > 0 && (
        <svg width={box.w} height={box.h} style={{ overflow: 'visible', display: 'block' }}>
          {thin
            ? <RoughPaths drawable={vertical
              ? gen.line(box.w / 2, 0, box.w / 2, box.h, roughOpts(m, { stroke: color, sw: Math.max(2, box.w * 0.8), seed: seed || `bar${box.h}` }))
              : gen.line(0, box.h / 2, box.w, box.h / 2, roughOpts(m, { stroke: color, sw: Math.max(2, box.h * 0.8), seed: seed || `bar${box.w}` }))} />
            : <RoughPaths drawable={gen.path(roundedRectPath(0, 0, box.w, box.h, radius), roughOpts(m, { fill: color, stroke: outline || color, sw: Math.max(2, sw), seed: seed || `bar${box.w}x${box.h}` }))} />}
        </svg>
      )}
    </div>
  );
};

/** 강조 띠 (형광펜/알약/밑줄). style에 위치와 transform을 넣는다 (skin.ts highlightStyle) */
export const Mark: React.FC<{ style: React.CSSProperties; seed?: string }> = ({ style, seed }) => {
  const m = useMedia();
  const sketch = m.kind === 'sketch';
  const { ref, box } = useBox(sketch);
  if (!sketch) return <span style={style} />;
  const { background, borderRadius, opacity, ...rest } = style;
  const color = String(background || '');
  return (
    <span ref={ref as any} style={{ ...rest, display: 'block', opacity }}>
      {box.w > 0 && (
        <svg width={box.w} height={box.h} style={{ overflow: 'visible', display: 'block' }}>
          {/* 형광펜으로 두세 번 문지른 자국 */}
          <RoughPaths drawable={gen.rectangle(0, 0, box.w, box.h, roughOpts(m, { fill: color, sw: 0, seed: seed || `mark${box.w}`, fillStyle: 'zigzag' }))} />
        </svg>
      )}
    </span>
  );
};

// ---------------------------------------------------------------- 아이콘 (Tabler, MIT)
const ICONS: Record<string, keyof typeof Tb> = {
  doc: 'TbFileText', warning: 'TbAlertTriangle', tip: 'TbBulb', info: 'TbInfoCircle', check: 'TbCheck', x: 'TbX',
  star: 'TbStar', user: 'TbUser', users: 'TbUsers', calendar: 'TbCalendar', clock: 'TbClock', cash: 'TbCash', coin: 'TbCoin',
  bank: 'TbBuildingBank', certificate: 'TbCertificate', id: 'TbId', school: 'TbSchool', briefcase: 'TbBriefcase', tool: 'TbTool',
  home: 'TbHome', phone: 'TbDeviceMobile', mail: 'TbMail', search: 'TbSearch', target: 'TbTarget', trend: 'TbTrendingUp',
  chart: 'TbChartBar', pie: 'TbChartPie', globe: 'TbWorld', pin: 'TbMapPin', shield: 'TbShieldCheck', question: 'TbHelp',
  arrow: 'TbArrowRight', bolt: 'TbBolt', leaf: 'TbLeaf', heart: 'TbHeart', gift: 'TbGift', lock: 'TbLock', download: 'TbDownload',
  // 장면 소품 (doodle_scene, people_ratio)
  laptop: 'TbDeviceLaptop', desktop: 'TbDeviceDesktop', wallet: 'TbWallet', store: 'TbBuildingStore', building: 'TbBuilding',
  cart: 'TbShoppingCart', register: 'TbCashRegister', book: 'TbBook', pencil: 'TbPencil', hammer: 'TbHammer', helmet: 'TbHelmet',
  car: 'TbCar', bus: 'TbBus', train: 'TbTrain', plane: 'TbPlane', truck: 'TbTruck', bike: 'TbBike', coffee: 'TbCoffee', bed: 'TbBed',
  door: 'TbDoor', chair: 'TbArmchair', desk: 'TbDesk', trophy: 'TbTrophy', medal: 'TbMedal', flag: 'TbFlag', hourglass: 'TbHourglass',
  piggy: 'TbPigMoney', receipt: 'TbReceipt', call: 'TbPhone', chat: 'TbMessageCircle', stethoscope: 'TbStethoscope', chef: 'TbChefHat',
  plant: 'TbPlant', sun: 'TbSun', moon: 'TbMoon', rain: 'TbCloudRain', key: 'TbKey', box: 'TbBox', clipboard: 'TbClipboardCheck',
  barrier: 'TbBarrierBlock', stairs: 'TbStairs', mountain: 'TbMountain', road: 'TbRoad', printer: 'TbPrinter', camera: 'TbCamera',
};
export const ICON_NAMES = Object.keys(ICONS);

type IconEl = { type: string; props: Record<string, any> };
const iconCache: Record<string, IconEl[]> = {};
/** react-icons 요소 트리에서 도형만 뽑는다 (손그림 재료가 같은 도형을 다시 그리도록) */
const iconShapes = (name: string): IconEl[] => {
  if (iconCache[name]) return iconCache[name];
  const comp = (Tb as any)[ICONS[name] || ICONS.question];
  const out: IconEl[] = [];
  const walk = (e: any) => {
    if (!e || typeof e !== 'object') return;
    if (typeof e.type === 'string' && e.type !== 'svg' && e.props?.stroke !== 'none') out.push({ type: e.type, props: e.props });
    const c = e.props?.children;
    (Array.isArray(c) ? c : [c]).forEach(walk);
  };
  walk(comp({}));
  iconCache[name] = out;
  return out;
};

/** 선 아이콘 (24x24 기준). name은 ICON_NAMES 중 하나 */
export const Icon: React.FC<{ name: string; size: number; color: string; sw?: number; draw?: number; style?: React.CSSProperties }> = ({ name, size, color, sw = 2, draw, style }) => {
  const shapes = iconShapes(name);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ overflow: 'visible', ...style }}>
      {shapes.map((s, i) => {
        const common = { stroke: color, sw, draw, seed: `${name}${i}`, rough: 0.3 };  // 24칸 아이콘: 흔들림을 작게
        if (s.type === 'path') return <SPath key={i} d={s.props.d} fill={s.props.fill === 'currentColor' ? color : 'none'} {...common} strokeLinecap="round" strokeLinejoin="round" />;
        if (s.type === 'circle') return <SCircle key={i} cx={+s.props.cx} cy={+s.props.cy} r={+s.props.r} {...common} />;
        if (s.type === 'rect') return <SRect key={i} x={+s.props.x} y={+s.props.y} w={+s.props.width} h={+s.props.height} rx={+(s.props.rx || 0)} {...common} />;
        if (s.type === 'line') return <SLine key={i} x1={+s.props.x1} y1={+s.props.y1} x2={+s.props.x2} y2={+s.props.y2} {...common} />;
        return null;
      })}
    </svg>
  );
};

// ---------------------------------------------------------------- 사람 픽토그램
/** 사람: bust(흉상, 업무 지도형 영상의 주인공) / standing(서 있는 픽토그램) */
export const Person: React.FC<{ size: number; color: string; variant?: 'bust' | 'standing'; draw?: number; seed?: string; style?: React.CSSProperties }> = ({
  size, color, variant = 'bust', draw, seed = 'person', style,
}) => (
  <svg width={size} height={variant === 'bust' ? size : size * 2} viewBox={variant === 'bust' ? '0 0 100 100' : '0 0 100 200'} style={{ overflow: 'visible', ...style }}>
    {variant === 'bust' ? (
      <>
        <SCircle cx={50} cy={32} r={20} fill={color} stroke={color} sw={2} draw={draw} seed={`${seed}h`} />
        <SPath d="M14 96 C14 66 30 58 50 58 C70 58 86 66 86 96 Z" fill={color} stroke={color} sw={2} draw={draw} seed={`${seed}b`} />
      </>
    ) : (
      <>
        <SCircle cx={50} cy={22} r={16} fill={color} stroke={color} sw={2} draw={draw} seed={`${seed}h`} />
        <SPath d="M30 48 H70 Q78 48 78 56 V108 H66 V190 H54 V128 H46 V190 H34 V108 H22 V56 Q22 48 30 48 Z" fill={color} stroke={color} sw={2} draw={draw} seed={`${seed}b`} />
      </>
    )}
  </svg>
);
