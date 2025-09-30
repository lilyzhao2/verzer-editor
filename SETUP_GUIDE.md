# 🚀 Verzer Setup Guide for Non-Coders

Welcome! This guide will walk you through setting up your AI document editor step by step.

## Step 1: Get Your Anthropic API Key

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to Settings → API Keys
4. Click "Create Key"
5. Copy the key that starts with `sk-ant-...`
6. Keep this tab open - you'll need this key soon!

## Step 2: Set Up Your API Key Locally

1. In your project folder (`verzer-editor`), create a new file called `.env.local`
2. Add this line to the file:
   ```
   ANTHROPIC_API_KEY=paste_your_key_here
   ```
3. Replace `paste_your_key_here` with your actual API key from Step 1
4. Save the file

## Step 3: Test Your Application Locally

1. Open Terminal (Mac) or Command Prompt (Windows)
2. Navigate to your project folder:
   ```bash
   cd "/Users/lilyzhao-streak/Desktop/Verzer MVP/verzer-editor"
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and go to: [http://localhost:3000](http://localhost:3000)
5. You should see your document editor!

## Step 4: Test the Features

1. **Write Something**: Type any text in the left editor panel
2. **AI Edit**: In the right chat panel, type "make it more formal" and hit Enter
3. **See Version**: A new version will be created - check the dropdown at the top
4. **Compare Versions**: Select a version to compare in the "Compare with" dropdown
5. **Accept/Reject**: Click the green/red buttons on individual changes

## Step 5: Deploy to verzer.ai

### Option A: Using Vercel (Easiest)

1. Create a GitHub account at [github.com](https://github.com)
2. Upload your project to GitHub:
   - Create a new repository
   - Follow GitHub's instructions to push your code
3. Go to [vercel.com](https://vercel.com)
4. Sign in with GitHub
5. Click "Import Project"
6. Select your repository
7. In Environment Variables, add:
   - Name: `ANTHROPIC_API_KEY`
   - Value: Your API key from Step 1
8. Click "Deploy"
9. Once deployed, go to Settings → Domains
10. Add `verzer.ai` as a custom domain

### Option B: Manual Deployment

1. Build your project:
   ```bash
   npm run build
   ```
2. The built files will be in `.next` folder
3. Contact your hosting provider for specific upload instructions

## 🎨 Customization Tips

### Change Colors
Edit `tailwind.config.js` to change the color scheme

### Change AI Model
In `app/api/anthropic/route.ts`, you can change:
- `claude-3-haiku-20240307` (current - fast & cheap)
- `claude-3-sonnet-20240229` (better quality, more expensive)
- `claude-3-opus-20240229` (best quality, most expensive)

### Change Layout Split
In `app/page.tsx`, change `w-3/5` and `w-2/5` to adjust the split ratio

## ❓ Troubleshooting

### "API key not configured" Error
- Make sure your `.env.local` file exists and contains your API key
- Restart the development server after adding the key

### "Failed to get response from Anthropic"
- Check that your API key is correct
- Ensure you have credits in your Anthropic account

### Page Not Loading
- Make sure you ran `npm install` first
- Check that port 3000 is not being used by another application

## 📞 Need Help?

1. Check the console for error messages (Right-click → Inspect → Console)
2. Make sure all steps were followed exactly
3. Try restarting the development server

## 🎯 What This Solves

Your document editor solves a real problem:
- **Before**: In ChatGPT, each edit overwrites the previous one. If AI goes wrong, you lose good work.
- **After**: Every edit is preserved as a version. You can compare, accept/reject changes, and never lose good writing.

## 🚀 Next Steps

Once your MVP is working:
1. Get user feedback
2. Consider adding user accounts
3. Add export functionality
4. Implement collaborative features
5. Add more AI models

Good luck with your launch! 🎉
