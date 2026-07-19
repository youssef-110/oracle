/**
 * Oracle — app.js (main controller, state management)
 * AI that watches your screen and speaks live feedback
 * Author: Youssef | github.com/youssef-880
 */

const MODES = {
  code: {
    name: 'Code Review',
    color: '#6366f1',
    greeting: "Oracle online. Code Review mode active. I'm watching your screen for bugs, bad practices, and improvements."
  },
  gaming: {
    name: 'Gaming Coach',
    color: '#f59e0b',
    greeting: "Oracle online. Gaming Coach mode active. Let's play — I'll call the shots as I see them."
  },
  design: {
    name: 'Design Critic',
    color: '#06b6d4',
    greeting: 'Oracle online. Design Critic mode active. Show me your work and I will give you honest design feedback.'
  },
  study: {
    name: 'Study Buddy',
    color: '#22c55e',
    greeting: "Oracle online. Study Buddy mode active. I'm reading along with you — let's learn this together."
  },
  general: {
    name: 'General Assistant',
    color: '#a78bfa',
    greeting: "Oracle online. General Assistant mode active. I'm watching your screen and I'll chime in when it helps."
  }
};

const state = {
  mode: 'code',
  customInstruction: '',
  interval: 5, // seconds, or 'manual'
  running: false,
  paused: false,
  analyzing: false,
  previousDescription: '',
  lastAnalysisAt: null,
  nextCaptureAt: null,
  stats: {
    startedAt: null,
    screenshots: 0,
    analyses: 0,
    words: 0,
    changes: 0,
    apiCalls: 0
  }
};

let ticker = null;

/* ================================================================ */
/*  Boot                                                            */
/* ================================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  OracleUI.init();
  OracleVoice.init((speaking) => OracleUI.setSpeaking(speaking));
  bindSetupControls();
  bindActiveControls();
  bindConnectivity();

  document.addEventListener('oracle:voices', () => {
    OracleUI.populateVoices(OracleVoice.getVoices(), OracleVoice.settings.voiceURI);
  });
  OracleUI.populateVoices(OracleVoice.getVoices(), OracleVoice.settings.voiceURI);

  await checkApiKey();
});

async function checkApiKey() {
  const health = await OracleAPI.health();
  OracleUI.showKeyMissing(!health.hasKey);
  return health.hasKey;
}

/* ================================================================ */
/*  Setup screen bindings                                           */
/* ================================================================ */

function bindSetupControls() {
  const ui = OracleUI.el;

  ui.keyRetry.addEventListener('click', checkApiKey);

  /* Mode cards */
  ui.modeGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.mode-card');
    if (!card) return;
    state.mode = card.dataset.mode;
    ui.modeGrid.querySelectorAll('.mode-card').forEach((c) => c.classList.toggle('selected', c === card));
  });

  /* Suggestion pills fill the custom instruction input */
  ui.suggestionPills.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    ui.customInstruction.value = pill.dataset.suggestion;
    ui.customInstruction.focus();
  });

  /* Interval + quality (setup) */
  ui.intervalGroup.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    setIntervalSetting(pill.dataset.interval);
  });
  ui.qualityGroup.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    setQualitySetting(pill.dataset.quality);
  });

  /* Collapsible voice settings */
  ui.voiceToggle.addEventListener('click', () => {
    const open = ui.voiceBody.classList.toggle('hidden');
    ui.voiceToggle.classList.toggle('open', !open);
    if (!open && window.gsap) {
      gsap.from(ui.voiceBody, { opacity: 0, y: -8, duration: 0.3, ease: 'power2.out' });
    }
  });

  /* Voice sliders (setup) */
  ui.rateSlider.addEventListener('input', () => {
    OracleVoice.setRate(ui.rateSlider.value);
    ui.rateLabel.textContent = `${Number(ui.rateSlider.value).toFixed(1)}x`;
    ui.activeRate.value = ui.rateSlider.value;
    ui.activeRateLabel.textContent = ui.rateLabel.textContent;
  });
  ui.pitchSlider.addEventListener('input', () => {
    OracleVoice.setPitch(ui.pitchSlider.value);
    ui.pitchLabel.textContent = Number(ui.pitchSlider.value).toFixed(1);
  });
  ui.volumeSlider.addEventListener('input', () => {
    OracleVoice.setVolume(ui.volumeSlider.value);
    ui.volumeLabel.textContent = `${Math.round(ui.volumeSlider.value * 100)}%`;
    ui.activeVolume.value = ui.volumeSlider.value;
    ui.activeVolumeLabel.textContent = ui.volumeLabel.textContent;
  });
  ui.voiceSelect.addEventListener('change', () => {
    OracleVoice.setVoice(ui.voiceSelect.value);
    ui.activeVoice.value = ui.voiceSelect.value;
  });

  /* Start + denied overlay */
  ui.startBtn.addEventListener('click', startOracle);
  ui.deniedRetry.addEventListener('click', () => {
    OracleUI.showShareDenied(false);
    startOracle();
  });
  ui.deniedBack.addEventListener('click', () => OracleUI.showShareDenied(false));
}

