# Open Interview Coder

An AI-powered coding assistant that helps you during screen sharing sessions. The assistant appears as an overlay on your screen and can help with coding questions, debugging, and general programming assistance.

## Features

- Floating assistant overlay designed for screen-sharing workflows
- Real-time AI assistance for coding questions and interview prep
- Text-only assistant responses in the chat window
- Microphone capture with browser speech recognition for question transcription
- Screenshot analysis capabilities for supported vision-capable models
- Interview session context fields for role, company, background summary, and job description
- Provider selection for OpenAI, Google Gemini, and Anthropic
- Encrypted local API-key storage
- Provider capability awareness for text, vision, streaming, and transcription support
- Production-safe Electron defaults with secure IPC and OS keychain support

## Installation

### For Users

1. Download the latest release for your operating system from the releases page
2. Install the application
3. Launch the application
4. Open Settings and add an API key for OpenAI, Gemini, or Anthropic.

### For Developers

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/open-interview-coder.git
   cd open-interview-coder
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Run the test suite:
   ```bash
   npm test
   ```

5. Build the Windows installer:
   ```bash
   npm run build:win
   ```

6. Launch the generated installer when the build completes:
   ```bash
   npm run install:win
   ```

   The installer is created in the `dist` folder as a Windows NSIS setup file.

## Project Structure

```
open-interview-coder/
├── assets/                 # Images and icons
│   ├── icon.iconset/       # macOS icon set
│   ├── OCTO.png            # Application icon
│   ├── OCTO.ico            # Windows application icon
│   └── icon.icns           # macOS icon
├── src/                    # Source code
│   ├── main.js             # Main Electron process
│   ├── renderer.js         # Renderer process for the main window
│   ├── preload.js          # Preload script for secure IPC
│   ├── llm-service.js      # LLM API integration
│   ├── screenshot.js       # Screenshot capture functionality
│   ├── settings.js         # Settings window functionality
│   └── config.js           # Configuration management
├── styles.css              # Application styles
├── index.html              # Main application HTML
├── settings.html           # Settings page HTML
├── .gitignore              # Git ignore file
├── LICENSE                 # MIT License
├── package.json            # npm package configuration
└── README.md               # Project documentation
```

## Building for Distribution

To build the application for distribution:

```bash
# For macOS
npm run build:mac

# For Windows
npm run build:win

# Equivalent direct electron-builder command
npx electron-builder --win --config.win.signAndEditExecutable=false

# Compatibility alias for older instructions
npm run build:win:local

# For Linux
npm run build:linux
```

The built applications will be available in the `dist` directory.

## Usage

1. Launch the application
2. Add the role, company, candidate background summary, and job description in the session metadata so the assistant can ground interview answers in your actual context.
3. Select a microphone in the chat composer and click Listen to capture interviewer audio or your own spoken question.
4. When a transcript appears, review it and click Use transcript to send it into the chat.
5. Use the keyboard shortcuts to control the assistant:

   - `Cmd/Ctrl + Shift + S`: Capture and analyze a screenshot
   - `Cmd/Ctrl + Shift + H`: Toggle assistant visibility
   - `Cmd/Ctrl + Shift + Q`: Quit the application
   - `Cmd/Ctrl + ←/→/↑/↓`: Move the assistant window
   - `Cmd + ,`: Open settings

6. Ask questions in the chat box, choose a suggestion, or use the screenshot
   shortcut. Press Enter to send and Shift+Enter for a new line.
7. Use the window controls to hide the assistant or quit the application.

## Configuration

Choose an active provider and manage API keys in the app's Settings:

1. Open Settings with `Cmd/Ctrl + ,` or the gear button.
2. Select OpenAI, Google Gemini, or Anthropic.
3. Add the provider's API key and save. Saved keys are encrypted with the
   operating system's secure credential storage and are never returned to the
   renderer. Linux requires a working system keyring (such as GNOME Keyring or
   KWallet) to save new keys.

Provider usage and billing are controlled by the provider. Google's Gemini API
has a free tier subject to Google's current eligibility, quotas, and terms.
Gemini requests try Flash Lite models first and automatically fall back to
other supported Gemini models when a model is unavailable or overloaded,
using Google's Interactions API.
Anthropic requests use Claude Haiku 5.5,
and OpenAI requests use GPT-4o mini.

The app currently supports text-only responses in chat, with microphone capture
implemented as an input workflow instead of spoken playback. Speech recognition
uses the browser's Web Speech API when available. Depending on the Electron
runtime, recognition may require an internet connection and a supported speech
service; a network failure is reported separately from microphone connection or
permission problems. Typing remains available as a fallback, and the app never
emits an audio response by default.

Windows builds disable electron-builder's executable-editing helper because
that helper requires symbolic-link privileges when extracting on some Windows
installations. This still creates a working per-user NSIS installer; the
installer is unsigned. For branded executable metadata or signed public
distribution, enable Windows Developer Mode (or build from an elevated
terminal), restore `signAndEditExecutable` to `true`, and configure a
code-signing certificate.

## Capability matrix

| Capability | OpenAI | Gemini | Anthropic |
| --- | --- | --- | --- |
| Text generation | ✅ | ✅ | ✅ |
| Streaming responses | ✅ | ✅ | ✅ |
| Vision / screenshot analysis | ✅ | ✅ | ✅ |
| Browser transcription | ⚠️ via local speech API | ⚠️ via local speech API | ⚠️ via local speech API |
| Default model | GPT-4o mini | Gemini 2.5 Flash Lite | Claude Haiku 5.5 |

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
