/**
 * Simple Test Runner
 * Basic functionality testing without overcomplication
 */

interface SimpleTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class SimpleTestRunner {
  private tests: Array<() => SimpleTestResult> = [];

  addTest(name: string, testFn: () => void) {
    this.tests.push((): SimpleTestResult => {
      try {
        testFn();
        return { name, passed: true };
      } catch (error) {
        return { 
          name, 
          passed: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
  }

  runTests(): SimpleTestResult[] {
    console.log('🧪 Running simple tests...');
    const results: SimpleTestResult[] = [];

    for (const test of this.tests) {
      const result = test();
      results.push(result);
      
      if (result.passed) {
        console.log(`✅ ${result.name}`);
      } else {
        console.error(`❌ ${result.name}: ${result.error}`);
      }
    }

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`\n📊 Results: ${passed}/${total} tests passed`);

    return results;
  }

  clearTests() {
    this.tests = [];
  }
}

export const simpleTestRunner = new SimpleTestRunner();

// Basic editor tests
export const addBasicEditorTests = (editor: any) => {
  simpleTestRunner.clearTests();

  simpleTestRunner.addTest('Editor exists', () => {
    if (!editor) throw new Error('Editor not found');
  });

  simpleTestRunner.addTest('Can get content', () => {
    const content = editor.getHTML();
    if (typeof content !== 'string') throw new Error('Cannot get content');
  });

  simpleTestRunner.addTest('Can set content', () => {
    editor.commands.setContent('<p>Test</p>');
    const content = editor.getHTML();
    if (!content.includes('Test')) throw new Error('Content not set');
  });

  simpleTestRunner.addTest('Can focus editor', () => {
    editor.commands.focus();
    // Just check it doesn't throw an error
  });

  simpleTestRunner.addTest('API endpoint responds', async () => {
    const response = await fetch('/api/anthropic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Test',
        content: 'Test',
        model: 'claude-3-5-haiku-20241022',
        mode: 'chat',
        maxTokens: 10
      })
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
  });
};

// Auto-run basic tests
export const runBasicTests = () => {
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      console.log('🚀 Running basic tests...');
      simpleTestRunner.runTests();
    }, 2000);
  }
};
