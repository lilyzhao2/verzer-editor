/**
 * Smart Auto-Save System with Conflict Resolution
 * Handles multiple save strategies and conflict detection
 */

export interface AutoSaveConfig {
  enabled: boolean;
  interval: number; // milliseconds
  maxRetries: number;
  conflictResolution: 'user' | 'server' | 'merge' | 'prompt';
  backupEnabled: boolean;
  backupInterval: number; // milliseconds
}

export interface SaveState {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  conflictDetected: boolean;
  retryCount: number;
  error: string | null;
}

export interface ConflictResolution {
  type: 'user' | 'server' | 'merge';
  userContent: string;
  serverContent: string;
  mergedContent?: string;
  resolution: string;
}

export class SmartAutoSave {
  private config: AutoSaveConfig;
  private state: SaveState;
  private saveTimer: NodeJS.Timeout | null = null;
  private backupTimer: NodeJS.Timeout | null = null;
  private lastContent: string = '';
  private saveCallbacks: Array<(content: string) => Promise<void>> = [];
  private conflictCallbacks: Array<(conflict: ConflictResolution) => Promise<string>> = [];
  
  constructor(config: Partial<AutoSaveConfig> = {}) {
    this.config = {
      enabled: true,
      interval: 30000, // 30 seconds
      maxRetries: 3,
      conflictResolution: 'prompt',
      backupEnabled: true,
      backupInterval: 300000, // 5 minutes
      ...config,
    };
    
    this.state = {
      isSaving: false,
      lastSaved: null,
      hasUnsavedChanges: false,
      conflictDetected: false,
      retryCount: 0,
      error: null,
    };
  }
  
  // Register save callback
  onSave(callback: (content: string) => Promise<void>) {
    this.saveCallbacks.push(callback);
  }
  
  // Register conflict resolution callback
  onConflict(callback: (conflict: ConflictResolution) => Promise<string>) {
    this.conflictCallbacks.push(callback);
  }
  
  // Start auto-save
  start() {
    if (!this.config.enabled) return;
    
    this.saveTimer = setInterval(() => {
      this.autoSave();
    }, this.config.interval);
    
    if (this.config.backupEnabled) {
      this.backupTimer = setInterval(() => {
        this.createBackup();
      }, this.config.backupInterval);
    }
  }
  
  // Stop auto-save
  stop() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }
  
  // Update content and trigger save if needed
  updateContent(content: string) {
    const hasChanged = content !== this.lastContent;
    this.lastContent = content;
    
    if (hasChanged) {
      this.state.hasUnsavedChanges = true;
      this.state.error = null;
      
      // Debounced save for rapid changes
      this.debouncedSave();
    }
  }
  
  // Force save
  async forceSave(): Promise<boolean> {
    if (!this.state.hasUnsavedChanges) return true;
    
    return await this.performSave();
  }
  
  // Get current state
  getState(): SaveState {
    return { ...this.state };
  }
  
  // Update configuration
  updateConfig(newConfig: Partial<AutoSaveConfig>) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart timers if interval changed
    if (newConfig.interval || newConfig.enabled !== undefined) {
      this.stop();
      this.start();
    }
  }
  
  private debouncedSave() {
    // Clear existing timer
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    // Set new timer
    this.saveTimer = setTimeout(() => {
      this.autoSave();
    }, 2000); // 2 second debounce
  }
  
  private async autoSave() {
    if (!this.state.hasUnsavedChanges || this.state.isSaving) return;
    
    await this.performSave();
  }
  
  private async performSave(): Promise<boolean> {
    if (this.state.isSaving) return false;
    
    this.state.isSaving = true;
    this.state.error = null;
    
    try {
      // Execute all save callbacks
      for (const callback of this.saveCallbacks) {
        await callback(this.lastContent);
      }
      
      this.state.lastSaved = new Date();
      this.state.hasUnsavedChanges = false;
      this.state.retryCount = 0;
      this.state.conflictDetected = false;
      
      return true;
    } catch (error: any) {
      this.state.error = error.message;
      this.state.retryCount++;
      
      // Retry logic
      if (this.state.retryCount < this.config.maxRetries) {
        setTimeout(() => {
          this.performSave();
        }, 1000 * this.state.retryCount); // Exponential backoff
      } else {
        console.error('Auto-save failed after max retries:', error);
      }
      
      return false;
    } finally {
      this.state.isSaving = false;
    }
  }
  
  private async createBackup() {
    try {
      const backup = {
        content: this.lastContent,
        timestamp: new Date().toISOString(),
        version: 'backup',
      };
      
      localStorage.setItem('verzer-backup', JSON.stringify(backup));
    } catch (error) {
      console.error('Backup creation failed:', error);
    }
  }
  
  // Conflict resolution methods
  async resolveConflict(userContent: string, serverContent: string): Promise<string> {
    const conflict: ConflictResolution = {
      type: this.config.conflictResolution as 'user' | 'server' | 'merge',
      userContent,
      serverContent,
      resolution: '',
    };
    
    switch (this.config.conflictResolution) {
      case 'user':
        return userContent;
        
      case 'server':
        return serverContent;
        
      case 'merge':
        conflict.mergedContent = await this.mergeContent(userContent, serverContent);
        return conflict.mergedContent;
        
      case 'prompt':
        // Let the UI handle the prompt
        for (const callback of this.conflictCallbacks) {
          const resolution = await callback(conflict);
          if (resolution) return resolution;
        }
        return userContent; // Fallback
        
      default:
        return userContent;
    }
  }
  
  private async mergeContent(userContent: string, serverContent: string): Promise<string> {
    // Simple merge strategy - can be enhanced with more sophisticated algorithms
    const userLines = userContent.split('\n');
    const serverLines = serverContent.split('\n');
    
    // For now, prefer user content but add server changes that don't conflict
    const mergedLines = [...userLines];
    
    // Add server lines that don't exist in user content
    serverLines.forEach(serverLine => {
      if (!userLines.includes(serverLine) && serverLine.trim()) {
        mergedLines.push(serverLine);
      }
    });
    
    return mergedLines.join('\n');
  }
  
  // Get backup if available
  getBackup(): { content: string; timestamp: string } | null {
    try {
      const backup = localStorage.getItem('verzer-backup');
      return backup ? JSON.parse(backup) : null;
    } catch {
      return null;
    }
  }
  
  // Clear backup
  clearBackup() {
    localStorage.removeItem('verzer-backup');
  }
}

// Global instance
export const smartAutoSave = new SmartAutoSave();
