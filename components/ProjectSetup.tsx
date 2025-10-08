'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ProjectConfig, ExampleDocument } from '@/lib/types';
import { 
  Upload, Trash2, Check, FileText, Sparkles, Loader2,
  BookOpen, ChevronDown, ChevronUp, Settings, Plus, Edit2, X
} from 'lucide-react';

interface RewriteTemplate {
  id: string;
  label: string;
  description: string;
  prompt: string;
  isActive: boolean;
  isCustom: boolean;
}

export function ProjectSetup() {
  const { state, updateProjectConfig } = useEditor();
  
  // Rewrite templates state
  const [rewriteTemplates, setRewriteTemplates] = useState<RewriteTemplate[]>(() => {
    try {
      const saved = localStorage.getItem('rewriteTemplates');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load rewrite templates:', e);
    }
    // Default 5 stock templates
    return [
      {
        id: 'concise',
        label: 'More concise',
        description: 'Shorter, punchier version',
        prompt: 'Rewrite this text to be more concise and direct, removing unnecessary words while preserving the core meaning.',
        isActive: true,
        isCustom: false
      },
      {
        id: 'formal',
        label: 'More formal',
        description: 'Professional tone',
        prompt: 'Rewrite this text in a more formal, professional tone suitable for business or academic contexts.',
        isActive: true,
        isCustom: false
      },
      {
        id: 'simple',
        label: 'Simpler',
        description: 'Easier to understand',
        prompt: 'Rewrite this text to be simpler and easier to understand, using plain language and shorter sentences.',
        isActive: true,
        isCustom: false
      },
      {
        id: 'angle',
        label: 'Different angle',
        description: 'Rephrase the idea',
        prompt: 'Rewrite this text from a different perspective or angle, presenting the same information in a fresh way.',
        isActive: false,
        isCustom: false
      },
      {
        id: 'active',
        label: 'Active voice',
        description: 'Direct, action-oriented',
        prompt: 'Rewrite this text using active voice, making sentences more direct and action-oriented.',
        isActive: false,
        isCustom: false
      }
    ];
  });
  
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{ label: string; description: string; prompt: string }>({ label: '', description: '', prompt: '' });
  
  // Autocomplete settings
  const [autocompleteSettings, setAutocompleteSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('autocompleteSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load autocomplete settings:', e);
    }
    return {
      enabled: true,
      typingDelay: 2000, // milliseconds
      styleAdaptation: true,
      contextLength: 800 // characters
    };
  });
  
  const [activeTab, setActiveTab] = useState<'context' | 'rewrites' | 'autocomplete'>('context');
  
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
  
  // Rewrite template management functions
  const saveRewriteTemplates = (templates: RewriteTemplate[]) => {
    try {
      localStorage.setItem('rewriteTemplates', JSON.stringify(templates));
      console.log('✅ Saved rewrite templates to localStorage');
    } catch (e) {
      console.error('Failed to save rewrite templates:', e);
    }
  };
  
  const toggleTemplateActive = (id: string) => {
    const activeCount = rewriteTemplates.filter(t => t.isActive).length;
    const template = rewriteTemplates.find(t => t.id === id);
    
    // If trying to activate and already have 3 active, prevent it
    if (template && !template.isActive && activeCount >= 3) {
      alert('You can only select up to 3 active rewrites. Please deactivate one first.');
      return;
    }
    
    const updated = rewriteTemplates.map(t =>
      t.id === id ? { ...t, isActive: !t.isActive } : t
    );
    setRewriteTemplates(updated);
    saveRewriteTemplates(updated);
  };
  
  const startEditingTemplate = (template: RewriteTemplate) => {
    setEditingTemplate(template.id);
    setEditingValues({
      label: template.label,
      description: template.description,
      prompt: template.prompt
    });
  };
  
  const saveTemplateEdit = () => {
    if (!editingTemplate) return;
    
    const updated = rewriteTemplates.map(t =>
      t.id === editingTemplate
        ? { ...t, ...editingValues }
        : t
    );
    setRewriteTemplates(updated);
    saveRewriteTemplates(updated);
    setEditingTemplate(null);
  };
  
  const cancelTemplateEdit = () => {
    setEditingTemplate(null);
  };
  
  const addNewTemplate = () => {
    const activeCount = rewriteTemplates.filter(t => t.isActive).length;
    
    const newTemplate: RewriteTemplate = {
      id: `custom-${Date.now()}`,
      label: 'New Rewrite',
      description: 'Custom rewrite style',
      prompt: 'Rewrite this text...',
      isActive: activeCount < 3, // Auto-activate if under 3
      isCustom: true
    };
    
    const updated = [...rewriteTemplates, newTemplate];
    setRewriteTemplates(updated);
    saveRewriteTemplates(updated);
    startEditingTemplate(newTemplate);
  };
  
  const deleteTemplate = (id: string) => {
    if (window.confirm('Are you sure you want to delete this custom rewrite?')) {
      const updated = rewriteTemplates.filter(t => t.id !== id);
      setRewriteTemplates(updated);
      saveRewriteTemplates(updated);
    }
  };
  
  // Autocomplete settings functions
  const saveAutocompleteSettings = (settings: typeof autocompleteSettings) => {
    try {
      localStorage.setItem('autocompleteSettings', JSON.stringify(settings));
      setAutocompleteSettings(settings);
      console.log('✅ Saved autocomplete settings to localStorage');
    } catch (e) {
      console.error('Failed to save autocomplete settings:', e);
    }
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
          <h1 className="text-3xl font-bold text-black mb-2">Settings</h1>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('context')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'context'
                ? 'text-[#1e3a8a] border-b-2 border-[#1e3a8a]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Context
          </button>
          <button
            onClick={() => setActiveTab('rewrites')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'rewrites'
                ? 'text-[#1e3a8a] border-b-2 border-[#1e3a8a]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Rewrite Settings
          </button>
          <button
            onClick={() => setActiveTab('autocomplete')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'autocomplete'
                ? 'text-[#1e3a8a] border-b-2 border-[#1e3a8a]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Autocomplete Settings
          </button>
          <button
            onClick={() => setActiveTab('view')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'view'
                ? 'text-[#1e3a8a] border-b-2 border-[#1e3a8a]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            View Options
          </button>
        </div>

        {/* Success Message */}
        {showSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <span className="text-sm text-black">Settings saved successfully!</span>
          </div>
        )}

        {/* Context Tab */}
        {activeTab === 'context' && (
          <>
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
          </>
        )}

        {/* Rewrite Settings Tab */}
        {activeTab === 'rewrites' && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-black mb-2">Customize Rewrite Options</h2>
              <p className="text-sm text-gray-600 mb-4">
                Select up to 3 active rewrites. Click on any rewrite to edit its prompt and customize how the AI transforms your text.
              </p>
              <div className="text-sm text-gray-500">
                Active: <span className="font-semibold text-[#1e3a8a]">{rewriteTemplates.filter(t => t.isActive).length}</span> / 3
              </div>
            </div>

            {/* Rewrite Templates */}
            <div className="space-y-3">
              {rewriteTemplates.map(template => (
                <div
                  key={template.id}
                  className={`bg-white rounded-lg border-2 transition-all ${
                    template.isActive
                      ? 'border-[#1e3a8a] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {editingTemplate === template.id ? (
                    // Edit Mode
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-black mb-2">Label</label>
                        <input
                          type="text"
                          value={editingValues.label}
                          onChange={(e) => setEditingValues({ ...editingValues, label: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                          placeholder="e.g., More concise"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-2">Description</label>
                        <input
                          type="text"
                          value={editingValues.description}
                          onChange={(e) => setEditingValues({ ...editingValues, description: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
                          placeholder="e.g., Shorter, punchier version"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-black mb-2">AI Prompt</label>
                        <textarea
                          value={editingValues.prompt}
                          onChange={(e) => setEditingValues({ ...editingValues, prompt: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black text-sm"
                          rows={4}
                          placeholder="Describe how you want the AI to rewrite the text..."
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={cancelTemplateEdit}
                          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveTemplateEdit}
                          className="px-4 py-2 bg-[#1e3a8a] text-white rounded-lg hover:bg-[#1e40af] flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={template.isActive}
                            onChange={() => toggleTemplateActive(template.id)}
                            className="w-5 h-5 text-[#1e3a8a] rounded border-gray-300 focus:ring-[#1e3a8a]"
                          />
                          <div className="flex-1">
                            <h3 className="text-base font-semibold text-black">{template.label}</h3>
                            <p className="text-sm text-gray-600">{template.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditingTemplate(template)}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          {template.isCustom && (
                            <button
                              onClick={() => deleteTemplate(template.id)}
                              className="p-2 hover:bg-red-100 rounded-lg"
                              title="Delete"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="ml-8 mt-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-700 italic">"{template.prompt}"</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add Custom Rewrite Button */}
            <button
              onClick={addNewTemplate}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#1e3a8a] hover:bg-blue-50 text-gray-600 hover:text-[#1e3a8a] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Custom Rewrite
            </button>
          </div>
        )}

        {/* Autocomplete Settings Tab */}
        {activeTab === 'autocomplete' && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-black mb-2">Autocomplete Configuration</h2>
              <p className="text-sm text-gray-600">
                Customize how the AI autocomplete feature behaves while you're typing.
              </p>
            </div>

            {/* Settings */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              {/* Typing Delay */}
              <div>
                <h3 className="text-base font-semibold text-black mb-1">Typing Delay</h3>
                <p className="text-sm text-gray-600 mb-3">How long to wait after you stop typing before showing suggestions</p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="500"
                    value={autocompleteSettings.typingDelay}
                    onChange={(e) => saveAutocompleteSettings({ ...autocompleteSettings, typingDelay: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a8a]"
                  />
                  <span className="text-sm font-medium text-black w-20 text-right">
                    {(autocompleteSettings.typingDelay / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>

              {/* Style Adaptation */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-black mb-1">Style Adaptation</h3>
                  <p className="text-sm text-gray-600">Let AI adapt to your writing style (short/long sentences, formal/casual)</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autocompleteSettings.styleAdaptation}
                    onChange={(e) => saveAutocompleteSettings({ ...autocompleteSettings, styleAdaptation: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e3a8a]"></div>
                </label>
              </div>

              {/* Context Length */}
              <div>
                <h3 className="text-base font-semibold text-black mb-1">Context Length</h3>
                <p className="text-sm text-gray-600 mb-3">How much of your previous text to analyze for better suggestions</p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="200"
                    max="2000"
                    step="200"
                    value={autocompleteSettings.contextLength}
                    onChange={(e) => saveAutocompleteSettings({ ...autocompleteSettings, contextLength: parseInt(e.target.value) })}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e3a8a]"
                  />
                  <span className="text-sm font-medium text-black w-20 text-right">
                    {autocompleteSettings.contextLength} chars
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}