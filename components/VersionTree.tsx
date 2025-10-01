'use client';

import React, { useState } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { useCompare } from '@/contexts/CompareContext';
import { Version } from '@/lib/types';
import { ChevronDown, ChevronRight, Circle, CheckCircle, Star, Filter, Eye, EyeOff, ExternalLink, Archive } from 'lucide-react';

interface TreeNode {
  version: Version;
  children: TreeNode[];
  depth: number;
}

export function VersionTree() {
  const { state, setCurrentVersion, toggleVersionStar, toggleVersionArchive, openTab } = useEditor();
  const { selectedVersionsForCompare, toggleVersionForCompare } = useCompare();
  // Initialize with all nodes expanded
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    return new Set(state.versions.map(v => v.id));
  });
  
  // No filters in the tree view anymore - they're in parallel view

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

  const renderNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.version.id);
    const hasChildren = node.children.length > 0;
    const isCurrent = state.currentVersionId === node.version.id;
    const isSelectedForCompare = selectedVersionsForCompare.includes(node.version.id);
    const isManualEdit = node.version.prompt?.startsWith('✏️') || node.version.prompt?.startsWith('📝');
    const isAuditedAI = node.version.prompt?.startsWith('🤝');
    const isRejectedAI = node.version.prompt?.startsWith('❌');
    const isAIEdit = node.version.prompt && !isManualEdit && !isAuditedAI && !isRejectedAI;

    // No filtering in tree view - show all versions

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
            <div
              onClick={() => setCurrentVersion(node.version.id)}
              onDoubleClick={() => {
                // If in parallel view, open in new tab
                if (state.viewMode === 'parallel') {
                  openTab(node.version.id);
                }
              }}
              className={`flex-1 text-left p-3 rounded-lg border-2 transition-all cursor-pointer ${
                node.version.isArchived
                  ? 'opacity-50 border-gray-300 bg-gray-50'
                  : isCurrent
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
                <span className="text-xs bg-gray-100 text-black px-2 py-0.5 rounded">
                  Original
                </span>
              )}
              
              {isManualEdit && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  ✏️ Manual
                </span>
              )}
              
              {isAuditedAI && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  🤝 AI+Human
                </span>
              )}
              
              {isRejectedAI && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                  ❌ Rejected
                </span>
              )}
              
              {isAIEdit && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  🤖 AI
                </span>
              )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openTab(node.version.id);
            }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVersionStar(node.version.id);
            }}
            className={`p-1 rounded hover:bg-gray-100 ${
              node.version.isStarred ? 'text-yellow-500' : 'text-gray-400'
            }`}
            title={node.version.isStarred ? "Unstar version" : "Star version"}
          >
            <Star className={`w-4 h-4 ${node.version.isStarred ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleVersionArchive(node.version.id);
            }}
            className={`p-1 rounded hover:bg-gray-100 ${
              node.version.isArchived ? 'text-red-500' : 'text-gray-400'
            }`}
            title={node.version.isArchived ? "Restore version" : "Archive version"}
          >
            <Archive className="w-4 h-4" />
          </button>
          {isCurrent && (
            <CheckCircle className="w-4 h-4 text-blue-600" />
          )}
        </div>
            </div>
            
            {node.version.prompt && (
              <p className="text-xs text-black line-clamp-2">
                {node.version.prompt}
              </p>
            )}
            
            {node.version.note && (
              <p className="text-xs text-blue-600 italic mt-1">
                📝 {node.version.note}
              </p>
            )}
            
            <p className="text-xs text-black mt-1">
              {new Date(node.version.timestamp).toLocaleString()}
            </p>
          </div>
          
          {/* Iterate Mode: Add to comparison button */}
          {state.viewMode === 'iterate' && (
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
            {node.children.map((child) => 
              renderNode(child)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Version Tree - No filters, just the tree */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {renderNode(tree)}
      </div>
    </div>
  );
}


