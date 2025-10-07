// API route for Anthropic Claude integration
import { NextRequest, NextResponse } from 'next/server';

// Advanced caching strategy with multiple cache layers
type CacheEntry = { 
  value: any; 
  expiresAt: number; 
  hits: number; 
  lastAccessed: number;
  size: number;
};

const CACHE_LAYERS = {
  // Hot cache: Very fast, short TTL for frequent requests
  HOT: new Map<string, CacheEntry>(),
  // Warm cache: Medium TTL for moderate frequency
  WARM: new Map<string, CacheEntry>(),
  // Cold cache: Long TTL for infrequent but expensive requests
  COLD: new Map<string, CacheEntry>(),
};

const CACHE_CONFIG = {
  HOT_TTL: 30 * 1000,    // 30 seconds
  WARM_TTL: 5 * 60 * 1000, // 5 minutes
  COLD_TTL: 30 * 60 * 1000, // 30 minutes
  MAX_HOT_SIZE: 50,
  MAX_WARM_SIZE: 100,
  MAX_COLD_SIZE: 200,
  MAX_TOTAL_SIZE: 10 * 1024 * 1024, // 10MB total cache
};

let totalCacheSize = 0;

function getCache(key: string) {
  // Check hot cache first
  let entry = CACHE_LAYERS.HOT.get(key);
  if (entry && Date.now() <= entry.expiresAt) {
    entry.hits++;
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  // Check warm cache
  entry = CACHE_LAYERS.WARM.get(key);
  if (entry && Date.now() <= entry.expiresAt) {
    entry.hits++;
    entry.lastAccessed = Date.now();
    // Promote to hot cache
    promoteToHot(key, entry);
    return entry.value;
  }

  // Check cold cache
  entry = CACHE_LAYERS.COLD.get(key);
  if (entry && Date.now() <= entry.expiresAt) {
    entry.hits++;
    entry.lastAccessed = Date.now();
    // Promote to warm cache
    promoteToWarm(key, entry);
    return entry.value;
  }

  return null;
}

function setCache(key: string, value: any, ttlMs?: number) {
  const size = JSON.stringify(value).length;
  const entry: CacheEntry = {
    value,
    expiresAt: Date.now() + (ttlMs || CACHE_CONFIG.WARM_TTL),
    hits: 0,
    lastAccessed: Date.now(),
    size,
  };

  // Determine cache layer based on request type and size
  const requestType = key.split(':')[0];
  let targetLayer: keyof typeof CACHE_LAYERS = 'WARM';

  if (requestType === 'autocomplete' || size < 1000) {
    targetLayer = 'HOT';
  } else if (requestType === 'rewrite' || requestType === 'thoughts') {
    targetLayer = 'WARM';
  } else if (requestType === 'edit' || size > 5000) {
    targetLayer = 'COLD';
  }

  // Clean up expired entries first
  cleanupExpiredEntries();

  // Check if we need to evict entries
  if (totalCacheSize + size > CACHE_CONFIG.MAX_TOTAL_SIZE) {
    evictLeastUsed();
  }

  // Set in target layer
  CACHE_LAYERS[targetLayer].set(key, entry);
  totalCacheSize += size;

  // Clean up if layer is too large
  if (CACHE_LAYERS[targetLayer].size > getMaxSizeForLayer(targetLayer)) {
    evictFromLayer(targetLayer);
  }
}

function promoteToHot(key: string, entry: CacheEntry) {
  // Remove from current layer
  CACHE_LAYERS.WARM.delete(key);
  CACHE_LAYERS.COLD.delete(key);
  
  // Add to hot cache
  entry.expiresAt = Date.now() + CACHE_CONFIG.HOT_TTL;
  CACHE_LAYERS.HOT.set(key, entry);
}

function promoteToWarm(key: string, entry: CacheEntry) {
  // Remove from cold cache
  CACHE_LAYERS.COLD.delete(key);
  
  // Add to warm cache
  entry.expiresAt = Date.now() + CACHE_CONFIG.WARM_TTL;
  CACHE_LAYERS.WARM.set(key, entry);
}

function getMaxSizeForLayer(layer: keyof typeof CACHE_LAYERS): number {
  switch (layer) {
    case 'HOT': return CACHE_CONFIG.MAX_HOT_SIZE;
    case 'WARM': return CACHE_CONFIG.MAX_WARM_SIZE;
    case 'COLD': return CACHE_CONFIG.MAX_COLD_SIZE;
    default: return 0;
  }
}

function cleanupExpiredEntries() {
  const now = Date.now();
  
  Object.values(CACHE_LAYERS).forEach(cache => {
    for (const [key, entry] of cache.entries()) {
      if (now > entry.expiresAt) {
        totalCacheSize -= entry.size;
        cache.delete(key);
      }
    }
  });
}

function evictLeastUsed() {
  const allEntries: Array<{ key: string; layer: keyof typeof CACHE_LAYERS; entry: CacheEntry }> = [];
  
  Object.entries(CACHE_LAYERS).forEach(([layerName, cache]) => {
    for (const [key, entry] of cache.entries()) {
      allEntries.push({ key, layer: layerName as keyof typeof CACHE_LAYERS, entry });
    }
  });

  // Sort by hits (ascending) then by last accessed (ascending)
  allEntries.sort((a, b) => {
    if (a.entry.hits !== b.entry.hits) {
      return a.entry.hits - b.entry.hits;
    }
    return a.entry.lastAccessed - b.entry.lastAccessed;
  });

  // Remove 20% of least used entries
  const toRemove = Math.ceil(allEntries.length * 0.2);
  for (let i = 0; i < toRemove; i++) {
    const { key, layer, entry } = allEntries[i];
    CACHE_LAYERS[layer].delete(key);
    totalCacheSize -= entry.size;
  }
}

function evictFromLayer(layer: keyof typeof CACHE_LAYERS) {
  const cache = CACHE_LAYERS[layer];
  const entries = Array.from(cache.entries());
  
  // Sort by hits and last accessed
  entries.sort((a, b) => {
    if (a[1].hits !== b[1].hits) {
      return a[1].hits - b[1].hits;
    }
    return a[1].lastAccessed - b[1].lastAccessed;
  });

  // Remove oldest 25% of entries
  const toRemove = Math.ceil(entries.length * 0.25);
  for (let i = 0; i < toRemove; i++) {
    const [key, entry] = entries[i];
    cache.delete(key);
    totalCacheSize -= entry.size;
  }
}

// Cache statistics for monitoring
function getCacheStats() {
  const stats = {
    hot: { size: CACHE_LAYERS.HOT.size, hits: 0 },
    warm: { size: CACHE_LAYERS.WARM.size, hits: 0 },
    cold: { size: CACHE_LAYERS.COLD.size, hits: 0 },
    totalSize: totalCacheSize,
  };

  Object.values(CACHE_LAYERS).forEach(cache => {
    for (const entry of cache.values()) {
      if (cache === CACHE_LAYERS.HOT) stats.hot.hits += entry.hits;
      else if (cache === CACHE_LAYERS.WARM) stats.warm.hits += entry.hits;
      else if (cache === CACHE_LAYERS.COLD) stats.cold.hits += entry.hits;
    }
  });

  return stats;
}

// Function to clean up explanation text formatting
function cleanExplanationText(text: string): string {
  if (!text) return text;
  
  // Remove any remaining [EXPLANATION] tags
  text = text.replace(/\[EXPLANATION\]/gi, '').replace(/\[\/EXPLANATION\]/gi, '');
  
  // Convert numbered lists to proper formatting
  text = text.replace(/(\d+\.\s)/g, '\n$1');
  
  // Convert bullet points to proper formatting
  text = text.replace(/([•·▪▫])\s/g, '\n• ');
  
  // Clean up multiple spaces and line breaks
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\n\s+/g, '\n');
  text = text.replace(/\n+/g, '\n');
  
  // Trim whitespace
  text = text.trim();
  
  // If the text is very long, truncate it and add ellipsis
  if (text.length > 500) {
    text = text.substring(0, 500) + '...';
  }
  
  return text;
}

