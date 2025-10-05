'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Version, ChatMessage, DocumentMode, VersionState, TrackedChange } from '@/lib/types';
import { analyzeDiff } from '@/lib/diffAnalysis';

interface EditorStateV2 {
  // Document
  documentName: string;
  
  // Versions
  versions: Version[];
  currentVersionId: string;
  
  // Editing mode
  documentMode: DocumentMode;
  workingContent: string; // Current unsaved content
  stagedChanges: TrackedChange[]; // Changes pending review in tracking mode
  
  // Chat
  chatHistory: ChatMessage[];
  
  // Alternatives (for Diff & Regenerate)
  alternatives: Version[]; // Alternative versions for comparison
  
  // Settings
  trackUserEdits: boolean; // Track user changes in tracking mode
  
  // Debug
  debugMode: boolean;
}

interface EditorContextTypeV2 {
  state: EditorStateV2;
  
  // Version management
  createVersion: (content: string, prompt: string | null, versionState?: VersionState) => string;
  updateVersion: (versionId: string, content: string, markAsEdited?: boolean) => void;
  setCurrentVersion: (versionId: string) => void;
  getCurrentVersion: () => Version | undefined;
  getPreviousVersion: () => Version | undefined;
  toggleVersionArchive: (versionId: string) => void;
  
  // Content editing
  setWorkingContent: (content: string) => void;
  
  // Mode management
  setDocumentMode: (mode: DocumentMode) => void;
  
  // AI chat
  sendChatMessage: (prompt: string) => Promise<void>;
  acceptAllChanges: () => void;
  rejectAndRegenerate: () => Promise<void>;
  generateAlternatives: (count?: number) => Promise<void>;
  
  // Settings
  setDocumentName: (name: string) => void;
  setTrackUserEdits: (enabled: boolean) => void;
  toggleDebugMode: () => void;
  clearEverything: () => void;
}

const EditorContextV2 = createContext<EditorContextTypeV2 | undefined>(undefined);