/* ================================================================ */
/*  Active screen bindings                                          */
/* ================================================================ */

function bindActiveControls() {
  const ui = OracleUI.el;

  ui.pauseBtn.addEventListener('click', () => {
    state.paused = !state.paused;
    OracleUI.setPaused(state.paused);
    if (!state.paused) scheduleNext();
    else OracleUI.updateCountdown(null, null);
  });

  ui.analyzeNowBtn.addEventListener('click', () => runCycle(true));
  ui.stopBtn.addEventListener('click', stopOracle);

  ui.activeIntervalGroup.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    setIntervalSetting(pill.dataset.interval);
    if (state.running && !state.paused) scheduleNext();
  });
  ui.activeQualityGroup.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;
    setQualitySetting(pill.dataset.quality);
  });

  /* Voice controls (active) */
  ui.muteBtn.addEventListener('click', () => {
    OracleVoice.setMuted(!OracleVoice.settings.muted);
    OracleUI.setMuted(OracleVoice.settings.muted);
  });
  ui.activeRate.addEventListener('input', () => {
    OracleVoice.setRate(ui.activeRate.value);
    ui.activeRateLabel.textContent = `${Number(ui.activeRate.value).toFixed(1)}x`;
    ui.rateSlider.value = ui.activeRate.value;
    ui.rateLabel.textContent = ui.activeRateLabel.textContent;
  });
  ui.activeVolume.addEventListener('input', () => {
    OracleVoice.setVolume(ui.activeVolume.value);
    ui.activeVolumeLabel.textContent = `${Math.round(ui.activeVolume.value * 100)}%`;
    ui.volumeSlider.value = ui.activeVolume.value;
    ui.volumeLabel.textContent = ui.activeVolumeLabel.textContent;
  });
  ui.activeVoice.addEventListener('change', () => {
    OracleVoice.setVoice(ui.activeVoice.value);
    ui.voiceSelect.value = ui.activeVoice.value;
  });

  /* Mobile tabs */
  ui.mobileTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    OracleUI.applyTab(btn.dataset.tabTarget);
  });
}

function bindConnectivity() {
  const sync = () => OracleUI.setOffline(!navigator.onLine);
  window.addEventListener('online', sync);
  window.addEventListener('offline', sync);
  sync();
}

/* ================================================================ */
/*  Settings helpers                                                */
/* ================================================================ */

function setIntervalSetting(value) {
  state.interval = value === 'manual' ? 'manual' : Number(value);
  OracleUI.syncPillGroup(OracleUI.el.intervalGroup, 'interval', value);
  OracleUI.syncPillGroup(OracleUI.el.activeIntervalGroup, 'interval', value);
  if (state.interval === 'manual') {
    state.nextCaptureAt = null;
    OracleUI.updateCountdown(null, null);
  }
}

function setQualitySetting(value) {
  OracleCapture.setQuality(value);
  OracleUI.syncPillGroup(OracleUI.el.qualityGroup, 'quality', value);
  OracleUI.syncPillGroup(OracleUI.el.activeQualityGroup, 'quality', value);
}

/* ================================================================ */
/*  Start / stop                                                    */
/* ================================================================ */

