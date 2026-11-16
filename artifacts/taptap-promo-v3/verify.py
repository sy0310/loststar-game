"""Decode and inspect the deliverable, its frame timing, audio and unchanged runtime."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PRIVATE = ROOT / "releases/taptap-promo-v3-private"
WORK = PRIVATE / "verification"


def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True)


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    video = HERE / "final-portrait.mp4"
    info = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)]).stdout)
    stream = next(s for s in info["streams"] if s["codec_type"] == "video")
    sound = next(s for s in info["streams"] if s["codec_type"] == "audio")
    duration = float(info["format"]["duration"])
    assert 50 <= duration <= 55 and duration < 60
    assert (stream["width"], stream["height"], stream["r_frame_rate"], stream["codec_name"]) == (1080, 1920, "30/1", "h264")
    assert sound["codec_name"] == "aac" and int(sound["sample_rate"]) == 48000
    assert int(stream["nb_frames"]) == 1620
    decoded = run(["ffmpeg", "-v", "error", "-i", str(video), "-f", "null", "-"])
    assert not decoded.stderr.strip()
    black = run(["ffmpeg", "-hide_banner", "-i", str(video), "-an", "-vf",
                 "crop=888:1800:96:60,blackdetect=d=0.12:pix_th=0.08:pic_th=0.99", "-f", "null", "-"])
    (WORK / "blackdetect.log").write_text(black.stderr)
    assert "black_start" not in black.stderr
    freezes = run(["ffmpeg", "-hide_banner", "-i", str(video), "-an", "-vf",
                   "crop=888:1400:96:390,freezedetect=n=-70dB:d=0.5", "-f", "null", "-"])
    (WORK / "freezedetect.log").write_text(freezes.stderr)
    events = []
    for match in re.finditer(r"freeze_start: ([0-9.]+)", freezes.stderr):
        at = float(match.group(1))
        assert any(a <= at <= b for a, b in [(8, 10.6), (14, 16.7), (19.5, 22.2)]), at
        events.append(at)
    measure = run(["ffmpeg", "-hide_banner", "-i", str(video), "-vn", "-af",
                   "loudnorm=I=-16:TP=-1.5:LRA=8:print_format=json", "-f", "null", "-"])
    block = re.search(r'\{\s*"input_i".*?\}', measure.stderr, re.S)
    loudness = json.loads(block.group())
    assert float(loudness["input_tp"]) < -.8
    assert -24 < float(loudness["input_i"]) < -12
    audio_digests = []
    for audio_source in [HERE.parent / "taptap-promo-v2/final-portrait.mp4", video]:
        packets = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(audio_source),
                                            "-map", "0:a:0", "-c", "copy", "-f", "adts", "-"])
        audio_digests.append(hashlib.sha256(packets).hexdigest())
    assert audio_digests[0] == audio_digests[1], audio_digests
    runtime = json.loads((HERE / "runtime-baseline.json").read_text())
    hashes = []
    for item in runtime["runtimeFiles"]:
        source = ROOT / "prototypes/salvage-survivor-demo" / item["path"]
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        assert digest == item["sha256"], source
        hashes.append({"path": item["path"], "sha256": digest})
    recording = json.loads((HERE.parent / "taptap-promo-v1/recording-evidence.json").read_text())
    for scene, report in recording.items():
        assert report["audio"]["settings"]["music"] == 0
        assert not report["errors"]
        assert not report["invincibility"] and not report["enemyEdits"] and not report["gameDamageEdits"]
    cover = Image.open(HERE / "cover.jpg")
    assert cover.size == (1080, 1920)
    # Verify the caption compositor preserves the HUD through every editorial phase.
    hud = []
    for at in [.8, 5, 8.8, 11.8, 14.8, 17.8, 20.4, 23.4, 27.5, 41.2, 43.2, 51.5]:
        paths = []
        for label, source in [("final", video), ("base", PRIVATE / "render/base.mov")]:
            dest = WORK / f"{label}-{at}.png"
            run(["ffmpeg", "-v", "error", "-y", "-ss", str(at), "-i", str(source), "-frames:v", "1", str(dest)])
            paths.append(dest)
        a, b = [np.asarray(Image.open(p).convert("RGB"), dtype=np.float32) for p in paths]
        difference = float(np.mean(np.abs(a[:390] - b[:390])))
        assert difference < 7, (at, difference)
        # The removed gray recorder canvas must never appear in a final game frame.
        gray = np.all(np.abs(a[400:1800, 100:980] - 128) < 2, axis=2).mean()
        assert gray < .01
        hud.append({"second": at, "hudMeanAbsoluteDifference": difference, "grayFillRatio": float(gray)})
    result = {"durationSeconds": duration, "dimensions": [1080, 1920], "fps": "30/1",
              "frames": 1620, "codecs": [stream["codec_name"], sound["codec_name"]],
              "bytes": video.stat().st_size, "sha256": hashlib.sha256(video.read_bytes()).hexdigest(),
              "fullDecode": "passed", "blackIntervals": [], "staticSelectionIntervals": events,
              "freezeDetection": "-70 dB / 0.5s; known selection screens use this cut's actual time intervals.",
              "loudness": loudness, "unchangedRuntimeFiles": len(hashes),
              "aacStreamIdenticalToV2": True, "aacStreamSha256": audio_digests[1],
              "runtimeSource": runtime["sourceCommit"], "hudSamples": hud,
              "sourcePlaybackSpeed": 1, "fpsConversion": "25 fps frames duplicated to 30 fps; original game time retained",
              "physicalPhonePlayback": "pending", "userVisualAndSoundApproval": "pending"}
    (HERE / "verification.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
