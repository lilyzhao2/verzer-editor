/**
 * Comprehensive Test Runner
 * Automated testing for editor functionality
 */

import { errorMonitor } from './errorMonitoring';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  duration: number;
  passed: number;
  failed: number;
}

class TestRunner {
  private tests: Array<() => Promise<TestResult>> = [];
  private results: TestSuite[] = [];

  // Add a test
  addTest(name: string, testFn: () => Promise<void> | void) {
    this.tests.push(async (): Promise<TestResult> => {
      const startTime = performance.now();
      try {
        await testFn();
        const duration = performance.now() - startTime;
        return { name, passed: true, duration };
      } catch (error) {
        const duration = performance.now() - startTime;
        return { 
          name, 
          passed: false, 
          duration, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
  }

  // Run all tests
  async runAllTests(): Promise<TestSuite> {
    const startTime = performance.now();
    const testResults: TestResult[] = [];

    console.log('🧪 Starting test suite...');

    for (const test of this.tests) {
      try {
        const result = await test();
        testResults.push(result);
        
        if (result.passed) {
          console.log(`✅ ${result.name} (${result.duration.toFixed(2)}ms)`);
        } else {
          console.error(`❌ ${result.name}: ${result.error}`);
        }
      } catch (error) {
        const errorResult: TestResult = {
          name: 'Test Runner Error',
          passed: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error)
        };
        testResults.push(errorResult);
        console.error(`💥 Test runner error:`, error);
      }
    }

    const duration = performance.now() - startTime;
    const passed = testResults.filter(r => r.passed).length;
    const failed = testResults.filter(r => !r.passed).length;

    const suite: TestSuite = {
      name: 'Editor Test Suite',
      tests: testResults,
      duration,
      passed,
      failed
    };

    this.results.push(suite);

    console.log(`\n📊 Test Results:`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️ Duration: ${duration.toFixed(2)}ms`);

    return suite;
  }

  // Get test results
  getResults(): TestSuite[] {
    return this.results;
  }

  // Clear results
  clearResults() {
    this.results = [];
  }
}

// Global test runner instance
export const testRunner = new TestRunner();

// Editor-specific tests
export const addEditorTests = (editor: any, editorElement: HTMLElement) => {
  // Basic functionality tests
  testRunner.addTest('Editor Initialization', () => {
    if (!editor) throw new Error('Editor not initialized');
    if (!editorElement) throw new Error('Editor element not found');
    if (!editor.state) throw new Error('Editor state not available');
    if (!editor.view) throw new Error('Editor view not available');
  });

  testRunner.addTest('Editor Content Access', () => {
    const content = editor.getHTML();
    if (typeof content !== 'string') throw new Error('Editor content not accessible');
  });

  testRunner.addTest('Editor Commands Available', () => {
    const commands = ['setContent', 'focus', 'blur'];
    for (const cmd of commands) {
      if (typeof editor.commands[cmd] !== 'function') {
        throw new Error(`Command ${cmd} not available`);
      }
    }
  });

  testRunner.addTest('Editor Methods Available', () => {
    const methods = ['getHTML', 'getText', 'isEmpty'];
    for (const method of methods) {
      if (typeof editor[method] !== 'function') {
        throw new Error(`Method ${method} not available`);
      }
    }
  });

  // Performance tests
  testRunner.addTest('Editor Performance - Content Update', async () => {
    const startTime = performance.now();
    editor.commands.setContent('<p>Test content</p>');
    const duration = performance.now() - startTime;
    
    if (duration > 100) {
      throw new Error(`Content update too slow: ${duration.toFixed(2)}ms`);
    }
    
    errorMonitor.reportMetric('content_update', duration, 'ms', 'Editor');
  });

  testRunner.addTest('Editor Performance - Large Content', async () => {
    const largeContent = '<p>' + 'Lorem ipsum '.repeat(1000) + '</p>';
    const startTime = performance.now();
    editor.commands.setContent(largeContent);
    const duration = performance.now() - startTime;
    
    if (duration > 500) {
      throw new Error(`Large content update too slow: ${duration.toFixed(2)}ms`);
    }
    
    errorMonitor.reportMetric('large_content_update', duration, 'ms', 'Editor');
  });

  // Memory tests
  testRunner.addTest('Memory Usage Check', () => {
    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      const totalMB = memory.totalJSHeapSize / 1024 / 1024;
      
      if (usedMB > 100) {
        throw new Error(`High memory usage: ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB`);
      }
      
      errorMonitor.reportMetric('memory_used', usedMB, 'MB', 'Editor');
    }
  });

  // API tests
  testRunner.addTest('API Endpoint - Anthropic', async () => {
    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Test prompt',
        content: 'Test content',
        model: 'claude-3-5-haiku-20241022',
        mode: 'chat',
        maxTokens: 50
      })
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    if (!data.response) {
      throw new Error('API response missing response field');
    }
  });

  testRunner.addTest('API Performance - Response Time', async () => {
    const startTime = performance.now();
    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Quick test',
        content: 'Test',
        model: 'claude-3-5-haiku-20241022',
        mode: 'chat',
        maxTokens: 10
      })
    });
    const duration = performance.now() - startTime;
    
    if (duration > 5000) {
      throw new Error(`API response too slow: ${duration.toFixed(2)}ms`);
    }
    
    errorMonitor.reportMetric('api_response_time', duration, 'ms', 'API');
  });

  // Cache tests
  testRunner.addTest('Cache Statistics Endpoint', async () => {
    const response = await fetch('/api/anthropic');
    if (!response.ok) {
      throw new Error(`Cache stats endpoint failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.cache) {
      throw new Error('Cache stats missing cache data');
    }
  });

  // UI tests
  testRunner.addTest('UI Elements Present', () => {
    const requiredElements = [
      '[data-testid="editor"]',
      '[data-testid="toolbar"]',
      '[data-testid="version-selector"]'
    ];
    
    for (const selector of requiredElements) {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Required UI element not found: ${selector}`);
      }
    }
  });

  testRunner.addTest('Debug Panel Toggle', () => {
    const debugButton = document.querySelector('[title="Toggle Debug Panel"]');
    if (!debugButton) {
      throw new Error('Debug panel toggle button not found');
    }
    
    // Test click
    (debugButton as HTMLElement).click();
    const debugPanel = document.querySelector('[data-testid="debug-panel"]');
    if (!debugPanel) {
      throw new Error('Debug panel not showing after click');
    }
  });
};

// Auto-run tests on page load
export const runAutoTests = () => {
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      setTimeout(() => {
        console.log('🚀 Running automatic tests...');
        testRunner.runAllTests();
      }, 3000); // Wait longer for editor to fully initialize
    });
  }
};
