import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AISuggestion {
  id: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
  from: number;
  to: number;
  variations?: string[];
  status: 'pending' | 'accepted' | 'rejected';
}

interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  mode: 'chat' | 'agent';
  documentContent: string;
  selectedText?: string;
  selectionRange?: { from: number; to: number };
  conversationId: string;
  regenerate?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { 
      messages, 
      model, 
      mode, 
      documentContent, 
      selectedText, 
      selectionRange,
      conversationId,
      regenerate 
    } = body;

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== 'user') {
      return NextResponse.json({ error: 'No user message found' }, { status: 400 });
    }

    // Build context for AI
    const context = buildContext(documentContent, selectedText, selectionRange, mode);
    
    // Determine if this should generate suggestions
    const shouldGenerateSuggestions = mode === 'agent' && selectedText && selectionRange;

    // Build system prompt
    const systemPrompt = buildSystemPrompt(mode, shouldGenerateSuggestions, context);

    // Prepare messages for API
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10) // Keep last 10 messages for context
    ];

    // Call appropriate AI model
    console.log(`🤖 Calling AI model: ${model}`);
    let response;
    if (model.startsWith('claude')) {
      console.log('📞 Using Claude API');
      response = await callClaude(model, apiMessages, shouldGenerateSuggestions);
    } else {
      console.log('📞 Using OpenAI API');
      response = await callOpenAI(model, apiMessages, shouldGenerateSuggestions);
    }
    console.log('✅ AI response received');

    // Parse response and generate suggestions if needed
    let suggestions: AISuggestion[] = [];
    if (shouldGenerateSuggestions && selectedText && selectionRange) {
      suggestions = await generateSuggestions(
        response.content,
        selectedText,
        selectionRange,
        model
      );
    }

    return NextResponse.json({
      content: response.content,
      suggestions,
      model,
      conversationId
    });

  } catch (error) {
    console.error('AI Chat API Error:', error);
    return NextResponse.json(
      { error: 'Failed to process AI chat request' },
      { status: 500 }
    );
  }
}

function buildContext(
  documentContent: string, 
  selectedText?: string, 
  selectionRange?: { from: number; to: number },
  mode?: string
): string {
  let context = '';
  
  // Add document context (truncate if too long)
  const maxDocLength = 10000; // ~2500 tokens
  if (documentContent.length > maxDocLength) {
    if (selectionRange) {
      // Include selection + surrounding context
      const start = Math.max(0, selectionRange.from - 1000);
      const end = Math.min(documentContent.length, selectionRange.to + 1000);
      context += `Document excerpt (around selection):\n${documentContent.slice(start, end)}\n\n`;
    } else {
      // Just include beginning and end
      context += `Document beginning:\n${documentContent.slice(0, 2000)}\n\n`;
      context += `Document end:\n${documentContent.slice(-2000)}\n\n`;
    }
  } else {
    context += `Full document:\n${documentContent}\n\n`;
  }

  // Add selection context
  if (selectedText && selectionRange) {
    context += `Currently selected text (${selectionRange.from}-${selectionRange.to}):\n"${selectedText}"\n\n`;
  }

  return context;
}

function buildSystemPrompt(mode: string, shouldGenerateSuggestions: boolean, context: string): string {
  let prompt = `You are an AI writing assistant helping with document editing. `;
  
  if (mode === 'agent') {
    prompt += `You are in Agent mode - you can suggest specific edits to selected text. `;
    if (shouldGenerateSuggestions) {
      prompt += `When the user asks for changes to selected text, you MUST provide a specific rewrite. 
      
IMPORTANT: Always respond with "I suggest changing it to: [NEW TEXT]" when asked to edit text.
For example:
- User: "make this more formal"
- You: "I suggest changing it to: [formal version of the text]"

Be direct and actionable with your edits.`;
    }
  } else {
    prompt += `You are in Chat mode - provide helpful suggestions and discuss the document, but don't make direct edits. `;
  }

  prompt += `\n\nDocument context:\n${context}`;
  
  prompt += `\n\nGuidelines:
- Be concise and helpful
- Focus on the user's specific request
- Consider the document's overall tone and style
- If in Agent mode and editing text, always use "I suggest changing it to: [NEW TEXT]" format
- Ask clarifying questions when needed`;

  return prompt;
}

async function callOpenAI(model: string, messages: any[], shouldGenerateSuggestions: boolean) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini',
      messages,
      max_tokens: shouldGenerateSuggestions ? 1000 : 500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    content: data.choices[0].message.content
  };
}

async function callClaude(model: string, messages: any[], shouldGenerateSuggestions: boolean) {
  // Check if API key is configured
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    throw new Error('Anthropic API key not configured. Please add ANTHROPIC_API_KEY to your .env.local file.');
  }

  // Convert messages format for Claude
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  console.log(`🔑 Using Claude model: ${model === 'claude-3-5-sonnet' ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022'}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model === 'claude-3-5-sonnet' ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022',
      max_tokens: shouldGenerateSuggestions ? 1000 : 500,
      temperature: 0.7,
      system: systemMessage?.content || '',
      messages: conversationMessages
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`❌ Claude API error: ${response.status} - ${errorText}`);
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('✅ Claude response received successfully');
  return {
    content: data.content[0].text
  };
}

async function generateSuggestions(
  aiResponse: string,
  selectedText: string,
  selectionRange: { from: number; to: number },
  model: string
): Promise<AISuggestion[]> {
  const suggestions: AISuggestion[] = [];
  
  // Look for the specific pattern we instructed the AI to use
  const suggestPattern = /I suggest changing it to:\s*(.+?)(?:\n|$)/i;
  const changeToPattern = /change (?:it )?to:\s*(.+?)(?:\n|$)/i;
  const replaceWithPattern = /replace (?:it )?with:\s*(.+?)(?:\n|$)/i;
  
  let suggestedText = null;
  let explanation = aiResponse;
  
  // Try to extract the suggested text using different patterns
  const suggestMatch = aiResponse.match(suggestPattern);
  const changeToMatch = aiResponse.match(changeToPattern);
  const replaceWithMatch = aiResponse.match(replaceWithPattern);
  
  if (suggestMatch) {
    suggestedText = suggestMatch[1].trim().replace(/['"]/g, '');
  } else if (changeToMatch) {
    suggestedText = changeToMatch[1].trim().replace(/['"]/g, '');
  } else if (replaceWithMatch) {
    suggestedText = replaceWithMatch[1].trim().replace(/['"]/g, '');
  }
  
  // If we found a suggestion and have selected text, create a suggestion
  if (suggestedText && selectedText && suggestedText !== selectedText) {
    const suggestionId = `sug-${Date.now()}`;
    
    suggestions.push({
      id: suggestionId,
      originalText: selectedText,
      suggestedText: suggestedText,
      explanation: explanation,
      from: selectionRange.from,
      to: selectionRange.to,
      status: 'pending'
    });
    
    console.log(`✨ Generated suggestion: "${selectedText}" → "${suggestedText}"`);
  } else {
    console.log('ℹ️ No actionable suggestion found in AI response');
  }

  return suggestions;
}
