'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Plus, X, Maximize2, Minimize2, Copy, Edit3, GitBranch, Grid, Columns } from 'lucide-react';
import { Version } from '@/lib/types';

interface DocumentPanel {
  id: string;
  versionId: string;
  zoomed: boolean;
}

export function MultitaskView() {
  const { state, setCurrentVersion, createVersion, setViewMode } = useEditor();
  const [panels, setPanels] = useState<DocumentPanel[]>([
    { id: 'panel-1', versionId: state.currentVersionId, zoomed: false },
    { id: 'panel-2', versionId: '', zoomed: false },
    { id: 'panel-3', versionId: '', zoomed: false }
  ]);
  const [layout, setLayout] = useState<'grid' | 'columns'>('columns');
  const [selectedPanel, setSelectedPanel] = useState<string>('panel-1');

  const getVersion = (id: string): Version | undefined => {
    return state.versions.find(v => v.id === id);
  };

  const handleContinueFrom = (versionId: string) => {
    const version = getVersion(versionId);
    if (version) {
      const prompt = `🔄 Continued from v${version.number}`;
      const note = `Working on ideas from v${version.number}`;
      createVersion(version.content, prompt, version.id, note);
      
      // Update the panel to show the new version
      const newVersionId = `v${state.versions.length}`; // This will be the new version's ID
      setPanels(panels.map(p => 
        p.id === selectedPanel 
          ? { ...p, versionId: newVersionId }
          : p
      ));
    }
  };

  const handleEditInPlace = (versionId: string) => {
    setCurrentVersion(versionId);
    // Switch to document view for editing
    setViewMode('document');
  };

  const addPanel = () => {
    const newPanel: DocumentPanel = {
      id: `panel-${Date.now()}`,
      versionId: '',
      zoomed: false
    };
    setPanels([...panels, newPanel]);
  };

  const removePanel = (panelId: string) => {
    if (panels.length > 1) {
      setPanels(panels.filter(p => p.id !== panelId));
    }
  };

  const toggleZoom = (panelId: string) => {
    setPanels(panels.map(p => 
      p.id === panelId 
        ? { ...p, zoomed: !p.zoomed }
        : p
    ));
  };

  const updatePanelVersion = (panelId: string, versionId: string) => {
    setPanels(panels.map(p => 
      p.id === panelId 
        ? { ...p, versionId }
        : p
    ));
  };

  const renderPanel = (panel: DocumentPanel) => {
    const version = panel.versionId ? getVersion(panel.versionId) : null;
    const isSelected = selectedPanel === panel.id;

    return (
      <div
        key={panel.id}
        className={`flex flex-col border-2 rounded-lg overflow-hidden ${
          isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200'
        }`}
        onClick={() => setSelectedPanel(panel.id)}
      >
        {/* Panel Header */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              {/* Version Selector */}
              <select
                value={panel.versionId}
                onChange={(e) => updatePanelVersion(panel.id, e.target.value)}
                className="text-sm font-medium bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="">Select Version</option>
                {state.versions.map(v => (
                  <option key={v.id} value={v.id}>
                    v{v.number} {v.note ? `- ${v.note}` : ''}
                  </option>
                ))}
              </select>

              {/* Version Info */}
              {version && (
                <div className="flex items-center gap-2 text-xs">
                  {version.note && (
                    <span className="text-blue-600 italic">📝 {version.note}</span>
                  )}
                  <span className="text-gray-500">
                    {new Date(version.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* Panel Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleZoom(panel.id);
                }}
                className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                title={panel.zoomed ? "Normal view" : "Zoom out"}
              >
                {panel.zoomed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              </button>
              {panels.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removePanel(panel.id);
                  }}
                  className="p-1 text-gray-600 hover:bg-red-100 hover:text-red-600 rounded"
                  title="Close panel"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {version && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleContinueFrom(panel.versionId);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              >
                <GitBranch className="w-3 h-3" />
                Fork & Continue
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditInPlace(panel.versionId);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              >
                <Edit3 className="w-3 h-3" />
                Edit This
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(version.content.replace(/<[^>]*>/g, ''));
                }}
                className="flex items-center gap-1 px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
              >
                <Copy className="w-3 h-3" />
                Copy Text
              </button>
            </div>
          )}
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-auto bg-white p-4">
          {version ? (
            <div className={panel.zoomed ? 'transform scale-50 origin-top-left w-[200%]' : ''}>
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: version.content }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p className="text-center">
                Select a version<br/>to display
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-3 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Multitask Mode
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Work with multiple versions simultaneously
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Layout Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setLayout('columns')}
                className={`p-1.5 rounded ${
                  layout === 'columns' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Column layout"
              >
                <Columns className="w-4 h-4" />
              </button>
              <button
                onClick={() => setLayout('grid')}
                className={`p-1.5 rounded ${
                  layout === 'grid' 
                    ? 'bg-white shadow-sm text-blue-600' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
                title="Grid layout"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            {/* Add Panel Button */}
            {panels.length < 4 && (
              <button
                onClick={addPanel}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Panel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panels Grid */}
      <div className="flex-1 p-4 overflow-auto">
        <div className={`h-full ${
          layout === 'grid' 
            ? panels.length === 3 
              ? 'grid grid-cols-3 gap-4'
              : 'grid grid-cols-2 gap-4'
            : 'flex gap-4'
        }`}>
          {panels.map(panel => (
            <div 
              key={panel.id}
              className={layout === 'columns' ? 'flex-1' : ''}
            >
              {renderPanel(panel)}
            </div>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-6 py-2 border-t bg-white">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            {panels.filter(p => p.versionId).length} of {panels.length} panels active
          </div>
          <div className="text-gray-500">
            Click on a panel to select • Use "Fork & Continue" to create branches
          </div>
        </div>
      </div>
    </div>
  );
}
