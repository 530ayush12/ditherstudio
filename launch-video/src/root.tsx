import React from 'react';
import {Composition} from 'remotion';
import {LaunchVideo} from './video';

export const FPS = 30;
export const DURATION = 420;

export const Root: React.FC = () => (
  <Composition
    id="LaunchVideo"
    component={LaunchVideo}
    durationInFrames={DURATION}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
