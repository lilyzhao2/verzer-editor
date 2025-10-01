'use client';

import React from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Bug, X, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';

export function DebugPanel() {
  const { state, toggleDebugMode } = useEditor();
  const [copied, setCopied] = useState(false);

  if (!state.debugMode) return null;

  const copyToClipboard = async () => {
    if (state.lastSystemPrompt) {
      await navigator.clipboard.writeText(state.lastSystemPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold">Debug: System Prompt</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              {copied ? <CheckCircle className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={toggleDebugMode}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {state.lastSystemPrompt ? (
            <div className="space-y-6">
              {/* System Prompt */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  System Prompt Sent to AI
                </h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                    {state.lastSystemPrompt}
                  </pre>
                </div>
              </div>
              
              {/* Project Configuration Summary */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Project Configuration Summary
                </h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  {(() => {
                    const config = state.projectConfigs?.find(c => c.id === state.activeConfigId);
                    if (!config) return <p className="text-gray-600">No active configuration</p>;
                    
                    return (
                      <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium text-gray-700">Project Name:</span>
                            <span className="ml-2 text-gray-900">{config.projectName || 'Untitled'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Configuration:</span>
                            <span className="ml-2 text-gray-900">{config.name}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium text-gray-700">Examples:</span>
                            <span className="ml-2 text-gray-900">{config.examples?.length || 0} uploaded</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Learned Patterns:</span>
                            <span className="ml-2 text-gray-900">
                              {config.learnedPatterns ? `Yes (${config.learnedPatterns.length} chars)` : 'No'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="font-medium text-gray-700">Tone:</span>
                            <span className="ml-2 text-gray-900">{config.tone || 'Not specified'}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Audience:</span>
                            <span className="ml-2 text-gray-900">{config.audience || 'Not specified'}</span>
                          </div>
                        </div>
                        
                        {config.learnedPatterns && (
                          <div>
                            <span className="font-medium text-gray-700">Patterns Preview:</span>
                            <div className="mt-1 p-2 bg-white border border-gray-200 rounded text-xs text-gray-700 max-h-32 overflow-auto">
                              {config.learnedPatterns.substring(0, 300)}
                              {config.learnedPatterns.length > 300 && '...'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              {/* System Info */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  System Information
                </h4>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">AI Model:</span>
                      <span className="ml-2 text-gray-900">{state.selectedModel}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Current Version:</span>
                      <span className="ml-2 text-gray-900">v{state.versions.find(v => v.id === state.currentVersionId)?.number}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Document Length:</span>
                      <span className="ml-2 text-gray-900">{state.versions.find(v => v.id === state.currentVersionId)?.content.length || 0} characters</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Total Configurations:</span>
                      <span className="ml-2 text-gray-900">{state.projectConfigs?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Bug className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-700 mb-2">No Debug Data Yet</h3>
              <p>Make an AI request to see the system prompt and configuration details here.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            <p><strong>Tip:</strong> This shows exactly what context and instructions are being sent to the AI.</p>
            <p>Use this to debug why the AI might be generating poor content or not following instructions.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
