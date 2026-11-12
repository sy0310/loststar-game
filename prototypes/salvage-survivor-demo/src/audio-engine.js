/* Original synthesized SFX and fallback score, plus two user-approved streamed music files.
 * This module never reads game state, storage or game RNG. */
(function (root) {
  "use strict";
  const AudioContextType = root.AudioContext || root.webkitAudioContext;
  const OfflineContextType =
    root.OfflineAudioContext || root.webkitOfflineAudioContext;
  const LIMITS = Object.freeze({
    voices: 24,
    sfx: 18,
    music: 8,
    schedulerMs: 80,
    lookahead: 0.16,
  });
  const DEFAULTS = Object.freeze({
    master: 0.8,
    music: 0.25,
    sfx: 0.55,
    muted: false,
    musicUrl: null,
  });
  const APPROVED_TRACKS = Object.freeze([
    {
      id: "nebula-groove",
      title: "Nebula Groove",
      url: "./assets/audio/nebula-groove.mp3",
    },
    {
      id: "nebula-loop",
      title: "Nebula Loop",
      url: "./assets/audio/nebula-loop.mp3",
    },
  ]);
  const GAPS = Object.freeze({
    cannon: 0.075,
    drone: 0.09,
    arc: 0.13,
    missile: 0.18,
    blade: 0.15,
    shield: 0.22,
    prism: 0.16,
    gravity: 0.45,
    hit: 0.065,
    explosion: 0.13,
    pickup: 0.09,
    scrap: 0.11,
    heal: 0.25,
    hurt: 0.25,
    upgrade: 0.7,
    evolution: 1.1,
    fusion: 1.3,
    boss: 1.5,
    victory: 1,
    defeat: 1,
  });
  const IDS = Object.freeze(Object.keys(GAPS));
  const CHORDS = [
    [50, 57, 60, 64],
    [46, 53, 57, 60],
    [53, 60, 67, 69],
    [48, 55, 62, 64],
  ];
  const MELODY = [
    74,
    null,
    77,
    81,
    null,
    77,
    76,
    null,
    72,
    null,
    76,
    79,
    null,
    76,
    74,
    null,
  ];
  const STEP_SECONDS = 60 / 88 / 4;
  const LOOP_SECONDS = STEP_SECONDS * 64;
  let settings = { ...DEFAULTS };
  let requested = {
    playing: false,
    paused: false,
    phase: 1,
    boss: false,
    upgrade: false,
  };
  let context = null;
  let mixer = null;
  let unlocked = false;
  let unlockPromise = null;
  let operation = Promise.resolve();
  let generation = 0;
  let hidden = !!root.document?.hidden;
  let pageHidden = false;
  let timer = null;
  let step = 0;
  let nextStepAt = 0;
  let musicStarts = 0;
  let tracks = APPROVED_TRACKS.map((track) => ({ ...track }));
  let slots = [];
  let activeSlot = 0;
  let fade = null;
  let fadeInAt = null;
  let musicMode = "playlist";
  let mediaWarming = false;
  let warmingPromise = null;
  const playbackEvents = [];
  let externalStatus = "waiting-for-gesture";
  let mediaGeneration = 0;
  let mediaStarts = 0;
  let fadesCompleted = 0;
  let maxMediaPlaying = 0;
  let maxTotalVoices = 0;
  let mediaFailures = 0;
  const failedTracks = new Set();
  let lastError = "";
  const totals = {
    contexts: 0,
    unlockCalls: 0,
    lockedDrops: 0,
    contextWaitTimeouts: 0,
  };

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const blocked = () =>
    hidden ||
    pageHidden ||
    requested.paused ||
    settings.muted ||
    settings.master === 0;
  const copyState = () => ({ ...requested });

  function independentSeed() {
    try {
      if (root.crypto?.getRandomValues)
        return root.crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    } catch (_) {}
    return (Date.now() ^ 0x5d83a927) >>> 0 || 1;
  }

  function randomStream(seed) {
    let value = seed >>> 0 || 1;
    return () => {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      return (value >>> 0) / 4294967296;
    };
  }

  function createMixer(audio, config, offline) {
    const random = randomStream(offline ? 0x72d1048b : independentSeed());
    const voices = new Map();
    const lastPlay = new Map();
    const stats = {
      maxVoices: 0,
      maxSfx: 0,
      maxMusic: 0,
      voiceDrops: 0,
      rateDrops: 0,
      stolenVoices: 0,
      played: {},
    };
    let nextVoice = 1;
    let duckUntil = 0;
    let recordingDestination = null;
    const master = audio.createGain();
    const sfx = audio.createGain();
    const music = audio.createGain();
    const duck = audio.createGain();
    const limiter = audio.createDynamicsCompressor();
    master.gain.value = config.master;
    sfx.gain.value = config.sfx;
    music.gain.value = config.music;
    duck.gain.value = 1;
    limiter.threshold.value = -11;
    limiter.knee.value = 10;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    sfx.connect(master);
    music.connect(duck);
    duck.connect(master);
    master.connect(limiter);
    limiter.connect(audio.destination);
    const noise = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index++)
      data[index] = random() * 2 - 1;

    function count(group) {
      let total = 0;
      for (const voice of voices.values())
        if (!group || voice.group === group) total++;
      return total;
    }

    function release(voice, stop) {
      if (!voices.has(voice.id) && !offline) return;
      voices.delete(voice.id);
      if (stop) {
        voice.source.onended = null;
        try {
          voice.source.stop();
        } catch (_) {}
      }
      for (const node of voice.nodes) {
        try {
          node.disconnect();
        } catch (_) {}
      }
    }

    function prune(at) {
      for (const voice of voices.values()) {
        if (voice.end < at - 0.002) {
          if (offline) voices.delete(voice.id);
          else release(voice, false);
        }
      }
    }

    function tone(
      group,
      at,
      duration,
      frequency,
      endFrequency,
      volume,
      options = {},
    ) {
      prune(offline ? at : audio.currentTime);
      const groupLimit = group === "music" ? LIMITS.music : LIMITS.sfx;
      if (count() >= LIMITS.voices || count(group) >= groupLimit) {
        const replaceable = [...voices.values()].find(
          (voice) =>
            group === "sfx" &&
            voice.group === "sfx" &&
            voice.priority < (options.priority || 0),
        );
        if (replaceable) {
          release(replaceable, true);
          stats.stolenVoices++;
        } else {
          stats.voiceDrops++;
          return null;
        }
      }
      const source = options.noise
        ? audio.createBufferSource()
        : audio.createOscillator();
      const envelope = audio.createGain();
      const nodes = [source, envelope];
      if (options.noise) {
        source.buffer = noise;
        source.loop = true;
      } else {
        source.type = options.wave || "sine";
        source.frequency.setValueAtTime(Math.max(20, frequency), at);
        if (endFrequency)
          source.frequency.exponentialRampToValueAtTime(
            Math.max(20, endFrequency),
            at + duration,
          );
      }
      const attack = Math.min(duration * 0.2, options.attack || 0.008);
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.linearRampToValueAtTime(
        Math.max(0.0001, volume),
        at + attack,
      );
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      source.connect(envelope);
      let output = envelope;
      if (options.filter) {
        const filter = audio.createBiquadFilter();
        filter.type = options.filter;
        filter.frequency.setValueAtTime(options.cutoff || 1200, at);
        filter.Q.value = options.q || 0.7;
        output.connect(filter);
        output = filter;
        nodes.push(filter);
      }
      if (audio.createStereoPanner && options.pan) {
        const pan = audio.createStereoPanner();
        pan.pan.value = clamp(options.pan, -0.8, 0.8);
        output.connect(pan);
        output = pan;
        nodes.push(pan);
      }
      output.connect(group === "music" ? music : sfx);
      const voice = {
        id: nextVoice++,
        group,
        source,
        nodes,
        priority: options.priority || 0,
        end: at + duration + 0.025,
      };
      voices.set(voice.id, voice);
      source.onended = () => release(voice, false);
      source.start(at, options.noise ? random() * 0.45 : undefined);
      source.stop(voice.end);
      stats.maxVoices = Math.max(stats.maxVoices, count());
      stats.maxSfx = Math.max(stats.maxSfx, count("sfx"));
      stats.maxMusic = Math.max(stats.maxMusic, count("music"));
      return voice;
    }

    function duckMusic(at, amount, seconds) {
      duckUntil = Math.max(duckUntil, at + seconds);
      duck.gain.cancelScheduledValues(at);
      duck.gain.setValueAtTime(Math.max(0.12, duck.gain.value), at);
      duck.gain.linearRampToValueAtTime(amount, at + 0.025);
      duck.gain.setValueAtTime(amount, duckUntil);
      duck.gain.linearRampToValueAtTime(1, duckUntil + 0.22);
    }

    function play(id, opts = {}, at = audio.currentTime) {
      if (!IDS.includes(id)) return false;
      const previous = lastPlay.get(id);
      if (previous !== undefined && at - previous < GAPS[id]) {
        stats.rateDrops++;
        return false;
      }
      lastPlay.set(id, at);
      const strength = Number.isFinite(opts.strength)
        ? clamp(opts.strength, 0.25, 1.3)
        : 1;
      const evolved = !!opts.evolved || !!opts.fused;
      const fused = !!opts.fused;
      const gain =
        strength *
        (Number.isFinite(opts.volume) ? clamp(opts.volume, 0, 1) : 1);
      const pan = Number.isFinite(opts.pan) ? clamp(opts.pan, -0.8, 0.8) : 0;
      const priority = ["victory", "defeat"].includes(id)
        ? 3
        : ["evolution", "fusion", "boss", "hurt"].includes(id)
          ? 2
          : ["upgrade", "heal", "shield"].includes(id)
            ? 1
            : 0;
      const createdBefore = nextVoice;
      const note = (
        offset,
        duration,
        frequency,
        endFrequency,
        volume,
        options = {},
      ) =>
        tone(
          "sfx",
          at + offset,
          duration,
          frequency,
          endFrequency,
          volume * gain,
          { pan, priority, ...options },
        );
      const noiseBurst = (
        offset,
        duration,
        volume,
        cutoff = 1800,
        filter = "bandpass",
      ) =>
        note(offset, duration, 0, 0, volume, { noise: true, filter, cutoff });
      switch (id) {
        case "cannon":
          note(
            0,
            evolved ? 0.21 : 0.095,
            evolved ? 960 : 760,
            evolved ? 190 : 150,
            0.16,
            { wave: evolved ? "sawtooth" : "triangle" },
          );
          note(0, 0.045, 1520, 480, 0.045, { wave: "square" });
          break;
        case "drone":
          for (let index = 0; index < (fused ? 4 : evolved ? 3 : 2); index++)
            note(
              index * 0.035,
              0.095,
              560 + index * 280,
              420 + index * 180,
              0.09,
              { wave: "sine", pan: index % 2 ? 0.35 : -0.35 },
            );
          break;
        case "arc":
          noiseBurst(0, evolved ? 0.18 : 0.095, 0.12, evolved ? 3100 : 2300);
          note(0, 0.1, evolved ? 1150 : 800, evolved ? 1500 : 230, 0.075, {
            wave: "sawtooth",
          });
          break;
        case "missile":
          for (let index = 0; index < (evolved ? 3 : 1); index++) {
            noiseBurst(index * 0.065, 0.24, 0.12, 850, "lowpass");
            note(index * 0.065, 0.2, 150, 42, 0.13, { wave: "triangle" });
          }
          break;
        case "blade":
          note(0, evolved || fused ? 0.19 : 0.12, 1760, 620, 0.1, {
            wave: "triangle",
          });
          note(0.012, 0.1, fused ? 330 : 2640, fused ? 90 : 1260, 0.06, {
            wave: fused ? "sawtooth" : "sine",
          });
          if (fused) noiseBurst(0.025, 0.17, 0.08, 1250, "lowpass");
          break;
        case "shield":
          note(0, evolved ? 0.42 : 0.24, 392, 440, 0.12, { wave: "sine" });
          note(0.02, evolved ? 0.36 : 0.2, 587, 660, 0.075, {
            wave: "triangle",
          });
          if (evolved) note(0, 0.24, 196, 98, 0.1);
          break;
        case "prism":
          [1244, 1661, 2489].forEach((frequency, index) =>
            note(
              index * 0.025,
              evolved ? 0.33 : 0.23,
              frequency,
              frequency * 1.035,
              0.075,
              { wave: "sine", pan: (index - 1) * 0.4 },
            ),
          );
          break;
        case "gravity":
          note(0, evolved ? 0.65 : 0.48, 99, 36, 0.16, { wave: "sine" });
          note(0.035, 0.35, 148, 54, 0.045, { wave: "triangle" });
          noiseBurst(0.02, 0.38, 0.1, 260, "lowpass");
          break;
        case "hit":
          noiseBurst(0, 0.045, 0.055, 2400, "highpass");
          note(0, 0.045, 420, 160, 0.04, { wave: "triangle" });
          break;
        case "explosion":
          noiseBurst(0, 0.3, 0.2, 1100, "lowpass");
          note(0, 0.26, 110, 32, 0.15);
          break;
        case "pickup":
          note(0, 0.085, 1046, 1568, 0.07);
          break;
        case "scrap":
          note(0, 0.08, 880, 1320, 0.065, { wave: "triangle" });
          note(0.045, 0.07, 1320, 1760, 0.045);
          break;
        case "heal":
          [60, 64, 67].forEach((midi, index) =>
            note(index * 0.055, 0.28, hz(midi + 12), 0, 0.085),
          );
          break;
        case "hurt":
          note(0, 0.22, 220, 75, 0.13, {
            wave: "sawtooth",
            filter: "lowpass",
            cutoff: 1500,
          });
          noiseBurst(0, 0.1, 0.1, 700, "lowpass");
          duckMusic(at, 0.52, 0.22);
          break;
        case "upgrade":
          [74, 77, 81].forEach((midi, index) =>
            note(index * 0.075, 0.34, hz(midi), 0, 0.1, { wave: "triangle" }),
          );
          duckMusic(at, 0.3, 0.65);
          break;
        case "evolution":
          [62, 69, 74, 77, 81, 86].forEach((midi, index) =>
            note(index * 0.065, 0.45, hz(midi), 0, 0.095, {
              wave: index % 2 ? "sine" : "triangle",
              pan: index % 2 ? 0.3 : -0.3,
            }),
          );
          duckMusic(at, 0.2, 0.95);
          break;
        case "fusion":
          [62, 65, 69, 74, 81, 86].forEach((midi, index) =>
            note(index * 0.06, 0.5, hz(midi), hz(midi) * 1.01, 0.09, {
              wave: "triangle",
              pan: index % 2 ? 0.5 : -0.5,
            }),
          );
          noiseBurst(0.28, 0.32, 0.07, 2800, "highpass");
          duckMusic(at, 0.18, 1.1);
          break;
        case "boss":
          [50, 49, 50].forEach((midi, index) =>
            note(index * 0.18, 0.33, hz(midi), hz(midi - 12), 0.1, {
              wave: "sawtooth",
              filter: "lowpass",
              cutoff: 760,
            }),
          );
          duckMusic(at, 0.32, 1.2);
          break;
        case "victory":
          [62, 65, 69, 74, 77, 81].forEach((midi, index) =>
            note(index * 0.09, 0.48, hz(midi), 0, 0.09, { wave: "triangle" }),
          );
          duckMusic(at, 0.28, 1.25);
          break;
        case "defeat":
          [62, 60, 57, 50].forEach((midi, index) =>
            note(index * 0.13, 0.38, hz(midi), 0, 0.09, { wave: "triangle" }),
          );
          duckMusic(at, 0.36, 1.1);
          break;
      }
      if (nextVoice === createdBefore) return false;
      stats.played[id] = (stats.played[id] || 0) + 1;
      return true;
    }

    function musicStep(index, at, phase, boss) {
      const bar = Math.floor(index / 16) % 4;
      const local = index % 16;
      const chord = CHORDS[bar];
      const intensity = boss ? 4 : phase;
      if (local === 0) {
        for (const midi of chord.slice(0, 3))
          tone("music", at, STEP_SECONDS * 14, hz(midi), 0, 0.025, {
            wave: "sine",
            attack: 0.12,
          });
      }
      if (local % 8 === 0)
        tone("music", at, 0.48, hz(chord[0] - 12), 0, 0.055, {
          wave: "triangle",
          attack: 0.02,
        });
      const gap = intensity === 1 ? 4 : intensity === 2 ? 2 : 1;
      const melody = MELODY[(local + bar * 2) % MELODY.length];
      if (local % gap === 0 && melody)
        tone("music", at, 0.21, hz(melody + (boss ? -12 : 0)), 0, 0.035, {
          wave: "triangle",
          pan: local % 4 ? 0.3 : -0.3,
        });
      if (intensity >= 2 && local % 8 === 0)
        tone("music", at, 0.15, 105, 38, 0.07, { wave: "sine" });
      if (intensity >= 3 && local % 4 === 2)
        tone("music", at, 0.045, 0, 0, 0.025, {
          noise: true,
          filter: "highpass",
          cutoff: 5300,
        });
      if (intensity >= 4 && local % 8 === 4)
        tone("music", at, 0.11, 0, 0, 0.04, {
          noise: true,
          filter: "bandpass",
          cutoff: 1400,
        });
    }

    function stop(group) {
      for (const voice of [...voices.values()])
        if (!group || voice.group === group) release(voice, true);
    }

    function configure(next) {
      const at = audio.currentTime;
      for (const [node, value] of [
        [master, next.master],
        [music, next.music],
        [sfx, next.sfx],
      ])
        node.gain.setTargetAtTime(next.muted ? 0 : value, at, 0.012);
    }

    function recordingStream() {
      if (offline || !audio.createMediaStreamDestination) return null;
      if (!recordingDestination) {
        try {
          recordingDestination = audio.createMediaStreamDestination();
          limiter.connect(recordingDestination);
        } catch (_) {
          recordingDestination = null;
        }
      }
      return recordingDestination?.stream || null;
    }

    return {
      play,
      musicStep,
      tone,
      stop,
      configure,
      musicBus: music,
      recordingStream,
      recordingState: () => ({
        supported: !!audio.createMediaStreamDestination,
        created: !!recordingDestination,
        audioTracks: recordingDestination?.stream.getAudioTracks().length || 0,
      }),
      inspect: () => ({
        activeVoices: count(),
        sfxVoices: count("sfx"),
        musicVoices: count("music"),
        ...stats,
        played: { ...stats.played },
        gains: {
          master: master.gain.value,
          music: music.gain.value,
          sfx: sfx.gain.value,
          duck: duck.gain.value,
          limiterReductionDb: limiter.reduction,
        },
      }),
      lastPlay,
    };
  }

  function logMusicEvent(kind, details = {}) {
    playbackEvents.push({
      kind,
      audioSeconds: context?.currentTime || 0,
      pageMs: root.performance?.now?.() || 0,
      ...details,
    });
    if (playbackEvents.length > 40) playbackEvents.shift();
  }

  function slotGain(slot, value) {
    slot.level = value;
    if (slot.gain && context)
      slot.gain.gain.setTargetAtTime(value, context.currentTime, 0.025);
  }

  function setSlotTrack(slot, trackIndex) {
    slot.cancelPlayback?.();
    slot.playPending = false;
    slot.token++;
    slot.element.pause();
    slot.trackIndex = trackIndex;
    slot.warmed = false;
    slot.needsGesture = false;
    slot.failed = false;
    const token = ++slot.loadGeneration;
    const url = new URL(
      tracks[trackIndex].url,
      root.location?.href || "http://localhost/",
    );
    slot.element.onerror = () => {
      if (token !== slot.loadGeneration) return;
      slot.failed = true;
      failedTracks.add(trackIndex);
      mediaFailures++;
      lastError =
        "A music stream could not load; gameplay and sound effects remain available";
      if (failedTracks.size >= tracks.length) fallbackToSynthesis();
    };
    slot.element.src = url.href;
    slot.element.load();
  }

  function makeMediaSlots() {
    if (slots.length || !context || !mixer) return;
    if (typeof root.Audio !== "function" || !context.createMediaElementSource) {
      musicMode = "synthesis";
      externalStatus = "fallback-synthesis";
      return;
    }
    try {
      slots = [0, 1].map((index) => {
        const element = new root.Audio();
        element.preload = "metadata";
        element.playsInline = true;
        element.setAttribute("playsinline", "");
        element.crossOrigin = "anonymous";
        const gain = context.createGain();
        gain.gain.value = 0;
        const source = context.createMediaElementSource(element);
        source.connect(gain);
        gain.connect(mixer.musicBus);
        return {
          element,
          gain,
          source,
          trackIndex: index % tracks.length,
          token: 0,
          loadGeneration: 0,
          warmed: false,
          needsGesture: false,
          failed: false,
          playPending: false,
          level: 0,
        };
      });
      slots.forEach((slot) => setSlotTrack(slot, slot.trackIndex));
    } catch (_) {
      for (const slot of slots) slot.element.pause();
      slots = [];
      musicMode = "synthesis";
      externalStatus = "fallback-synthesis";
      lastError =
        "Streaming audio unavailable; original synthesis remains available";
    }
  }

  function warmMediaSlot(slot) {
    if ((slot.warmed && !slot.needsGesture) || slot.failed)
      return Promise.resolve();
    const token = ++slot.token;
    const position = slot.element.currentTime || 0;
    slotGain(slot, 0);
    let result;
    try {
      result = slot.element.play();
    } catch (_) {
      result = Promise.reject(Error("Media gesture required"));
    }
    let confirm;
    const played = new Promise((resolve) => {
      confirm = resolve;
    });
    const onPlaying = () => confirm();
    slot.element.addEventListener("playing", onPlaying);
    const playback = Promise.race([Promise.resolve(result), played])
      .then(() => {
        if (slot.token !== token) return;
        slot.warmed = true;
        slot.needsGesture = false;
      })
      .catch(() => {
        if (slot.token === token) slot.needsGesture = true;
      });
    return Promise.race([
      playback,
      new Promise((resolve) => root.setTimeout(resolve, 4000)),
    ]).then(() => {
      slot.element.removeEventListener("playing", onPlaying);
      if (slot.token !== token) return;
      if (!slot.element.paused && slot.element.currentTime > position + 0.02) {
        slot.warmed = true;
        slot.needsGesture = false;
      }
      slot.token++;
      slot.element.pause();
      try {
        slot.element.currentTime = position;
      } catch (_) {}
    });
  }

  function stopMusic() {
    if (
      timer !== null ||
      slots.some((slot) => !slot.element.paused && slot.level > 0)
    )
      logMusicEvent("stop", {
        track: tracks[slots[activeSlot]?.trackIndex || 0]?.title || "",
      });
    if (timer !== null) root.clearInterval(timer);
    timer = null;
    if (fade && context) {
      const progress = clamp((context.currentTime - fade.at) / 2, 0, 1);
      activeSlot = progress >= 0.5 ? fade.to : fade.from;
    }
    fade = null;
    fadeInAt = null;
    mediaGeneration++;
    slots.forEach((slot, index) => {
      slot.cancelPlayback?.();
      slot.token++;
      slot.playPending = false;
      slot.element.pause();
      slotGain(slot, 0);
      if (index !== activeSlot) {
        try {
          slot.element.currentTime = 0;
        } catch (_) {}
      }
    });
    mixer?.stop("music");
  }

  function canMusicPlay() {
    return (
      unlocked &&
      context?.state === "running" &&
      !blocked() &&
      requested.playing &&
      settings.music > 0
    );
  }

  function fallbackToSynthesis() {
    if (musicMode === "synthesis") return;
    stopMusic();
    musicMode = "synthesis";
    externalStatus = "fallback-synthesis";
    startMusic();
  }

  function startSlot(index, zero, onStarted) {
    const slot = slots[index];
    if (!slot || slot.failed || slot.playPending || !canMusicPlay()) return;
    if (zero) {
      try {
        slot.element.currentTime = 0;
      } catch (_) {}
    }
    slot.playPending = true;
    const token = ++slot.token;
    const owner = mediaGeneration;
    let completed = false;
    const cleanup = () => {
      slot.element.removeEventListener("playing", confirm);
      if (slot.cancelPlayback === cleanup) slot.cancelPlayback = null;
      if (slot.pendingPlayback?.confirm === confirm)
        slot.pendingPlayback = null;
    };
    const confirm = () => {
      if (completed) return;
      completed = true;
      cleanup();
      if (
        slot.token !== token ||
        owner !== mediaGeneration ||
        !canMusicPlay()
      ) {
        if (slot.token === token) slot.element.pause();
        return;
      }
      slot.playPending = false;
      slot.warmed = true;
      slot.needsGesture = false;
      mediaStarts++;
      logMusicEvent("track-start", { track: tracks[slot.trackIndex].title });
      externalStatus = "playing-approved-streams";
      onStarted();
    };
    slot.cancelPlayback = cleanup;
    slot.pendingPlayback = { confirm, position: slot.element.currentTime };
    slot.element.addEventListener("playing", confirm);
    let result;
    try {
      result = slot.element.play();
    } catch (_) {
      cleanup();
      slot.playPending = false;
      slot.needsGesture = true;
      return;
    }
    Promise.resolve(result)
      .then(confirm)
      .catch(() => {
        if (completed) return;
        completed = true;
        cleanup();
        if (slot.token !== token) return;
        slot.playPending = false;
        slot.needsGesture = true;
        externalStatus = "waiting-for-gesture";
        lastError = "Music playback needs another user gesture";
      });
  }

  function nextTrack(current) {
    for (let distance = 1; distance <= tracks.length; distance++) {
      const index = (current + distance) % tracks.length;
      if (!failedTracks.has(index)) return index;
    }
    return null;
  }

  function streamTick() {
    if (!canMusicPlay() || mediaWarming || slots.length !== 2) return;
    // Confirm actual progress when a backend omits both the event and promise.
    for (const slot of slots) {
      const pending = slot.pendingPlayback;
      if (
        pending &&
        !slot.element.paused &&
        !slot.element.ended &&
        !slot.element.seeking &&
        slot.element.currentTime > pending.position + 0.02
      )
        pending.confirm();
    }
    const now = context.currentTime;
    const active = slots[activeSlot];
    if (active.failed) {
      const next = nextTrack(active.trackIndex);
      if (next === null) {
        fallbackToSynthesis();
        return;
      }
      activeSlot = 1 - activeSlot;
      if (slots[activeSlot].trackIndex !== next)
        setSlotTrack(slots[activeSlot], next);
      return;
    }
    if (active.element.paused && !fade) {
      startSlot(activeSlot, false, () => {
        fadeInAt = context.currentTime;
      });
      return;
    }
    if (fade) {
      const progress = clamp((now - fade.at) / 2, 0, 1);
      const intensity =
        0.9 + (requested.phase - 1) * 0.035 + (requested.boss ? 0.03 : 0);
      slotGain(
        slots[fade.from],
        Math.cos((progress * Math.PI) / 2) * intensity,
      );
      slotGain(slots[fade.to], Math.sin((progress * Math.PI) / 2) * intensity);
      if (progress >= 1) {
        const old = slots[fade.from];
        old.element.pause();
        slotGain(old, 0);
        try {
          old.element.currentTime = 0;
        } catch (_) {}
        activeSlot = fade.to;
        fade = null;
        fadesCompleted++;
        logMusicEvent("crossfade-complete", {
          track: tracks[slots[activeSlot].trackIndex].title,
        });
      }
    } else {
      const progress =
        fadeInAt === null ? 1 : clamp((now - fadeInAt) / 2, 0, 1);
      slotGain(
        active,
        progress *
          (0.9 + (requested.phase - 1) * 0.035 + (requested.boss ? 0.03 : 0)),
      );
      if (progress >= 1) fadeInAt = null;
      const duration = active.element.duration;
      if (
        Number.isFinite(duration) &&
        duration > 2.2 &&
        duration - active.element.currentTime <= 2.15
      ) {
        const next = nextTrack(active.trackIndex);
        if (next === null) {
          fallbackToSynthesis();
          return;
        }
        const otherIndex = 1 - activeSlot;
        const other = slots[otherIndex];
        if (other.trackIndex !== next) setSlotTrack(other, next);
        slotGain(other, 0);
        startSlot(otherIndex, true, () => {
          fade = { from: activeSlot, to: otherIndex, at: context.currentTime };
          logMusicEvent("crossfade-start", {
            from: tracks[slots[activeSlot].trackIndex].title,
            to: tracks[other.trackIndex].title,
            seconds: 2,
          });
          fadeInAt = null;
        });
      }
    }
    const activeMedia = slots.filter(
      (slot) => !slot.element.paused && !slot.element.ended,
    ).length;
    maxMediaPlaying = Math.max(maxMediaPlaying, activeMedia);
    maxTotalVoices = Math.max(
      maxTotalVoices,
      activeMedia + (mixer?.inspect().activeVoices || 0),
    );
  }

  function musicTick() {
    if (!canMusicPlay() || !mixer) return;
    if (musicMode === "playlist") {
      streamTick();
      return;
    }
    const now = context.currentTime;
    while (nextStepAt < now + LIMITS.lookahead) {
      mixer.musicStep(step, nextStepAt, requested.phase, requested.boss);
      step = (step + 1) % 64;
      nextStepAt += STEP_SECONDS;
    }
  }

  function startMusic() {
    if (!canMusicPlay() || mediaWarming || timer !== null) return;
    musicStarts++;
    nextStepAt = context.currentTime + 0.04;
    musicTick();
    timer = root.setInterval(musicTick, LIMITS.schedulerMs);
  }

  async function transitionContext(target) {
    const audio = context;
    if (!audio || audio.state === "closed") return false;
    if (audio.state === target) return true;
    let timeout;
    const transition = target === "running" ? audio.resume() : audio.suspend();
    try {
      return await Promise.race([
        Promise.resolve(transition).then(() => audio.state === target),
        new Promise((resolve) => {
          timeout = root.setTimeout(() => {
            totals.contextWaitTimeouts++;
            lastError = "Audio output is waiting for another user gesture";
            resolve(false);
          }, 1500);
        }),
      ]);
    } finally {
      root.clearTimeout(timeout);
    }
  }

  async function reconcile() {
    const current = ++generation;
    if (!context || !unlocked) return false;
    if (blocked()) {
      stopMusic();
      mixer.stop();
    } else if ((!requested.playing || settings.music === 0) && !mediaWarming)
      stopMusic();
    operation = operation
      .catch(() => {})
      .then(async () => {
        if (current !== generation) return false;
        mixer.configure({
          ...settings,
          music: settings.music * (requested.upgrade ? 0.72 : 1),
        });
        try {
          if (blocked()) {
            if (context.state === "running")
              await transitionContext("suspended");
            return false;
          }
          if (context.state !== "running" && context.state !== "closed")
            await transitionContext("running");
          if (current !== generation || blocked()) return false;
          startMusic();
          return context.state === "running";
        } catch (_) {
          lastError = "Audio output is waiting for a supported user gesture";
          return false;
        }
      });
    return operation;
  }

  async function unlock() {
    totals.unlockCalls++;
    if (!AudioContextType) return false;
    if (unlockPromise) return unlockPromise;
    const activation = root.navigator?.userActivation;
    if (!unlocked && activation && !activation.isActive) return false;
    unlockPromise = (async () => {
      try {
        if (!context || context.state === "closed") {
          stopMusic();
          for (const slot of slots) {
            slot.element.pause();
            try {
              slot.source.disconnect();
              slot.gain.disconnect();
            } catch (_) {}
          }
          slots = [];
          context = new AudioContextType({ latencyHint: "interactive" });
          totals.contexts++;
          mixer = createMixer(context, settings, false);
          const audio = context;
          audio.onstatechange = () => {
            if (audio !== context || audio.state !== "running") return;
            unlocked = true;
            void reconcile();
          };
        }
        makeMediaSlots();
        if (
          !warmingPromise &&
          slots.some((slot) => !slot.warmed || slot.needsGesture) &&
          !blocked()
        ) {
          mediaWarming = true;
          warmingPromise = Promise.all(slots.map((slot) => warmMediaSlot(slot)))
            .catch(() => {})
            .finally(() => {
              mediaWarming = false;
              warmingPromise = null;
              void reconcile();
            });
        }
        if (context.state !== "running" && context.state !== "closed")
          await transitionContext("running");
        unlocked = context.state === "running";
        if (unlocked) {
          await reconcile();
        }
        return unlocked;
      } catch (_) {
        lastError = "Audio output unavailable";
        return false;
      } finally {
        unlockPromise = null;
      }
    })();
    return unlockPromise;
  }

  function play(id, opts) {
    if (
      !unlocked ||
      !context ||
      context.state !== "running" ||
      blocked() ||
      settings.sfx === 0
    ) {
      totals.lockedDrops++;
      return false;
    }
    const played = mixer.play(id, opts);
    maxTotalVoices = Math.max(
      maxTotalVoices,
      (mixer?.inspect().activeVoices || 0) +
        slots.filter((slot) => !slot.element.paused && !slot.element.ended)
          .length,
    );
    return played;
  }

  function setState(next = {}) {
    const previous = JSON.stringify(requested);
    for (const key of ["playing", "paused", "boss", "upgrade"])
      if (typeof next[key] === "boolean") requested[key] = next[key];
    if (Number.isFinite(next.phase))
      requested.phase = clamp(Math.floor(next.phase), 1, 4);
    if (JSON.stringify(requested) !== previous) void reconcile();
    return inspect();
  }

  function configure(next = {}) {
    for (const key of ["master", "music", "sfx"])
      if (Number.isFinite(next[key])) settings[key] = clamp(next[key], 0, 1);
    if (typeof next.muted === "boolean") settings.muted = next.muted;
    const changedUrl =
      Object.hasOwn(next, "musicUrl") &&
      (typeof next.musicUrl === "string" || next.musicUrl === null) &&
      next.musicUrl !== settings.musicUrl;
    if (changedUrl) {
      try {
        const url =
          next.musicUrl === null
            ? null
            : new URL(
                next.musicUrl,
                root.location?.href || "http://localhost/",
              );
        if (url && !["http:", "https:", "blob:"].includes(url.protocol))
          throw Error("Unsupported audio URL");
      } catch (_) {
        lastError = "Invalid music URL; the approved playlist is preserved";
        mixer?.configure(settings);
        void reconcile();
        return inspect();
      }
      stopMusic();
      settings.musicUrl = next.musicUrl;
      tracks = next.musicUrl
        ? [{ id: "custom", title: "User music", url: next.musicUrl }]
        : APPROVED_TRACKS.map((track) => ({ ...track }));
      failedTracks.clear();
      musicMode = "playlist";
      externalStatus = "waiting-for-gesture";
      activeSlot = 0;
      slots.forEach((slot, index) => setSlotTrack(slot, index % tracks.length));
    }
    mixer?.configure(settings);
    if (settings.sfx === 0) mixer?.stop("sfx");
    void reconcile();
    return inspect();
  }

  function inspect() {
    return {
      supported: !!AudioContextType,
      unlocked,
      contextCreated: !!context,
      contextState: context?.state || "uncreated",
      state: copyState(),
      settings: {
        ...settings,
        musicUrl: settings.musicUrl ? "custom" : "approved-playlist",
      },
      externalMusic: {
        configured: true,
        streaming: true,
        fullTrackDecodeCalls: 0,
        status: externalStatus,
        mode: musicMode,
        activeTrack: tracks[slots[activeSlot]?.trackIndex || 0]?.title || "",
        tracks: tracks.map((track) => ({ id: track.id, title: track.title })),
        mediaElements: slots.length,
        activeMedia: slots.filter(
          (slot) => !slot.element.paused && !slot.element.ended,
        ).length,
        positions: slots.map((slot) => ({
          track: slot.trackIndex,
          seconds: slot.element.currentTime || 0,
          duration: Number.isFinite(slot.element.duration)
            ? slot.element.duration
            : null,
          paused: slot.element.paused,
          warmed: slot.warmed,
          needsGesture: slot.needsGesture,
          failed: slot.failed,
          gain: slot.level,
          gainValue: slot.gain.gain.value,
          elementVolume: slot.element.volume,
        })),
        crossfading: !!fade,
        fadeSeconds: 2,
        fadesCompleted,
        mediaStarts,
        maxMediaPlaying,
        mediaFailures,
        warming: mediaWarming,
        playbackEvents: playbackEvents.map((event) => ({ ...event })),
      },
      schedulerCount: timer === null ? 0 : 1,
      musicStarts,
      maxTotalVoices,
      recording: mixer?.recordingState() || {
        supported: false,
        created: false,
        audioTracks: 0,
      },
      limits: { ...LIMITS },
      totals: { ...totals },
      lastError,
      ...(mixer
        ? mixer.inspect()
        : {
            activeVoices: 0,
            sfxVoices: 0,
            musicVoices: 0,
            maxVoices: 0,
            maxSfx: 0,
            maxMusic: 0,
            voiceDrops: 0,
            rateDrops: 0,
            stolenVoices: 0,
            played: {},
          }),
    };
  }

  function recordingStream() {
    return mixer?.recordingStream() || null;
  }

  async function renderOffline(id, options = {}) {
    if (!OfflineContextType) throw Error("OfflineAudioContext unavailable");
    const seconds = clamp(
      Number.isFinite(options.seconds)
        ? options.seconds
        : id === "music"
          ? LOOP_SECONDS * 4
          : 1.6,
      0.3,
      60,
    );
    const sampleRate = 44100;
    const offline = new OfflineContextType(
      2,
      Math.ceil(seconds * sampleRate),
      sampleRate,
    );
    const bank = createMixer(
      offline,
      { master: 0.8, music: 0.25, sfx: 0.55 },
      true,
    );
    if (id === "music") {
      for (let index = 0; index * STEP_SECONDS < seconds; index++) {
        const at = index * STEP_SECONDS;
        const phase = clamp(Math.floor(at / LOOP_SECONDS) + 1, 1, 4);
        bank.musicStep(index % 64, at, phase, phase === 4);
      }
    } else if (id === "stress") {
      for (let index = 0; index < 600; index++)
        bank.play(
          IDS[index % IDS.length],
          { evolved: index % 3 === 0 },
          index * 0.004,
        );
    } else {
      if (!IDS.includes(id)) throw Error("Unknown audition cue");
      bank.play(id, options, 0.06);
    }
    const buffer = await offline.startRendering();
    return { buffer, stats: bank.inspect(), seconds: buffer.duration };
  }

  root.SurvivorAudio = Object.freeze({
    unlock,
    play,
    setState,
    configure,
    inspect,
    recordingStream,
    renderOffline,
  });
  root.document?.addEventListener("visibilitychange", () => {
    hidden = !!root.document.hidden;
    void reconcile();
  });
  root.addEventListener?.("pagehide", () => {
    pageHidden = true;
    void reconcile();
  });
  root.addEventListener?.("pageshow", () => {
    pageHidden = false;
    hidden = !!root.document?.hidden;
    void reconcile();
  });
})(typeof window === "undefined" ? globalThis : window);
