'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, Loader2, Sparkles } from 'lucide-react';

interface DocumentUploadProps {
  onContentExtracted: (content: string, fileName?: string) => void;
  onContextExtracted?: (context: any) => void;
  mode: 'document' | 'context';
}

export function DocumentUpload({ onContentExtracted, onContextExtracted, mode }: DocumentUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // Use server-side processing for all file types
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      // Try to parse as JSON, but handle HTML error pages
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process file');
      } else {
        // Got HTML error page instead of JSON
        throw new Error(`Server error: ${response.status} ${response.statusText}. Please try again.`);
      }
    }
    
    const result = await response.json();
    return result.text;
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    
    try {
      // Extract text content from file
      const content = await extractTextFromFile(file);
      
      if (!content || content.trim().length === 0) {
        throw new Error('The file appears to be empty or could not be read.');
      }
      
      if (mode === 'document') {
        // For document mode, just insert the content with filename
        onContentExtracted(content, file.name);
      } else {
        // For context mode, use AI to extract configuration
        const response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Analyze this document and extract project configuration details. Return ONLY a valid JSON object with these fields:
              {
                "projectName": "The document title or project name",
                "description": "What this document is about",
                "styleGuide": "The writing style used (formal, casual, technical, etc.)",
                "tone": "The tone of the document",
                "audience": "Who this document appears to be written for",
                "constraints": "Any apparent rules or constraints",
                "additionalContext": "Any other relevant context"
              }
              
              Return ONLY the JSON object, no other text.`,
            content: content.substring(0, 4000), // Limit content to avoid token limits
            mode: 'analyze'
          }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to analyze document');
        }
        
        const result = await response.json();
        
        // Try to parse the response as JSON
        try {
          let contextData;
          
          // Handle different response formats
          if (result.editedContent && typeof result.editedContent === 'string') {
            // Try to parse editedContent as JSON
            contextData = JSON.parse(result.editedContent);
          } else if (result.response && typeof result.response === 'string') {
            // Try to parse response as JSON
            contextData = JSON.parse(result.response);
          } else if (result.response && typeof result.response === 'object') {
            // Already an object
            contextData = result.response;
          } else {
            throw new Error('Unexpected response format');
          }
          
          if (onContextExtracted && contextData) {
            onContextExtracted(contextData);
          } else {
            throw new Error('No context data extracted');
          }
        } catch (parseError) {
          console.error('Parse error:', parseError);
          // If parsing fails, alert the user
          alert('Could not extract context from this document. Please try with a different file or enter the configuration manually.');
          if (onContextExtracted) {
            onContextExtracted(null);
          }
        }
      }
    } catch (error: any) {
      console.error('Error processing file:', error);
      alert(error.message || 'Error processing file. Please try again.');
      setFileName(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${isProcessing ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept=".txt,.html,.md,.markdown,.pdf,.docx,.doc"
          className="hidden"
        />
        
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700">
              {mode === 'context' ? 'Analyzing document...' : 'Processing document...'}
            </p>
            {fileName && (
              <p className="text-xs text-gray-500">{fileName}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drop your document here or click to browse
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports PDF, Word (.docx), TXT, HTML, Markdown
              </p>
              <p className="text-xs text-green-600 mt-1 font-medium">
                ✓ PDF and Word documents fully supported!
              </p>
            </div>
            {mode === 'context' && (
              <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-purple-100 rounded-full">
                <Sparkles className="w-3 h-3 text-purple-600" />
                <span className="text-xs text-purple-700 font-medium">
                  AI will extract context automatically
                </span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {fileName && !isProcessing && (
        <div className="mt-3 flex items-center justify-between p-2 bg-gray-50 rounded">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">{fileName}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setFileName(null);
            }}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
}
