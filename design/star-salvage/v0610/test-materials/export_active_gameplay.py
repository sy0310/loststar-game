"""Export the actual page recording with its live game output audio."""
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys


recording = Path(sys.argv[1])
destination = Path(sys.argv[2])
capture = json.loads((recording / "capture.json").read_text())
video = recording / "whole-ui-original.webm"
audio = recording / "actual-output-audio.webm"


def probe(file):
    return json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(file),
    ]))


source = probe(video)
start = float(source["format"]["duration"]) - (
    capture["contextCloseWallMs"] - capture["recordingStartedWallMs"]
) / 1000
duration = (capture["recordingEndedWallMs"] - capture["recordingStartedWallMs"]) / 1000
assert start > 3 and 59 < duration < 62

windows = []
for second in range(0, 60, 5):
    samples = [sample for sample in capture["samples"] if
               capture["recordingStartedWallMs"] + second * 1000 <= sample["wallMs"] <
               min(capture["recordingStartedWallMs"] + (second + 5) * 1000,
                   capture["recordingEndedWallMs"])]
    travelled = sum(math.hypot(b["x"] - a["x"], b["y"] - a["y"])
                    for a, b in zip(samples, samples[1:]))
    active = sum(sample["inputActive"] for sample in samples) / len(samples)
    assert travelled > 250 and active > 0.8, (second, travelled, active)
    windows.append({"startSecond": second, "travelledPixels": travelled,
                    "inputActiveRatio": active, "samples": len(samples)})

destination.parent.mkdir(parents=True, exist_ok=True)
subprocess.run([
    "ffmpeg", "-v", "error", "-y", "-ss", str(start), "-i", str(video), "-i", str(audio),
    "-t", "60", "-map", "0:v:0", "-map", "1:a:0",
    "-vf", "scale=780:1688:flags=neighbor,setsar=1,setpts=PTS-STARTPTS",
    "-af", "asetpts=PTS-STARTPTS", "-c:v", "libx264", "-preset", "medium",
    "-crf", "23", "-maxrate", "3500k", "-bufsize", "7000k", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", str(destination),
], check=True)
result = probe(destination)
assert 59 < float(result["format"]["duration"]) < 62
assert [(stream["codec_type"], stream["codec_name"]) for stream in result["streams"]] == [
    ("video", "h264"), ("audio", "aac")]
summary = {
    "source": capture["source"], "scope": capture["scope"], "trimStartSeconds": start,
    "duration": result["format"]["duration"], "motionWindows": windows,
    "bytes": destination.stat().st_size,
    "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
}
destination.with_suffix(".json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(summary, ensure_ascii=False))
