import React from 'react';
import { Composition, getInputProps } from 'remotion';
import './fonts.css';
import { MotionVideo } from './motion/MotionVideo';
import { Thumbnail } from './thumbnail/Thumbnail';

export const RemotionRoot = () => {
  const input = getInputProps() as any;
  return (
    <>
    <Composition
      id="Motion"
      component={MotionVideo as any}
      defaultProps={input}
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
      defaultProps={input}
      durationInFrames={1}
      fps={30}
      calculateMetadata={async ({ props }: { props: any }) => ({ width: props.width || 1280, height: props.height || 720 })}
    />
    </>
  );
};
