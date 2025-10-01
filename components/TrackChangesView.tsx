'use client';

import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

interface TrackChangesViewProps {
  originalContent: string;
  editedContent: string;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptPartial: (acceptedContent: string) => void;
}

export function TrackChangesView({ 
  originalContent, 
  editedContent, 
  onAcceptAll, 
  onRejectAll,
  onAcceptPartial 
}: TrackChangesViewProps) {
  
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Simple Preview of AI Edit */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              AI has suggested edits to your document
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Review the changes below and choose to accept or reject them
            </p>
          </div>
          
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: editedContent }}
          />
        </div>
      </div>

      {/* Simple Action Buttons */}
      <div className="bg-gray-50 border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-end gap-3">
          <button
            onClick={onRejectAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={onAcceptAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}