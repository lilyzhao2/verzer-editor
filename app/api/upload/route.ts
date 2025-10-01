import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for file processing
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds timeout

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Processing file:', file.name, 'Size:', file.size);
    let extractedText = '';
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.pdf')) {
        console.log('Processing PDF file');
        // Process PDF
        const pdf = require('pdf-parse');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log('Buffer size:', buffer.length);
        const data = await pdf(buffer);
        extractedText = data.text;
        console.log('Extracted text length:', extractedText.length);
        
      } else if (fileName.endsWith('.docx')) {
        console.log('Processing DOCX file');
        // Process Word document (docx)
        const mammoth = require('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
        
      } else if (fileName.endsWith('.doc')) {
        // Old .doc format is more complex, mammoth only supports .docx
        return NextResponse.json(
          { error: 'Please save your document as .docx format. The older .doc format is not supported.' },
          { status: 400 }
        );
        
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.text')) {
        console.log('Processing text file');
        // Process text file
        extractedText = await file.text();
        
      } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
        console.log('Processing HTML file');
        // Process HTML
        const html = await file.text();
        // Simple HTML stripping
        extractedText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
      } else if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
        console.log('Processing Markdown file');
        // Process Markdown
        extractedText = await file.text();
        
      } else {
        console.log('Processing as plain text');
        // Try to read as text
        extractedText = await file.text();
      }
      
      if (!extractedText || extractedText.trim().length === 0) {
        console.log('No text extracted');
        return NextResponse.json(
          { error: 'Could not extract text from the file. The file may be empty or corrupted.' },
          { status: 400 }
        );
      }
      
      // Limit text length to avoid issues
      if (extractedText.length > 50000) {
        console.log('Truncating text from', extractedText.length, 'to 50000 characters');
        extractedText = extractedText.substring(0, 50000) + '... (truncated)';
      }
      
      console.log('Successfully processed file, returning', extractedText.length, 'characters');
      return NextResponse.json({ 
        success: true,
        text: extractedText,
        fileName: file.name,
        fileType: fileName.split('.').pop()
      });
      
    } catch (parseError: any) {
      console.error('Error parsing file:', fileName);
      console.error('Error message:', parseError.message);
      console.error('Stack trace:', parseError.stack);
      return NextResponse.json(
        { error: `Failed to parse ${fileName.split('.').pop()?.toUpperCase()} file: ${parseError.message}` },
        { status: 400 }
      );
    }
    
  } catch (error: any) {
    console.error('Error in upload API:');
    console.error('Error message:', error.message);
    console.error('Stack trace:', error.stack);
    return NextResponse.json(
      { error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}