/*
 * Oracle — AI Screen Assistant Backend
 * Setup: npm install → copy .env.example to .env →
 *        add GEMINI_API_KEY → npm start
 * Get free Gemini key at: https://aistudio.google.com
 * Visit: http://localhost:3000
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
/* "gemini-flash-latest" is a rolling alias maintained by Google, so the app
   keeps working when individual model versions are retired. */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
// Tried in order when a model is overloaded (503) or out of free quota (429).
const GEMINI_MODELS = [...new Set([GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-3.5-flash-lite'])];
const GEMINI_TIMEOUT_MS = 15000;
const geminiUrl = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
// Serve only the UI. Serving __dirname exposed .env (the Gemini key) and server.js.
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

/* ------------------------------------------------------------------ */
/*  Mode definitions                                                   */
/* ------------------------------------------------------------------ */

const MODES = {
  code: {
    name: 'Code Review',
    prompt:
      'You are an expert senior software engineer. Focus on bugs, errors, bad practices, ' +
      'performance issues, and suggestions. If you see an error message analyze it immediately. ' +
      'If code looks good say so briefly.'
  },
  gaming: {
    name: 'Gaming Coach',
    prompt:
      'You are an elite gaming coach. Give real-time tactical advice, call out mistakes ' +
      'immediately, suggest better strategies. Be energetic and motivating.'
  },
  design: {
    name: 'Design Critic',
    prompt:
      'You are a senior UI/UX designer and design critic. Comment on layout, spacing, colors, ' +
      'typography, accessibility, and user experience. Be direct and specific.'
  },
  study: {
    name: 'Study Buddy',
    prompt:
      'You are a helpful tutor. Help the user understand what they are reading or writing. ' +
      'Ask questions, make connections, suggest mnemonics, summarize key points.'
  },
  general: {
    name: 'General Assistant',
    prompt:
      'You are a helpful AI assistant. Give useful contextual commentary on whatever you see on screen.'
  }
};

/* ------------------------------------------------------------------ */
/*  Prompt builder                                                     */
/* ------------------------------------------------------------------ */

function buildPrompt({ mode, customInstruction, previousDescription, secondsSinceLast }) {
  const modeDef = MODES[mode] || MODES.general;

  const memory = previousDescription
    ? `You gave feedback ${secondsSinceLast || 'a few'} seconds ago and saw: "${previousDescription}". ` +
      'Only comment if something meaningful has changed since then. ' +
      'If the screen is essentially identical, reply with exactly NO_CHANGE. ' +
      'If only minor things changed, keep feedback very brief. ' +
      'If something major changed, give a more detailed analysis.'
    : 'This is the first screenshot of this session — give your first observations directly.';

  const lines = [
    "You are Oracle, an AI assistant watching someone's screen in real time and speaking your feedback out loud through text-to-speech.",
    memory,
    'Be concise — you are speaking out loud, so keep responses under 4 sentences unless something critical is happening. ' +
      "Never say 'I can see' or 'I notice' — just get straight to the feedback. " +
      'Use plain spoken language with no markdown, no bullet points, no code blocks.',
    modeDef.prompt
  ];

  if (customInstruction && String(customInstruction).trim()) {
    lines.push(`Additional instruction from the user (follow it): ${String(customInstruction).trim()}`);
  }

  lines.push(
    'After your spoken feedback (or after NO_CHANGE), add one final line that starts with "SCREEN:" ' +
      'followed by a single factual sentence describing what is currently on screen. ' +
      'This line is your memory for the next comparison and will never be spoken.'
  );

  return lines.join('\n\n');
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasKey: Boolean(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') });
});

app.get('/api/voices', (req, res) => {
  res.json({
    modes: Object.entries(MODES).map(([id, m]) => ({ id, name: m.name, prompt: m.prompt })),
    note: 'Speech voices are provided by the browser Web Speech API on the client.'
  });
});

app.post('/api/analyze', async (req, res) => {
  try {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return res.status(500).json({
        error:
          'GEMINI_API_KEY is missing. Copy .env.example to .env, add your key from https://aistudio.google.com, then restart the server.'
      });
    }

    const {
      imageBase64,
      mimeType,
      mode,
      customInstruction,
      previousDescription,
      secondsSinceLast
    } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required.' });
    }

    const prompt = buildPrompt({ mode, customInstruction, previousDescription, secondsSinceLast });

    const geminiBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
          ]
        }
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 }
    };

    let response;
    let data = {};
    for (const model of GEMINI_MODELS) {
      try {
        response = await fetch(geminiUrl(model), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body: JSON.stringify(geminiBody),
          signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)
        });
        data = await response.json().catch(() => ({}));
      } catch (err) {
        if (err.name !== 'TimeoutError') throw err;
        console.warn(`[Oracle] ${model} timed out after ${GEMINI_TIMEOUT_MS / 1000}s, trying the next model.`);
        response = { ok: false, status: 504 };
        data = { error: { message: `Gemini timed out after ${GEMINI_TIMEOUT_MS / 1000}s.` } };
        continue;
      }
      if (response.status !== 429 && response.status !== 503) break;
      console.warn(`[Oracle] ${model} returned ${response.status}, trying the next model.`);
    }

    if (!response.ok) {
      const message =
        (data && data.error && data.error.message) || `Gemini API error (HTTP ${response.status})`;
      console.error('[Oracle] Gemini error:', message);
      return res.status(502).json({ error: message });
    }

    const raw =
      (data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts.map((p) => p.text || '').join('')) ||
      '';

    if (!raw.trim()) {
      return res.status(502).json({ error: 'Gemini returned an empty response. Retrying next cycle.' });
    }

    /* Split the spoken text from the SCREEN: memory line */
    let text = raw.trim();
    let description = previousDescription || '';
    const match = raw.match(/SCREEN:\s*([\s\S]*)$/i);
    if (match) {
      description = match[1].trim();
      text = raw.slice(0, match.index).trim();
    }
    if (/^NO_?CHANGE\b/i.test(text)) text = '';

    console.log(
      `[Oracle] ${new Date().toLocaleTimeString()} | mode=${mode || 'general'} | ` +
        `spoke="${text.slice(0, 120) || '(quiet — no change)'}" | screen="${description.slice(0, 120)}"`
    );

    res.json({ text, description });
  } catch (err) {
    console.error('[Oracle] /api/analyze failed:', err.message);
    res.status(500).json({ error: 'Analysis failed: ' + err.message });
  }
});

/* ------------------------------------------------------------------ */

function startServer() {
  return new Promise((resolve) => {
    // Loopback only: other machines on the network must not reach the Gemini key.
    app.listen(PORT, '127.0.0.1', () => {
      console.log('┌──────────────────────────────────────────────┐');
      console.log('│  ORACLE — AI Screen Assistant                │');
      console.log(`│  Running at http://localhost:${PORT}            │`);
      console.log(`│  Gemini key: ${GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here' ? 'loaded ✓                        ' : 'MISSING ✗ (see .env.example)   '}│`);
      console.log('└──────────────────────────────────────────────┘');
      resolve();
    });
  });
}

/* Run standalone (npm run web) or be embedded by the Electron app. */
if (require.main === module) startServer();

module.exports = { startServer, PORT };
