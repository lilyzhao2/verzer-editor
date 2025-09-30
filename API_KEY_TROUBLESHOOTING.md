# 🚨 CRITICAL: API Key Troubleshooting Guide

## The Problem That Keeps Happening

**NEVER hardcode API keys in production code!** This file documents a temporary fix for a persistent environment variable issue.

## What Happened

1. **Environment Variable Corruption**: The `.zshrc` file had missing newlines causing "export" to be appended to the API key
2. **Server Caching**: Next.js server processes cached the corrupted environment variable
3. **Multiple Restarts Failed**: Even after fixing `.zshrc`, the server kept using the corrupted key

## The Fix Applied

The API route now properly uses environment variables:

```typescript
const apiKey = process.env.ANTHROPIC_API_KEY;
```

## Root Cause

The `.zshrc` file had this broken format:
```bash
export ANTHROPIC_API_KEY="...key..."export PATH="..."
```

Should be:
```bash
export ANTHROPIC_API_KEY="...key..."
export PATH="..."
```

## How to Fix Properly

1. **Fix .zshrc file** - Add newlines between export statements
2. **Remove hardcoded key** - Use environment variables only
3. **Restart shell** - `source ~/.zshrc`
4. **Restart server** - `npm run dev`

## Security Warning

⚠️ **NEVER commit hardcoded API keys to version control!**
- This is a temporary development fix only
- Remove hardcoded keys before deploying
- Use environment variables in production

## Prevention

1. Always check API key format in terminal: `echo $ANTHROPIC_API_KEY`
2. Verify no "export" suffix in the key
3. Test API key directly with curl before starting server
4. Use `.env.local` files for local development

## Current Status

✅ **Working**: Environment variables properly configured
✅ **Secure**: No hardcoded keys in source code
✅ **Ready**: Safe for GitHub and production deployment

---
*Created: September 30, 2025*
*Issue: Environment variable corruption causing API authentication failures*
