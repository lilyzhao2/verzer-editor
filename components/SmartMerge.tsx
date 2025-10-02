'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { 
  Settings, GitMerge, Eye, EyeOff, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, XCircle, Sparkles, User, X, Check,
  MessageSquare, Columns, List, Focus as FocusIcon, Sliders
} from 'lucide-react';
import { RuleBuilder } from './RuleBuilder';
import { 
  ClassifiedChange, ViewMode, MergeRule, MergePreset, MergeStats,
  ChangeType, ImpactLevel
} from '@/lib/smartMergeTypes';
import {
  classifyChange,
  applyRules,
  MERGE_PRESETS,
  generateImpactExplanation
} from '@/lib/smartMergeEngine';

export function SmartMerge() {
  const { state, createVersion } = useEditor();
  
  // Core state
  const [baseVersionId, setBaseVersionId] = useState(state.currentVersionId);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [showSettings, setShowSettings] = useState(false);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [showAutoHandled, setShowAutoHandled] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    critical: true,
    important: true,
    normal: false,
    autoHandled: false
  });
  
  // Rules state
  const activeConfig = state.projectConfigs.find(c => c.id === state.activeConfigId);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    activeConfig?.mergePresetId || 'balanced-review'
  );
  const [customRules, setCustomRules] = useState<MergeRule[]>(
    activeConfig?.customMergeRules || []
  );
  
  // Get versions
  const baseVersion = state.versions.find(v => v.id === baseVersionId);
  const selectedVersions = selectedVersionIds
    .map(id => state.versions.find(v => v.id === id))
    .filter(Boolean);
  
  // Auto-select versions on mount
  useEffect(() => {
    if (selectedVersionIds.length === 0) {
      if (state.compareVersionId && state.currentVersionId) {
        setBaseVersionId(state.compareVersionId);
        setSelectedVersionIds([state.currentVersionId]);
      } else {
        const sortedVersions = [...state.versions].sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        
        if (sortedVersions.length >= 2) {
          setBaseVersionId(sortedVersions[1].id);
          setSelectedVersionIds([sortedVersions[0].id]);
        } else if (sortedVersions.length === 1) {
          setBaseVersionId(sortedVersions[0].id);
          setSelectedVersionIds([]);
        }
      }
      setIsInitializing(false);
    }
  }, [state.versions, state.compareVersionId, state.currentVersionId, selectedVersionIds.length]);
  
  // Extract and classify changes
  const classifiedChanges = useMemo<ClassifiedChange[]>(() => {
    if (!baseVersion || selectedVersions.length === 0) return [];
    
    const baseDiv = document.createElement('div');
    baseDiv.innerHTML = baseVersion.content;
    const baseParagraphs = Array.from(baseDiv.children).map(el => el.textContent || '');
    
    const allChanges: ClassifiedChange[] = [];
    
    baseParagraphs.forEach((basePara, index) => {
      selectedVersions.forEach(version => {
        const versionDiv = document.createElement('div');
        versionDiv.innerHTML = version!.content;
        const versionParagraphs = Array.from(versionDiv.children).map(el => el.textContent || '');
        const versionPara = versionParagraphs[index] || '';
        
        if (versionPara !== basePara) {
          const classified = classifyChange(
            basePara,
            versionPara,
            index,
            index === 0 ? 'Introduction' : `Section ${index + 1}`,
            version!.prompt?.includes('Manual') || version!.prompt?.includes('✏️') || false
          );
          
          // Get comments from Compare tab if available
          const compareComments = state.comments
            .filter(c => c.versionId === version!.id || c.versionId === baseVersion.id)
            .map(c => c.text);
          
          allChanges.push({
            id: `change-${index}-${version!.id}`,
            ...classified,
            originalText: basePara,
            alternatives: [
              {
                versionId: baseVersion.id,
                versionNumber: baseVersion.number,
                text: basePara,
                isManual: baseVersion.prompt?.includes('Manual') || baseVersion.prompt?.includes('✏️') || false,
                source: 'manual'
              },
              {
                versionId: version!.id,
                versionNumber: version!.number,
                text: versionPara,
                isManual: version!.prompt?.includes('Manual') || version!.prompt?.includes('✏️') || false,
                source: version!.prompt?.includes('AI') ? 'ai' : 'manual'
              }
            ],
            status: 'pending',
            comments: compareComments,
            explanation: generateImpactExplanation({
              ...classified,
              type: classified.type!,
              impact: classified.impact!,
              section: classified.section!,
              length: classified.length!,
              semanticShift: classified.semanticShift!
            } as ClassifiedChange)
          } as ClassifiedChange);
        }
      });
    });
    
    return allChanges;
  }, [baseVersion, selectedVersions, state.comments]);
  
  // Apply rules to changes
  const processedChanges = useMemo(() => {
    const preset = MERGE_PRESETS.find(p => p.id === selectedPresetId);
    const rules = preset ? [...preset.rules, ...customRules] : customRules;
    
    return applyRules(classifiedChanges, rules);
  }, [classifiedChanges, selectedPresetId, customRules]);
  
  // Calculate stats
  const stats: MergeStats = useMemo(() => {
    const total = processedChanges.length;
    const critical = processedChanges.filter(c => c.impact === 'critical' && c.status !== 'auto-handled').length;
    const important = processedChanges.filter(c => c.impact === 'important' && c.status !== 'auto-handled').length;
    const normal = processedChanges.filter(c => c.impact === 'normal' && c.status !== 'auto-handled').length;
    const autoHandled = processedChanges.filter(c => c.status === 'auto-handled').length;
    const reviewed = processedChanges.filter(c => c.status === 'accepted').length;
    
    return { total, critical, important, normal, autoHandled, reviewed };
  }, [processedChanges]);
  
  // Filter changes by category
  const changesToReview = processedChanges.filter(c => c.status !== 'auto-handled');
  const criticalChanges = changesToReview.filter(c => c.impact === 'critical');
  const importantChanges = changesToReview.filter(c => c.impact === 'important');
  const normalChanges = changesToReview.filter(c => c.impact === 'normal');
  const autoHandledChanges = processedChanges.filter(c => c.status === 'auto-handled');
  
  // Handle change acceptance
  const handleAcceptChange = (changeId: string, versionId: string) => {
    const changeIndex = processedChanges.findIndex(c => c.id === changeId);
    if (changeIndex !== -1) {
      processedChanges[changeIndex].status = 'accepted';
      processedChanges[changeIndex].selectedAlternativeId = versionId;
    }
  };
  
  // Handle merge completion
  const handleCreateMergedVersion = () => {
    if (!baseVersion) return;
    
    // Build merged content
    const baseDiv = document.createElement('div');
    baseDiv.innerHTML = baseVersion.content;
    const elements = Array.from(baseDiv.children);
    
    processedChanges.forEach(change => {
      if (change.status === 'accepted' && change.selectedAlternativeId) {
        const alternative = change.alternatives.find(a => a.versionId === change.selectedAlternativeId);
        if (alternative && elements[change.location]) {
          elements[change.location].textContent = alternative.text;
        }
      } else if (change.status === 'auto-handled' && change.selectedAlternativeId) {
        const alternative = change.alternatives.find(a => a.versionId === change.selectedAlternativeId);
        if (alternative && elements[change.location]) {
          elements[change.location].textContent = alternative.text;
        }
      }
    });
    
    const mergedContent = Array.from(elements).map(el => el.outerHTML).join('');
    
    // Create new version
    const versionNumbers = [baseVersion.number, ...selectedVersions.map(v => v!.number)].join(' + ');
    createVersion(
      mergedContent,
      `🔀 Smart Merge: ${versionNumbers}`,
      baseVersion.id,
      `Merged ${stats.reviewed + stats.autoHandled} changes`
    );
    
    alert(`✅ Created merged version with ${stats.reviewed + stats.autoHandled} changes!`);
  };
  
  // Loading state
  if (isInitializing) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Smart Merge...</p>
        </div>
      </div>
    );
  }
  
  // No versions state
  if (!baseVersion || selectedVersions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <GitMerge className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Versions Available</h3>
          <p className="text-sm text-gray-600">Create some versions first to use Smart Merge</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Smart Merge</h2>
            <p className="text-sm text-gray-600 mt-1">
              Base: <span className="font-medium">V{baseVersion.number}</span> → 
              Merging: <span className="font-medium">{selectedVersions.length} versions</span>
              {state.compareVersionId && state.currentVersionId && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  From Compare Tab
                </span>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('unified')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'unified' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
                title="Unified View"
              >
                <List className="w-3 h-3" />
                Unified
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'split' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
                title="Split View"
              >
                <Columns className="w-3 h-3" />
                Split
              </button>
              <button
                onClick={() => setViewMode('focus')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  viewMode === 'focus' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-700 hover:text-gray-900'
                }`}
                title="Focus Mode"
              >
                <FocusIcon className="w-3 h-3" />
                Focus
              </button>
            </div>
            
            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
            
            {/* Create Merged Version Button */}
            <button
              onClick={handleCreateMergedVersion}
              disabled={stats.reviewed === 0 && stats.autoHandled === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              Create Merged Version ({stats.reviewed + stats.autoHandled})
            </button>
          </div>
        </div>
        
        {/* Stats Summary */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Total Changes:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
            <span className="font-medium text-red-700">{stats.critical} Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span className="font-medium text-yellow-700">{stats.important} Important</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="font-medium text-green-700">{stats.autoHandled} Auto-handled</span>
          </div>
          <div className="ml-auto text-gray-600">
            Progress: {stats.reviewed}/{changesToReview.length} reviewed
          </div>
        </div>
      </div>
      
      {/* View Mode Explanation Banner */}
      {viewMode === 'split' && (
        <div className="border-b bg-yellow-50 p-3">
          <div className="max-w-4xl mx-auto text-sm text-yellow-800">
            <strong>Split View:</strong> Side-by-side comparison (Coming soon - currently shows unified view)
          </div>
        </div>
      )}
      {viewMode === 'focus' && (
        <div className="border-b bg-purple-50 p-3">
          <div className="max-w-4xl mx-auto text-sm text-purple-800">
            <strong>Focus Mode:</strong> Minimal distractions (Coming soon - currently shows unified view)
          </div>
        </div>
      )}
      
      {/* Settings Panel - NOW ALWAYS VISIBLE */}
      <div className="border-b bg-white p-4 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">🎛️ Smart Filtering & Rules</h3>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              {showSettings ? 'Hide Details ▲' : 'Show Details ▼'}
            </button>
          </div>
          
          {/* Quick Controls - Always Visible */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-300">
              <label className="text-sm font-semibold text-gray-900">Preset:</label>
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="px-2 py-1 text-sm border-0 bg-transparent focus:outline-none font-semibold text-blue-700"
              >
                {MERGE_PRESETS.map(preset => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => setShowRuleBuilder(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Sliders className="w-4 h-4 text-blue-700" />
              <span className="font-semibold text-gray-900">Custom Rules</span>
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                {customRules.length}
              </span>
            </button>
            
            <button
              onClick={() => setShowAutoHandled(!showAutoHandled)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              {showAutoHandled ? <EyeOff className="w-4 h-4 text-gray-900" /> : <Eye className="w-4 h-4 text-green-700" />}
              <span className="font-semibold text-gray-900">{showAutoHandled ? 'Hide' : 'Show'} Auto-handled</span>
              <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded">
                {stats.autoHandled}
              </span>
            </button>
          </div>
          
          {/* Expanded Details */}
          {showSettings && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
              <h4 className="text-sm font-bold text-gray-900 mb-2">Current Preset: {MERGE_PRESETS.find(p => p.id === selectedPresetId)?.name}</h4>
              <p className="text-sm text-gray-700 mb-3">
                {MERGE_PRESETS.find(p => p.id === selectedPresetId)?.description}
              </p>
              
              <div className="text-sm text-gray-900 space-y-1 bg-gray-50 p-3 rounded">
                <div><strong className="text-gray-900">Active Rules:</strong> {MERGE_PRESETS.find(p => p.id === selectedPresetId)?.rules.length} preset rules + {customRules.length} custom rules</div>
                <div><strong className="text-gray-900">Auto-handling:</strong> {stats.autoHandled} changes automatically accepted</div>
                <div><strong className="text-gray-900">Requires review:</strong> {changesToReview.length} changes</div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-800 mb-2">
                  <strong>💡 Tip:</strong> Click "Custom Rules" to create your own IF-THEN rules for specific types of changes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Critical Changes */}
          {criticalChanges.length > 0 && (
            <div className="border border-red-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setExpandedCategories(prev => ({ ...prev, critical: !prev.critical }))}
                className="w-full px-4 py-3 bg-red-50 flex items-center justify-between hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    🔴 CRITICAL CHANGES ({criticalChanges.length})
                  </h3>
                </div>
                {expandedCategories.critical ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedCategories.critical && (
                <div className="divide-y">
                  {criticalChanges.map((change, idx) => (
                    <ChangeCard 
                      key={change.id} 
                      change={change} 
                      index={idx + 1}
                      total={criticalChanges.length}
                      onAccept={handleAcceptChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Important Changes */}
          {importantChanges.length > 0 && (
            <div className="border border-yellow-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setExpandedCategories(prev => ({ ...prev, important: !prev.important }))}
                className="w-full px-4 py-3 bg-yellow-50 flex items-center justify-between hover:bg-yellow-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    🟡 IMPORTANT CHANGES ({importantChanges.length})
                  </h3>
                </div>
                {expandedCategories.important ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedCategories.important && (
                <div className="divide-y">
                  {importantChanges.map((change, idx) => (
                    <ChangeCard 
                      key={change.id} 
                      change={change} 
                      index={idx + 1}
                      total={importantChanges.length}
                      onAccept={handleAcceptChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Normal Changes */}
          {normalChanges.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setExpandedCategories(prev => ({ ...prev, normal: !prev.normal }))}
                className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    ⚪ NORMAL CHANGES ({normalChanges.length})
                  </h3>
                </div>
                {expandedCategories.normal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedCategories.normal && (
                <div className="divide-y">
                  {normalChanges.map((change, idx) => (
                    <ChangeCard 
                      key={change.id} 
                      change={change} 
                      index={idx + 1}
                      total={normalChanges.length}
                      onAccept={handleAcceptChange}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Auto-handled Changes */}
          {autoHandledChanges.length > 0 && showAutoHandled && (
            <div className="border border-green-200 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => setExpandedCategories(prev => ({ ...prev, autoHandled: !prev.autoHandled }))}
                className="w-full px-4 py-3 bg-green-50 flex items-center justify-between hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    ✅ AUTO-HANDLED ({autoHandledChanges.length})
                  </h3>
                  <span className="text-xs text-gray-600">
                    These changes were automatically accepted based on your rules
                  </span>
                </div>
                {expandedCategories.autoHandled ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              
              {expandedCategories.autoHandled && (
                <div className="p-4 text-sm text-gray-700">
                  <p className="mb-2">Rules applied:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {Array.from(new Set(autoHandledChanges.map(c => c.ruleApplied).filter(Boolean))).map(rule => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setExpandedCategories(prev => ({ ...prev, autoHandled: true }))}
                    className="mt-3 text-blue-600 hover:text-blue-800 text-xs"
                  >
                    Review These Anyway →
                  </button>
                </div>
              )}
            </div>
          )}
          
        </div>
      </div>
      
      {/* Rule Builder Modal */}
      {showRuleBuilder && (
        <RuleBuilder
          rules={customRules}
          onRulesChange={(newRules) => {
            setCustomRules(newRules);
            // TODO: Save to project config
          }}
          onClose={() => setShowRuleBuilder(false)}
        />
      )}
    </div>
  );
}

// Change Card Component
interface ChangeCardProps {
  change: ClassifiedChange;
  index: number;
  total: number;
  onAccept: (changeId: string, versionId: string) => void;
}

function ChangeCard({ change, index, total, onAccept }: ChangeCardProps) {
  const [selectedAltId, setSelectedAltId] = useState<string | undefined>(undefined);
  
  const handleSelect = (versionId: string) => {
    setSelectedAltId(versionId);
    onAccept(change.id, versionId);
  };
  
  const typeLabels: Record<ChangeType, string> = {
    'grammar': 'Grammar',
    'punctuation': 'Punctuation',
    'spelling': 'Spelling',
    'word-choice': 'Word Choice',
    'tone': 'Tone Change',
    'structure': 'Structure',
    'addition': 'New Content',
    'deletion': 'Deletion',
    'modification': 'Modification'
  };
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-gray-500">
            Change {index} of {total}
          </span>
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
            {typeLabels[change.type]}
          </span>
          <span className="text-xs text-gray-600">
            📍 {change.section}
          </span>
          {change.ruleApplied && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              🏷️ {change.ruleApplied}
            </span>
          )}
        </div>
        
        {change.comments && change.comments.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <MessageSquare className="w-3 h-3" />
            {change.comments.length} comments from Compare
          </div>
        )}
      </div>
      
      {/* Alternatives */}
      <div className="space-y-3">
        {change.alternatives.map((alt, idx) => (
          <div
            key={alt.versionId}
            onClick={() => handleSelect(alt.versionId)}
            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
              selectedAltId === alt.versionId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded border border-gray-300">
                  {idx + 1}
                </kbd>
                <span className="text-xs font-medium text-gray-700">
                  V{alt.versionNumber}
                </span>
                {alt.isManual && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Manual
                  </span>
                )}
                {!alt.isManual && (
                  <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI
                  </span>
                )}
              </div>
              
              {selectedAltId === alt.versionId && (
                <CheckCircle className="w-5 h-5 text-blue-600" />
              )}
            </div>
            
            <p className="text-sm text-gray-800 leading-relaxed">
              {alt.text || <em className="text-gray-400">(No content)</em>}
            </p>
          </div>
        ))}
      </div>
      
      {/* Impact Explanation */}
      {change.explanation && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-gray-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-700 mb-1">Why This Matters:</p>
              <p className="text-xs text-gray-600">{change.explanation}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Comments from Compare */}
      {change.comments && change.comments.length > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-blue-700 mb-1">Your Notes from Compare:</p>
              <div className="space-y-1">
                {change.comments.map((comment, idx) => (
                  <p key={idx} className="text-xs text-blue-800">• {comment}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

