'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { useCompare } from '@/contexts/CompareContext';
import { Version } from '@/lib/types';
import { ChevronDown, ChevronRight, Circle, CheckCircle } from 'lucide-react';

interface TreeNode {
  version: Version;
  children: TreeNode[];
  depth: number;
}

export function VersionTree() {
  const { state, setCurrentVersion } = useEditor();
  const { selectedVersionsForCompare, toggleVersionForCompare } = useCompare();
  // Initialize with all nodes expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    return new Set(state.versions.map(v => v.id));
  });

  // Build tree structure from versions using parentId
  const buildTree = (): TreeNode => {
    const root: TreeNode = {
      version: state.versions[0],
      children: [],
      depth: 0
    };

    const nodeMap = new Map<string, TreeNode>();
    nodeMap.set(state.versions[0].id, root);

    // Build nodes for all versions
    state.versions.slice(1).forEach(version => {
      const parentNode = nodeMap.get(version.parentId || 'v0');
      if (parentNode) {
        const newNode: TreeNode = {
          version,
          children: [],
          depth: parentNode.depth + 1
        };
        parentNode.children.push(newNode);
        nodeMap.set(version.id, newNode);
      }
    });

    return root;
  };

  const tree = buildTree();

  const toggleNode = (versionId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(versionId)) {
        newSet.delete(versionId);
      } else {
        newSet.add(versionId);
      }
      return newSet;
    });
  };

  const renderNode = (node: TreeNode, isLast: boolean = false): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.version.id);
    const hasChildren = node.children.length > 0;
    const isCurrent = state.currentVersionId === node.version.id;
    const isSelectedForCompare = selectedVersionsForCompare.includes(node.version.id);
    const isManualEdit = node.version.prompt?.includes('Manual edit');
    const isAIEdit = node.version.prompt && !isManualEdit;

    return (
      <div key={node.version.id} className="relative">
        {/* Node */}
        <div className="flex items-start gap-2 group">
          {/* Tree Lines */}
          <div className="flex items-center pt-2">
            {node.depth > 0 && (
              <>
                {/* Horizontal line */}
                <div className="w-4 h-px bg-gray-300"></div>
              </>
            )}
            
            {/* Expand/Collapse Button */}
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.version.id)}
                className="w-5 h-5 flex items-center justify-center hover:bg-gray-200 rounded transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </button>
            ) : (
              <Circle className="w-2 h-2 text-gray-400 ml-1.5" />
            )}
          </div>

          {/* Version Card */}
          <div className="flex-1 flex gap-2">
            <button
              onClick={() => setCurrentVersion(node.version.id)}
              className={`flex-1 text-left p-3 rounded-lg border-2 transition-all ${
                isCurrent
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
              }`}
            >
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}>
                v{node.version.number}
              </span>
              
              {node.version.isOriginal && (
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  Original
                </span>
              )}
              
              {isManualEdit && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  ✏️ Manual
                </span>
              )}
              
              {isAIEdit && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  🤖 AI
                </span>
              )}

              {isCurrent && (
                <CheckCircle className="w-4 h-4 text-blue-600 ml-auto" />
              )}
            </div>
            
            {node.version.prompt && (
              <p className="text-xs text-gray-700 line-clamp-2">
                {node.version.prompt}
              </p>
            )}
            
            <p className="text-xs text-gray-500 mt-1">
              {new Date(node.version.timestamp).toLocaleString()}
            </p>
          </button>
          
          {/* Compare Mode: Add to comparison button */}
          {state.viewMode === 'compare' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleVersionForCompare(node.version.id);
              }}
              className={`px-2 py-1 text-xs rounded transition-all ${
                isSelectedForCompare
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title={isSelectedForCompare ? 'Remove from comparison' : 'Add to comparison'}
            >
              {isSelectedForCompare ? '✓' : '+'}
            </button>
          )}
        </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-6 mt-2 space-y-2 border-l-2 border-gray-200 pl-2">
            {node.children.map((child, idx) => 
              renderNode(child, idx === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-2">
      {renderNode(tree)}
    </div>
  );
}


