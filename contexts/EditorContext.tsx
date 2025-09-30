'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Version, ChatMessage, EditorState, AIModel, ViewMode } from '@/lib/types';

interface EditorContextType {
  state: EditorState;
  createVersion: (content: string, prompt: string | null) => void;
  updateVersion: (versionId: string, content: string) => void;
  setCurrentVersion: (versionId: string) => void;
  setCompareVersion: (versionId: string | null) => void;
  getCurrentVersion: () => Version | undefined;
  getCompareVersion: () => Version | undefined;
  applyAIEdit: (prompt: string) => Promise<void>;
  setSelectedModel: (model: AIModel) => void;
  setViewMode: (mode: ViewMode) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EditorState>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('editorState');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        return {
          ...parsed,
          versions: parsed.versions.map((v: any) => ({
            ...v,
            timestamp: new Date(v.timestamp)
          })),
          chatHistory: parsed.chatHistory.map((c: any, index: number) => ({
            ...c,
            id: `msg-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(c.timestamp)
          })),
          selectedModel: parsed.selectedModel || 'claude-3-5-haiku-20241022',
          viewMode: parsed.viewMode || 'chat'
        };
      }
    }

    // Default initial state with empty document
    const initialVersion: Version = {
      id: 'v0',
      number: 0,
      content: '',
      prompt: null,
      timestamp: new Date(),
      isOriginal: true,
    };

    return {
      versions: [initialVersion],
      currentVersionId: 'v0',
      compareVersionId: null,
      chatHistory: [],
      selectedModel: 'claude-3-5-haiku-20241022' as AIModel,
      viewMode: 'chat' as ViewMode,
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('editorState', JSON.stringify(state));
    }
  }, [state]);

  const createVersion = useCallback((content: string, prompt: string | null) => {
    setState(prev => {
      const versionNumber = prev.versions.length;
      const newVersion: Version = {
        id: `v${versionNumber}`,
        number: versionNumber,
        content,
        prompt,
        timestamp: new Date(),
        isOriginal: false,
      };

      const newChatMessage: ChatMessage | null = prompt ? {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        versionCreated: versionNumber,
        timestamp: new Date(),
      } : null;

      return {
        ...prev,
        versions: [...prev.versions, newVersion],
        currentVersionId: newVersion.id,
        chatHistory: newChatMessage ? [...prev.chatHistory, newChatMessage] : prev.chatHistory,
      };
    });
  }, []);

  const updateVersion = useCallback((versionId: string, content: string) => {
    setState(prev => ({
      ...prev,
      versions: prev.versions.map(v =>
        v.id === versionId ? { ...v, content } : v
      ),
    }));
  }, []);

  const setCurrentVersion = useCallback((versionId: string) => {
    setState(prev => ({
      ...prev,
      currentVersionId: versionId,
    }));
  }, []);

  const setCompareVersion = useCallback((versionId: string | null) => {
    setState(prev => ({
      ...prev,
      compareVersionId: versionId,
    }));
  }, []);

  const getCurrentVersion = useCallback(() => {
    return state.versions.find(v => v.id === state.currentVersionId);
  }, [state]);

  const getCompareVersion = useCallback(() => {
    if (!state.compareVersionId) return undefined;
    return state.versions.find(v => v.id === state.compareVersionId);
  }, [state]);

  const setSelectedModel = useCallback((model: AIModel) => {
    setState(prev => ({
      ...prev,
      selectedModel: model,
    }));
  }, []);

  const applyAIEdit = useCallback(async (prompt: string) => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return;

    try {
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          content: currentVersion.content,
          model: state.selectedModel,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get AI response');
      }

      const { editedContent, explanation } = await response.json();
      
      // Create the new version
      createVersion(editedContent, prompt);
      
      // Add to chat history with the explanation
      const newChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        response: explanation || 'Changes applied successfully.',
        versionCreated: state.versions.length, // This will be the new version number
        timestamp: new Date(),
      };
      
      setState(prev => ({
        ...prev,
        chatHistory: [...prev.chatHistory, newChatMessage],
      }));
    } catch (error) {
      console.error('Error applying AI edit:', error);
      throw error;
    }
  }, [getCurrentVersion, createVersion, state.selectedModel]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);

  return (
    <EditorContext.Provider
      value={{
        state,
        createVersion,
        updateVersion,
        setCurrentVersion,
        setCompareVersion,
        getCurrentVersion,
        getCompareVersion,
        applyAIEdit,
        setSelectedModel,
        setViewMode,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditor() {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}
