'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { ProjectConfig } from '@/lib/types';
import { Settings, Save, FileText, Users, Palette, AlertCircle, Sparkles, Upload, Plus, Trash2, Copy, Check, ChevronRight } from 'lucide-react';
import { DocumentUpload } from './DocumentUpload';

export function ProjectSetup() {
  const { state, updateProjectConfig, saveProjectConfig, setActiveConfig, deleteProjectConfig } = useEditor();
  const activeConfig = state.projectConfigs?.find(c => c.id === state.activeConfigId) || state.projectConfigs?.[0];
  
  const [config, setConfig] = useState<Omit<ProjectConfig, 'id' | 'createdAt'>>({
    name: activeConfig?.name || 'Default Configuration',
    projectName: activeConfig?.projectName || 'Untitled Project',
    description: activeConfig?.description || '',
    styleGuide: activeConfig?.styleGuide || '',
    tone: activeConfig?.tone || '',
    audience: activeConfig?.audience || '',
    references: activeConfig?.references || [],
    constraints: activeConfig?.constraints || '',
    additionalContext: activeConfig?.additionalContext || '',
    isActive: true
  });
  
  const [referenceInput, setReferenceInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

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
        isActive: true
      });
    }
  }, [activeConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    
    if (activeConfig) {
      // Update existing config
      updateProjectConfig({
        ...activeConfig,
        ...config,
        id: activeConfig.id,
        createdAt: activeConfig.createdAt
      });
    }
    
    // Show success message
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

  const addReference = () => {
    if (referenceInput.trim()) {
      setConfig(prev => ({
        ...prev,
        references: [...(prev.references || []), referenceInput.trim()]
      }));
      setReferenceInput('');
    }
  };

  const removeReference = (index: number) => {
    setConfig(prev => ({
      ...prev,
      references: prev.references?.filter((_, i) => i !== index) || []
    }));
  };

  const handleContextExtracted = (extractedContext: any) => {
    // Check if extractedContext is valid
    if (!extractedContext) {
      alert('Failed to extract context from document. Please try again with a different file.');
      setShowUpload(false);
      return;
    }
    
    setConfig(prev => ({
      ...prev,
      projectName: extractedContext?.projectName || prev.projectName,
      description: extractedContext?.description || prev.description,
      styleGuide: extractedContext?.styleGuide || prev.styleGuide,
      tone: extractedContext?.tone || prev.tone,
      audience: extractedContext?.audience || prev.audience,
      constraints: extractedContext?.constraints || prev.constraints,
      additionalContext: extractedContext?.additionalContext || prev.additionalContext,
    }));
    setShowUpload(false);
    
    // Show success message
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar - Configuration List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">Configurations</h3>
            <button
              onClick={handleSaveAsNew}
              className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
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
              className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors ${
                cfg.id === state.activeConfigId 
                  ? 'bg-blue-50 border-l-4 border-l-blue-600' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <h4 className="text-sm font-medium text-gray-900">{cfg.name}</h4>
                    {cfg.isActive && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{cfg.projectName}</p>
                  {cfg.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cfg.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(cfg.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {cfg.id === state.activeConfigId && (
                  <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0 mt-1" />
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Sidebar Actions */}
        <div className="p-3 border-t border-gray-200 space-y-2">
          <button
            onClick={handleDuplicate}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            <Copy className="w-4 h-4" />
            Duplicate Current
          </button>
          {state.projectConfigs && state.projectConfigs.length > 1 && (
            <button
              onClick={() => handleDelete(state.activeConfigId || '')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded hover:bg-red-100"
            >
              <Trash2 className="w-4 h-4" />
              Delete Current
            </button>
          )}
        </div>
      </div>

      {/* Main Content - Configuration Editor */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="px-6 py-3 border-b bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Edit Configuration</h2>
              <p className="text-xs text-gray-600">Define your project context for AI assistance</p>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                title="Extract context from document"
              >
                <Upload className="w-4 h-4" />
                Extract from Doc
              </button>
              
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  showSuccess 
                    ? 'bg-green-600 text-white' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {showSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Configuration Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Settings className="w-4 h-4" />
                Configuration Name
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="E.g., Legal Brief, Blog Post, Technical Documentation..."
              />
            </div>
            
            {/* Project Name */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Project Name
              </label>
              <input
                type="text"
                value={config.projectName}
                onChange={(e) => setConfig(prev => ({ ...prev, projectName: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your project name..."
              />
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Project Description
              </label>
              <textarea
                value={config.description}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                placeholder="What is this project about? What are you trying to achieve?"
              />
            </div>

            {/* Style Guide */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Palette className="w-4 h-4" />
                Writing Style Guide
              </label>
              <textarea
                value={config.styleGuide}
                onChange={(e) => setConfig(prev => ({ ...prev, styleGuide: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                placeholder="E.g., 'Academic with citations', 'Conversational blog style', 'Technical documentation'..."
              />
            </div>

            {/* Tone and Audience */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Tone
                </label>
                <select
                  value={config.tone}
                  onChange={(e) => setConfig(prev => ({ ...prev, tone: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select tone...</option>
                  <option value="formal">Formal</option>
                  <option value="casual">Casual</option>
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="technical">Technical</option>
                  <option value="creative">Creative</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="informative">Informative</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Users className="w-4 h-4" />
                  Target Audience
                </label>
                <input
                  type="text"
                  value={config.audience}
                  onChange={(e) => setConfig(prev => ({ ...prev, audience: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="E.g., 'Software developers', 'General public'..."
                />
              </div>
            </div>

            {/* Style References */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Style References (Examples to follow)
              </label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referenceInput}
                    onChange={(e) => setReferenceInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addReference()}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a reference example or link..."
                  />
                  <button
                    onClick={addReference}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Add
                  </button>
                </div>
                {config.references && config.references.length > 0 && (
                  <div className="space-y-1">
                    {config.references.map((ref, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <span className="flex-1 text-sm text-gray-700">{ref}</span>
                        <button
                          onClick={() => removeReference(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Constraints */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <AlertCircle className="w-4 h-4" />
                Constraints & Rules
              </label>
              <textarea
                value={config.constraints}
                onChange={(e) => setConfig(prev => ({ ...prev, constraints: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
                placeholder="E.g., 'Max 500 words', 'No technical jargon', 'Include citations'..."
              />
            </div>

            {/* Additional Context */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Additional Context for AI
              </label>
              <textarea
                value={config.additionalContext}
                onChange={(e) => setConfig(prev => ({ ...prev, additionalContext: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                placeholder="Any other information the AI should know about this project..."
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How this works:</p>
                  <p>This configuration will be included as context in every AI interaction, ensuring consistent style and adherence to your project requirements. The AI will use this as a reference to maintain your desired tone, style, and constraints throughout all edits.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Extract Context from Document</h3>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Upload a document and AI will automatically extract project configuration details like style, tone, audience, and constraints.
            </p>
            <DocumentUpload
              mode="context"
              onContextExtracted={handleContextExtracted}
              onContentExtracted={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  );
}