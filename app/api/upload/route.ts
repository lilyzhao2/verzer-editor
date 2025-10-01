import { NextRequest, NextResponse } from 'next/server';

// Force Node.js runtime for file processing
export const runtime = 'nodejs';
export const maxDuration = 30; // 30 seconds timeout

// Convert plain text to HTML with proper formatting
function convertTextToHTML(text: string): string {
  // Split into lines and process each line
  const lines = text.split('\n');
  const htmlLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === '') {
      // Empty line - add paragraph break
      htmlLines.push('<p><br></p>');
    } else if (line.match(/^#{1,6}\s/)) {
      // Markdown-style headers
      const level = line.match(/^#+/)?.[0].length || 1;
      const content = line.replace(/^#+\s*/, '');
      htmlLines.push(`<h${Math.min(level, 6)}>${content}</h${Math.min(level, 6)}>`);
    } else if (line.match(/^[-*+]\s/)) {
      // Bullet points
      const content = line.replace(/^[-*+]\s*/, '');
      htmlLines.push(`<ul><li>${content}</li></ul>`);
    } else if (line.match(/^\d+\.\s/)) {
      // Numbered lists
      const content = line.replace(/^\d+\.\s*/, '');
      htmlLines.push(`<ol><li>${content}</li></ol>`);
    } else if (line.match(/^[A-Z][A-Z\s]+$/)) {
      // All caps line - likely a header
      htmlLines.push(`<h2>${line}</h2>`);
    } else if (line.match(/^[A-Z][^.!?]*[.!?]$/)) {
      // Sentence starting with capital and ending with punctuation
      htmlLines.push(`<p>${line}</p>`);
    } else {
      // Regular paragraph
      htmlLines.push(`<p>${line}</p>`);
    }
  }
  
  return htmlLines.join('\n');
}

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
        const pdf = require('pdf-parse-fork');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log('Buffer size:', buffer.length);
        const data = await pdf(buffer);
        const plainText = data.text;
        extractedText = convertTextToHTML(plainText);
        console.log('Extracted text length:', plainText.length);
        
      } else if (fileName.endsWith('.docx')) {
        console.log('Processing DOCX file');
        // Process Word document (docx)
        const mammoth = require('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer });
        const plainText = result.value;
        extractedText = convertTextToHTML(plainText);
        
      } else if (fileName.endsWith('.doc')) {
        // Old .doc format is more complex, mammoth only supports .docx
        return NextResponse.json(
          { error: 'Please save your document as .docx format. The older .doc format is not supported.' },
          { status: 400 }
        );
        
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.text')) {
        console.log('Processing text file');
        // Process text file and convert to HTML
        const plainText = await file.text();
        extractedText = convertTextToHTML(plainText);
        
      } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
        console.log('Processing HTML file');
        // Process HTML - preserve formatting
        const html = await file.text();
        extractedText = html; // Keep HTML as-is for formatting preservation
        
      } else if (fileName.endsWith('.md') || fileName.endsWith('.markdown')) {
        console.log('Processing Markdown file');
        // Process Markdown and convert to HTML
        const markdown = await file.text();
        extractedText = convertTextToHTML(markdown);
        
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