export function EditorProviderV2({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EditorStateV2>(() => {
    // Default state
    const initialVersion: Version = {
      id: 'v0',
      number: '0',
      content: '<p>Start writing your document here...</p>',
      prompt: null,
      note: 'Initial version',
      timestamp: new Date(),
      isOriginal: true,
      parentId: null,
      checkpoints: [],
      versionState: 'reviewed', // V0 is always finalized
    };

    return {
      documentName: 'Untitled Document',
      versions: [initialVersion],
      currentVersionId: 'v0',
      documentMode: 'editing',
      workingContent: initialVersion.content,
      stagedChanges: [],
      chatHistory: [],
      alternatives: [],
      trackUserEdits: true,
      debugMode: false,
    };
  });

  // Load from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('verzer-editor-v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        parsed.versions = parsed.versions.map((v: any) => ({
          ...v,
          timestamp: new Date(v.timestamp),
        }));
        parsed.chatHistory = parsed.chatHistory.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setState(parsed);
      } catch (error) {
        console.error('Failed to load saved state:', error);
      }
    }
  }, []);

  // Save to localStorage on state change
  useEffect(() => {
    localStorage.setItem('verzer-editor-v2', JSON.stringify(state));
  }, [state]);

  // Get current version
  const getCurrentVersion = useCallback(() => {
    return state.versions.find((v) => v.id === state.currentVersionId);
  }, [state.versions, state.currentVersionId]);

  // Get previous version (for comparison)
  const getPreviousVersion = useCallback(() => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion || !currentVersion.parentId) return undefined;
    return state.versions.find((v) => v.id === currentVersion.parentId);
  }, [state.versions, getCurrentVersion]);

  // Create new version
  const createVersion = useCallback(
    (content: string, prompt: string | null, versionState: VersionState = 'ai-created'): string => {
      const currentVersion = getCurrentVersion();
      const nextNumber = String(state.versions.length);
      
      const newVersion: Version = {
        id: `v${nextNumber}`,
        number: nextNumber,
        content,
        prompt,
        note: prompt ? `AI: ${prompt.slice(0, 50)}...` : 'Manual edit',
        timestamp: new Date(),
        isOriginal: false,
        parentId: currentVersion?.id || null,
        checkpoints: [],
        versionState,
        aiEditedContent: versionState === 'ai-created' ? content : undefined,
      };

      setState((prev) => ({
        ...prev,
        versions: [...prev.versions, newVersion],
        currentVersionId: newVersion.id,
        workingContent: content,
      }));

      return newVersion.id;
    },
    [state.versions, getCurrentVersion]
  );

  // Update version content
  const updateVersion = useCallback((versionId: string, content: string, markAsEdited: boolean = true) => {
    setState((prev) => ({
      ...prev,
      versions: prev.versions.map((v) =>
        v.id === versionId
          ? { ...v, content, hasUserEdits: markAsEdited ? true : v.hasUserEdits }
          : v
      ),
      workingContent: content,
    }));
  }, []);

  // Set current version
  const setCurrentVersion = useCallback((versionId: string) => {
    const version = state.versions.find((v) => v.id === versionId);
    if (version) {
      setState((prev) => ({
        ...prev,
        currentVersionId: versionId,
        workingContent: version.content,
      }));
    }
  }, [state.versions]);

  // Toggle version archive
  const toggleVersionArchive = useCallback((versionId: string) => {
    setState((prev) => ({
      ...prev,
      versions: prev.versions.map((v) =>
        v.id === versionId ? { ...v, isArchived: !v.isArchived } : v
      ),
    }));
  }, []);

  // Set working content
  const setWorkingContent = useCallback((content: string) => {
    setState((prev) => ({
      ...prev,
      workingContent: content,
    }));
  }, []);

  // Set document mode (just a view switch, no confirmation)
  const setDocumentMode = useCallback((mode: DocumentMode) => {
    setState((prev) => ({
      ...prev,
      documentMode: mode,
    }));
  }, []);

  // Send chat message
  const sendChatMessage = useCallback(
    async (prompt: string) => {
      const currentVersion = getCurrentVersion();
      if (!currentVersion) return;

      try {
        // Add user message to chat
        const userMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: prompt,
          timestamp: new Date(),
        };

        setState((prev) => ({
          ...prev,
          chatHistory: [...prev.chatHistory, userMessage],
        }));

        // Call AI API
        const response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            content: state.workingContent,
            documentName: state.documentName,
            model: 'claude-3-7-sonnet-20250219',
            mode: 'edit',
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('AI API error:', errorData);
          throw new Error(errorData.error || 'AI request failed');
        }

        const data = await response.json();
        console.log('AI response:', data);
        const aiContent = data.editedContent || data.edited_content || data.content;

        // Add AI response to chat
        const aiMessage: ChatMessage = {
          id: `msg-${Date.now()}-ai`,
          role: 'assistant',
          content: `✓ Created V${state.versions.length}`,
          timestamp: new Date(),
        };

        // Create new version (STAGED)
        const newVersionId = createVersion(aiContent, prompt, 'ai-created');

        // Always default to Editing mode (clean view)
        // User can switch to Tracking or Diff if needed
        setState((prev) => ({
          ...prev,
          chatHistory: [...prev.chatHistory, aiMessage],
          documentMode: 'editing', // Default to clean view
        }));

      } catch (error) {
        console.error('AI chat error:', error);
        alert('Failed to process AI request. Please try again.');
      }
    },
    [state.workingContent, state.documentName, state.versions, state.documentMode, getCurrentVersion, createVersion]
  );

  // Accept all changes (unlocks version and allows AI chat)
  const acceptAllChanges = useCallback(() => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return;

    // Finalize current version and switch back to editing
    setState((prev) => ({
      ...prev,
      versions: prev.versions.map((v) =>
        v.id === currentVersion.id
          ? { 
              ...v, 
              versionState: 'reviewed' as VersionState,
              hasUserEdits: v.content !== v.aiEditedContent // Mark as edited if content changed
            }
          : v
      ),
      documentMode: 'editing', // Switch back to clean view
      stagedChanges: [],
    }));
  }, [getCurrentVersion]);

  // Reject and regenerate
  const rejectAndRegenerate = useCallback(async () => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return;

    // Archive current version
    toggleVersionArchive(currentVersion.id);

    // Revert to previous version
    const prevVersion = getPreviousVersion();
    if (prevVersion) {
      setCurrentVersion(prevVersion.id);
    }

    // Switch to Diff & Regenerate tab
    setState((prev) => ({
      ...prev,
      documentMode: 'diff-regenerate',
    }));

    // Generate new alternative
    await generateAlternatives(1);
  }, [getCurrentVersion, getPreviousVersion, toggleVersionArchive, setCurrentVersion]);

  // Generate alternatives
  const generateAlternatives = useCallback(
    async (count: number = 3) => {
      const currentVersion = getCurrentVersion();
      if (!currentVersion || !currentVersion.prompt) return;

      const newAlternatives: Version[] = [];

      for (let i = 0; i < count; i++) {
        try {
          const response = await fetch('/api/anthropic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: currentVersion.prompt,
              content: state.workingContent,
              documentName: state.documentName,
              model: 'claude-3-7-sonnet-20250219',
              mode: 'edit',
              temperature: 0.7 + i * 0.1, // Vary temperature for diversity
            }),
          });

          if (!response.ok) continue;

          const data = await response.json();
          const aiContent = data.editedContent || data.edited_content || data.content;

          const altVersion: Version = {
            id: `v${state.versions.length + newAlternatives.length}-alt${i}-${Date.now()}`,
            number: `${state.versions.length}`,
            content: aiContent,
            prompt: currentVersion.prompt,
            note: `Alternative ${i + 1}`,
            timestamp: new Date(),
            isOriginal: false,
            parentId: currentVersion.parentId,
            checkpoints: [],
            versionState: 'ai-created',
            isArchived: true, // Alternatives start as archived
          };

          newAlternatives.push(altVersion);
        } catch (error) {
          console.error('Failed to generate alternative:', error);
        }
      }

      setState((prev) => ({
        ...prev,
        alternatives: [...prev.alternatives, ...newAlternatives],
        versions: [...prev.versions, ...newAlternatives],
      }));
    },
    [state.workingContent, state.documentName, state.versions, getCurrentVersion]
  );

  // Set document name
  const setDocumentName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, documentName: name }));
  }, []);

  // Set track user edits
  const setTrackUserEdits = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, trackUserEdits: enabled }));
  }, []);

  // Toggle debug mode
  const toggleDebugMode = useCallback(() => {
    setState((prev) => ({ ...prev, debugMode: !prev.debugMode }));
  }, []);

  // Clear everything and reset to initial state
  const clearEverything = useCallback(() => {
    if (!window.confirm('Are you sure? This will delete all versions and chat history.')) {
      return;
    }

    const initialVersion: Version = {
      id: 'v0',
      number: '0',
      content: '<p>Start writing your document here...</p>',
      prompt: null,
      note: 'Initial version',
      timestamp: new Date(),
      isOriginal: true,
      parentId: null,
      checkpoints: [],
      versionState: 'reviewed',
    };

    setState({
      documentName: 'Untitled Document',
      versions: [initialVersion],
      currentVersionId: 'v0',
      documentMode: 'editing',
      workingContent: initialVersion.content,
      stagedChanges: [],
      chatHistory: [],
      alternatives: [],
      trackUserEdits: true,
      debugMode: false,
    });

    // Clear localStorage
    localStorage.removeItem('verzer-editor-v2');
  }, []);

  const value: EditorContextTypeV2 = {
    state,
    createVersion,
    updateVersion,
    setCurrentVersion,
    getCurrentVersion,
    getPreviousVersion,
    toggleVersionArchive,
    setWorkingContent,
    setDocumentMode,
    sendChatMessage,
    acceptAllChanges,
    rejectAndRegenerate,
    generateAlternatives,
    setDocumentName,
    setTrackUserEdits,
    toggleDebugMode,
    clearEverything,
  };

  return (
    <EditorContextV2.Provider value={value}>
      {children}
    </EditorContextV2.Provider>
  );
}

export function useEditorV2() {
  const context = useContext(EditorContextV2);
  if (!context) {
    throw new Error('useEditorV2 must be used within EditorProviderV2');
  }
  return context;
}

