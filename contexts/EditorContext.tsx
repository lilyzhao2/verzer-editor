'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Version, ChatMessage, EditorState, AIModel, ViewMode, Checkpoint } from '@/lib/types';

interface EditorContextType {
  state: EditorState;
  createVersion: (content: string, prompt: string | null, parentId?: string) => void;
  updateVersion: (versionId: string, content: string) => void;
  createCheckpoint: (versionId: string, content: string, type: 'auto-save' | 'manual') => void;
  revertToCheckpoint: (versionId: string, checkpointId: string) => void;
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
  // Always start with default state to avoid hydration mismatch
  const [state, setState] = useState<EditorState>(() => {
    const initialVersion: Version = {
      id: 'v0',
      number: '0',
      content: '',
      prompt: null,
      timestamp: new Date(),
      isOriginal: true,
      parentId: null,
      checkpoints: [],
    };

    return {
      versions: [initialVersion],
      currentVersionId: 'v0',
      compareVersionId: null,
      chatHistory: [],
      selectedModel: 'claude-3-5-haiku-20241022' as AIModel,
      viewMode: 'document' as ViewMode,
    };
  });

  // Load from localStorage after mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('editorState');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setState({
            ...parsed,
            versions: parsed.versions.map((v: any) => ({
              ...v,
              timestamp: new Date(v.timestamp),
              checkpoints: v.checkpoints || []
            })),
            chatHistory: parsed.chatHistory.map((c: any, index: number) => ({
              ...c,
              id: `msg-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(c.timestamp)
            })),
            selectedModel: parsed.selectedModel || 'claude-3-5-haiku-20241022',
            viewMode: parsed.viewMode || 'document'
          });
        } catch (error) {
          console.error('Failed to load state:', error);
        }
      }
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('editorState', JSON.stringify(state));
    }
  }, [state]);

  const createVersion = useCallback((content: string, prompt: string | null, parentId?: string) => {
    setState(prev => {
      // Determine parent: explicit parentId, or current version
      let parent: Version | undefined;
      let isRootLevelVersion = false;
      
      if (parentId === 'v0') {
        // Explicitly creating a root-level version
        parent = prev.versions[0];
        isRootLevelVersion = true;
      } else if (parentId) {
        parent = prev.versions.find(v => v.id === parentId);
      } else {
        parent = prev.versions.find(v => v.id === prev.currentVersionId);
      }
      
      // Generate hierarchical version number
      let newVersionNumber: string;
      let newVersionId: string;
      
      if (isRootLevelVersion || !parent || parent.isOriginal) {
        // Creating root-level version: v1, v2, v3...
        const rootVersions = prev.versions.filter(v => !v.number.includes('.'));
        newVersionNumber = rootVersions.length.toString();
      } else {
        // Creating branch: v2 → v2.1, v2.1 → v2.1.1
        const parentNumber = parent.number;
        const siblings = prev.versions.filter(v => 
          v.parentId === parent.id && v.number.startsWith(parentNumber + '.')
        );
        const nextChild = siblings.length + 1;
        newVersionNumber = `${parentNumber}.${nextChild}`;
      }
      
      newVersionId = `v${newVersionNumber}`;
      
      const newVersion: Version = {
        id: newVersionId,
        number: newVersionNumber,
        content,
        prompt,
        timestamp: new Date(),
        isOriginal: false,
        parentId: parent?.id || null,
        checkpoints: [],
      };

      const newChatMessage: ChatMessage | null = prompt ? {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        versionCreated: newVersionNumber,
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

  const createCheckpoint = useCallback((versionId: string, content: string, type: 'auto-save' | 'manual') => {
    setState(prev => ({
      ...prev,
      versions: prev.versions.map(v => {
        if (v.id === versionId) {
          const newCheckpoint: Checkpoint = {
            id: `cp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content,
            timestamp: new Date(),
            type,
          };
          return {
            ...v,
            content, // Update current content
            checkpoints: [...v.checkpoints, newCheckpoint],
          };
        }
        return v;
      }),
    }));
  }, []);

  const revertToCheckpoint = useCallback((versionId: string, checkpointId: string) => {
    setState(prev => ({
      ...prev,
      versions: prev.versions.map(v => {
        if (v.id === versionId) {
          const checkpoint = v.checkpoints.find(cp => cp.id === checkpointId);
          if (checkpoint) {
            return { ...v, content: checkpoint.content };
          }
        }
        return v;
      }),
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
      
      // Create the new version (createVersion will handle hierarchical numbering and chat history)
      createVersion(editedContent, prompt, currentVersion.id);
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
        createCheckpoint,
        revertToCheckpoint,
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
