# sustAIn 🌱

**Smarter prompts. Fewer tokens. Lower environmental impact.**

sustAIn is a browser extension that compresses AI prompts before they are sent to large language models. By removing unnecessary wording while preserving key instructions, the extension helps reduce token usage, improve efficiency, and lower the computational resources required to run AI systems.

Large language models require significant computing power. Every prompt sent to an AI model consumes energy, water for cooling data centers, and hardware resources. While a single prompt is small, the scale of global AI usage is massive.

sustAIn focuses on improving **prompt efficiency** so users can get the same results with fewer tokens and less compute.

---

# Why sustAIn?

Many prompts written by humans contain extra words that are not necessary for the model to understand the request. AI models can often interpret much shorter instructions without losing meaning.

For example:

## Original Prompt

I am actually really interested in understanding, in a detailed and step-by-step way, the process by which water evaporates from oceans, lakes, and rivers and rises into the atmosphere to form clouds.

## Compressed Prompt

Explain step by step how water evaporates from oceans, lakes, and rivers and forms clouds.

The compressed version communicates the same intent while using fewer tokens.

When scaled across millions of AI requests, this type of efficiency can meaningfully reduce compute demand.

---

# Environmental Impact

Running large AI models requires powerful GPUs in data centers that consume electricity and cooling resources. AI infrastructure also uses water to cool servers and maintain stable temperatures.

Reducing the number of tokens sent to models helps reduce:

• compute workload  
• electricity consumption  
• cooling demand  
• infrastructure strain from large scale AI usage  

sustAIn aims to make AI usage slightly more efficient at scale by encouraging better prompt practices and reducing unnecessary token usage.

Even small improvements in prompt efficiency can have a measurable environmental effect when multiplied across millions of AI interactions.

---

# Benefits for Developers

sustAIn is not only about sustainability. It also helps developers and AI users work more efficiently.

Benefits include:

### Lower Token Usage
Compressed prompts use fewer tokens which can reduce API costs and extend usage limits.

### Faster Requests
Shorter prompts can reduce processing time and improve responsiveness.

### Better Prompt Discipline
The extension encourages writing prompts that focus on core instructions instead of unnecessary phrasing.

### Useful for AI Builders
Developers working with LLM APIs can use sustAIn to experiment with prompt optimization and token efficiency.

---

# Features

### Prompt Compression
Automatically shortens prompts while keeping the main instructions intact.

### Token Savings
Reduce token usage while maintaining similar AI responses.

### Undo Button
Instantly revert to the original prompt if needed.

### Adjustable Compression
Choose how aggressively prompts should be compressed.

### Impact Tracking
Track how many tokens and resources you save over time.

---

# Installation

## Manual Installation

1. Clone the repository

```
git clone https://github.com/YOUR_USERNAME/sustain
```

2. Open Chrome and go to

```
chrome://extensions
```

3. Enable Developer Mode

4. Click **Load Unpacked**

5. Select the dist folder

---

# How It Works

The extension intercepts prompts before they are submitted and analyzes them for redundant language.

The compression process focuses on:

• removing filler phrases  
• shortening verbose wording  
• preserving key instructions  
• maintaining model understanding  

Users can compare results between the original and compressed prompts directly in the interface.

---

# Development

Install dependencies

```
npm install
```

Run development mode

```
npm run dev
```

Build the extension

```
npm run build
```

---

# Contributing

Ideas, feedback, and improvements are welcome.

Feel free to open an issue or submit a pull request.

---

# Support

If you find the project useful, consider supporting development.

Buy Me a Coffee: YOUR_LINK_HERE

Support helps keep the project free and allows continued work on tools focused on efficient and sustainable computing.

---
