import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { selectedText, context, model = 'claude-3-5-sonnet-20241022' } = await request.json();

    if (!selectedText || typeof selectedText !== 'string') {
      return NextResponse.json({ error: 'Selected text is required' }, { status: 400 });
    }

    if (selectedText.length < 3 || selectedText.length > 300) {
      return NextResponse.json({ 
        error: 'Selected text must be between 3 and 300 characters' 
      }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in environment variables');
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const prompt = `Rewrite the following text in 5 different ways. You must provide exactly 5 variations with these specific labels. Return ONLY a JSON array.

Original text: "${selectedText}"

Context: "${context}"

Create exactly these 5 variations:
1. "More concise" - Make it shorter and punchier
2. "More formal" - Use professional, business-appropriate language  
3. "Simpler" - Use easier words and shorter sentences
4. "Different angle" - Rephrase the same idea from a different perspective
5. "Active voice" - Make it direct and action-oriented

Return format (EXACTLY this structure):
[
  {"label": "More concise", "text": "..."},
  {"label": "More formal", "text": "..."},
  {"label": "Simpler", "text": "..."},
  {"label": "Different angle", "text": "..."},
  {"label": "Active voice", "text": "..."}
]

IMPORTANT: 
- Return ONLY the JSON array, no other text
- All 5 variations must be present
- Each variation should be meaningfully different
- Keep the same core meaning but change the style`;

    console.log('🔄 Making rewrite request to Anthropic API...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // Faster model for quicker responses
        max_tokens: 800, // Increased for 5 variations
        temperature: 0.3, // Lower for more consistent formatting
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Anthropic API error:', response.status, errorText);
      return NextResponse.json(
        { error: `API request failed: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Received response from Anthropic API');

    if (!data.content || !data.content[0] || !data.content[0].text) {
      console.error('❌ Invalid response structure:', data);
      return NextResponse.json({ error: 'Invalid API response' }, { status: 500 });
    }

    const responseText = data.content[0].text.trim();
    console.log('📝 Raw response:', responseText);

    // Parse JSON from response
    let variations;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        variations = JSON.parse(jsonMatch[0]);
      } else {
        variations = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      console.error('❌ Response text:', responseText);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    // Validate the variations
    if (!Array.isArray(variations)) {
      console.error('❌ Response is not an array:', variations);
      return NextResponse.json({ error: 'Invalid response format' }, { status: 500 });
    }

    // Filter and validate variations
    const validVariations = variations.filter(v => 
      v && 
      typeof v === 'object' &&
      typeof v.label === 'string' && 
      typeof v.text === 'string' && 
      v.text.trim().length > 0 &&
      v.label.trim().length > 0
    );

    console.log(`📊 Validation results: ${variations.length} total, ${validVariations.length} valid`);

    if (validVariations.length === 0) {
      console.error('❌ No valid variations found:', variations);
      return NextResponse.json({ error: 'No valid rewrites generated' }, { status: 500 });
    }

    // If we have fewer than 5, log a warning but continue
    if (validVariations.length < 5) {
      console.warn(`⚠️ Only got ${validVariations.length} variations instead of 5`);
    }

    // Ensure we have the expected labels
    const expectedLabels = ['More concise', 'More formal', 'Simpler', 'Different angle', 'Active voice'];
    const foundLabels = validVariations.map(v => v.label);
    const missingLabels = expectedLabels.filter(label => !foundLabels.includes(label));
    
    if (missingLabels.length > 0) {
      console.warn('⚠️ Missing expected labels:', missingLabels);
    }

    console.log(`✅ Returning ${validVariations.length} valid variations`);
    console.log('📝 Variation labels:', foundLabels);
    
    return NextResponse.json({ 
      variations: validVariations,
      originalText: selectedText,
    });

  } catch (error) {
    console.error('❌ Rewrite API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
