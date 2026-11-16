import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root = 'artifacts/v036';
const path = `${root}/evidence.json`;
const report = JSON.parse(await readFile(path, 'utf8'));
for (const sample of report.cases) {
  const state = sample.finalState.study;
  if (!['revealed', 'complete'].includes(state.phase)) throw new Error(`Incomplete recording ${sample.name}`);
  const file = `${sample.name}-video-final.png`;
  execFileSync('ffmpeg', ['-y', '-sseof', '-0.2', '-i', `${root}/${sample.video.file}`, '-frames:v', '1', `${root}/${file}`], {stdio: 'ignore'});
  sample.frames = sample.frames.filter(frame => frame.file !== file);
  sample.frames.push({file, seconds: sample.name.endsWith('fog') ? state.workElapsed / 1000 : state.elapsed,
    state: sample.finalState, origin: 'Actual video frame extracted 0.2 seconds before its end, with the end-of-capture state recorded separately'});
}
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log(`${report.cases.length} real video final frames extracted`);
