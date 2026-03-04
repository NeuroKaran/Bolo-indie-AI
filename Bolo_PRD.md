# Bolo --- Voice-Native Agentic Bridge for Indian Developers (MVP)

## 1. Purpose & One-liner

**Purpose:** Reduce the translation tax for Indian developers by
transforming messy, code‑mixed spoken ideas into polished, agent‑ready
prompts that paste directly into AI coding assistants.

**One‑liner:** Dictate in Hinglish (or any Indian language), get
developer‑grade prompts in English instantly --- with a saffron & white
indie UI.

------------------------------------------------------------------------

## 2. Goals & Success Criteria (MVP)

### Business Goals

-   Remove friction for non‑native English developers when using AI
    coding assistants.
-   Enable rapid ideation-to-execution for hackathon teams and product
    builders.
-   Keep operational costs extremely low (only STT engine cost).

### Success Metrics (First 30 Days)

-   **Latency:** Hotkey → clipboard copy ≤ 2.5 seconds.
-   **Accuracy:** Technical jargon retention ≥ 95%.
-   **Adoption:** ≥10 uses per active coding session.
-   **Retention:** ≥25% weekly returning users.

### Secondary Metrics

-   Prompt usefulness ≥ 4/5 (human review).
-   ≥60% prompts pasted into coding assistants.

------------------------------------------------------------------------

## 3. Target Users & Use Cases

### Primary Users

-   Indian developers who think in regional languages or Hinglish.
-   Full‑stack engineers designing architecture quickly.
-   Hackathon teams and indie builders.

### Key Use Cases

-   Dictating middleware or functions.
-   Architecture brainstorming.
-   Writing test cases or API specs via voice.

------------------------------------------------------------------------

## 4. Product Principles

-   **Indian-first:** Works with code‑mixed languages.
-   **Low‑latency:** Minimal UI friction.
-   **Privacy‑aware:** Prefer local processing.
-   **Developer‑centric:** Outputs structured prompts optimized for LLM
    agents.
-   **Low cost infrastructure.**

------------------------------------------------------------------------

## 5. UI/UX Design --- Indie Indian Aesthetic

### Color Palette

-   Primary saffron: `#FF9933`
-   Deep saffron accent: `#FF6F00`
-   White background: `#FFFFFF`
-   Soft off‑white: `#FFF8F0`
-   Charcoal text: `#121212`
-   Secondary text: `#6B6B6B`

### Typography

-   Clean sans-serif UI font.
-   Monospace for code blocks.
-   Indie‑style hand‑drawn icons.

### Design Principles

-   Minimal floating UI.
-   Slight paper texture background.
-   Soft rounded corners.
-   Quick micro‑animations.

### Accessibility

-   WCAG AA contrast compliance.
-   Keyboard‑first navigation.

------------------------------------------------------------------------

## 6. Core Features (MVP)

### Global Hotkey Activation

-   Default shortcut: Ctrl/Cmd + Space
-   Instantly launches recording bar.

### Floating Command Bar

Displays: - Audio waveform - Recording timer - Language detection chip -
Preview of structured prompt

### Indic‑Aware Speech‑to‑Text

Supports: - Hinglish - Hindi - Tamil - Bengali - Telugu - Other Indian
languages

### Agentic Prompt Structuring

Transforms transcript into:

-   Title
-   Description
-   Requirements
-   Acceptance criteria
-   Constraints

### Clipboard & Auto‑Inject

-   Prompt copied automatically.
-   Optional direct injection into editor.

### Prompt History

-   Last 50 prompts stored locally.
-   Favorite templates.

### Settings Panel

-   STT provider selection
-   Language preferences
-   Privacy settings
-   Custom hotkeys

------------------------------------------------------------------------

## 7. Tech Stack

### Desktop Client

-   Tauri
-   React

### Audio Processing

-   Silero VAD

### Speech‑to‑Text Providers

-   Whisper API
-   Deepgram
-   SeamlessM4T
-   Bhashini

### LLM Prompt Structuring

-   Groq (Llama models)
-   Gemini Flash

### Backend

-   Serverless APIs
-   Redis / Edge KV caching

### Storage

-   Local SQLite database

------------------------------------------------------------------------

## 8. System Architecture (HLD)

### Client Layer

Responsibilities: - Hotkey detection - Audio capture - Local VAD - UI
display - Clipboard injection

### Edge / Cloud Layer

Responsibilities: - Audio ingestion - STT provider integration -
Transcript normalization - LLM prompt structuring

### Data Flow

1.  User presses hotkey
2.  Audio captured and cleaned by VAD
3.  Audio sent to STT provider
4.  Transcript returned
5.  LLM structures prompt
6.  Prompt returned to client
7.  Copied to clipboard

------------------------------------------------------------------------

## 9. Low Level Design (LLD)

### API --- ingestAudio

POST

    {
    "userId": "string",
    "sessionId": "string",
    "audioChunkBase64": "string",
    "chunkIndex": 0,
    "languageHints": ["hi","en"]
    }

### Prompt Object

    {
      "promptId": "uuid",
      "title": "string",
      "summary": "string",
      "requirements": [],
      "acceptance_criteria": [],
      "constraints": [],
      "examples": [],
      "original_transcript": "string",
      "confidence": 0.0
    }

------------------------------------------------------------------------

## 10. Privacy & Security

-   Ephemeral audio storage.
-   TLS encrypted traffic.
-   AES‑256 encryption for stored data.
-   Optional local‑only mode.

------------------------------------------------------------------------

## 11. Edge Cases

-   Poor microphone input.
-   Network loss.
-   Code tokens misinterpreted by STT.

Mitigation: - Confidence indicators. - Edit prompt before copy. -
Preserve code syntax.

------------------------------------------------------------------------

## 12. QA Strategy

-   1000 labeled Hinglish test phrases.
-   Accuracy evaluation across languages.
-   Latency monitoring.

------------------------------------------------------------------------

## 13. Product Roadmap

### MVP

-   Voice capture
-   STT integration
-   Prompt structuring
-   Clipboard copy

### Version 1

-   VSCode plugin
-   Cursor integration
-   Mobile companion

------------------------------------------------------------------------

## 14. Risks

  Risk                      Mitigation
  ------------------------- ------------------------------
  High STT cost             Allow provider switching
  Privacy concerns          Local mode
  Technical jargon errors   Custom vocabulary dictionary

------------------------------------------------------------------------

## 15. Acceptance Criteria

-   Latency ≤2.5s
-   STT accuracy ≥95%
-   UI accessibility compliant
-   Clipboard workflow stable

------------------------------------------------------------------------

## 16. Deliverables

-   PRD document
-   Figma UI mockups
-   STT dataset
-   Security checklist

------------------------------------------------------------------------

## 17. Sample UX Copy

Floating Bar

**Bolo**

Record (रिकॉर्ड करें)

Detected Language: Hinglish

\[Copy Prompt\] \[Inject\]

Low confidence --- Edit before copy
