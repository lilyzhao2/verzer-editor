// API route for Anthropic Claude integration
import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, content, model, mode = 'edit', projectConfig } = body;
    
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-20241022',
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
      console.error('Anthropic API error:', {
        status: response.status,
        statusText: response.statusText,
        error: error,
        requestBody: {
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: 4000,
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
      return NextResponse.json({ 
        mode: 'chat',
        response: responseText 
      });
    } else if (mode === 'analyze') {
      // For analyze mode, try to extract and return clean JSON or structured text
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
      // If JSON parsing fails, return the raw text as "analysis"
      return NextResponse.json({ 
        mode: 'analyze',
        analysis: responseText,
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
