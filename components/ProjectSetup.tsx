'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ProjectConfig } from '@/lib/types';
import { 
  Upload, Plus, Trash2, Check, ChevronRight, FileText,
  Sparkles, BookOpen, Target, Zap, Copy, FileUp, X
} from 'lucide-react';
import { DocumentUpload } from './DocumentUpload';

const DEFAULT_PROMPT_TEMPLATE = `You are helping with a writing project.

Style Analysis from Examples:
{{styleAnalysis}}

Project Context:
- Type: {{projectType}}
- Audience: {{audience}}
- Purpose: {{purpose}}

Please maintain the same writing style, tone, and structure as shown in the examples when {{task}}.`;

interface StyleExample {
  id: string;
  fileName: string;
  content: string;
  analysis?: string;
}

export function ProjectSetup() {
  const { state, updateProjectConfig, saveProjectConfig, setActiveConfig, deleteProjectConfig } = useEditor();
  const activeConfig = state.projectConfigs?.find(c => c.id === state.activeConfigId) || state.projectConfigs?.[0];
  
  const [config, setConfig] = useState<Omit<ProjectConfig, 'id' | 'createdAt'>>({
    name: activeConfig?.name || 'New Configuration',
    projectName: activeConfig?.projectName || 'My Project',
    description: activeConfig?.description || '',
    styleGuide: activeConfig?.styleGuide || '',
    tone: activeConfig?.tone || '',
    audience: activeConfig?.audience || '',
    references: activeConfig?.references || [],
    constraints: activeConfig?.constraints || '',
    additionalContext: activeConfig?.additionalContext || '',
    promptTemplate: activeConfig?.promptTemplate || DEFAULT_PROMPT_TEMPLATE,
    templateVariables: activeConfig?.templateVariables || {},
    isActive: true
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [examples, setExamples] = useState<StyleExample[]>([]);
  const [analyzingExample, setAnalyzingExample] = useState<string | null>(null);

  useEffect(() => {
    if (activeConfig) {
      setConfig({
        name: activeConfig.name,
        projectName: activeConfig.projectName,
        description: activeConfig.description || '',
        styleGuide: activeConfig.styleGuide || '',
        tone: activeConfig.tone || '',
        audience: activeConfig.audience || '',
        references: activeConfig.references || [],
        constraints: activeConfig.constraints || '',
        additionalContext: activeConfig.additionalContext || '',
        promptTemplate: activeConfig.promptTemplate || DEFAULT_PROMPT_TEMPLATE,
        templateVariables: activeConfig.templateVariables || {},
        isActive: true
      });
    }
  }, [activeConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    
    // Combine all example analyses into the style guide
    const combinedStyleAnalysis = examples
      .filter(ex => ex.analysis)
      .map(ex => ex.analysis)
      .join('\n\n');
    
    const updatedConfig = {
      ...config,
      styleGuide: combinedStyleAnalysis || config.styleGuide,
      additionalContext: `Examples analyzed: ${examples.map(ex => ex.fileName).join(', ')}`
    };
    
    if (activeConfig) {
      updateProjectConfig({
        ...activeConfig,
        ...updatedConfig,
        id: activeConfig.id,
        createdAt: activeConfig.createdAt
      });
    }
    
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setIsSaving(false);
    }, 2000);
  };

  const handleSaveAsNew = () => {
    const newConfigId = saveProjectConfig(config);
    setActiveConfig(newConfigId);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 2000);
  };

  const handleDuplicate = () => {
    const duplicatedConfig = {
      ...config,
      name: `${config.name} (Copy)`
    };
    const newConfigId = saveProjectConfig(duplicatedConfig);
    setActiveConfig(newConfigId);
  };

  const handleDelete = (configId: string) => {
    if (state.projectConfigs?.length === 1) {
      alert('Cannot delete the last configuration');
      return;
    }
    if (confirm('Are you sure you want to delete this configuration?')) {
      deleteProjectConfig(configId);
    }
  };

  const handleExampleUploaded = async (fileName: string, content: string) => {
    const newExample: StyleExample = {
      id: `example-${Date.now()}`,
      fileName,
      content: content.substring(0, 2000) // Keep first 2000 chars for display
    };
    
    setExamples(prev => [...prev, newExample]);
    setAnalyzingExample(newExample.id);
    
    // Analyze the example with AI
    try {
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'analyze',
          prompt: `Analyze this writing example and extract:
1. Writing style (formal/casual/technical/creative)
2. Tone (professional/friendly/authoritative/conversational)
3. Structure patterns (how paragraphs are organized)
4. Vocabulary level and word choice patterns
5. Sentence structure (simple/complex/varied)
6. Any unique stylistic elements

Be specific and provide actionable style guidelines.`,
          content: content
        }),
      });
      
      const result = await response.json();
      
      setExamples(prev => prev.map(ex => 
        ex.id === newExample.id 
          ? { ...ex, analysis: result.response }
          : ex
      ));
      
      // Auto-update config based on analysis
      if (result.response) {
        setConfig(prev => ({
          ...prev,
          styleGuide: prev.styleGuide ? `${prev.styleGuide}\n\n${result.response}` : result.response
        }));
      }
    } catch (error) {
      console.error('Failed to analyze example:', error);
    } finally {
      setAnalyzingExample(null);
    }
    
    setShowUpload(false);
  };

  const removeExample = (id: string) => {
    setExamples(prev => prev.filter(ex => ex.id !== id));
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar - Configuration List */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-br from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Style Configurations</h3>
            <button
              onClick={handleSaveAsNew}
              className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              title="Create new configuration"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {state.projectConfigs?.map(cfg => (
            <div
              key={cfg.id}
              onClick={() => setActiveConfig(cfg.id)}
              className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-all ${
                cfg.id === state.activeConfigId 
                  ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-l-purple-600' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900">{cfg.name}</h4>
                  {cfg.audience && (
                    <p className="text-xs text-gray-600 mt-1">For: {cfg.audience}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(cfg.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {cfg.id === state.activeConfigId && (
                  <ChevronRight className="w-4 h-4 text-purple-600 mt-1" />
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-3 border-t border-gray-200 space-y-2">
          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <Copy className="w-4 h-4" />
            Duplicate
          </button>
          {state.projectConfigs && state.projectConfigs.length > 1 && (
            <button
              onClick={() => handleDelete(state.activeConfigId || '')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Style Learning</h2>
              <p className="text-sm text-gray-600 mt-1">Upload examples of good writing to teach AI your style</p>
            </div>
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                showSuccess 
                  ? 'bg-green-600 text-white' 
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {showSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Save Style
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Quick Setup */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                Quick Setup
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="E.g., Blog Style, Legal Docs..."
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={config.audience}
                    onChange={(e) => setConfig(prev => ({ ...prev, audience: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="E.g., Developers, General Public..."
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  What's the purpose?
                </label>
                <input
                  type="text"
                  value={config.description}
                  onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="E.g., Technical documentation, Marketing content, Legal briefs..."
                />
              </div>
            </div>

            {/* Style Examples */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" />
                  Style Examples
                </h3>
                <button
                  onClick={() => setShowUpload(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                >
                  <FileUp className="w-4 h-4" />
                  Upload Example
                </button>
              </div>
              
              {examples.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No examples uploaded yet</p>
                  <p className="text-sm text-gray-500 mt-1">Upload documents that represent your desired writing style</p>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Upload First Example
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {examples.map(example => (
                    <div key={example.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-gray-800">{example.fileName}</span>
                            {analyzingExample === example.id && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                                Analyzing...
                              </span>
                            )}
                          </div>
                          
                          {example.analysis && (
                            <div className="mt-2 p-3 bg-white rounded border border-purple-200">
                              <p className="text-xs font-semibold text-purple-700 mb-1">Style Analysis:</p>
                              <p className="text-xs text-gray-600 line-clamp-3">{example.analysis}</p>
                            </div>
                          )}
                          
                          <div className="mt-2">
                            <p className="text-xs text-gray-500 line-clamp-2">{example.content}</p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => removeExample(example.id)}
                          className="ml-2 p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Extracted Style Guide */}
            {config.styleGuide && (
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Learned Style Guide
                </h3>
                <div className="bg-white rounded-lg p-4 border border-purple-200">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                    {config.styleGuide}
                  </pre>
                </div>
              </div>
            )}

            {/* Additional Constraints */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Additional Requirements
              </h3>
              <textarea
                value={config.constraints}
                onChange={(e) => setConfig(prev => ({ ...prev, constraints: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={3}
                placeholder="E.g., 'Keep paragraphs under 5 sentences', 'Use active voice', 'Include examples'..."
              />
            </div>

          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-xl w-full mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload Style Example</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Upload a document that represents the writing style you want the AI to learn and replicate.
            </p>
            <DocumentUpload
              mode="document"
              onContentExtracted={(content: string, fileName?: string) => {
                handleExampleUploaded(fileName || 'example.txt', content);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}