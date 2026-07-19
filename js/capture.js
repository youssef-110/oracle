/**
 * Oracle — capture.js (screen capture, interval logic, screenshot)
 * AI that watches your screen and speaks live feedback
 * Author: Youssef | github.com/youssef-880
 */

const OracleCapture = {
  QUALITY: {
    low: { maxWidth: 640, jpeg: 0.5 },
    medium: { maxWidth: 1024, jpeg: 0.65 },
    high: { maxWidth: 1600, jpeg: 0.85 }
  },

  quality: 'medium',
  _stream: null,
  _video: null,
  _onEnded: null,

  isActive() {
    return Boolean(this._stream);
  },

  setQuality(quality) {
    if (this.QUALITY[quality]) this.quality = quality;
  },

  /**
   * Ask for screen share permission and start the capture stream.
   * Throws the browser error (e.g. NotAllowedError) if denied.
   * onEnded fires if the user stops sharing from the browser UI.
   */
  async start(onEnded) {
    this._onEnded = onEnded || null;

    this._stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 5 },
      audio: false
    });

    const track = this._stream.getVideoTracks()[0];
    track.addEventListener('ended', () => {
      this.stop();
      if (this._onEnded) this._onEnded();
    });

    this._video = document.createElement('video');
    this._video.srcObject = this._stream;
    this._video.muted = true;
    this._video.playsInline = true;
    await this._video.play();

    /* Wait until the video actually has pixels to grab. */
    if (!this._video.videoWidth) {
      await new Promise((resolve) => {
        this._video.addEventListener('loadedmetadata', resolve, { once: true });
        setTimeout(resolve, 1500);
      });
    }
  },

  /** Stop the stream and release the screen. */
  stop() {
    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
    if (this._video) {
      this._video.srcObject = null;
      this._video = null;
    }
  },

  /**
   * Grab a screenshot of the shared screen at the current quality.
   * Returns { dataUrl, base64, mimeType }.
   */
  grab() {
    if (!this._stream || !this._video || !this._video.videoWidth) {
      throw new Error('Screen capture is not active.');
    }

    const q = this.QUALITY[this.quality] || this.QUALITY.medium;
    const scale = Math.min(1, q.maxWidth / this._video.videoWidth);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(this._video.videoWidth * scale);
    canvas.height = Math.round(this._video.videoHeight * scale);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(this._video, 0, 0, canvas.width, canvas.height);

    const mimeType = 'image/jpeg';
    const dataUrl = canvas.toDataURL(mimeType, q.jpeg);
    const base64 = dataUrl.split(',')[1];

    return { dataUrl, base64, mimeType };
  }
};

window.OracleCapture = OracleCapture;
