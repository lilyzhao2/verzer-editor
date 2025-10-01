'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { Clock, User, MessageSquare, GitBranch } from 'lucide-react';

interface ChangeTooltipProps {
  paragraphId: string;
  children: React.ReactNode;
}

export function ChangeTooltip({ paragraphId, children }: ChangeTooltipProps) {
  const { state, getParagraphLineage, getChangeMetadata } = useEditor();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const lineage = getParagraphLineage(state.currentVersionId);
  const paragraphLineage = lineage.find(p => p.id === paragraphId);
  const changeMetadata = getChangeMetadata(state.currentVersionId);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (tooltipRef.current && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setTooltipPosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    };

    if (showTooltip) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => document.removeEventListener('mousemove', handleMouseMove);
    }
  }, [showTooltip]);

  if (!paragraphLineage) {
    return <>{children}</>;
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      
      {showTooltip && (
        <div
          ref={tooltipRef}
          className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg max-w-xs pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-3 h-3" />
            <span className="font-semibold">Paragraph Lineage</span>
          </div>

          {/* User and Time */}
          <div className="flex items-center gap-2 mb-2 text-gray-300">
            <User className="w-3 h-3" />
            <span>{paragraphLineage.userName}</span>
            <Clock className="w-3 h-3 ml-2" />
            <span>{new Date(paragraphLineage.timestamp).toLocaleString()}</span>
          </div>

          {/* Prompt */}
          <div className="mb-2">
            <div className="flex items-center gap-1 mb-1">
              <MessageSquare className="w-3 h-3" />
              <span className="text-gray-300">Prompt:</span>
            </div>
            <div className="text-gray-200 bg-gray-800 p-2 rounded text-xs">
              {paragraphLineage.prompt.length > 100 
                ? paragraphLineage.prompt.substring(0, 100) + '...'
                : paragraphLineage.prompt
              }
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            {paragraphLineage.isLocked && (
              <span className="text-red-400 text-xs">🔒 Locked</span>
            )}
            <span className="text-gray-400 text-xs">
              Click for version tree
            </span>
          </div>

          {/* Arrow */}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}
