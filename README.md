# Verzer - AI Document Editor MVP

A revolutionary document editor that solves the "linear editing" problem in AI writing tools. Never lose good work when AI goes in the wrong direction.

## 🎯 Problem It Solves

In ChatGPT and similar tools, each edit overwrites the previous version. When AI takes your document in the wrong direction, you lose your good work. Verzer preserves every version, lets you compare changes, and accept/reject edits at a granular level.

## ✨ Key Features

- **Version Management**: Every AI edit creates a new preserved version
- **Visual Diffs**: See exactly what changed with red strikethrough (deletions) and green underline (additions)
- **Granular Control**: Accept/reject individual changes or all at once
- **Manual Editing**: Edit any version directly
- **Version Switching**: Jump between any versions instantly
- **Prompt History**: See which prompts created which versions

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Anthropic API Key

1. Get your API key from [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Create a `.env.local` file in the root directory
3. Add your API key:

```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🌐 Deploying to verzer.ai

### Option 1: Deploy via Vercel (Recommended)

1. Push your code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/dashboard)
3. Import your GitHub repository
4. Add your `ANTHROPIC_API_KEY` in Environment Variables
5. Deploy!
6. Set up custom domain to point to verzer.ai

### Option 2: Build and Deploy Manually

```bash
# Build for production
npm run build

# The output will be in .next folder
# Upload to your hosting provider
```

## 💡 How to Use

1. **Start Writing**: Type or paste your document in the editor
2. **AI Edits**: Enter prompts like "make it more compelling" or "add humor"
3. **Compare Versions**: Select versions to compare from the dropdown
4. **Accept/Reject Changes**: Click the green/red buttons on individual changes
5. **Manual Edits**: Click in the editor and type to make manual changes

## 🏗️ Architecture Decisions

- **Next.js**: For easy deployment to Vercel/verzer.ai
- **Local Storage**: Persists data in browser (can upgrade to database later)
- **Claude Haiku**: Fast, affordable AI model for MVP
- **diff-match-patch**: Google's robust library for text comparison

## 📝 Future Enhancements

- Paragraph-level prompt tracking
- Collaborative features
- Export/import documents
- Keyboard shortcuts
- Undo/redo within versions
- Database persistence
- User accounts

## 🤝 Contributing

This is an MVP. Feel free to extend and improve!

## 📄 License

MIT