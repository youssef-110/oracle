/**
 * Oracle — ui.js (all DOM, animations, state rendering)
 * AI that watches your screen and speaks live feedback
 * Author: Youssef | github.com/youssef-880
 */

const OracleUI = {
  el: {},

  init() {
    const $ = (id) => document.getElementById(id);
    this.el = {
      keyScreen: $('key-screen'),
      keyRetry: $('key-retry'),
      deniedScreen: $('denied-screen'),
      deniedRetry: $('denied-retry'),
      deniedBack: $('denied-back'),
      offline: $('offline-indicator'),

      setupScreen: $('setup-screen'),
      setupPanel: $('setup-panel'),
      modeGrid: $('mode-grid'),
      customInstruction: $('custom-instruction'),
      suggestionPills: $('suggestion-pills'),
      intervalGroup: $('interval-group'),
      qualityGroup: $('quality-group'),
      voiceToggle: $('voice-toggle'),
      voiceBody: $('voice-body'),
      voiceSelect: $('voice-select'),
      rateSlider: $('rate-slider'),
      rateLabel: $('rate-label'),
      pitchSlider: $('pitch-slider'),
      pitchLabel: $('pitch-label'),
      volumeSlider: $('volume-slider'),
      volumeLabel: $('volume-label'),
      startBtn: $('start-btn'),

      activeScreen: $('active-screen'),
      mobileTabs: $('mobile-tabs'),
      modeBadge: $('active-mode-badge'),
      activeInstruction: $('active-instruction'),
      pauseBtn: $('pause-btn'),
      analyzeNowBtn: $('analyze-now-btn'),
      stopBtn: $('stop-btn'),
      activeIntervalGroup: $('active-interval-group'),
      activeQualityGroup: $('active-quality-group'),
      ringProgress: $('ring-progress'),
      countdownNum: $('countdown-num'),
      statShots: $('stat-shots'),
      statAnalyses: $('stat-analyses'),

      previewWrap: $('preview-wrap'),
      previewImg: $('preview-img'),
      previewPlaceholder: $('preview-placeholder'),
      scanline: $('scanline'),
      analyzingBadge: $('analyzing-badge'),
      feed: $('feed'),
      feedEmpty: $('feed-empty'),

      waveform: $('waveform'),
      speakingLabel: $('speaking-label'),
      muteBtn: $('mute-btn'),
      activeRate: $('active-rate'),
      activeRateLabel: $('active-rate-label'),
      activeVolume: $('active-volume'),
      activeVolumeLabel: $('active-volume-label'),
      activeVoice: $('active-voice'),
      statDuration: $('stat-duration'),
      statWords: $('stat-words'),
      statChanges: $('stat-changes'),
      statApi: $('stat-api'),
      oracleSees: $('oracle-sees'),

      speakerIcon: $('speaker-icon'),
      lastSaid: $('last-said')
    };

    if (window.gsap) {
      gsap.from(this.el.setupPanel, { opacity: 0, y: 26, duration: 0.7, ease: 'power3.out' });
      gsap.from('.app-header', { opacity: 0, y: -16, duration: 0.6, ease: 'power2.out' });
    }
  },

  /* ---------------- Overlays / global states ---------------- */

  showKeyMissing(show) {
    this.el.keyScreen.classList.toggle('hidden', !show);
  },

  showShareDenied(show) {
    this.el.deniedScreen.classList.toggle('hidden', !show);
    if (show && window.gsap) {
      gsap.from(this.el.deniedScreen.querySelector('.overlay-card'), {
        opacity: 0, scale: 0.94, duration: 0.35, ease: 'power2.out'
      });
    }
  },

  setOffline(offline) {
    this.el.offline.classList.toggle('hidden', !offline);
  },

  /* ---------------- Setup ↔ Active transitions ---------------- */

  showActiveScreen(modeInfo, customInstruction) {
    this.el.modeBadge.textContent = modeInfo.name.toUpperCase();
    document.documentElement.style.setProperty('--mode-color', modeInfo.color);
    this.el.activeInstruction.textContent = customInstruction ? `“${customInstruction}”` : '';
    this.el.activeInstruction.title = customInstruction || '';

    this.el.setupScreen.classList.add('hidden');
    this.el.activeScreen.classList.remove('hidden');
    this.applyTab('preview');

    if (window.gsap) {
      gsap.from('#active-screen .panel, #active-screen .preview-wrap, #active-screen .feed, #active-screen .bottom-bar', {
        opacity: 0, y: 22, duration: 0.55, stagger: 0.07, ease: 'power3.out'
      });
    }
  },

  showSetupScreen() {
    this.el.activeScreen.classList.add('hidden');
    this.el.setupScreen.classList.remove('hidden');
    if (window.gsap) {
      gsap.from(this.el.setupPanel, { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' });
    }
  },

  resetActiveScreen() {
    this.el.feed.innerHTML = '';
    this.el.feed.appendChild(this.el.feedEmpty);
    this.el.feedEmpty.classList.remove('hidden');
    this.el.previewImg.classList.remove('visible');
    this.el.previewImg.removeAttribute('src');
    this.el.previewPlaceholder.classList.remove('hidden');
    this.el.lastSaid.textContent = 'Oracle is warming up…';
    this.el.oracleSees.innerHTML = '<em>Nothing yet — first capture pending.</em>';
    this.el.countdownNum.textContent = '–';
    this.el.ringProgress.style.strokeDashoffset = 125.6;
  },

  /* ---------------- Preview / analysis visuals ---------------- */

  setPreview(dataUrl) {
    this.el.previewImg.src = dataUrl;
    this.el.previewImg.classList.add('visible');
    this.el.previewPlaceholder.classList.add('hidden');
  },

  setAnalyzing(analyzing) {
    this.el.scanline.classList.toggle('hidden', !analyzing);
    this.el.analyzingBadge.classList.toggle('hidden', !analyzing);
  },

  setSpeaking(speaking) {
    this.el.waveform.classList.toggle('active', speaking);
    this.el.previewWrap.classList.toggle('speaking-glow', speaking);
    this.el.speakingLabel.textContent = speaking ? 'speaking' : 'idle';
    this.el.speakerIcon.textContent = speaking ? '🔊' : '🔈';

    const latest = this.el.feed.querySelector('.feed-entry');
    if (latest) latest.classList.toggle('highlight', speaking);
  },

  /* ---------------- Feed ---------------- */

  addFeedEntry({ text, modeName, color, isError = false }) {
    this.el.feedEmpty.classList.add('hidden');

    const entry = document.createElement('div');
    entry.className = 'feed-entry' + (isError ? ' error' : '');
    entry.style.setProperty('--entry-color', isError ? 'var(--danger)' : color);

    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `
      <div class="feed-meta">
        <span class="feed-time">${time}</span>
        <span class="feed-mode">${isError ? 'ERROR' : modeName.toUpperCase()}</span>
      </div>
      <p class="feed-text"></p>
    `;
    entry.querySelector('.feed-text').textContent = text;

    this.el.feed.prepend(entry);
    if (window.gsap) {
      gsap.from(entry, { opacity: 0, y: 14, duration: 0.45, ease: 'power2.out' });
    }

    /* Keep the feed from growing forever. */
    const entries = this.el.feed.querySelectorAll('.feed-entry');
    if (entries.length > 40) entries[entries.length - 1].remove();
  },

  /* ---------------- Bottom bar + memory card ---------------- */

  setLastSaid(text) {
    this.el.lastSaid.textContent = text;
    if (window.gsap) {
      gsap.fromTo(this.el.lastSaid, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4 });
    }
  },

  setOracleSees(description) {
    if (description) {
      this.el.oracleSees.innerHTML = '';
      const em = document.createElement('em');
      em.textContent = description;
      this.el.oracleSees.appendChild(em);
    }
  },

  /* ---------------- Countdown + stats ---------------- */

  updateCountdown(remainingSec, totalSec) {
    const CIRC = 125.6;
    if (totalSec == null) {
      this.el.countdownNum.textContent = '–';
      this.el.ringProgress.style.strokeDashoffset = CIRC;
      return;
    }
    const clamped = Math.max(0, remainingSec);
    this.el.countdownNum.textContent = `${Math.ceil(clamped)}s`;
    this.el.ringProgress.style.strokeDashoffset = CIRC * (clamped / totalSec);
  },

  updateStats(stats) {
    this.el.statShots.textContent = stats.screenshots;
    this.el.statAnalyses.textContent = stats.analyses;
    this.el.statWords.textContent = stats.words;
    this.el.statChanges.textContent = stats.changes;
    this.el.statApi.textContent = stats.apiCalls;
    this.el.statDuration.textContent = this._formatDuration(stats.startedAt);
  },

  _formatDuration(startedAt) {
    if (!startedAt) return '00:00';
    const total = Math.floor((Date.now() - startedAt) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  },

  /* ---------------- Controls state ---------------- */

  setPaused(paused) {
    this.el.pauseBtn.innerHTML = paused ? '▶ &nbsp;RESUME' : '⏸ &nbsp;PAUSE';
    this.el.pauseBtn.classList.toggle('btn-success', paused);
    this.el.pauseBtn.classList.toggle('btn-warning', !paused);
  },

  setMuted(muted) {
    this.el.muteBtn.innerHTML = muted ? '🔇 &nbsp;UNMUTE' : '🔊 &nbsp;MUTE';
    this.el.muteBtn.classList.toggle('muted', muted);
  },

  /* Sync .selected inside a pill group by data attribute value. */
  syncPillGroup(group, attr, value) {
    group.querySelectorAll('.pill').forEach((pill) => {
      pill.classList.toggle('selected', pill.dataset[attr] === String(value));
    });
  },

  /* ---------------- Voice dropdowns ---------------- */

  populateVoices(voices, selectedURI) {
    [this.el.voiceSelect, this.el.activeVoice].forEach((select) => {
      select.innerHTML = '';
      if (!voices.length) {
        const opt = document.createElement('option');
        opt.textContent = 'No voices available';
        select.appendChild(opt);
        return;
      }
      voices.forEach((voice) => {
        const opt = document.createElement('option');
        opt.value = voice.voiceURI;
        opt.textContent = `${voice.name} (${voice.lang})`;
        if (voice.voiceURI === selectedURI) opt.selected = true;
        select.appendChild(opt);
      });
    });
  },

  /* ---------------- Mobile tabs ---------------- */

  applyTab(name) {
    document.querySelectorAll('#active-screen [data-tab]').forEach((el) => {
      el.classList.toggle('tab-visible', el.dataset.tab === name);
    });
    this.el.mobileTabs.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('selected', btn.dataset.tabTarget === name);
    });
  }
};

window.OracleUI = OracleUI;
