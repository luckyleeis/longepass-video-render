import React from 'react';
import { Composition, Folder, getInputProps } from 'remotion';
import './fonts.css';
import { MotionVideo } from './motion/MotionVideo';
import { Thumbnail } from './thumbnail/Thumbnail';
import mockTemplates from './templates/mockProps.json';

// 템플릿 목록은 명세(manifest)의 category 로 자동으로 묶는다 (bin/studio check 가 만드는 mockProps.json) — 새 템플릿이 빠지지 않게
const CATEGORY_ORDER = ['opener', 'structure', 'emphasis', 'story', 'number', 'organize', 'compare', 'chart', 'space', 'outro'];
const CATEGORIES: Record<string, string[]> = (() => {
  const groups: Record<string, string[]> = {};
  Object.entries(mockTemplates as Record<string, any>).forEach(([tid, tm]) => {
    const cat = tm.category || 'etc';
    (groups[cat] = groups[cat] || []).push(tid);
  });
  const cats = Object.keys(groups).sort((a, b) => (CATEGORY_ORDER.indexOf(a) + 99) % 99 - (CATEGORY_ORDER.indexOf(b) + 99) % 99);
  return Object.fromEntries(cats.map((c, i) => [`${i + 1}-${c}`, groups[c].sort()]));
})();

const defaultMotionProps = (mockTemplates as any)['bar_chart']?.props || {};
const defaultThumbProps = {
  theme: defaultMotionProps.theme,
  text: 'LONGEPASS 考照攻略',
  badge: '熱門推薦',
  object: 'certificate',
};

export const RemotionRoot = () => {
  const input = getInputProps() as any;
  const motionProps = (input && input.shots) ? input : defaultMotionProps;
  const thumbProps = (input && input.text) ? input : defaultThumbProps;

  return (
    <>
      <Composition
        id="Motion"
        component={MotionVideo as any}
        defaultProps={motionProps}
        calculateMetadata={async ({ props }: { props: any }) => ({
          durationInFrames: Math.max(1, props.total_frames || 30),
          width: props.width || 1920,
          height: props.height || 1080,
          fps: props.fps || 30,
        })}
      />
      <Composition
        id="Thumbnail"
        component={Thumbnail as any}
        defaultProps={thumbProps}
        durationInFrames={1}
        fps={30}
        calculateMetadata={async ({ props }: { props: any }) => ({
          width: props.width || 1280,
          height: props.height || 720,
        })}
      />

      <Folder name="Templates">
        {Object.entries(CATEGORIES).map(([catName, ids]) => (
          <Folder key={catName} name={catName}>
            {ids.map((tid) => {
              const tm = (mockTemplates as any)[tid];
              if (!tm) return null;
              return (
                <Composition
                  key={tid}
                  id={tid.replace(/_/g, '-')}
                  component={MotionVideo as any}
                  defaultProps={tm.props}
                  durationInFrames={tm.total_frames}
                  width={tm.width || 1920}
                  height={tm.height || 1080}
                  fps={tm.fps || 30}
                />
              );
            })}
          </Folder>
        ))}
      </Folder>
    </>
  );
};
