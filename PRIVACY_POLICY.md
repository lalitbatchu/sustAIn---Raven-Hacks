# SustAIn Privacy Policy

Last updated: March 14, 2026

## Overview

SustAIn is a Chrome extension that helps users compress prompts on supported AI chat websites before sending them to the model.

## What SustAIn Accesses

SustAIn reads the prompt text that a user types into supported AI chat interfaces in order to:

- compress the prompt locally in the browser,
- replace the prompt with the compressed version,
- support undo,
- show local usage and savings statistics.

Supported sites currently include:

- ChatGPT
- Gemini
- Claude
- Grok
- Copilot
- DeepSeek
- Perplexity

## Local Processing

Prompt compression runs locally inside the extension using bundled model and runtime files.

SustAIn does not send prompt text to our backend for compression.

## Information Stored Locally

SustAIn stores the following data in `chrome.storage.local` on the user's device:

- extension settings such as undo, compression level, and tutorial state,
- local aggregate usage and savings totals such as tokens saved, compression percentage, water savings, and energy savings.

## Information Sent Off Device

SustAIn sends limited usage metrics to our backend at:

- `https://backend.lalitbatchu.workers.dev`

This may include:

- a locally generated extension user identifier,
- original prompt token count,
- compressed prompt token count,
- tokens saved.

This is used for aggregate eco-log / usage tracking.

The payload does not include prompt text.

## What We Do Not Collect

SustAIn does not intentionally collect:

- passwords,
- payment information,
- health information,
- precise location,
- contact lists.

SustAIn does not sell user data.

SustAIn does not use data for advertising or for purposes unrelated to the extension's core functionality.

## Third Parties

SustAIn uses browser-local bundled model/runtime assets for prompt compression and a backend endpoint hosted on Cloudflare Workers for limited usage-metric logging.

## Data Retention

Local settings and totals remain on the user's device until cleared by the user or removed with the extension.

Limited usage-metric records sent to the backend may be retained for aggregate statistics.

## Contact

For questions about this privacy policy, contact:

- `usesustain@gmail.com`
