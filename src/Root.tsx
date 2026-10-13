import React from 'react';
import { Composition, Folder, getInputProps } from 'remotion';
import './fonts.css';
import { MotionVideo } from './motion/MotionVideo';
import { Thumbnail } from './thumbnail/Thumbnail';
import mockTemplates from './templates/mockProps.json';

const CATEGORIES: Record<string, string[]> = {
  '1-Information': ['headline', 'title_card', 'chapter_card', 'callout', 'outro', 'brand_intro'],
  '2-Structure': ['list', 'steps', 'flow', 'timeline', 'card_set', 'tiles', 'document_form'],
  '3-Comparison': ['compare', 'contrast', 'board'],
  '4-Data-Charts': ['counter', 'bar_chart', 'growth_line', 'radar', 'people_ratio'],
  '5-Special': ['quiz', 'phone_screen', 'taiwan_map', 'globe', 'doodle_scene', 'icon_series'],
};

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
