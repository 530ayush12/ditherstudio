import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {ASSETS, COLORS, TYPE} from './tokens';

const IMAGES = [
  'assets/montage/01-real-color.png',
  'assets/montage/02-real-color.png',
  'assets/montage/03-real-color.png',
  'assets/montage/04-real-color.png',
  'assets/montage/05-real-color.png',
  'assets/montage/06-real-color.png',
  'assets/montage/07-real-color.png',
  'assets/montage/08-real-color.png',
  'assets/montage/09-real-color.png',
  'assets/montage/10-real-color.png',
  'assets/montage/11-real-color.png',
  'assets/montage/12-real-color.png',
  'assets/montage/13-real-color.png',
  'assets/montage/14-real-color.png',
  'assets/montage/15-real-color.png',
  'assets/montage/16-real-color.png',
  'assets/montage/17-real-color.png',
  'assets/montage/18-real-color.png',
  'assets/montage/19-real-color.png',
  'assets/montage/20-real-color.png',
];

const HOLD = 15;
const MONTAGE_FRAMES = IMAGES.length * HOLD;

const MontageFrame: React.FC<{src: string}> = ({src}) => {
  return (
    <AbsoluteFill style={{background: COLORS.root}}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(0deg, rgba(9,13,10,.08), transparent 36%, rgba(9,13,10,.04))',
        }}
      />
    </AbsoluteFill>
  );
};

const FinalCard: React.FC = () => {
  return (
    <AbsoluteFill style={{background: COLORS.root, overflow: 'hidden'}}>
      <Img
        src={staticFile(ASSETS.mountain)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'pixelated',
          opacity: 0.92,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(9,13,10,.82), rgba(9,13,10,.32) 52%, rgba(9,13,10,.74)), linear-gradient(0deg, rgba(9,13,10,.72), rgba(9,13,10,.04) 45%, rgba(9,13,10,.36))',
        }}
      />
      <div style={{position: 'absolute', left: 102, right: 102, bottom: 122}}>
        <div
          style={{
            fontFamily: '"Gaius Pixel", "Geist Pixel", "Geist Mono", ui-monospace, monospace',
            fontSize: 166,
            lineHeight: 0.82,
            fontWeight: 900,
            letterSpacing: -2,
            textTransform: 'uppercase',
            color: COLORS.paperBright,
            textShadow: '0 6px 0 rgba(14,19,12,.36)',
          }}
        >
          Dither
          <br />
          Studio
        </div>
        <div
          style={{
            marginTop: 38,
            display: 'inline-block',
            padding: '24px 30px',
            background: COLORS.paper,
            color: COLORS.root,
            fontFamily: TYPE.mono,
            fontSize: 42,
            fontWeight: 780,
            clipPath: 'polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px))',
          }}
        >
          ditherstudio.ideatr.dev
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const LaunchVideo: React.FC = () => {
  const frame = useCurrentFrame();

  if (frame >= MONTAGE_FRAMES) {
    return (
      <AbsoluteFill>
        <Audio src={staticFile(ASSETS.audio)} volume={0.9} />
        <FinalCard />
      </AbsoluteFill>
    );
  }

  const index = Math.min(IMAGES.length - 1, Math.floor(frame / HOLD));

  return (
    <AbsoluteFill>
      <Audio src={staticFile(ASSETS.audio)} volume={0.82} />
      <MontageFrame src={IMAGES[index]} />
    </AbsoluteFill>
  );
};
