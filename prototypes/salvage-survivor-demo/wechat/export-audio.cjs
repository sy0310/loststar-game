/* Build-time rendering of the existing original synth. No browser ships in the game. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("@playwright/test");
const folder = path.resolve(__dirname, "..");
const output = path.resolve(process.argv[2]);
const cues = ["cannon", "drone", "arc", "missile", "blade", "shield", "prism", "gravity", "hit", "explosion", "pickup", "scrap", "heal", "hurt", "upgrade", "evolution", "fusion", "boss", "enemyCharge", "enemyFire", "victory", "defeat"];
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: fs.readFileSync(path.join(folder, "src/audio-engine.js"), "utf8") });
    for (const id of cues) {
      for (const evolved of [false, true]) {
        const samples = await page.evaluate(async ({ id, evolved }) => {
          const { buffer } = await SurvivorAudio.renderOffline(id, { evolved });
          const a = buffer.getChannelData(0);
          const b = buffer.getChannelData(1);
          return Array.from(a, (value, index) => Math.round(Math.max(-1, Math.min(1, (value + b[index]) / 2)) * 32767));
        }, { id, evolved });
        const wav = Buffer.alloc(44 + samples.length * 2);
        wav.write("RIFF", 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8);
        wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(44100, 24); wav.writeUInt32LE(88200, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
        wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
        samples.forEach((value, index) => wav.writeInt16LE(value, 44 + index * 2));
        const name = id + (evolved ? "-evolved" : "");
        const temporary = path.join(output, name + ".wav");
        fs.writeFileSync(temporary, wav);
        execFileSync("ffmpeg", ["-v", "error", "-y", "-i", temporary, "-ar", "22050", "-ac", "1", "-b:a", "32k", path.join(output, name + ".mp3")]);
        fs.unlinkSync(temporary);
      }
    }
    console.log(JSON.stringify({ cues: cues.length, files: cues.length * 2, source: "src/audio-engine.js renderOffline" }));
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
