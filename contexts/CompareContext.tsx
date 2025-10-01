'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

interface CompareContextType {
  selectedVersionsForCompare: string[];
  toggleVersionForCompare: (versionId: string) => void;
  clearCompareSelection: () => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [selectedVersionsForCompare, setSelectedVersionsForCompare] = useState<string[]>([]);

  const toggleVersionForCompare = useCallback((versionId: string) => {
    setSelectedVersionsForCompare(prev => {
      if (prev.includes(versionId)) {
        return prev.filter(id => id !== versionId);
      } else {
        // No limit - compare as many versions as you want
        return [...prev, versionId];
      }
    });
  }, []);

  const clearCompareSelection = useCallback(() => {
    setSelectedVersionsForCompare([]);
  }, []);

  return (
    <CompareContext.Provider
      value={{
        selectedVersionsForCompare,
        toggleVersionForCompare,
        clearCompareSelection,
      }}
    >
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}

