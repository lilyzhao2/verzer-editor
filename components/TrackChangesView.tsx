'use client';

import React, { useState, useMemo } from 'react';
import { Change } from 'diff';
import { Check, X } from 'lucide-react';

interface TrackChangesViewProps {
  changes: Change[];
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onAcceptChange: (index: number) => void;
  onRejectChange: (index: number) => void;
}

export function TrackChangesView({
  changes,
  onAcceptAll,
  onRejectAll,
  onAcceptChange,
  onRejectChange,
}: TrackChangesViewProps) {
  const [acceptedChanges, setAcceptedChanges] = useState<Set<number>>(new Set());
  const [rejectedChanges, setRejectedChanges] = useState<Set<number>>(new Set());
  const [hoveredChange, setHoveredChange] = useState<number | null>(null);

  // Calculate stats
  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    changes.forEach(change => {
      if (change.added) additions++;
      if (change.removed) deletions++;
    });
    return { additions, deletions, total: additions + deletions };
  }, [changes]);

  const handleAccept = (index: number) => {
    setAcceptedChanges(prev => new Set([...prev, index]));
    setRejectedChanges(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    onAcceptChange(index);
  };

  const handleReject = (index: number) => {
    setRejectedChanges(prev => new Set([...prev, index]));
    setAcceptedChanges(prev => {
      const next = new Set(prev);
      next.delete(index);
      return next;
    });
    onRejectChange(index);
  };

  const handleAcceptAll = () => {
    const allChangeIndexes = new Set<number>();
    changes.forEach((_, index) => {
      if (changes[index].added || changes[index].removed) {
        allChangeIndexes.add(index);
      }
    });
    setAcceptedChanges(allChangeIndexes);
    setRejectedChanges(new Set());
    onAcceptAll();
  };

  const handleRejectAll = () => {
    const allChangeIndexes = new Set<number>();
    changes.forEach((_, index) => {
      if (changes[index].added || changes[index].removed) {
        allChangeIndexes.add(index);
      }
    });
    setRejectedChanges(allChangeIndexes);
    setAcceptedChanges(new Set());
    onRejectAll();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with stats and actions */}
      <div className="bg-blue-50 border-b border-blue-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Track Changes</h3>
            <p className="text-sm text-gray-600 mt-1">
              {stats.additions} addition{stats.additions !== 1 ? 's' : ''}, {stats.deletions} deletion{stats.deletions !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Accept All
            </button>
            <button
              onClick={handleRejectAll}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Reject All
            </button>
          </div>
        </div>
      </div>

      {/* Document content with inline changes */}
      <div className="flex-1 overflow-auto p-8 bg-white">
        <div className="max-w-4xl mx-auto prose prose-lg">
          {changes.map((change, index) => {
            const isAccepted = acceptedChanges.has(index);
            const isRejected = rejectedChanges.has(index);
            const isHovered = hoveredChange === index;

            if (!change.added && !change.removed) {
              // Unchanged text
              return (
                <span key={index} className="text-gray-900">
                  {change.value}
                </span>
              );
            }

            if (change.removed) {
              // Deletion
              return (
                <span
                  key={index}
                  className={`relative inline-block group ${
                    isRejected
                      ? 'opacity-30 line-through'
                      : isAccepted
                      ? 'hidden'
                      : 'bg-red-100 text-red-800 line-through px-1 rounded'
                  }`}
                  onMouseEnter={() => setHoveredChange(index)}
                  onMouseLeave={() => setHoveredChange(null)}
                >
                  {change.value}
                  {!isAccepted && !isRejected && (
                    <span className="inline-flex gap-0.5 ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleAccept(index)}
                        className="p-0.5 hover:bg-green-200 rounded text-green-700 text-xs"
                        title="Keep deletion"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleReject(index)}
                        className="p-0.5 hover:bg-red-200 rounded text-red-700 text-xs"
                        title="Restore text"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </span>
              );
            }

            if (change.added) {
              // Addition
              return (
                <span
                  key={index}
                  className={`relative inline-block group ${
                    isRejected
                      ? 'hidden'
                      : isAccepted
                      ? 'bg-green-50 text-green-900'
                      : 'bg-green-200 text-green-900 font-semibold px-1 rounded'
                  }`}
                  onMouseEnter={() => setHoveredChange(index)}
                  onMouseLeave={() => setHoveredChange(null)}
                >
                  {change.value}
                  {!isAccepted && !isRejected && (
                    <span className="inline-flex gap-0.5 ml-1 opacity-50 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleAccept(index)}
                        className="p-0.5 hover:bg-green-300 rounded text-green-800 text-xs font-bold"
                        title="Accept addition"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleReject(index)}
                        className="p-0.5 hover:bg-red-200 rounded text-red-700 text-xs font-bold"
                        title="Reject addition"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </span>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
