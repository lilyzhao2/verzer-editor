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
    
    // In agent mode, always generate suggestions that can be applied to the document
    const shouldGenerateSuggestions = mode === 'agent';

    // Build version context info
    const versionInfo = `Current document version: ${body.currentVersion || 'unknown'}. Recent changes: ${body.recentChanges || 'none'}.`;
    
    // Build system prompt
    const systemPrompt = buildSystemPrompt(mode, shouldGenerateSuggestions, context, versionInfo);

    // Prepare messages for API
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10) // Keep last 10 messages for context
    ];

    // Call appropriate AI model with retry logic
    console.log(`🤖 Calling AI model: ${model}`);
    let response;
    
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (model.startsWith('claude')) {
          console.log(`📞 Using Claude API (attempt ${attempt + 1}/${maxRetries})`);
          response = await callClaude(model, apiMessages, shouldGenerateSuggestions);
        } else {
          console.log(`📞 Using OpenAI API (attempt ${attempt + 1}/${maxRetries})`);
          response = await callOpenAI(model, apiMessages, shouldGenerateSuggestions);
        }
        console.log('✅ AI response received');
        break; // Success, exit retry loop
        
      } catch (error) {
        lastError = error as Error;
        console.error(`❌ API call failed (attempt ${attempt + 1}/${maxRetries}):`, error);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 3s, 9s
          const delay = Math.pow(3, attempt) * 1000;
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all retries failed, try fallback model
    if (!response && lastError) {
      if (model === 'gpt-4o') {
        console.log('🔄 GPT-4o failed, trying Claude as fallback...');
        try {
          response = await callClaude('claude-3-5-sonnet', apiMessages, shouldGenerateSuggestions);
          console.log('✅ Fallback to Claude successful');
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          throw lastError; // Throw original error
        }
      } else {
        throw lastError; // No fallback available
      }
    }

    // Parse response and generate suggestions if needed
    let suggestions: AISuggestion[] = [];
    if (shouldGenerateSuggestions) {
      suggestions = await generateSuggestions(
        response.content,
        selectedText || '',
        selectionRange || { from: 0, to: 0 },
        model,
        documentContent
      );
      
      // If no suggestions were generated and we have selected text, make a direct request
      if (suggestions.length === 0 && selectedText && selectionRange) {
        console.log('🔄 No suggestions found, making direct edit request...');
        
        const directPrompt = `Rewrite this text to be ${lastUserMessage.content.toLowerCase()}. Provide ONLY the rewritten text, no explanation:

Original text: "${selectedText}"

Rewritten text:`;

        const directMessages = [
          { role: 'system', content: directPrompt },
          { role: 'user', content: 'Please rewrite the text as requested.' }
        ];

        try {
          let directResponse;
          if (model.startsWith('claude')) {
            directResponse = await callClaude(model, directMessages, false);
          } else {
            directResponse = await callOpenAI(model, directMessages, false);
          }

          const rewrittenText = directResponse.content.trim().replace(/^["']|["']$/g, '');
          
          if (rewrittenText && rewrittenText !== selectedText) {
            suggestions.push({
              id: `sug-${Date.now()}-direct`,
              originalText: selectedText,
              suggestedText: rewrittenText,
              explanation: `Direct rewrite: ${lastUserMessage.content}`,
              from: selectionRange.from,
              to: selectionRange.to,
              status: 'pending'
            });
            console.log(`✨ Created direct suggestion: "${selectedText}" → "${rewrittenText}"`);
          }
        } catch (error) {
          console.error('Direct edit request failed:', error);
        }
      }
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

function buildSystemPrompt(mode: string, shouldGenerateSuggestions: boolean, context: string, versionInfo?: string): string {
  let prompt = `You are an AI writing assistant helping with document editing. `;
  
  if (versionInfo) {
    prompt += `${versionInfo}\n\n`;
  }
  
  if (mode === 'agent') {
    prompt += `You are in Agent mode. When the user asks for changes, you should:

1. Identify what part of the document needs to be changed
2. Provide the exact replacement text using this EXACT format:

REPLACE: "exact text from document to replace"
WITH: "your improved version"

CRITICAL RULES:
- Use double quotes around both REPLACE and WITH text
- Copy the EXACT text from the document for REPLACE
- Write clean, properly formatted text for WITH
- Do NOT wrap text in <p> tags or other HTML - just provide the plain text
- Do NOT merge words together
- Do NOT include extra characters or formatting
- Keep text readable and properly spaced
- For multiple changes, provide multiple REPLACE/WITH pairs

Example:
User: "make this more concise"
You: I'll help make that more concise.

REPLACE: "On a crisp autumn morning, with the morning mist still clinging to the trees, I found myself contemplating how salutations have always fascinated me as these brief but meaningful moments of human connection"
WITH: "On a crisp autumn morning, I contemplated how greetings fascinate me as brief moments of human connection"

IMPORTANT: Never wrap your REPLACE or WITH text in HTML tags like <p> or <span>. Just provide the raw text content.

Always provide specific REPLACE/WITH pairs for any changes you suggest.`;
  } else {
    prompt += `You are in Chat mode - provide helpful suggestions and discuss the document, but don't make direct edits. `;
  }

  prompt += `\n\nDocument context:\n${context}`;
  
  prompt += `\n\nGuidelines:
- Be concise and helpful
- Focus on the user's specific request
- In Agent mode, ALWAYS use the exact phrases "I suggest changing it to:" or "I suggest adding at the end:"
- Provide the actual new text, not just descriptions`;

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
  model: string,
  documentContent: string
): Promise<AISuggestion[]> {
  const suggestions: AISuggestion[] = [];
  
  // Look for REPLACE/WITH format first (most reliable)
  // Very simple pattern to capture everything between REPLACE: and WITH:
  const replaceIndex = aiResponse.indexOf('REPLACE:');
  const withIndex = aiResponse.indexOf('WITH:', replaceIndex);
  
  console.log('🔍 Looking for REPLACE/WITH pattern...');
  console.log('📝 AI Response length:', aiResponse.length);
  console.log('📍 REPLACE index:', replaceIndex, 'WITH index:', withIndex);
  
  if (replaceIndex !== -1 && withIndex !== -1 && withIndex > replaceIndex) {
    // Extract content between REPLACE: and WITH:
    let originalText = aiResponse.substring(replaceIndex + 8, withIndex).trim();
    
    // Find the end of the WITH section (look for double newline, "Regenerate", or end of string)
    let withContent = aiResponse.substring(withIndex + 5);
    const endMarkers = ['\n\nRegenerate', '\n\n\n', '\nRegenerate'];
    let endIndex = withContent.length;
    
    for (const marker of endMarkers) {
      const markerIndex = withContent.indexOf(marker);
      if (markerIndex !== -1 && markerIndex < endIndex) {
        endIndex = markerIndex;
      }
    }
    
    let suggestedText = withContent.substring(0, endIndex).trim();
    
    // Remove quotes if present
    originalText = originalText.replace(/^["']|["']$/g, '');
    suggestedText = suggestedText.replace(/^["']|["']$/g, '');
    
    // Clean up corrupted text patterns
    originalText = originalText
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Fix camelCase words that got merged
      .replace(/(\w+)(\w+)(?=\s|$)/g, (match, p1, p2) => {
        // Only split if it looks like two words merged together
        if (p1.length > 2 && p2.length > 2) {
          return `${p1} ${p2}`;
        }
        return match;
      })
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    suggestedText = suggestedText
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Fix camelCase words that got merged
      .replace(/(\w+)(\w+)(?=\s|$)/g, (match, p1, p2) => {
        // Only split if it looks like two words merged together
        if (p1.length > 2 && p2.length > 2) {
          return `${p1} ${p2}`;
        }
        return match;
      })
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    console.log(`✨ Found REPLACE/WITH suggestion:`);
    console.log(`📝 Original raw (${originalText.length} chars):`, originalText.substring(0, 300));
    console.log(`🔄 Suggested raw (${suggestedText.length} chars):`, suggestedText.substring(0, 300));
    
    // Validate the text quality
    const hasCorruptedWords = /\b\w{15,}\b/.test(originalText) || /\b\w{15,}\b/.test(suggestedText);
    const hasReasonableLength = originalText.length > 10 && suggestedText.length > 10;
    const isNotTooSimilar = originalText !== suggestedText;
    
    if (originalText.length > 0 && suggestedText.length > 0 && !hasCorruptedWords && hasReasonableLength && isNotTooSimilar) {
      // For text matching, clean up HTML tags and normalize whitespace
      const originalTextForMatching = originalText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      
      console.log(`📝 Original for matching (${originalTextForMatching.length} chars):`, originalTextForMatching.substring(0, 300));
      
      suggestions.push({
        id: `sug-${Date.now()}-replace`,
        originalText: originalTextForMatching,
        suggestedText: suggestedText, // Keep HTML for replacement
        explanation: 'AI suggested changes',
        from: -1, // Signal that frontend should find the position
        to: -1,   // Signal that frontend should find the position
        status: 'pending'
      });
      console.log('✅ Suggestion created successfully');
      return suggestions;
    } else {
      console.log('❌ Suggestion rejected due to quality issues:');
      console.log(`  - Has corrupted words: ${hasCorruptedWords}`);
      console.log(`  - Has reasonable length: ${hasReasonableLength}`);
      console.log(`  - Is not too similar: ${isNotTooSimilar}`);
      console.log(`  - Original length: ${originalText.length}, Suggested length: ${suggestedText.length}`);
    }
  } else {
    console.log('❌ REPLACE/WITH pattern not found');
  }
  
  // Try pattern without quotes as fallback
  const replaceWithoutQuotes = /REPLACE:\s*([^\n]+(?:\n[^\n]+)*?)\s*WITH:\s*([^\n]+(?:\n[^\n]+)*?)(?:\n|$)/is;
  const replaceMatchNoQuotes = aiResponse.match(replaceWithoutQuotes);
  
  if (replaceMatchNoQuotes) {
    let originalText = replaceMatchNoQuotes[1].trim();
    let suggestedText = replaceMatchNoQuotes[2].trim();
    
    // Clean up HTML tags
    originalText = originalText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    suggestedText = suggestedText.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    
    console.log(`✨ Found REPLACE/WITH suggestion (no quotes):`);
    console.log(`📝 Original:`, originalText.substring(0, 100) + '...');
    console.log(`🔄 Suggested:`, suggestedText.substring(0, 100) + '...');
    
    suggestions.push({
      id: `sug-${Date.now()}-replace-nq`,
      originalText: originalText,
      suggestedText: suggestedText,
      explanation: aiResponse,
      from: -1,
      to: -1,
      status: 'pending'
    });
    return suggestions;
  }
  
  // Fallback patterns if REPLACE/WITH not found
  const patterns = {
    // Direct text replacement (when text is selected)
    changeSelected: /I suggest changing it to:\s*["']?([^"'\n]+)["']?/i,
    changeTo: /change (?:it )?to:\s*["']?([^"'\n]+)["']?/i,
    replaceWith: /replace (?:it )?with:\s*["']?([^"'\n]+)["']?/i,
    
    // Adding content (when no selection)
    addAtEnd: /I suggest adding at the end:\s*["']?([^"'\n]+)["']?/i,
    addContent: /I suggest adding:\s*["']?([^"'\n]+)["']?/i,
    
    // More flexible patterns
    suggestText: /suggest:\s*["']?([^"'\n]+)["']?/i,
    hereIs: /here (?:is|'s) (?:a )?(?:more )?(?:concise|formal|simple)? ?(?:version)?:\s*["']?([^"'\n]+)["']?/i,
    
    // Fallback - look for quoted text that might be the suggestion
    quotedText: /"([^"]{10,})"/
  };
  
  console.log('🔍 Parsing AI response for suggestions:', aiResponse.substring(0, 200) + '...');
  
  // Try to match different types of suggestions
  for (const [type, pattern] of Object.entries(patterns)) {
    const match = aiResponse.match(pattern);
    console.log(`🔍 Testing pattern ${type}:`, pattern, '→', match ? 'MATCH' : 'no match');
    if (match) {
      const suggestionId = `sug-${Date.now()}-${type}`;
      let suggestedText = match[1].trim().replace(/['"]/g, '');
      let originalText = selectedText;
      let from = selectionRange.from;
      let to = selectionRange.to;
      
      // Handle different suggestion types
      if (type.includes('add') && !selectedText) {
        // Adding new content - append to end of document
        const docLength = documentContent.length;
        originalText = '';
        from = docLength;
        to = docLength;
      } else if (type.includes('rewrite') && !selectedText) {
        // Rewriting without selection - suggest replacing entire document or last paragraph
        const paragraphs = documentContent.split('\n').filter(p => p.trim());
        if (paragraphs.length > 0) {
          const lastParagraph = paragraphs[paragraphs.length - 1];
          originalText = lastParagraph;
          from = documentContent.lastIndexOf(lastParagraph);
          to = from + lastParagraph.length;
        }
      }
      
      if (suggestedText && (originalText || type.includes('add'))) {
        suggestions.push({
          id: suggestionId,
          originalText: originalText,
          suggestedText: suggestedText,
          explanation: aiResponse,
          from: from,
          to: to,
          status: 'pending'
        });
        
        console.log(`✨ Generated ${type} suggestion: "${originalText}" → "${suggestedText}"`);
        break; // Only create one suggestion per response
      }
    }
  }
  
  // If no patterns matched but we have selected text and this is agent mode, create a fallback suggestion
  if (suggestions.length === 0 && selectedText) {
    console.log('⚠️ No patterns matched, creating fallback suggestion');
    
    // For now, if the AI is being conversational, let's force a simple suggestion
    // This is a temporary fix - we'll improve the AI prompting
    let suggestedText = selectedText;
    
    // Simple transformations based on common requests
    if (aiResponse.toLowerCase().includes('concise')) {
      // Create a more concise version (remove redundant words)
      suggestedText = selectedText
        .replace(/\s+/g, ' ')
        .replace(/very\s+/gi, '')
        .replace(/really\s+/gi, '')
        .replace(/quite\s+/gi, '')
        .trim();
    } else if (aiResponse.toLowerCase().includes('formal')) {
      // Make more formal
      suggestedText = selectedText
        .replace(/don't/gi, 'do not')
        .replace(/can't/gi, 'cannot')
        .replace(/won't/gi, 'will not');
    }
    
    // Only create suggestion if text actually changed
    if (suggestedText !== selectedText && suggestedText.length > 0) {
      suggestions.push({
        id: `sug-${Date.now()}-auto`,
        originalText: selectedText,
        suggestedText: suggestedText,
        explanation: `Auto-generated suggestion based on your request: ${aiResponse}`,
        from: selectionRange.from,
        to: selectionRange.to,
        status: 'pending'
      });
      console.log(`✨ Created auto suggestion: "${selectedText}" → "${suggestedText}"`);
    }
  }
  
  if (suggestions.length === 0) {
    console.log('ℹ️ No actionable suggestion patterns found in AI response');
  }

  return suggestions;
}
