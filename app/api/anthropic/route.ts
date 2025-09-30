// API route for Anthropic Claude integration
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, content, model } = await request.json();
    
    // Check for API key in environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY in your .env.local file.' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307', // Default to Haiku if not specified
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `You are a document editor. Edit the following document according to this instruction: "${prompt}"
            
            Return ONLY the edited document text, no explanations or commentary.
            
            Original document:
            ${content}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return NextResponse.json(
        { error: 'Failed to get response from Anthropic' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const editedContent = data.content[0].text;

    return NextResponse.json({ editedContent });
  } catch (error) {
    console.error('Error in Anthropic API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
