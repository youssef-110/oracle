# Oracle

Oracle is a desktop app that watches your screen in real time and speaks live AI feedback out loud. Pick a mode — code review, gaming coach, design critic, study buddy, or general assistant — and Oracle narrates what it sees as you work.

It runs as an Electron app: screen capture is granted automatically (no browser share picker), and Oracle excludes its own window from what it watches, so it never comments on itself.

## Features

- **Live screen narration** — periodic screenshots analyzed by Gemini, spoken aloud via the Web Speech API
- **Five modes** — Code Review, Gaming Coach, Design Critic, Study Buddy, General Assistant
- **Custom instructions** — steer the feedback with your own prompt
- **Configurable interval & quality** — trade off responsiveness vs. API usage
- **Voice controls** — rate, pitch, volume, and voice selection

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and add your free Gemini API key from [aistudio.google.com](https://aistudio.google.com):
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Run the desktop app:
   ```
   npm start
   ```

A browser-only version (with the standard screen-share picker) is also available:
```
npm run web
```
then open `http://localhost:3000`.

## Tech

- **Backend**: Node.js + Express, proxies requests to the Gemini API
- **Desktop shell**: Electron
- **Frontend**: vanilla HTML/CSS/JS, Web Speech API for text-to-speech

## License

MIT
