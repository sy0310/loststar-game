"""Original 144 BPM electro score for the second creator cut. No sampled recordings."""
import hashlib
import json
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
RATE = 48000
SECONDS = 54
BPM = 144
BEAT = 60 / BPM
COUNT = RATE * SECONDS
RNG = np.random.default_rng(49051)


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def envelope(t, duration, attack=.006, release=.04):
    return np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, duration - t) / release)


def synth(midi, duration, kind):
    t = np.arange(round(duration * RATE)) / RATE
    hz = frequency(midi)
    if kind == "bass":
        signal = np.sin(2 * np.pi * hz * t) * .75
        for harmonic in range(2, 7):
            signal += np.sin(2 * np.pi * hz * harmonic * t) * .28 / harmonic
        signal += np.sin(np.pi * hz * t) * .23
        signal = np.tanh(signal * 1.6)
        env = envelope(t, duration, .003, .04) * np.exp(-t * 2.5)
    elif kind == "lead":
        signal = np.zeros_like(t)
        for detune in [.997, 1, 1.003]:
            for harmonic in range(1, 9):
                signal += np.sin(2 * np.pi * hz * detune * harmonic * t) / harmonic ** 1.4
        signal /= 3
        env = envelope(t, duration, .008, .055) * np.exp(-t * 3)
    else:
        signal = np.sin(2 * np.pi * hz * t) + .32 * np.sin(4 * np.pi * hz * t)
        signal += .12 * np.sin(6 * np.pi * hz * t)
        env = envelope(t, duration, .004, .045) * np.exp(-t * 12)
    return (signal * env).astype(np.float32)


def noise(duration, low, high):
    size = round(duration * RATE)
    signal = RNG.normal(0, 1, size)
    bins = np.fft.rfftfreq(size, 1 / RATE)
    band = (1 - np.exp(-(bins / low) ** 4)) * np.exp(-(bins / high) ** 4)
    result = np.fft.irfft(np.fft.rfft(signal) * band, n=size)
    return result / max(.001, np.abs(result).max())


def add(bus, signal, at, gain, pan=0):
    start = round(at * RATE)
    end = min(COUNT, start + len(signal))
    if end <= start:
        return
    signal = signal[:end - start] * gain
    bus[start:end, 0] += signal * np.sqrt((1 - pan) / 2)
    bus[start:end, 1] += signal * np.sqrt((1 + pan) / 2)


def section(at):
    if at < 4:
        return 1.0, .85, 1.0
    if at < 8:
        return .74, .0, .52
    if at < 14:
        return .88, .28, .72
    if at < 19.5:
        return 1.0, .65, .9
    if at < 21.8:
        return .55, .12, .25
    if at < 34:
        return 1.1, 1.0, 1.0
    if at < 48:
        return 1.17, 1.07, 1.1
    return 1.05, .6, .94


