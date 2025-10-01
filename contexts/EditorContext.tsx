'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Version, ChatMessage, EditorState, AIModel, ViewMode, Checkpoint, PendingAIEdit, Comment, ProjectNote, ProjectConfig, EditorTab, TodoSession, TodoTask } from '@/lib/types';

interface EditorContextType {
  state: EditorState;
  createVersion: (content: string, prompt: string | null, parentId?: string, note?: string | null, customId?: string) => void;
  updateVersion: (versionId: string, content: string) => void;
  updateVersionNote: (versionId: string, note: string) => void;
  toggleVersionStar: (versionId: string) => void;
  updateProjectConfig: (config: ProjectConfig) => void;
  saveProjectConfig: (config: Omit<ProjectConfig, 'id' | 'createdAt'>) => void;
  setActiveConfig: (configId: string) => void;
  deleteProjectConfig: (configId: string) => void;
  openTab: (versionId: string) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTabDirtyState: (tabId: string, isDirty: boolean) => void;
  createTodoSession: (prompt: string) => Promise<void>;
  updateTodoTask: (taskId: string, updates: Partial<TodoTask>) => void;
  executeTodoTask: (taskId: string) => Promise<void>;
  cancelTodoSession: () => void;
  createCheckpoint: (versionId: string, content: string, type: 'auto-save' | 'manual') => void;
  revertToCheckpoint: (versionId: string, checkpointId: string) => void;
  setCurrentVersion: (versionId: string) => void;
  setCompareVersion: (versionId: string | null) => void;
  getCurrentVersion: () => Version | undefined;
  getCompareVersion: () => Version | undefined;
  applyAIEdit: (prompt: string, options?: { autoOpenInParallel?: boolean }) => Promise<void>;
  createAIVariations: (prompts: string[]) => Promise<any>;
  saveManualEdit: (content: string) => Promise<void>;
  setSelectedModel: (model: AIModel) => void;
  setViewMode: (mode: ViewMode) => void;
  setPendingAIEdit: (edit: PendingAIEdit | null) => void;
  acceptAIEdit: () => void;
  rejectAIEdit: () => void;
  acceptPartialAIEdit: (content: string) => void;
  addComment: (versionId: string, text: string, position?: { paragraph?: number; line?: number }) => void;
  updateComment: (commentId: string, text: string) => void;
  deleteComment: (commentId: string) => void;
  resolveComment: (commentId: string) => void;
  addProjectNote: (title: string, content: string, relatedVersions?: string[], tags?: string[]) => void;
  updateProjectNote: (noteId: string, updates: Partial<ProjectNote>) => void;
  deleteProjectNote: (noteId: string) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  // Always start with default state to avoid hydration mismatch
  const [state, setState] = useState<EditorState>(() => {
    const initialVersion: Version = {
      id: 'v0',
      number: '0',
      content: '<p>Start writing your document here...</p>',
      prompt: null,
      note: 'Initial version',
      timestamp: new Date(),
      isOriginal: true,
      parentId: null,
      checkpoints: []
    };
    
    const defaultConfig: ProjectConfig = {
      id: 'config-default',
      name: 'Default Configuration',
      projectName: 'My Document',
      description: '',
      styleGuide: '',
      tone: '',
      audience: '',
      references: [],
      constraints: '',
      additionalContext: '',
      createdAt: new Date(),
      isActive: true
    };

    const initialTab: EditorTab = {
      id: 'tab-v0',
      versionId: 'v0',
      title: 'v0',
      isDirty: false
    };

    return {
      versions: [initialVersion],
      currentVersionId: 'v0',
      compareVersionId: null,
      chatHistory: [],
      comments: [],
      projectNotes: [],
      selectedModel: 'claude-3-5-haiku-20241022' as AIModel,
      viewMode: 'document' as ViewMode,
      pendingAIEdit: null,
      projectConfigs: [defaultConfig],
      activeConfigId: 'config-default',
      tabs: [initialTab],
      activeTabId: 'tab-v0',
      activeTodoSession: null,
      todoHistory: []
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
            comments: parsed.comments || [],
            projectNotes: parsed.projectNotes || [],
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
            viewMode: parsed.viewMode || 'document',
            pendingAIEdit: null
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

  const createVersion = useCallback((content: string, prompt: string | null, parentId?: string, note?: string | null, customId?: string) => {
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
        const rootVersions = prev.versions.filter(v => typeof v.number === 'string' && !v.number.includes('.'));
        newVersionNumber = rootVersions.length.toString();
      } else {
        // Creating branch: ONLY single-level branches (v1.1, v1.2, not v1.1.1)
        // Always branch from the root version of the current version
        const rootNumber = typeof parent.number === 'string' ? parent.number.split('.')[0] : String(parent.number).split('.')[0]; // Get "1" from "1.2"
        const branches = prev.versions.filter(v => 
          typeof v.number === 'string' && v.number.startsWith(rootNumber + '.') && 
          v.number.split('.').length === 2 // Only single-level branches
        );
        const nextBranch = branches.length + 1;
        newVersionNumber = `${rootNumber}.${nextBranch}`;
      }
      
      newVersionId = customId || `v${newVersionNumber}`;
      
      const newVersion: Version = {
        id: newVersionId,
        number: newVersionNumber,
        content,
        prompt,
        note: note || null,
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

  const updateVersionNote = useCallback((versionId: string, note: string) => {
    setState(prev => ({
      ...prev,
      versions: prev.versions.map(v =>
        v.id === versionId ? { ...v, note } : v
      ),
    }));
  }, []);

  const toggleVersionStar = useCallback((versionId: string) => {
    setState(prev => ({
      ...prev,
      versions: prev.versions.map(v =>
        v.id === versionId ? { ...v, isStarred: !v.isStarred } : v
      ),
    }));
  }, []);

  const updateProjectConfig = useCallback((config: ProjectConfig) => {
    setState(prev => ({
      ...prev,
      projectConfigs: prev.projectConfigs.map(c =>
        c.id === config.id ? config : c
      ),
    }));
  }, []);

  const saveProjectConfig = useCallback((config: Omit<ProjectConfig, 'id' | 'createdAt'>) => {
    const newConfig: ProjectConfig = {
      ...config,
      id: `config-${Date.now()}`,
      createdAt: new Date(),
      isActive: false
    };
    
    setState(prev => ({
      ...prev,
      projectConfigs: [...prev.projectConfigs, newConfig],
    }));
    
    return newConfig.id;
  }, []);

  const setActiveConfig = useCallback((configId: string) => {
    setState(prev => ({
      ...prev,
      projectConfigs: prev.projectConfigs.map(c => ({
        ...c,
        isActive: c.id === configId
      })),
      activeConfigId: configId
    }));
  }, []);

  const deleteProjectConfig = useCallback((configId: string) => {
    setState(prev => {
      // Don't delete if it's the only config
      if (prev.projectConfigs.length <= 1) return prev;
      
      // If deleting active config, activate the first remaining one
      const isActive = prev.activeConfigId === configId;
      const newConfigs = prev.projectConfigs.filter(c => c.id !== configId);
      
      if (isActive && newConfigs.length > 0) {
        newConfigs[0].isActive = true;
      }
      
      return {
        ...prev,
        projectConfigs: newConfigs,
        activeConfigId: isActive ? newConfigs[0]?.id : prev.activeConfigId
      };
    });
  }, []);

  const openTab = useCallback((versionId: string) => {
    setState(prev => {
      // Check if tab already exists
      const existingTab = prev.tabs.find(t => t.versionId === versionId);
      if (existingTab) {
        // Just switch to it
        return {
          ...prev,
          activeTabId: existingTab.id,
          currentVersionId: versionId
        };
      }
      
      // Create new tab
      const version = prev.versions.find(v => v.id === versionId);
      if (!version) return prev;
      
      const newTab: EditorTab = {
        id: `tab-${versionId}-${Date.now()}`,
        versionId,
        title: `v${version.number}`,
        isDirty: false
      };
      
      return {
        ...prev,
        tabs: [...prev.tabs, newTab],
        activeTabId: newTab.id,
        currentVersionId: versionId
      };
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setState(prev => {
      const tabIndex = prev.tabs.findIndex(t => t.id === tabId);
      if (tabIndex === -1) return prev;
      
      // Don't close if it's the only tab
      if (prev.tabs.length === 1) return prev;
      
      const newTabs = prev.tabs.filter(t => t.id !== tabId);
      let newActiveTabId = prev.activeTabId;
      let newCurrentVersionId = prev.currentVersionId;
      
      // If closing active tab, switch to adjacent tab
      if (prev.activeTabId === tabId) {
        const newActiveTab = newTabs[Math.min(tabIndex, newTabs.length - 1)];
        newActiveTabId = newActiveTab.id;
        newCurrentVersionId = newActiveTab.versionId;
      }
      
      return {
        ...prev,
        tabs: newTabs,
        activeTabId: newActiveTabId,
        currentVersionId: newCurrentVersionId
      };
    });
  }, []);

  const switchTab = useCallback((tabId: string) => {
    setState(prev => {
      const tab = prev.tabs.find(t => t.id === tabId);
      if (!tab) return prev;
      
      return {
        ...prev,
        activeTabId: tabId,
        currentVersionId: tab.versionId
      };
    });
  }, []);

  const updateTabDirtyState = useCallback((tabId: string, isDirty: boolean) => {
    setState(prev => ({
      ...prev,
      tabs: prev.tabs.map(t =>
        t.id === tabId ? { ...t, isDirty } : t
      )
    }));
  }, []);

  const createTodoSession = useCallback(async (prompt: string) => {
    try {
      // Ask AI to decompose the task
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analyze this request and break it down into specific, actionable tasks. 
You MUST return ONLY valid JSON with this exact structure:
{
  "tasks": [
    {
      "title": "Brief task title",
      "description": "What needs to be done",
      "estimatedComplexity": "simple"
    }
  ]
}

Request: "${prompt}"

Break this into 3-7 clear tasks. Be specific and actionable. Return ONLY the JSON object, no other text.`,
          content: '',
          model: state.selectedModel,
          mode: 'analyze'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to decompose tasks:', errorData);
        throw new Error(errorData.error || 'Failed to decompose tasks');
      }
      
      const result = await response.json();
      let tasks: TodoTask[] = [];
      
      // Parse the response - handle both string and object responses
      let parsedResponse = result.response;
      
      // If response is a string, try to parse it as JSON
      if (typeof parsedResponse === 'string') {
        try {
          // Try to extract JSON from the string
          const jsonMatch = parsedResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          console.error('Failed to parse JSON from response:', e);
        }
      }
      
      // Extract tasks from the parsed response
      if (parsedResponse && typeof parsedResponse === 'object' && parsedResponse.tasks && Array.isArray(parsedResponse.tasks)) {
        tasks = parsedResponse.tasks.map((task: any, index: number) => ({
          id: `task-${Date.now()}-${index}`,
          title: task.title || `Task ${index + 1}`,
          description: task.description || '',
          status: 'pending' as const,
          estimatedComplexity: task.estimatedComplexity || 'medium',
          order: index
        }));
      }
      
      // Fallback if we couldn't parse tasks
      if (tasks.length === 0) {
        console.log('Falling back to single task due to parsing issues');
        tasks = [{
          id: `task-${Date.now()}`,
          title: 'Execute request',
          description: prompt,
          status: 'pending' as const,
          estimatedComplexity: 'complex',
          order: 0
        }];
      }

      const newSession: TodoSession = {
        id: `session-${Date.now()}`,
        originalPrompt: prompt,
        tasks,
        createdAt: new Date(),
        status: 'planning',
        executionMode: 'sequential'
      };

      setState(prev => ({
        ...prev,
        activeTodoSession: newSession
      }));
    } catch (error) {
      console.error('Error creating todo session:', error);
    }
  }, [state.selectedModel]);

  const updateTodoTask = useCallback((taskId: string, updates: Partial<TodoTask>) => {
    setState(prev => {
      if (!prev.activeTodoSession) return prev;
      
      return {
        ...prev,
        activeTodoSession: {
          ...prev.activeTodoSession,
          tasks: prev.activeTodoSession.tasks.map(task =>
            task.id === taskId ? { ...task, ...updates } : task
          )
        }
      };
    });
  }, []);


  const cancelTodoSession = useCallback(() => {
    setState(prev => {
      if (!prev.activeTodoSession) return prev;
      
      // Move session to history
      const pausedSession = {
        ...prev.activeTodoSession,
        status: 'paused' as const
      };
      
      return {
        ...prev,
        activeTodoSession: null,
        todoHistory: [...prev.todoHistory, pausedSession]
      };
    });
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

  const applyAIEdit = useCallback(async (prompt: string, options?: { autoOpenInParallel?: boolean }) => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return;

    try {
      // Get active project config safely
      const projectConfig = state.projectConfigs?.find(c => c.id === state.activeConfigId);
      
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          content: currentVersion.content,
          model: state.selectedModel,
          projectConfig,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to get AI response';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch (e) {
          const errorText = await response.text();
          errorMessage = `API Error (${response.status}): ${errorText}`;
        }
        console.error('AI API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      const { editedContent, explanation } = await response.json();
      
      // Calculate what the new version number will be
      // Since AI creates root versions, it's the count of root versions
      const rootVersions = state.versions?.filter(v => typeof v.number === 'string' && !v.number.includes('.')) || [];
      const newVersionNumber = rootVersions.length.toString();
      
      // Create the new version directly
      const newVersionId = `v${Date.now()}`;
      createVersion(editedContent, prompt, undefined, undefined, newVersionId);
      
      // If in parallel mode and autoOpen is true, open the new version in a tab
      if (options?.autoOpenInParallel && state.viewMode === 'parallel') {
        // Open the tab immediately with the known ID
        setTimeout(() => {
          openTab(newVersionId);
        }, 100);
      }
      
      // Add to chat history with the explanation
      const newChatMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        response: explanation || 'Changes applied successfully.',
        versionCreated: newVersionNumber, // Use the calculated version number
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
  }, [getCurrentVersion, createVersion, state, openTab]);

  const saveManualEdit = useCallback(async (content: string) => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return;

    try {
      // Use AI to summarize what changed
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Briefly summarize what changed between the original and edited content. Be concise (max 10 words). Just describe the changes, don't mention "the user" or "you".`,
          content: `Original:\n${currentVersion.content}\n\nEdited:\n${content}`,
          model: state.selectedModel,
        }),
      });

      let summary = '✏️ Manual edits';
      if (response.ok) {
        const { editedContent } = await response.json();
        // Extract just the summary from the AI response
        summary = `✏️ ${editedContent.trim()}`;
      }
      
      // Manual edits create branches (v1.1, v1.2, etc)
      createVersion(content, summary, currentVersion.id);
    } catch (error) {
      console.error('Error summarizing manual edit:', error);
      // Fall back to generic message if AI fails
      createVersion(content, `✏️ Manual edits to v${currentVersion.number}`, currentVersion.id);
    }
  }, [getCurrentVersion, createVersion, state.selectedModel]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setState(prev => ({ ...prev, viewMode: mode }));
  }, []);
  
  // New function to create multiple AI variations
  const createAIVariations = useCallback(async (prompts: string[]) => {
    const currentVersion = getCurrentVersion();
    if (!currentVersion) return;
    
    // Switch to parallel view automatically
    setViewMode('parallel');
    
    // Create each variation
    const results = [];
    for (const prompt of prompts) {
      try {
        await applyAIEdit(prompt, { autoOpenInParallel: true });
        results.push({ prompt, success: true });
        // Small delay between requests to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error creating variation for "${prompt}":`, error);
        results.push({ prompt, success: false, error });
      }
    }
    
    return results;
  }, [getCurrentVersion, setViewMode, applyAIEdit]);

  const setPendingAIEdit = useCallback((edit: PendingAIEdit | null) => {
    setState(prev => ({ ...prev, pendingAIEdit: edit }));
  }, []);

  // These functions are no longer used since AI edits create versions directly
  const acceptAIEdit = useCallback(() => {
    // No longer needed - AI edits create versions directly
  }, []);

  const rejectAIEdit = useCallback(() => {
    // No longer needed - AI edits create versions directly
  }, []);

  const acceptPartialAIEdit = useCallback((content: string) => {
    // No longer needed - AI edits create versions directly
  }, []);

  // Define executeTodoTask after applyAIEdit
  const executeTodoTask = useCallback(async (taskId: string) => {
    const session = state.activeTodoSession;
    if (!session) return;
    
    const task = session.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Mark task as in-progress
    updateTodoTask(taskId, { status: 'in-progress' });
    
    try {
      // Execute the task using AI
      await applyAIEdit(task.title + (task.description ? ': ' + task.description : ''));
      
      // Get the latest version created
      const latestVersion = state.versions[state.versions.length - 1];
      
      // Mark task as completed and associate with version
      updateTodoTask(taskId, { 
        status: 'completed',
        versionId: latestVersion.number
      });
    } catch (error) {
      console.error('Error executing task:', error);
      updateTodoTask(taskId, { status: 'pending' });
    }
  }, [state.activeTodoSession, state.versions, updateTodoTask, applyAIEdit]);

  // Comment functions
  const addComment = useCallback((versionId: string, text: string, position?: { paragraph?: number; line?: number }) => {
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      versionId,
      text,
      timestamp: new Date(),
      position,
      resolved: false,
    };
    setState(prev => ({
      ...prev,
      comments: [...prev.comments, newComment],
    }));
  }, []);

  const updateComment = useCallback((commentId: string, text: string) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => 
        c.id === commentId ? { ...c, text } : c
      ),
    }));
  }, []);

  const deleteComment = useCallback((commentId: string) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.filter(c => c.id !== commentId),
    }));
  }, []);

  const resolveComment = useCallback((commentId: string) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => 
        c.id === commentId ? { ...c, resolved: true } : c
      ),
    }));
  }, []);

  // Project Note functions
  const addProjectNote = useCallback((title: string, content: string, relatedVersions?: string[], tags?: string[]) => {
    const newNote: ProjectNote = {
      id: `note-${Date.now()}`,
      title,
      content,
      timestamp: new Date(),
      relatedVersions,
      tags,
    };
    setState(prev => ({
      ...prev,
      projectNotes: [...prev.projectNotes, newNote],
    }));
  }, []);

  const updateProjectNote = useCallback((noteId: string, updates: Partial<ProjectNote>) => {
    setState(prev => ({
      ...prev,
      projectNotes: prev.projectNotes.map(n => 
        n.id === noteId ? { ...n, ...updates } : n
      ),
    }));
  }, []);

  const deleteProjectNote = useCallback((noteId: string) => {
    setState(prev => ({
      ...prev,
      projectNotes: prev.projectNotes.filter(n => n.id !== noteId),
    }));
  }, []);

  return (
    <EditorContext.Provider
      value={{
        state,
        createVersion,
        updateVersion,
        updateVersionNote,
        toggleVersionStar,
        updateProjectConfig,
        saveProjectConfig,
        setActiveConfig,
        deleteProjectConfig,
        openTab,
        closeTab,
        switchTab,
        updateTabDirtyState,
        createTodoSession,
        updateTodoTask,
        executeTodoTask,
        cancelTodoSession,
        setCurrentVersion,
        setCompareVersion,
        getCurrentVersion,
        getCompareVersion,
        applyAIEdit,
        createAIVariations,
        saveManualEdit,
        setSelectedModel,
        setViewMode,
        createCheckpoint,
        revertToCheckpoint,
        setPendingAIEdit,
        acceptAIEdit,
        rejectAIEdit,
        acceptPartialAIEdit,
        addComment,
        updateComment,
        deleteComment,
        resolveComment,
        addProjectNote,
        updateProjectNote,
        deleteProjectNote,
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
