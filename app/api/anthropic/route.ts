// API route for Anthropic Claude integration
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, content, model, mode = 'edit', projectConfig } = await request.json();
    
    // Check if content is provided
    if (!content || content.trim() === '') {
      return NextResponse.json(
        { error: 'No document content provided. Please write some text in the document first.' },
        { status: 400 }
      );
    }
    
    // Check for API key in environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY in your environment variables.' },
        { status: 500 }
      );
    }

    // Build project context if provided
    let projectContext = '';
    if (projectConfig) {
      projectContext = `PROJECT CONTEXT:
Project Name: ${projectConfig.projectName || 'Untitled'}
Description: ${projectConfig.description || 'No description'}
${projectConfig.styleGuide ? `Writing Style: ${projectConfig.styleGuide}` : ''}
${projectConfig.tone ? `Tone: ${projectConfig.tone}` : ''}
${projectConfig.audience ? `Target Audience: ${projectConfig.audience}` : ''}
${projectConfig.constraints ? `Constraints: ${projectConfig.constraints}` : ''}
${projectConfig.references?.length ? `Style References: ${projectConfig.references.join(', ')}` : ''}
${projectConfig.additionalContext ? `Additional Context: ${projectConfig.additionalContext}` : ''}

Please keep all edits and responses aligned with this project context.

---

`;
    }

    // Different prompts based on mode
    let userContent: string;
    
    if (mode === 'chat') {
      userContent = `${projectContext}Document content: ${content}\n\nQuestion: ${prompt}`;
    } else if (mode === 'analyze') {
      // Context extraction mode - no project context needed
      userContent = prompt + '\n\nDocument to analyze:\n' + content;
    } else {
      // Ask AI to return both the edited document AND an explanation
      userContent = `${projectContext}Edit the following HTML document according to this instruction: "${prompt}"

IMPORTANT RULES:
1. The document is in HTML format. Preserve ALL HTML tags and formatting.
2. Keep existing HTML tags like <p>, <strong>, <em>, <h1>, <h2>, <ul>, <li>, etc.
3. Add appropriate HTML tags for any new formatting:
   - For bold text, use <strong> tags
   - For italic text, use <em> tags  
   - For new paragraphs, use <p> tags
   - For headings, use <h1>, <h2>, <h3> etc.
   - For lists, use <ul>/<ol> with <li> tags

Return your response in this exact format:
[DOCUMENT]
(Put the edited HTML document here with all formatting preserved)
[/DOCUMENT]
[EXPLANATION]
(Explain what changes you made and why)
[/EXPLANATION]

Original HTML document:
${content}`;
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
    } else if (mode === 'analyze') {
      // For analyze mode, try to extract and return clean JSON
      try {
        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ 
            mode: 'analyze',
            response: jsonData 
          });
        }
      } catch (e) {
        console.error('Failed to parse JSON from analyze response:', e);
      }
      // If JSON parsing fails, return the raw text
      return NextResponse.json({ 
        mode: 'analyze',
        response: responseText 
      });
    } else {
      // Parse the structured response for edit mode
      const documentMatch = responseText.match(/\[DOCUMENT\]([\s\S]*?)\[\/DOCUMENT\]/);
      const explanationMatch = responseText.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
      
      let editedContent = responseText; // fallback to full response if parsing fails
      let explanation = '';
      
      if (documentMatch && documentMatch[1]) {
        editedContent = documentMatch[1].trim();
      }
      
      if (explanationMatch && explanationMatch[1]) {
        explanation = explanationMatch[1].trim();
      }
      
      return NextResponse.json({ 
        mode: 'edit',
        editedContent,
        explanation
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