def main():
    drums = np.zeros((COUNT, 2), dtype=np.float32)
    tones = np.zeros_like(drums)
    t = np.arange(round(.31 * RATE)) / RATE
    kick = np.sin(2 * np.pi * (49 * t + (160 - 49) * .025 * (1 - np.exp(-t / .025))))
    kick *= np.exp(-t * 17)
    kick += .15 * np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 250)
    kick = np.tanh(kick * 1.8) * envelope(t, .31, .001, .025)
    snare_t = np.arange(round(.18 * RATE)) / RATE
    snare = noise(.18, 650, 8500) * np.exp(-snare_t * 23)
    snare += .32 * np.sin(2 * np.pi * 185 * snare_t) * np.exp(-snare_t * 30)
    hat_t = np.arange(round(.07 * RATE)) / RATE
    hat = noise(.07, 6200, 15000) * np.exp(-hat_t * 80)
    open_t = np.arange(round(.24 * RATE)) / RATE
    open_hat = noise(.24, 5000, 14000) * np.exp(-open_t * 19)
    for step in range(int(SECONDS / (BEAT / 4)) + 1):
        at = step * BEAT / 4
        drum_gain, lead_gain, arp_gain = section(at)
        if step % 4 == 0:
            add(drums, kick, at, .94 * drum_gain)
        if step % 8 == 4:
            add(drums, snare, at, .64 * drum_gain, .05)
        if step % 2 == 0 or 14 <= at < 19.5 or 22 <= at < 48:
            add(drums, hat, at, (.14 if step % 2 == 0 else .07) * drum_gain,
                -.34 if step % 2 else .34)
        if step % 8 == 6 and at >= 14:
            add(drums, open_hat, at, .16 * drum_gain, -.22)
        roots = [38, 34, 41, 36]
        chords = [[62, 65, 69], [58, 62, 65], [65, 69, 72], [60, 64, 67]]
        bar = step // 16
        chord = chords[bar % 4]
        if step % 2 == 0:
            midi = roots[bar % 4] + (12 if step % 8 == 6 else 0)
            add(tones, synth(midi, BEAT * .42, "bass"), at, .35 * max(.55, arp_gain))
        arp_note = chord[[0, 1, 2, 1, 0, 2, 1, 2][step % 8]] + (12 if step % 4 == 3 else 0)
        add(tones, synth(arp_note, BEAT * .4, "arp"), at, .10 * arp_gain,
            -.55 if step % 2 else .55)
        if step % 16 in [0, 3, 6, 8, 11, 14]:
            pattern = [0, 2, 1, 2, 1, 0]
            pos = [0, 3, 6, 8, 11, 14].index(step % 16)
            midi = chord[pattern[pos]] + 12
            add(tones, synth(midi, BEAT * .72, "lead"), at, .115 * lead_gain,
                -.13 if pos % 2 else .13)
        if step % 16 == 0:
            duration = BEAT * 3.8
            pad_t = np.arange(round(duration * RATE)) / RATE
            for midi in chord:
                pad = np.sin(2 * np.pi * frequency(midi - 12) * pad_t)
                pad *= envelope(pad_t, duration, .12, .25)
                add(tones, pad, at, .022)
    # A short original roll and impact emphasize the actual fusion click at 22 seconds.
    for at in np.arange(21.3, 22, BEAT / 8):
        add(drums, snare, at, .12 + .3 * (at - 21.3) / .7)
    add(drums, kick, 22, 1.12)
    add(drums, open_hat, 22, .35)
    t = np.arange(COUNT) / RATE
    pump = .33 + .67 * (1 - np.exp(-(t % BEAT) / .09))
    tones *= pump[:, None]
    # A low-level stereo echo opens the synth texture while keeping transients crisp.
    delay = round(BEAT * .75 * RATE)
    tones[delay:] += tones[:-delay, ::-1].copy() * .15
    mix = tones + drums
    fade_in = np.minimum(1, t / .018)
    fade_out = np.minimum(1, np.maximum(0, SECONDS - t) / .7)
    mix *= (fade_in * fade_out)[:, None]
    mix = np.tanh(mix * 1.05)
    mix *= .88 / max(.001, np.abs(mix).max())
    target = HERE / "source-footage/electro-144.wav"
    with wave.open(str(target), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes((mix * 32767).astype('<i2').tobytes())
    metadata = {"title": "Relay Chase", "bpm": BPM, "seconds": SECONDS,
                "sampleRate": RATE, "seed": 49051,
                "composition": "Original D minor / B-flat / F / C electro score, synthesized kick, snare, hats, bass, arpeggio and detuned lead. Fusion roll at21.3s and drop at22s.",
                "source": "compose_music.py", "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                "wavSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "provenance": "Composed and synthesized in this repository for this trailer; all oscillators and noise generated by this script."}
    (HERE / "music-provenance.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({"file": str(target), "bpm": BPM, "peak": float(np.abs(mix).max())}))


if __name__ == '__main__':
    main()
