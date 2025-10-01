'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ProjectConfig, ExampleDocument } from '@/lib/types';
import { 
  Upload, Trash2, Check, FileText, Sparkles, Loader2,
  BookOpen, ChevronDown, ChevronUp, Settings
} from 'lucide-react';

export function ProjectSetup() {
  const { state, updateProjectConfig } = useEditor();
  
  // Always use/create a single config
  const activeConfig = state.projectConfigs?.[0] || {
    id: 'context-config',
    name: 'Project Context',
    projectName: '',
    description: '',
    examples: [],
    learnedPatterns: '',
    styleGuide: '',
    tone: '',
    audience: '',
    constraints: '',
    additionalContext: '',
    createdAt: new Date(),
    isActive: true
  };
  
  const [config, setConfig] = useState({
    projectName: activeConfig.projectName || '',
    description: activeConfig.description || '',
    examples: activeConfig.examples || [],
    learnedPatterns: activeConfig.learnedPatterns || '',
    styleGuide: activeConfig.styleGuide || '',
    tone: activeConfig.tone || '',
    audience: activeConfig.audience || '',
    syntax: activeConfig.syntax || '',
    outcome: activeConfig.outcome || '',
    constraints: activeConfig.constraints || '',
    additionalContext: activeConfig.additionalContext || '',
    projectNotes: activeConfig.projectNotes || '',
  });
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (activeConfig) {
      setConfig({
        projectName: activeConfig.projectName || '',
        description: activeConfig.description || '',
        examples: activeConfig.examples || [],
        learnedPatterns: activeConfig.learnedPatterns || '',
        styleGuide: activeConfig.styleGuide || '',
        tone: activeConfig.tone || '',
        audience: activeConfig.audience || '',
        constraints: activeConfig.constraints || '',
        additionalContext: activeConfig.additionalContext || '',
      });
    }
  }, [activeConfig]);

    const handleFileUpload = async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      // Limit to 2 files maximum for performance
      if (files.length > 2) {
        alert('Please upload maximum 2 example documents for optimal AI performance.');
        return;
      }

      const newExamples: ExampleDocument[] = [];
      
      for (let i = 0; i < Math.min(files.length, 2); i++) {
        const file = files[i];
        
        // Check file size (limit to 500KB per file)
        if (file.size > 512000) {
          alert(`File "${file.name}" is too large. Please keep files under 500KB for optimal performance.`);
          continue;
        }
        
        const content = await readFileContent(file);
        
        // Limit content length (max 5,000 characters per file)
        if (content.length > 5000) {
          alert(`File "${file.name}" is too long. Please keep documents under 5,000 characters for optimal AI performance.`);
          continue;
        }
        
        newExamples.push({
          id: `example-${Date.now()}-${i}`,
          fileName: file.name,
          content,
          uploadedAt: new Date(),
        });
      }

      const updatedConfig = {
        ...config,
        examples: [...(config.examples || []), ...newExamples]
      };
      
      setConfig(updatedConfig);
      
      // Auto-analyze after upload
      if (newExamples.length > 0) {
        // Trigger analysis automatically
        setTimeout(() => {
          handleAnalyzeExamples();
        }, 500);
      }
    };

  const readFileContent = async (file: File): Promise<string> => {
    // For PDFs and Word docs, use server-side processing
    if (file.type === 'application/pdf' || file.name.endsWith('.docx')) {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to process file');
      
      const data = await response.json();
      return data.text;
    }

    // For text files, read directly
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  // Retry function for API calls
  const retryApiCall = async (apiCall: () => Promise<Response>, maxRetries = 3, baseDelay = 1000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await apiCall();
        
        // If successful, return immediately
        if (response.ok) {
          return response;
        }
        
        // If it's a 529 error and we have retries left, wait and retry
        if (response.status === 529 && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`API returned 529, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's not a 529 error or we're out of retries, return the response
        return response;
        
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // For network errors, also retry
        if (error instanceof TypeError) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Network error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }
    throw new Error('Max retries exceeded');
  };

  const handleAnalyzeExamples = async () => {
    if (!config.examples || config.examples.length === 0) return;

    setIsAnalyzing(true);
    try {
      // Combine all example contents
      const combinedContent = config.examples
        .map(ex => `\n\n=== ${ex.fileName} ===\n${ex.content}`)
        .join('\n\n');

      const response = await retryApiCall(async () => {
        return fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'analyze',
            prompt: 'Analyze documents',
            content: combinedContent,
            model: 'claude-3-5-haiku-20241022',
            analysisPrompt: `Analyze these example documents and extract writing patterns. Return a JSON object with these exact fields:
{
  "tone": "one of: Professional, Friendly, Formal, Casual, Persuasive, Informative",
  "audience": "one of: General public, Business professionals, Students, Clients, Colleagues, Executives",
  "syntax": "one of: Explanatory, Concise",
  "outcome": "one of: Conversion, Analysis, Email, Fundraising",
  "patterns": "detailed description of the writing patterns and style"
}

Be specific about the tone, audience, syntax style, and intended outcome based on the documents.`
          }),
        });
      });

      if (!response || !response.ok) {
        let errorMessage = 'Failed to analyze examples';
        if (response) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            const errorText = await response.text();
            errorMessage = `API Error (${response.status}): ${errorText}`;
          }
        }
        console.error('Analyze API error:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Try to parse the analysis as JSON to get structured data
      let extractedData = null;
      try {
        const analysisText = data.analysis || data.extracted || '';
        // Try to find JSON in the response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.log('Could not parse JSON from analysis, will use text only');
      }
      
      // Build the updated config with extracted data
      const extractedTone = extractedData?.tone || config.tone;
      const extractedAudience = extractedData?.audience || config.audience;
      const extractedSyntax = extractedData?.syntax || config.syntax;
      const extractedOutcome = extractedData?.outcome || config.outcome;
      
      const updatedConfig = {
        ...config,
        // Auto-populate the fields from extracted data
        tone: extractedTone,
        audience: extractedAudience,
        syntax: extractedSyntax,
        outcome: extractedOutcome,
        // Also update the text fields for display
        projectName: config.projectName || 'My Document',
        description: config.description || 'AI-analyzed document',
        learnedPatterns: extractedData?.patterns || data.analysis || data.extracted || '',
        styleGuide: data.analysis || data.extracted || '',
        // Keep examples intact
        examples: config.examples || []
      };
      
      setConfig(updatedConfig);

      // Auto-save the configuration after analysis
      updateProjectConfig({
        ...activeConfig,
        ...updatedConfig,
        id: activeConfig.id || 'context-config',
        name: 'Project Context',
        createdAt: activeConfig.createdAt || new Date()
      } as ProjectConfig);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Failed to analyze examples. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRemoveExample = (id: string) => {
    setConfig(prev => ({
      ...prev,
      examples: prev.examples?.filter(ex => ex.id !== id) || []
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    
    updateProjectConfig({
      ...activeConfig,
      ...config,
      id: activeConfig.id || 'context-config',
      name: 'Project Context',
      createdAt: activeConfig.createdAt || new Date()
    } as ProjectConfig);
    
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setIsSaving(false);
    }, 2000);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-black mb-2">Project Context (Optional)</h1>
    </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-sm text-black">Context saved successfully!</span>
          </div>
        )}


        {/* Upload Documents */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-black mb-4">
            Reference Documents
          </h2>

          {/* Upload Area */}
          <div className="mb-4">
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-black mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">
                  PDF, DOCX, TXT files (up to 10MB each)
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
              </div>
            </label>
          </div>

          {/* Example List */}
          {config.examples && config.examples.length > 0 && (
            <div className="space-y-2 mb-4">
              {config.examples.map(example => (
                <div
                  key={example.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-black">{example.fileName}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveExample(example.id)}
                    className="p-1 hover:bg-gray-200 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Project Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-black mb-4">
            Project Notes
          </h2>

          <div className="space-y-4">
            <div>
              <textarea
                value={config.additionalContext || ''}
                onChange={(e) => {
                  setConfig({ 
                    ...config, 
                    additionalContext: e.target.value
                  });
                }}
                placeholder="Add any notes or instructions for the AI..."
                rows={8}
                className="w-full px-3 py-2 border rounded-lg text-black text-sm"
              />
            </div>

            {/* Processing Indicator */}
            {isAnalyzing && (
              <div className="flex items-center justify-center gap-2 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Analyzing your documents...</span>
              </div>
            )}

          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Save Context
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}