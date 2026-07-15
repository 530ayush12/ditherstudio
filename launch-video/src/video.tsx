import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  Easing,
} from 'remotion';
import {ASSETS, COLORS, TYPE} from './tokens';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const out = Easing.bezier(0.16, 1, 0.3, 1);

const IMAGES = [
  'assets/montage/01-krishna-atkinson.png',
  'assets/montage/02-hanuman-moon.png',
  'assets/montage/03-hanuman-dance.png',
  'assets/montage/04-red-bayer.png',
  'assets/montage/05-mountain-bayer.png',
  'assets/montage/06-rocket.png',
  'assets/montage/07-waterfall.png',
  'assets/montage/08-canyon.png',
  'assets/montage/09-extra-bayer.png',
  'assets/montage/10-extra-image.png',
  'assets/montage/blue-cave-dither.png',
  'assets/montage/cosmic-deer-dither.png',
  'assets/montage/golden-fish-dither.png',
  'assets/montage/lotus-lake-dither.png',
  'assets/montage/moon-garden-dither.png',
  'assets/montage/neon-forest-dither.png',
  'assets/montage/peacock-clouds-dither.png',
  'assets/montage/rose-mountain-dither.png',
  'assets/montage/saffron-cliffs-dither.png',
  'assets/montage/temple-rain-dither.png',
];

const HOLD = 15;
const MONTAGE_FRAMES = IMAGES.length * HOLD;

const fitMode = (src: string) => {
  if (src.includes('mountain') || src.includes('waterfall') || src.includes('canyon')) return 'cover';
  return 'cover';
};

const MontageFrame: React.FC<{src: string; index: number; local: number}> = ({src, index, local}) => {
  const punch = interpolate(local, [0, HOLD], [1.035, 1.0], {...clamp, easing: out});
  const rotate = index % 4 === 0 ? -1.2 : index % 4 === 1 ? 0.8 : index % 4 === 2 ? 1.4 : -0.6;
  const inset = index % 5 === 0 ? 92 : index % 3 === 0 ? 54 : 0;
  const opacity = interpolate(local, [0, HOLD - 3, HOLD], [1, 1, 0.92], clamp);

  return (
    <AbsoluteFill style={{background: COLORS.root}}>
      <Img
        src={staticFile(src)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: fitMode(src),
          imageRendering: 'pixelated',
          opacity,
          transform: `scale(${punch}) rotate(${rotate * 0.12}deg)`,
        }}
      />
      {inset > 0 ? (
        <div
          style={{
            position: 'absolute',
            inset,
            pointerEvents: 'none',
            boxShadow: `0 0 0 ${inset}px ${COLORS.root}`,
            clipPath: 'polygon(0 0, calc(100% - 44px) 0, 100% 44px, 100% 100%, 44px 100%, 0 calc(100% - 44px))',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            index % 2 === 0
              ? 'linear-gradient(90deg, rgba(9,13,10,.18), transparent 52%, rgba(9,13,10,.2))'
              : 'linear-gradient(0deg, rgba(9,13,10,.22), transparent 48%, rgba(9,13,10,.08))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 36,
          bottom: 28,
          color: 'rgba(255,243,197,.72)',
          fontFamily: TYPE.mono,
          fontSize: 22,
          letterSpacing: 1,
        }}
      >
        {String(index + 1).padStart(2, '0')} / 20
      </div>
    </AbsoluteFill>
  );
};

const FinalCard: React.FC<{frame: number}> = ({frame}) => {
  const reveal = interpolate(frame, [0, 32], [0, 1], {...clamp, easing: out});
  const bgScale = interpolate(frame, [0, 120], [1.08, 1.0], clamp);
  const titleY = interpolate(frame, [8, 44], [90, 0], {...clamp, easing: out});

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
          transform: `scale(${bgScale})`,
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
      <div style={{position: 'absolute', left: 102, right: 102, bottom: 122, opacity: reveal}}>
        <div
          style={{
            fontFamily: '"Gaius Pixel", "Geist Pixel", "Geist Mono", ui-monospace, monospace',
            fontSize: 166,
            lineHeight: 0.82,
            fontWeight: 900,
            letterSpacing: -2,
            textTransform: 'uppercase',
            color: COLORS.paperBright,
            transform: `translateY(${titleY}px)`,
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
        <FinalCard frame={frame - MONTAGE_FRAMES} />
      </AbsoluteFill>
    );
  }

  const index = Math.min(IMAGES.length - 1, Math.floor(frame / HOLD));
  const local = frame - index * HOLD;

  return (
    <AbsoluteFill>
      <Audio src={staticFile(ASSETS.audio)} volume={0.9} />
      <MontageFrame src={IMAGES[index]} index={index} local={local} />
    </AbsoluteFill>
  );
};
