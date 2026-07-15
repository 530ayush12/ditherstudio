import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

fs.mkdirSync('out/stills', {recursive: true});
for (const file of fs.readdirSync('out/stills')) {
  if (file.startsWith('frame-') && file.endsWith('.png')) fs.unlinkSync(`out/stills/${file}`);
}
for (const frame of [0, 45, 90, 135, 180, 240, 300, 390]) {
  execFileSync('./node_modules/.bin/remotion', [
    'still',
    'src/index.ts',
    'LaunchVideo',
    `--frame=${frame}`,
    `--output=out/stills/frame-${String(frame).padStart(3, '0')}.png`,
  ], {stdio: 'inherit'});
}
execFileSync('ffmpeg', [
  '-y',
  '-pattern_type',
  'glob',
  '-i',
  'out/stills/frame-*.png',
  '-vf',
  'scale=480:-1,tile=4x2',
  '-frames:v',
  '1',
  '-update',
  '1',
  'out/contact-sheet.png',
], {stdio: 'inherit'});
