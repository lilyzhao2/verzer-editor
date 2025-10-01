'use client';

import React, { useState, useEffect } from 'react';
import { useEditor } from '@/contexts/EditorContext';
import { TodoTask, TodoSession } from '@/lib/types';
import { 
  CheckCircle, Circle, PlayCircle, PauseCircle, SkipForward,
  ChevronRight, ChevronDown, Sparkles, GitBranch, Clock,
  AlertCircle, X, Edit2, Plus, Trash2, GripVertical
} from 'lucide-react';

interface TodoPanelProps {
  onClose: () => void;
}

export function TodoPanel({ onClose }: TodoPanelProps) {
  const { state, createTodoSession, updateTodoTask, executeTodoTask, cancelTodoSession } = useEditor();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTasks, setEditedTasks] = useState<TodoTask[]>([]);
  const [executionMode, setExecutionMode] = useState<'sequential' | 'parallel' | 'interactive'>('sequential');
  
  const session = state.activeTodoSession;

  useEffect(() => {
    if (session && session.status === 'planning') {
      setEditedTasks(session.tasks);
    }
  }, [session]);

  const handleStartExecution = async () => {
    if (!session) return;
    
    // Update session to executing
    const updatedSession: TodoSession = {
      ...session,
      status: 'executing',
      executionMode,
      tasks: editedTasks
    };
    
    // Start execution based on mode
    if (executionMode === 'sequential') {
      // Execute tasks one by one
      for (const task of editedTasks) {
        if (task.status === 'pending') {
          await executeTodoTask(task.id);
        }
      }
    } else if (executionMode === 'parallel') {
      // Execute all tasks at once
      const pendingTasks = editedTasks.filter(t => t.status === 'pending');
      await Promise.all(pendingTasks.map(task => executeTodoTask(task.id)));
    } else {
      // Interactive mode - execute first task and wait
      const firstPending = editedTasks.find(t => t.status === 'pending');
      if (firstPending) {
        await executeTodoTask(firstPending.id);
      }
    }
  };

  const handleTaskEdit = (taskId: string, field: keyof TodoTask, value: any) => {
    setEditedTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, [field]: value } : task
    ));
  };

  const handleAddTask = () => {
    const newTask: TodoTask = {
      id: `task-${Date.now()}`,
      title: 'New Task',
      description: '',
      status: 'pending',
      estimatedComplexity: 'simple',
      order: editedTasks.length
    };
    setEditedTasks(prev => [...prev, newTask]);
  };

  const handleRemoveTask = (taskId: string) => {
    setEditedTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleReorderTasks = (fromIndex: number, toIndex: number) => {
    const reordered = [...editedTasks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    
    // Update order values
    const updatedTasks = reordered.map((task, index) => ({
      ...task,
      order: index
    }));
    
    setEditedTasks(updatedTasks);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'complex': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'in-progress': return <PlayCircle className="w-4 h-4 text-blue-600 animate-pulse" />;
      case 'skipped': return <SkipForward className="w-4 h-4 text-gray-400" />;
      default: return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  if (!session) {
    return null;
  }

  const completedTasks = session.tasks.filter(t => t.status === 'completed').length;
  const progress = (completedTasks / session.tasks.length) * 100;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">Smart Todo</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/50 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        
        {/* Progress Bar */}
        {session.status === 'executing' && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>{completedTasks} of {session.tasks.length} tasks</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Original Prompt */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <p className="text-xs font-medium text-gray-600 mb-1">Original Request:</p>
        <p className="text-sm text-gray-800 line-clamp-2">{session.originalPrompt}</p>
      </div>

      {/* Execution Mode (Planning Phase) */}
      {session.status === 'planning' && (
        <div className="px-4 py-3 border-b bg-white">
          <p className="text-xs font-medium text-gray-600 mb-2">Execution Mode:</p>
          <div className="flex gap-2">
            {(['sequential', 'parallel', 'interactive'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setExecutionMode(mode)}
                className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-all ${
                  executionMode === mode
                    ? 'bg-purple-100 border-purple-300 text-purple-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {mode === 'sequential' && '⏩ Sequential'}
                {mode === 'parallel' && '⚡ Parallel'}
                {mode === 'interactive' && '👁️ Interactive'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {(isEditing ? editedTasks : session.tasks).map((task, index) => (
          <div 
            key={task.id}
            className={`border rounded-lg p-3 transition-all ${
              task.status === 'in-progress' 
                ? 'border-blue-300 bg-blue-50' 
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-2">
              {isEditing && (
                <button
                  className="mt-1 cursor-move text-gray-400 hover:text-gray-600"
                  title="Drag to reorder"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
              )}
              
              <div className="mt-1">
                {getStatusIcon(task.status)}
              </div>
              
              <div className="flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => handleTaskEdit(task.id, 'title', e.target.value)}
                    className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded"
                  />
                ) : (
                  <h3 className="text-sm font-medium text-gray-800">
                    {index + 1}. {task.title}
                  </h3>
                )}
                
                {isEditing ? (
                  <textarea
                    value={task.description}
                    onChange={(e) => handleTaskEdit(task.id, 'description', e.target.value)}
                    className="w-full mt-1 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded resize-none"
                    rows={2}
                    placeholder="Task description..."
                  />
                ) : (
                  task.description && (
                    <p className="text-xs text-gray-600 mt-1">{task.description}</p>
                  )
                )}
                
                <div className="flex items-center gap-3 mt-2">
                  {/* Complexity Badge */}
                  {isEditing ? (
                    <select
                      value={task.estimatedComplexity}
                      onChange={(e) => handleTaskEdit(task.id, 'estimatedComplexity', e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-gray-300"
                    >
                      <option value="simple">Simple</option>
                      <option value="medium">Medium</option>
                      <option value="complex">Complex</option>
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getComplexityColor(task.estimatedComplexity)}`}>
                      {task.estimatedComplexity}
                    </span>
                  )}
                  
                  {/* Version Created */}
                  {task.versionId && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />
                      v{task.versionId}
                    </span>
                  )}
                  
                  {/* Remove button in edit mode */}
                  {isEditing && (
                    <button
                      onClick={() => handleRemoveTask(task.id)}
                      className="ml-auto text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isEditing && (
          <button
            onClick={handleAddTask}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">Add Task</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t bg-gray-50">
        {session.status === 'planning' && (
          <div className="space-y-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Tasks
                </button>
                <button
                  onClick={handleStartExecution}
                  className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-4 h-4" />
                  Start Execution
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => {
                    setEditedTasks(session.tasks);
                    setIsEditing(false);
                  }}
                  className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
        
        {session.status === 'executing' && (
          <div className="space-y-2">
            {executionMode === 'interactive' && (
              <button
                onClick={() => {
                  const nextTask = session.tasks.find(t => t.status === 'pending');
                  if (nextTask) executeTodoTask(nextTask.id);
                }}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                Execute Next Task
              </button>
            )}
            <button
              onClick={() => cancelTodoSession()}
              className="w-full py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
            >
              <PauseCircle className="w-4 h-4" />
              Pause Execution
            </button>
          </div>
        )}
        
        {session.status === 'completed' && (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-800">All tasks completed!</p>
            <button
              onClick={onClose}
              className="mt-3 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

