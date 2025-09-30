// API route for Anthropic Claude integration
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, content, model, mode = 'edit' } = await request.json();
    
    // Check for API key in environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    // Different prompts based on mode
    let userContent: string;
    
    if (mode === 'chat') {
      userContent = `Document content: ${content}\n\nQuestion: ${prompt}`;
    } else {
      userContent = `Edit the following document according to this instruction: "${prompt}"\n\nOriginal document:\n${content}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-haiku-20241022',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: userContent
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
    const responseText = data.content[0].text;

    // Return different response based on mode
    if (mode === 'chat') {
      return NextResponse.json({ 
        mode: 'chat',
        response: responseText 
      });
    } else {
      return NextResponse.json({ 
        mode: 'edit',
        editedContent: responseText 
      });
    }
  } catch (error) {
    console.error('Error in Anthropic API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