async function startOracle() {
  if (!(await checkApiKey())) return;

  state.customInstruction = OracleUI.el.customInstruction.value.trim();

  try {
    await OracleCapture.start(() => {
      /* User stopped sharing from the browser UI. */
      if (state.running) stopOracle();
    });
  } catch (err) {
    console.warn('[Oracle] Screen share failed:', err.name, err.message);
    OracleUI.showShareDenied(true);
    return;
  }

  /* Reset session state */
  state.running = true;
  state.paused = false;
  state.analyzing = false;
  state.previousDescription = '';
  state.lastAnalysisAt = null;
  state.stats = { startedAt: Date.now(), screenshots: 0, analyses: 0, words: 0, changes: 0, apiCalls: 0 };

  OracleUI.resetActiveScreen();
  OracleUI.setPaused(false);
  OracleUI.setMuted(OracleVoice.settings.muted);
  OracleUI.showActiveScreen(MODES[state.mode], state.customInstruction);
  OracleUI.updateStats(state.stats);

  ticker = setInterval(tick, 250);

  /* Greeting, then the first analysis runs immediately. */
  const greeting = MODES[state.mode].greeting;
  OracleUI.setLastSaid(greeting);
  OracleUI.addFeedEntry({ text: greeting, modeName: MODES[state.mode].name, color: MODES[state.mode].color });
  await OracleVoice.speak(greeting);

  runCycle(true);
}

function stopOracle() {
  state.running = false;
  state.paused = false;
  state.nextCaptureAt = null;
  clearInterval(ticker);
  OracleCapture.stop();
  OracleVoice.stop();
  OracleUI.setAnalyzing(false);
  OracleUI.setSpeaking(false);
  OracleUI.showSetupScreen();
}

/* ================================================================ */
/*  Analysis loop                                                   */
/* ================================================================ */

function scheduleNext() {
  if (!state.running || state.interval === 'manual') {
    state.nextCaptureAt = null;
    OracleUI.updateCountdown(null, null);
    return;
  }
  state.nextCaptureAt = Date.now() + state.interval * 1000;
}

function tick() {
  if (!state.running) return;

  OracleUI.updateStats(state.stats);

  if (state.paused || state.interval === 'manual' || state.analyzing || !state.nextCaptureAt) return;

  const remaining = (state.nextCaptureAt - Date.now()) / 1000;
  OracleUI.updateCountdown(remaining, state.interval);

  if (remaining <= 0) runCycle(false);
}

async function runCycle(manual) {
  if (!state.running || state.analyzing) return;
  if (state.paused && !manual) return;
  if (!navigator.onLine) {
    scheduleNext();
    return;
  }

  state.analyzing = true;
  state.nextCaptureAt = null;
  OracleUI.setAnalyzing(true);
  OracleUI.updateCountdown(null, null);

  const modeInfo = MODES[state.mode];

  try {
    const shot = OracleCapture.grab();
    state.stats.screenshots++;
    OracleUI.setPreview(shot.dataUrl);

    const secondsSinceLast = state.lastAnalysisAt
      ? Math.round((Date.now() - state.lastAnalysisAt) / 1000)
      : null;

    const result = await OracleAPI.analyze({
      imageBase64: shot.base64,
      mimeType: shot.mimeType,
      mode: state.mode,
      customInstruction: state.customInstruction,
      previousDescription: state.previousDescription,
      secondsSinceLast
    });

    state.stats.apiCalls++;
    state.lastAnalysisAt = Date.now();

    if (result.description && result.description !== state.previousDescription) {
      if (state.previousDescription) state.stats.changes++;
      state.previousDescription = result.description;
      OracleUI.setOracleSees(result.description);
    }

    OracleUI.setAnalyzing(false);

    if (result.text && result.text.trim()) {
      const text = result.text.trim();
      state.stats.analyses++;
      state.stats.words += text.split(/\s+/).length;
      OracleUI.addFeedEntry({ text, modeName: modeInfo.name, color: modeInfo.color });
      OracleUI.setLastSaid(text);
      OracleUI.updateStats(state.stats);

      /* Wait for speech to finish so voices never overlap. */
      await OracleVoice.speak(text);
    }
  } catch (err) {
    console.error('[Oracle] Analysis cycle failed:', err);
    OracleUI.setAnalyzing(false);
    OracleUI.addFeedEntry({ text: err.message, modeName: modeInfo.name, color: modeInfo.color, isError: true });
  } finally {
    state.analyzing = false;
    if (state.running && !state.paused) scheduleNext();
  }
}
