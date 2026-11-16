"""Export time-aligned, normal-speed game/SFX selects from the isolated captures."""
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PRIVATE = ROOT / "releases/taptap-promo-v1-private"
OUTPUT = HERE / "source-footage"


def probe(path):
    return json.loads(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    OUTPUT.mkdir(exist_ok=True)
    reports = {name: json.loads((PRIVATE / name / "capture.json").read_text())
               for name in ["natural", "evolution", "fusion", "climax"]}
    natural = reports["natural"]
    choice = natural["choices"][0]["wallSecond"]
    # Require a genuinely uninterrupted battle interval for the entire final twenty seconds.
    samples = reports["climax"]["samples"]
    ranges, begin = [], None
    for sample in samples:
        if sample["mode"] == "play" and begin is None:
            begin = sample["second"]
        if sample["mode"] != "play" and begin is not None:
            ranges.append((begin, sample["second"]))
            begin = None
    if begin is not None:
        ranges.append((begin, samples[-1]["second"]))
    eligible = [(a + .4, b - .3) for a, b in ranges if b - a > 20.8]
    if not eligible:
        raise RuntimeError(f"A longer uninterrupted battle take is required: {ranges}")
    longest = max(eligible, key=lambda interval: interval[1] - interval[0])
    climax_start = max(longest[0], longest[1] - 20)
    selections = [
        ("opening", "natural", 2.0, 8.0),
        ("experience", "natural", choice - 5.2, 5.0),
        ("choice", "natural", choice - .10, 2.5),
        ("first-upgrade", "natural", choice + 2.65, 3.5),
        ("evolution", "evolution", 0.0, 5.5),
        ("fusion", "fusion", 0.0, 5.5),
        ("climax", "climax", climax_start, 20.0),
    ]
    metadata = []
    for name, scene, start, duration in selections:
        folder = PRIVATE / scene
        report = reports[scene]
        if report["audio"]["settings"]["music"] != 0:
            raise RuntimeError("Streamed background music present in source audio")
        video = folder / "raw-page.webm"
        audio = folder / "game-sfx.webm"
        info = probe(video)
        stream = next(item for item in info['streams'] if item['codec_type'] == 'video')
        # Playwright fills an oversized recorder canvas at the top-left. Preserve
        # the complete CSS viewport while removing that empty recorder padding.
        viewport = "crop=390:844:0:0," if stream['width'] == 780 else ""
        trim = float(info["format"]["duration"]) - (
            report["contextCloseWallMs"] - report["recordingStartedWallMs"]
        ) / 1000
        target = OUTPUT / (name + ".mp4")
        subprocess.run([
            "ffmpeg", "-v", "error", "-y", "-ss", str(trim + start), "-i", str(video),
            "-ss", str(start), "-i", str(audio), "-t", str(duration),
            "-map", "0:v:0", "-map", "1:a:0", "-vf",
            viewport + "scale=780:1688:flags=neighbor,setpts=PTS-STARTPTS,setsar=1",
            "-af", "asetpts=PTS-STARTPTS", "-c:v", "libx264", "-threads", "4",
            "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", str(target),
        ], check=True)
        metadata.append({"file": str(target.relative_to(HERE)), "scene": scene,
                         "sourceRecordingInterval": [start, start + duration],
                         "rawVideoTrimOffset": trim, "sourceCommit": report["source"],
                         "gameViewport": [390, 844], "recorderCanvas": [stream['width'], stream['height']],
                         "removedRecorderPadding": bool(viewport),
                         "origin": report["origin"], "playbackSpeed": 1,
                         "rawVideoSha256": digest(video), "rawSfxSha256": digest(audio),
                         "sha256": digest(target), "bytes": target.stat().st_size})
    shutil.copyfile(PRIVATE / "original-project-theme-60s.wav", OUTPUT / "original-project-theme.wav")
    shutil.copyfile(PRIVATE / "music-provenance.json", HERE / "music-provenance.json")
    (HERE / "selects.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    segments = [
        {"in": 0, "out": 4, "file": "source-footage/climax.mp4", "sourceIn": 12, "origin": "advanced"},
        {"in": 4, "out": 12, "file": "source-footage/opening.mp4", "sourceIn": 0, "origin": "natural"},
        {"in": 12, "out": 17, "file": "source-footage/experience.mp4", "sourceIn": 0, "origin": "natural"},
        {"in": 17, "out": 19.5, "file": "source-footage/choice.mp4", "sourceIn": 0, "origin": "natural"},
        {"in": 19.5, "out": 23, "file": "source-footage/first-upgrade.mp4", "sourceIn": 0, "origin": "natural"},
        {"in": 23, "out": 28.5, "file": "source-footage/evolution.mp4", "sourceIn": 0, "origin": "advanced"},
        {"in": 28.5, "out": 34, "file": "source-footage/fusion.mp4", "sourceIn": 0, "origin": "advanced"},
        {"in": 34, "out": 54, "file": "source-footage/climax.mp4", "sourceIn": 0, "origin": "advanced"},
    ]
    (HERE / "edit.json").write_text(json.dumps({"duration": 54, "fps": 30, "segments": segments}, indent=2) + "\n")
    summaries = {}
    for scene, report in reports.items():
        summaries[scene] = {key: value for key, value in report.items()
                            if key not in ["samples", "initial", "final", "preparation"]}
        summaries[scene]["start"] = {key: report["initial"][key] for key in
                                      ["time", "level", "active", "passive", "evolved", "fused", "p"]}
        summaries[scene]["end"] = {key: report["final"][key] for key in
                                    ["time", "level", "active", "passive", "evolved", "fused", "p", "kills"]}
        summaries[scene]["inputSamples"] = report["samples"]
        if "preparation" in report:
            summaries[scene]["preparationScope"] = report["preparation"]["scope"]
    (HERE / "recording-evidence.json").write_text(json.dumps(summaries, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"selects": len(metadata), "climaxSourceStart": climax_start,
                      "uninterruptedPlayRanges": ranges}, ensure_ascii=False))


if __name__ == "__main__":
    main()
