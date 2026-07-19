/**
 * Oracle — api.js (fetch calls to backend)
 * AI that watches your screen and speaks live feedback
 * Author: Youssef | github.com/youssef-880
 */

const OracleAPI = {
  /**
   * Send a screenshot to the backend for Gemini Vision analysis.
   * Resolves with { text, description }.
   */
  async analyze({ imageBase64, mimeType, mode, customInstruction, previousDescription, secondsSinceLast }) {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        mimeType,
        mode,
        customInstruction,
        previousDescription,
        secondsSinceLast
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Server error (HTTP ${res.status})`);
    }
    return data;
  },

  /** Fetch available modes and their system prompts. */
  async getModes() {
    const res = await fetch('/api/voices');
    if (!res.ok) throw new Error(`Failed to load modes (HTTP ${res.status})`);
    return res.json();
  },

  /** Check server health + whether the Gemini API key is configured. */
  async health() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return { ok: false, hasKey: false };
      return res.json();
    } catch {
      return { ok: false, hasKey: false };
    }
  }
};

window.OracleAPI = OracleAPI;
