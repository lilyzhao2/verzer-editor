'use client';

import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';

export function ClearDataButton() {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = () => {
    // Clear localStorage
    localStorage.removeItem('editorState');
    // Reload the page to reset everything
    window.location.reload();
  };

  if (showConfirm) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <h3 className="text-lg font-semibold">Clear All Data?</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            This will delete all versions, chat history, and reset the editor to its initial state. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Clear Everything
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-2 px-3 py-1.5 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm"
      title="Clear all data and reset"
    >
      <Trash2 className="w-4 h-4" />
      Clear Data
    </button>
  );
}
