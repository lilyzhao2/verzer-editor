'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { MergeRule, ChangeType, ImpactLevel } from '@/lib/smartMergeTypes';

interface RuleBuilderProps {
  rules: MergeRule[];
  onRulesChange: (rules: MergeRule[]) => void;
  onClose: () => void;
}

export function RuleBuilder({ rules, onRulesChange, onClose }: RuleBuilderProps) {
  const [editingRule, setEditingRule] = useState<MergeRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  const createNewRule = (): MergeRule => ({
    id: `custom-${Date.now()}`,
    name: 'New Rule',
    enabled: true,
    priority: rules.length + 1,
    conditions: {},
    action: {
      type: 'show'
    }
  });
  
  const handleAddRule = () => {
    setEditingRule(createNewRule());
    setIsCreating(true);
  };
  
  const handleSaveRule = () => {
    if (!editingRule) return;
    
    if (isCreating) {
      onRulesChange([...rules, editingRule]);
    } else {
      onRulesChange(rules.map(r => r.id === editingRule.id ? editingRule : r));
    }
    
    setEditingRule(null);
    setIsCreating(false);
  };
  
  const handleDeleteRule = (ruleId: string) => {
    onRulesChange(rules.filter(r => r.id !== ruleId));
  };
  
  const handleToggleRule = (ruleId: string) => {
    onRulesChange(rules.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Custom Merge Rules</h2>
            <p className="text-sm text-gray-600 mt-1">
              Create rules to automatically handle specific types of changes
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Rules List */}
          <div className="space-y-4 mb-6">
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className={`border rounded-lg p-4 ${
                  rule.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => handleToggleRule(rule.id)}
                        className="rounded border-gray-300"
                      />
                      <h3 className="font-medium text-gray-900">{rule.name}</h3>
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    
                    <div className="ml-7 space-y-1 text-sm text-gray-600">
                      {/* Show conditions */}
                      {rule.conditions.changeType && (
                        <div>
                          <span className="font-medium">Types:</span>{' '}
                          {rule.conditions.changeType.join(', ')}
                        </div>
                      )}
                      {rule.conditions.length && (
                        <div>
                          <span className="font-medium">Length:</span>{' '}
                          {rule.conditions.length.operator} {rule.conditions.length.value} {rule.conditions.length.unit}
                        </div>
                      )}
                      {rule.conditions.semanticShift !== undefined && (
                        <div>
                          <span className="font-medium">Semantic shift:</span>{' '}
                          {rule.conditions.semanticShift ? 'Yes' : 'No'}
                        </div>
                      )}
                      
                      {/* Show action */}
                      <div>
                        <span className="font-medium">Action:</span>{' '}
                        {rule.action.type === 'auto-accept' && `Auto-accept from ${rule.action.preferVersion}`}
                        {rule.action.type === 'show' && `Show${rule.action.setPriority ? ` as ${rule.action.setPriority}` : ''}`}
                        {rule.action.type === 'hide' && 'Hide'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setIsCreating(false);
                      }}
                      className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Add Rule Button */}
          <button
            onClick={handleAddRule}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New Rule
          </button>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {rules.length} custom rule{rules.length !== 1 ? 's' : ''}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
      
      {/* Rule Editor Modal */}
      {editingRule && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                {isCreating ? 'Create New Rule' : 'Edit Rule'}
              </h3>
              
              {/* Rule Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Auto-accept grammar fixes"
                />
              </div>
              
              {/* Conditions */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">IF (Conditions):</h4>
                
                {/* Change Type */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Change Types (select multiple):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['grammar', 'punctuation', 'spelling', 'word-choice', 'tone', 'structure', 'addition', 'deletion', 'modification'].map((type) => (
                      <label key={type} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editingRule.conditions.changeType?.includes(type as ChangeType)}
                          onChange={(e) => {
                            const current = editingRule.conditions.changeType || [];
                            setEditingRule({
                              ...editingRule,
                              conditions: {
                                ...editingRule.conditions,
                                changeType: e.target.checked
                                  ? [...current, type as ChangeType]
                                  : current.filter(t => t !== type)
                              }
                            });
                          }}
                          className="rounded border-gray-300"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Length Condition */}
                <div className="mb-3">
                  <label className="flex items-center gap-2 text-sm mb-2">
                    <input
                      type="checkbox"
                      checked={!!editingRule.conditions.length}
                      onChange={(e) => {
                        setEditingRule({
                          ...editingRule,
                          conditions: {
                            ...editingRule.conditions,
                            length: e.target.checked
                              ? { operator: '<', value: 5, unit: 'words' }
                              : undefined
                          }
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium text-gray-700">Length condition</span>
                  </label>
                  
                  {editingRule.conditions.length && (
                    <div className="ml-6 flex items-center gap-2">
                      <select
                        value={editingRule.conditions.length.operator}
                        onChange={(e) => {
                          setEditingRule({
                            ...editingRule,
                            conditions: {
                              ...editingRule.conditions,
                              length: {
                                ...editingRule.conditions.length!,
                                operator: e.target.value as any
                              }
                            }
                          });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="<">less than</option>
                        <option value=">">greater than</option>
                        <option value="<=">less than or equal</option>
                        <option value=">=">greater than or equal</option>
                        <option value="=">equal to</option>
                      </select>
                      
                      <input
                        type="number"
                        value={editingRule.conditions.length.value}
                        onChange={(e) => {
                          setEditingRule({
                            ...editingRule,
                            conditions: {
                              ...editingRule.conditions,
                              length: {
                                ...editingRule.conditions.length!,
                                value: parseInt(e.target.value)
                              }
                            }
                          });
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      
                      <select
                        value={editingRule.conditions.length.unit}
                        onChange={(e) => {
                          setEditingRule({
                            ...editingRule,
                            conditions: {
                              ...editingRule.conditions,
                              length: {
                                ...editingRule.conditions.length!,
                                unit: e.target.value as 'words' | 'characters'
                              }
                            }
                          });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="words">words</option>
                        <option value="characters">characters</option>
                      </select>
                    </div>
                  )}
                </div>
                
                {/* Semantic Shift */}
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editingRule.conditions.semanticShift === true}
                      onChange={(e) => {
                        setEditingRule({
                          ...editingRule,
                          conditions: {
                            ...editingRule.conditions,
                            semanticShift: e.target.checked ? true : undefined
                          }
                        });
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium text-gray-700">Has semantic/tone shift</span>
                  </label>
                </div>
              </div>
              
              {/* Action */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">THEN (Action):</h4>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingRule.action.type === 'auto-accept'}
                      onChange={() => {
                        setEditingRule({
                          ...editingRule,
                          action: {
                            type: 'auto-accept',
                            preferVersion: 'ai'
                          }
                        });
                      }}
                      className="rounded-full border-gray-300"
                    />
                    <span className="text-sm">Auto-accept from:</span>
                    {editingRule.action.type === 'auto-accept' && (
                      <select
                        value={editingRule.action.preferVersion}
                        onChange={(e) => {
                          setEditingRule({
                            ...editingRule,
                            action: {
                              ...editingRule.action,
                              preferVersion: e.target.value as any
                            }
                          });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="ai">AI version</option>
                        <option value="manual">Manual version</option>
                        <option value="selected">Selected version</option>
                      </select>
                    )}
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingRule.action.type === 'show'}
                      onChange={() => {
                        setEditingRule({
                          ...editingRule,
                          action: {
                            type: 'show'
                          }
                        });
                      }}
                      className="rounded-full border-gray-300"
                    />
                    <span className="text-sm">Show me with priority:</span>
                    {editingRule.action.type === 'show' && (
                      <select
                        value={editingRule.action.setPriority || ''}
                        onChange={(e) => {
                          setEditingRule({
                            ...editingRule,
                            action: {
                              ...editingRule.action,
                              setPriority: e.target.value ? e.target.value as ImpactLevel : undefined
                            }
                          });
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Normal (no change)</option>
                        <option value="critical">Critical</option>
                        <option value="important">Important</option>
                        <option value="normal">Normal</option>
                      </select>
                    )}
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={editingRule.action.type === 'hide'}
                      onChange={() => {
                        setEditingRule({
                          ...editingRule,
                          action: {
                            type: 'hide'
                          }
                        });
                      }}
                      className="rounded-full border-gray-300"
                    />
                    <span className="text-sm">Hide completely</span>
                  </label>
                </div>
              </div>
              
              {/* Buttons */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setEditingRule(null);
                    setIsCreating(false);
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRule}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Check className="w-4 h-4" />
                  {isCreating ? 'Create Rule' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