// Cache statistics endpoint
export async function GET() {
  const stats = getCacheStats();
  return NextResponse.json({
    cache: stats,
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, content, model, mode = 'edit', projectConfig, maxTokens, stream } = body;
    
    console.log('Anthropic API called with:', { 
      prompt: prompt?.substring(0, 100) + '...', 
      contentLength: content?.length, 
      model, 
      mode,
      hasProjectConfig: !!projectConfig
    });
    
    // Check if content is provided
    if (!content || content.trim() === '') {
      console.log('No content provided');
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
      // If there's a custom prompt template, use it
      if (projectConfig.promptTemplate) {
        let template = projectConfig.promptTemplate;
        
        // Replace template variables with actual values
        template = template.replace(/{{projectType}}/g, projectConfig.name || 'document');
        template = template.replace(/{{projectName}}/g, projectConfig.projectName || 'Untitled');
        template = template.replace(/{{audience}}/g, projectConfig.audience || 'general audience');
        template = template.replace(/{{tone}}/g, projectConfig.tone || 'professional');
        template = template.replace(/{{styleGuide}}/g, projectConfig.styleGuide || 'standard style');
        template = template.replace(/{{constraints}}/g, projectConfig.constraints || 'No specific constraints');
        template = template.replace(/{{action}}/g, mode === 'chat' ? 'answer the question' : 'edit the document as requested');
        
        projectContext = template + '\n\n---\n\n';
      } else {
        // Fallback to structured context with emphasis on learned patterns
        const hasExamples = projectConfig.examples && projectConfig.examples.length > 0;
        const hasLearnedPatterns = projectConfig.learnedPatterns && projectConfig.learnedPatterns.trim();
        
        projectContext = `PROJECT CONTEXT:
Project Name: ${projectConfig.projectName || 'Untitled'}
Description: ${projectConfig.description || 'No description'}

${hasExamples ? `
📚 EXAMPLE DOCUMENTS AVAILABLE:
${projectConfig.examples?.map((ex: any) => `- ${ex.fileName}`).join('\n')}

${hasLearnedPatterns ? `
🎯 LEARNED PATTERNS FROM EXAMPLES:
${projectConfig.learnedPatterns}

** CRITICAL: Your primary goal is to match the style, tone, and structure shown in these learned patterns. **
` : `
⚠️ EXAMPLES UPLOADED BUT NOT ANALYZED: 
The user has uploaded ${projectConfig.examples?.length} example documents but hasn't analyzed them yet. 
Please ask them to click "Analyze Examples & Extract Patterns" in the Context tab to learn their style.
`}
` : ''}

${projectConfig.styleGuide ? `Writing Style: ${projectConfig.styleGuide}` : ''}
${projectConfig.tone ? `Tone: ${projectConfig.tone}` : ''}
${projectConfig.audience ? `Target Audience: ${projectConfig.audience}` : ''}
${projectConfig.constraints ? `Constraints: ${projectConfig.constraints}` : ''}
${projectConfig.references?.length ? `Style References: ${projectConfig.references.join(', ')}` : ''}
${projectConfig.additionalContext ? `Additional Context: ${projectConfig.additionalContext}` : ''}

Please keep all edits and responses aligned with this project context${hasLearnedPatterns ? ', especially the learned patterns from examples' : ''}.

---

`;
      }
    }

    // Debug: Log readable system info
    console.log('🤖 AI REQUEST DEBUG');
    console.log('📝 Mode:', mode);
    console.log('📄 Document Length:', content?.length || 0, 'characters');
    console.log('🎯 Project:', projectConfig?.projectName || 'None');
    console.log('📚 Examples:', projectConfig?.examples?.length || 0, 'uploaded');
    console.log('🎨 Learned Patterns:', projectConfig?.learnedPatterns ? 'Yes (' + projectConfig.learnedPatterns.length + ' chars)' : 'No');
    console.log('💬 User Request:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
    console.log('🔧 Context Length:', projectContext.length, 'characters');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Generate cache key with request type prefix for layered caching
    const requestType = mode === 'autocomplete' ? 'autocomplete' : 
                       mode === 'chat' ? (prompt.includes('rewrite') ? 'rewrite' : 'thoughts') : 
                       'edit';
    
    const cacheKey = `${requestType}:${JSON.stringify({ 
      mode, 
      model, 
      prompt: prompt.slice(0, 100), // Truncate prompt for key
      content: content?.slice(-200), 
      projectName: projectConfig?.projectName, 
      maxTokens 
    })}`;
    
    if (!stream) {
      const cached = getCache(cacheKey);
      if (cached) {
        console.log(`🎯 Cache HIT (${requestType}): ${cacheKey.slice(0, 50)}...`);
        return NextResponse.json(cached);
      }
      console.log(`❄️ Cache MISS (${requestType}): ${cacheKey.slice(0, 50)}...`);
    }

    // Different prompts based on mode
    let userContent: string;

    if (mode === 'chat') {
      userContent = `${projectContext}Document content: ${content}\n\nQuestion: ${prompt}`;
    } else if (mode === 'analyze') {
      // Context extraction mode - check for custom analysis prompt
      const customPrompt = body.analysisPrompt as string | undefined;
      
      if (customPrompt) {
        // Custom analysis prompt for style extraction from multiple examples
        userContent = customPrompt + '\n\nDocuments to analyze:\n' + content;
      } else {
        // Default context extraction mode
        userContent = prompt + '\n\nDocument to analyze:\n' + content;
      }
    } else {
      // Ask AI to return both the edited document AND an explanation
      userContent = `${projectContext}Edit the following HTML document according to this instruction: "${prompt}"

CRITICAL FORMATTING RULES - FOLLOW THESE EXACTLY:

1. PRESERVE ALL EXISTING CONTENT - Do not delete or remove any existing text unless explicitly asked to do so

2. PROPER HTML STRUCTURE - The document is in HTML format. Always use proper HTML tags:
   - Wrap ALL text content in <p> tags for paragraphs
   - Use <h1>, <h2>, <h3> for headings and section titles
   - Use <strong> for bold text, <em> for italic text
   - Use <ul> and <li> for bullet points, <ol> and <li> for numbered lists
   - Use <br> for line breaks within paragraphs when needed

3. RESUME/DOCUMENT FORMATTING - When editing resumes or documents:
   - Use <h1> for the main name/title at the top
   - Use <h2> for major sections (EDUCATION, EXPERIENCE, etc.)
   - Use <h3> for subsection headers
   - Use <p> for all paragraph content
   - Use <strong> for job titles, company names, important details
   - Use <em> for dates, locations, and secondary information
   - Use <ul> and <li> for skills, achievements, responsibilities

4. PROPER SPACING AND STRUCTURE:
   - Always separate different sections with proper paragraph spacing
   - Use <br> tags to create line breaks within sections when appropriate
   - Maintain consistent formatting throughout the document
   - Don't just paste text - structure it properly with HTML tags

5. ENHANCEMENT RULES:
   - When asked to "improve" or "enhance", ADD to existing content, don't replace it
   - When adding new content, format it properly with appropriate HTML tags
   - Maintain the original document structure unless specifically asked to change it

6. EXAMPLE OF PROPER FORMATTING:
   Instead of: "John Doe Software Engineer 2020-2023"
   Use: "<h1>John Doe</h1><p><strong>Software Engineer</strong> | 2020-2023</p>"

   Instead of: "Skills: JavaScript, React, Node.js"
   Use: "<h2>Skills</h2><ul><li>JavaScript</li><li>React</li><li>Node.js</li></ul>"

Return your response in this exact format:
[DOCUMENT]
(Put the edited HTML document here with proper formatting and structure)
[/DOCUMENT]
[EXPLANATION]
(Explain what changes you made and why)
[/EXPLANATION]

Original HTML document:
${content}`;
    }

    // If streaming requested, proxy Anthropic SSE directly
    if (stream) {
      const sseRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: Math.min(typeof maxTokens === 'number' ? maxTokens : 4000, 4000),
          stream: true,
          messages: [
            { role: 'user', content: `${projectContext}${mode === 'chat' ? `Document content: ${content}\n\nQuestion: ${prompt}` : userContent}` }
          ],
        }),
      });

      if (!sseRes.ok) {
        const error = await sseRes.text();
        return NextResponse.json(
          { error: `Failed to get response from Anthropic: ${sseRes.status} ${sseRes.statusText}`, details: error },
          { status: sseRes.status }
        );
      }

      // Pass-through SSE stream
      return new Response(sseRes.body, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
        max_tokens: Math.min(typeof maxTokens === 'number' ? maxTokens : 4000, 4000),
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
      console.error('Anthropic API error:', {
        status: response.status,
        statusText: response.statusText,
        error: error,
        requestBody: {
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: Math.min(typeof maxTokens === 'number' ? maxTokens : 4000, 4000),
          messages: [{ role: 'user', content: userContent }]
        }
      });
      return NextResponse.json(
        { error: `Failed to get response from Anthropic: ${response.status} ${response.statusText}`, details: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    const responseText = data.content[0].text;

    // Return different response based on mode
    if (mode === 'chat') {
      const payload = { 
        mode: 'chat',
        response: responseText 
      };
      setCache(cacheKey, payload, CACHE_CONFIG.WARM_TTL);
      return NextResponse.json(payload);
    } else if (mode === 'analyze') {
      // For analyze mode, try to extract and return clean JSON or structured text
      try {
        // Try to find JSON in the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const jsonData = JSON.parse(jsonMatch[0]);
          const payload = { 
            mode: 'analyze',
            response: jsonData 
          };
          setCache(cacheKey, payload, CACHE_CONFIG.WARM_TTL);
          return NextResponse.json(payload);
        }
      } catch (e) {
        console.error('Failed to parse JSON from analyze response:', e);
      }
      // If JSON parsing fails, return the raw text as "analysis"
      const payload = { 
        mode: 'analyze',
        analysis: responseText,
        response: responseText 
      };
      setCache(cacheKey, payload, CACHE_CONFIG.WARM_TTL);
      return NextResponse.json(payload);
    } else {
      // Parse the structured response for edit mode
      const documentMatch = responseText.match(/\[DOCUMENT\]([\s\S]*?)\[\/DOCUMENT\]/);
      const explanationMatch = responseText.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/);
      
      let editedContent = responseText; // fallback to full response if parsing fails
      let explanation = '';
      
      if (documentMatch && documentMatch[1]) {
        editedContent = documentMatch[1].trim();
      } else {
        // If no [DOCUMENT] tags found, try to extract HTML content
        // Look for HTML tags in the response
        const htmlMatch = responseText.match(/<[^>]+>[\s\S]*<\/[^>]+>/);
        if (htmlMatch) {
          editedContent = htmlMatch[0];
        } else {
          // If no HTML found, wrap the response in paragraph tags
          editedContent = `<p>${responseText}</p>`;
        }
      }
      
      if (explanationMatch && explanationMatch[1]) {
        explanation = explanationMatch[1].trim();
      } else {
        // If no [EXPLANATION] tags found, try to extract explanation from the response
        const lines = responseText.split('\n');
        const explanationLines = lines.filter((line: string) => 
          !line.includes('<') && 
          !line.includes('>') && 
          line.trim().length > 0 &&
          !line.includes('[DOCUMENT]') &&
          !line.includes('[/DOCUMENT]')
        );
        explanation = explanationLines.join(' ').trim() || 'Changes applied successfully.';
      }
      
      // Clean up the explanation text
      explanation = cleanExplanationText(explanation);
      
      console.log('AI Response parsed:', {
        hasDocumentTags: !!documentMatch,
        hasExplanationTags: !!explanationMatch,
        editedContentLength: editedContent.length,
        explanationLength: explanation.length
      });
      
      const payload = { 
        mode: 'edit',
        editedContent,
        explanation
      };
      setCache(cacheKey, payload, CACHE_CONFIG.WARM_TTL);
      return NextResponse.json(payload);
    }
  } catch (error) {
    console.error('Error in Anthropic API route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
