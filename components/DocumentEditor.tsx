'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { computeDiff } from '@/lib/diff-utils';
import { Check, X, CheckCircle } from 'lucide-react';

export function DocumentEditor() {
  const { updateVersion, getCurrentVersion, getCompareVersion, createVersion } = useEditor();
  const currentVersion = getCurrentVersion();
  const compareVersion = getCompareVersion();
  const [localContent, setLocalContent] = useState(currentVersion?.content || '');
  const [acceptedChanges, setAcceptedChanges] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLocalContent(currentVersion?.content || '');
    setAcceptedChanges(new Set());
  }, [currentVersion]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    if (currentVersion) {
      updateVersion(currentVersion.id, newContent);
    }
  };

  const handleAcceptChange = (index: number) => {
    setAcceptedChanges(prev => new Set(prev).add(index));
  };

  const handleRejectChange = (index: number) => {
    setAcceptedChanges(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
  };

  const handleAcceptAll = () => {
    if (compareVersion) {
      createVersion(compareVersion.content, `Accepted all changes from v${compareVersion.number}`);
      setAcceptedChanges(new Set());
    }
  };

  const renderDiffView = () => {
    if (!currentVersion || !compareVersion) return null;
    
    const diffs = computeDiff(currentVersion.content, compareVersion.content);
    let changeIndex = 0;

    return (
      <div className="p-6 bg-white rounded-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">
            Comparing v{currentVersion.number} → v{compareVersion.number}
          </h3>
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Accept All Changes
          </button>
        </div>
        
        <div className="prose max-w-none">
          {diffs.map((diff, index) => {
            const currentChangeIndex = diff.type !== 'unchanged' ? changeIndex++ : -1;
            
            if (diff.type === 'unchanged') {
              return <span key={index}>{diff.text}</span>;
            } else if (diff.type === 'deletion') {
              return (
                <span
                  key={index}
                  className="relative inline-block bg-red-50 text-red-700 line-through decoration-2 px-1 rounded"
                >
                  {diff.text}
                  <button
                    onClick={() => handleRejectChange(currentChangeIndex)}
                    className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-red-600 text-white rounded hover:bg-red-700"
                    title="Keep this text"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            } else {
              return (
                <span
                  key={index}
                  className="relative inline-block bg-green-50 text-green-700 underline decoration-2 px-1 rounded"
                >
                  {diff.text}
                  <button
                    onClick={() => handleAcceptChange(currentChangeIndex)}
                    className="ml-1 inline-flex items-center justify-center w-5 h-5 bg-green-600 text-white rounded hover:bg-green-700"
                    title="Accept this addition"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </span>
              );
            }
          })}
        </div>
      </div>
    );
  };

  if (compareVersion) {
    return renderDiffView();
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-3 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Version {currentVersion?.number} 
            {currentVersion?.isOriginal && ' (Original)'}
          </h2>
          <span className="text-sm text-gray-500">
            {currentVersion?.timestamp && new Date(currentVersion.timestamp).toLocaleString()}
          </span>
        </div>
        {currentVersion?.prompt && (
          <p className="mt-1 text-sm text-gray-600">
            Created from: &ldquo;{currentVersion.prompt}&rdquo;
          </p>
        )}
      </div>
      
      <div className="flex-1 p-6">
        <textarea
          value={localContent}
          onChange={handleTextChange}
          placeholder="Start writing your document here..."
          className="w-full h-full p-4 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-sans text-gray-800 leading-relaxed"
          style={{ minHeight: '500px' }}
        />
      </div>
    </div>
  );
}
