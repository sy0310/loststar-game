/* The original synthesized cues are rendered offline into local audio assets. */
(function (root) {
  "use strict";
  const settings = { master: 0.8, music: 0.25, sfx: 0.55, muted: false };
  let state = { playing: false, paused: true };
  let unlocked = false;
  let track = 0;
  let generation = 0;
  let music = null;
  const voices = [];
  const lastPlayed = new Map();
  const tracks = ["nebula-groove", "nebula-loop"];
  const blocked = () => !unlocked || settings.muted || state.paused || !state.playing || root.document.hidden;
  function stopAll() {
    music?.pause();
    for (const voice of voices) voice.audio.stop();
  }
  async function startMusic() {
    if (blocked()) return;
    if (music) {
      music.volume = settings.master * settings.music;
      music.play();
      return;
    }
    const current = ++generation;
    const name = tracks[track];
    try {
      await new Promise((resolve, reject) => wx.loadSubpackage({ name, success: resolve, fail: reject }));
      if (current !== generation || blocked()) return;
      music = wx.createInnerAudioContext();
      music.src = name + "/music.mp3";
      music.volume = settings.master * settings.music;
      music.onEnded(() => {
        music.destroy();
        music = null;
        track = (track + 1) % tracks.length;
        void startMusic();
      });
      music.onError((error) => { console.warn("Music playback", error.errMsg); });
      music.play();
    } catch (error) {
      console.warn("Music subpackage", error.errMsg || error.message);
    }
  }
  root.SurvivorAudio = {
    async unlock() { unlocked = true; void startMusic(); return true; },
    setState(change) {
      const wasBlocked = blocked();
      Object.assign(state, change);
      if (blocked()) { generation++; stopAll(); }
      else if (wasBlocked) void startMusic();
    },
    configure(change) {
      Object.assign(settings, change);
      for (const key of ["master", "music", "sfx"]) settings[key] = Math.max(0, Math.min(1, settings[key]));
      if (blocked()) { generation++; stopAll(); }
      else void startMusic();
    },
    inspect: () => ({ settings: { ...settings }, unlocked }),
    play(id, options = {}) {
      if (blocked() || !settings.sfx) return false;
      const now = Date.now();
      if (now - (lastPlayed.get(id) || 0) < 85) return false;
      lastPlayed.set(id, now);
      let voice = voices.find((entry) => entry.until <= now);
      if (!voice && voices.length < 12) {
        voice = { audio: wx.createInnerAudioContext(), until: 0 };
        voice.audio.onError((error) => console.warn("Sound playback", error.errMsg));
        voices.push(voice);
      }
      if (!voice) return false;
      voice.audio.stop();
      voice.audio.src = "assets/sfx/" + id + (options.evolved ? "-evolved" : "") + ".mp3";
      voice.audio.volume = settings.master * settings.sfx;
      voice.until = now + 1600;
      voice.audio.play();
      return true;
    },
  };
})(SurvivorPlatform);
