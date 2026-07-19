/**
 * Oracle — voice.js (Web Speech API, all voice controls)
 * AI that watches your screen and speaks live feedback
 * Author: Youssef | github.com/youssef-880
 */

const OracleVoice = {
  settings: {
    voiceURI: null,
    rate: 1,
    pitch: 1,
    volume: 1,
    muted: false
  },

  _voices: [],
  _speaking: false,
  _keepAlive: null,
  _onStateChange: null,

  /** Initialize voice list; onStateChange(isSpeaking) fires when speech starts/stops. */
  init(onStateChange) {
    this._onStateChange = onStateChange || null;
    this._loadVoices();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.addEventListener('voiceschanged', () => this._loadVoices());
    }
  },

  _loadVoices() {
    if (!('speechSynthesis' in window)) return;
    this._voices = window.speechSynthesis.getVoices();
    if (!this.settings.voiceURI && this._voices.length) {
      const preferred =
        this._voices.find((v) => v.lang.startsWith('en') && v.default) ||
        this._voices.find((v) => v.lang.startsWith('en')) ||
        this._voices[0];
      this.settings.voiceURI = preferred.voiceURI;
    }
    document.dispatchEvent(new CustomEvent('oracle:voices', { detail: this._voices }));
  },

  getVoices() {
    return this._voices;
  },

  isSpeaking() {
    return this._speaking;
  },

  isSupported() {
    return 'speechSynthesis' in window;
  },

  /**
   * Speak text out loud. Resolves when speech finishes so the next
   * analysis cycle never overlaps a voice that is still talking.
   * If muted or unsupported, resolves immediately.
   */
  speak(text) {
    return new Promise((resolve) => {
      if (!text || !text.trim() || this.settings.muted || !this.isSupported()) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = this._voices.find((v) => v.voiceURI === this.settings.voiceURI);
      if (voice) utterance.voice = voice;
      utterance.rate = this.settings.rate;
      utterance.pitch = this.settings.pitch;
      utterance.volume = this.settings.volume;

      const finish = () => {
        if (!this._speaking) return;
        this._speaking = false;
        clearInterval(this._keepAlive);
        if (this._onStateChange) this._onStateChange(false);
        resolve();
      };

      utterance.onstart = () => {
        this._speaking = true;
        if (this._onStateChange) this._onStateChange(true);
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      /* Chrome pauses long utterances — keep the engine awake. */
      clearInterval(this._keepAlive);
      this._keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        }
      }, 10000);

      /* Safety net: never leave the analysis loop stuck forever. */
      setTimeout(() => {
        if (this._speaking) {
          window.speechSynthesis.cancel();
          finish();
        }
      }, 60000);

      this._speaking = true;
      if (this._onStateChange) this._onStateChange(true);
      window.speechSynthesis.speak(utterance);
    });
  },

  /** Stop any current speech immediately. */
  stop() {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
    clearInterval(this._keepAlive);
    if (this._speaking) {
      this._speaking = false;
      if (this._onStateChange) this._onStateChange(false);
    }
  },

  /** Mute stops the current voice but analysis keeps running. */
  setMuted(muted) {
    this.settings.muted = muted;
    if (muted) this.stop();
  },

  setRate(rate) { this.settings.rate = Number(rate); },
  setPitch(pitch) { this.settings.pitch = Number(pitch); },
  setVolume(volume) { this.settings.volume = Number(volume); },
  setVoice(voiceURI) { this.settings.voiceURI = voiceURI; }
};

window.OracleVoice = OracleVoice;
