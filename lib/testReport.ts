/**
 * Test Report Generator
 * Generates comprehensive test reports and recommendations
 */

import { errorMonitor } from './errorMonitoring';
import { testRunner } from './testRunner';

interface TestReport {
  timestamp: string;
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    successRate: number;
    duration: number;
  };
  errors: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recent: Array<{
      message: string;
      component?: string;
      severity: string;
      timestamp: string;
    }>;
  };
  performance: {
    averageRenderTime: number;
    memoryUsage: {
      used: number;
      total: number;
      percentage: number;
    };
    cacheStats?: any;
  };
  recommendations: string[];
  score: number; // 0-100
}

export class TestReportGenerator {
  async generateReport(): Promise<TestReport> {
    // Run tests
    const testSuite = await testRunner.runAllTests();
    
    // Get error statistics
    const errorStats = errorMonitor.getErrorStats();
    
    // Get performance metrics
    const memory = (performance as any).memory;
    const memoryUsage = memory ? {
      used: memory.usedJSHeapSize / 1024 / 1024,
      total: memory.totalJSHeapSize / 1024 / 1024,
      percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
    } : { used: 0, total: 0, percentage: 0 };

    // Get cache statistics
    let cacheStats;
    try {
      const response = await fetch('/api/anthropic');
      cacheStats = await response.json();
    } catch (e) {
      console.warn('Could not fetch cache stats:', e);
    }

    // Calculate score
    const score = this.calculateScore(testSuite, errorStats, memoryUsage);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(testSuite, errorStats, memoryUsage, cacheStats);

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: testSuite.tests.length,
        passed: testSuite.passed,
        failed: testSuite.failed,
        successRate: (testSuite.passed / testSuite.tests.length) * 100,
        duration: testSuite.duration
      },
      errors: {
        total: errorStats.total,
        critical: errorStats.bySeverity.critical,
        high: errorStats.bySeverity.high,
        medium: errorStats.bySeverity.medium,
        low: errorStats.bySeverity.low,
        recent: errorStats.recent.map(e => ({
          message: e.message,
          component: e.component,
          severity: e.severity,
          timestamp: e.timestamp.toISOString()
        }))
      },
      performance: {
        averageRenderTime: 0, // This would come from performance monitoring
        memoryUsage,
        cacheStats
      },
      recommendations,
      score
    };
  }

  private calculateScore(testSuite: any, errorStats: any, memoryUsage: any): number {
    let score = 100;

    // Deduct points for failed tests
    const testFailureRate = testSuite.failed / testSuite.tests.length;
    score -= testFailureRate * 40; // Up to 40 points for test failures

    // Deduct points for errors
    if (errorStats.bySeverity.critical > 0) score -= 30;
    if (errorStats.bySeverity.high > 5) score -= 20;
    if (errorStats.bySeverity.medium > 10) score -= 10;

    // Deduct points for memory usage
    if (memoryUsage.percentage > 80) score -= 15;
    else if (memoryUsage.percentage > 60) score -= 10;
    else if (memoryUsage.percentage > 40) score -= 5;

    // Deduct points for performance
    if (testSuite.duration > 10000) score -= 10; // Slow tests
    if (testSuite.duration > 5000) score -= 5;

    return Math.max(0, Math.round(score));
  }

  private generateRecommendations(testSuite: any, errorStats: any, memoryUsage: any, cacheStats: any): string[] {
    const recommendations: string[] = [];

    // Test-related recommendations
    if (testSuite.failed > 0) {
      recommendations.push(`Fix ${testSuite.failed} failing tests to improve reliability`);
    }

    if (testSuite.duration > 5000) {
      recommendations.push('Optimize test performance - tests are running slowly');
    }

    // Error-related recommendations
    if (errorStats.bySeverity.critical > 0) {
      recommendations.push('🚨 CRITICAL: Fix critical errors immediately');
    }

    if (errorStats.bySeverity.high > 5) {
      recommendations.push('⚠️ HIGH: Address high-severity errors');
    }

    if (errorStats.total > 20) {
      recommendations.push('Consider implementing better error handling');
    }

    // Memory-related recommendations
    if (memoryUsage.percentage > 80) {
      recommendations.push('🔴 HIGH MEMORY: Consider memory optimization');
    } else if (memoryUsage.percentage > 60) {
      recommendations.push('🟡 MEDIUM MEMORY: Monitor memory usage');
    }

    // Cache-related recommendations
    if (cacheStats?.cache) {
      const { hot, warm, cold } = cacheStats.cache;
      const totalHits = hot.hits + warm.hits + cold.hits;
      const totalSize = hot.size + warm.size + cold.size;
      
      if (totalHits === 0) {
        recommendations.push('Cache not being utilized - check API calls');
      }
      
      if (totalSize > 100) {
        recommendations.push('Cache size is large - consider cleanup');
      }
    }

    // Performance recommendations
    if (testSuite.tests.some((t: any) => t.duration > 1000)) {
      recommendations.push('Some operations are slow - consider optimization');
    }

    // General recommendations
    if (recommendations.length === 0) {
      recommendations.push('✅ System is performing well!');
    }

    return recommendations;
  }

  async generateHTMLReport(): Promise<string> {
    const report = await this.generateReport();
    
    const getScoreColor = (score: number) => {
      if (score >= 90) return '#10B981'; // Green
      if (score >= 70) return '#F59E0B'; // Yellow
      if (score >= 50) return '#EF4444'; // Red
      return '#DC2626'; // Dark red
    };

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verzer Editor Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .score { font-size: 3rem; font-weight: bold; color: ${getScoreColor(report.score)}; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; padding: 20px; }
        .card { background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; }
        .card h3 { margin: 0 0 15px 0; color: #1f2937; }
        .metric { display: flex; justify-content: space-between; margin: 8px 0; }
        .metric-value { font-weight: bold; }
        .recommendations { background: #fef3c7; border-left-color: #f59e0b; }
        .recommendations ul { margin: 0; padding-left: 20px; }
        .recommendations li { margin: 8px 0; }
        .error { color: #dc2626; }
        .warning { color: #f59e0b; }
        .success { color: #10b981; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Verzer Editor Test Report</h1>
            <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
            <div class="score">${report.score}/100</div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h3>📊 Test Summary</h3>
                <div class="metric">
                    <span>Total Tests:</span>
                    <span class="metric-value">${report.summary.totalTests}</span>
                </div>
                <div class="metric">
                    <span>Passed:</span>
                    <span class="metric-value success">${report.summary.passed}</span>
                </div>
                <div class="metric">
                    <span>Failed:</span>
                    <span class="metric-value ${report.summary.failed > 0 ? 'error' : 'success'}">${report.summary.failed}</span>
                </div>
                <div class="metric">
                    <span>Success Rate:</span>
                    <span class="metric-value">${report.summary.successRate.toFixed(1)}%</span>
                </div>
                <div class="metric">
                    <span>Duration:</span>
                    <span class="metric-value">${report.summary.duration.toFixed(0)}ms</span>
                </div>
            </div>

            <div class="card">
                <h3>🚨 Error Summary</h3>
                <div class="metric">
                    <span>Total Errors:</span>
                    <span class="metric-value ${report.errors.total > 0 ? 'error' : 'success'}">${report.errors.total}</span>
                </div>
                <div class="metric">
                    <span>Critical:</span>
                    <span class="metric-value error">${report.errors.critical}</span>
                </div>
                <div class="metric">
                    <span>High:</span>
                    <span class="metric-value ${report.errors.high > 0 ? 'error' : 'success'}">${report.errors.high}</span>
                </div>
                <div class="metric">
                    <span>Medium:</span>
                    <span class="metric-value ${report.errors.medium > 0 ? 'warning' : 'success'}">${report.errors.medium}</span>
                </div>
                <div class="metric">
                    <span>Low:</span>
                    <span class="metric-value">${report.errors.low}</span>
                </div>
            </div>

            <div class="card">
                <h3>💾 Memory Usage</h3>
                <div class="metric">
                    <span>Used:</span>
                    <span class="metric-value">${report.performance.memoryUsage.used.toFixed(1)}MB</span>
                </div>
                <div class="metric">
                    <span>Total:</span>
                    <span class="metric-value">${report.performance.memoryUsage.total.toFixed(1)}MB</span>
                </div>
                <div class="metric">
                    <span>Percentage:</span>
                    <span class="metric-value ${report.performance.memoryUsage.percentage > 80 ? 'error' : report.performance.memoryUsage.percentage > 60 ? 'warning' : 'success'}">${report.performance.memoryUsage.percentage.toFixed(1)}%</span>
                </div>
            </div>

            <div class="card recommendations">
                <h3>💡 Recommendations</h3>
                <ul>
                    ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>
    </div>
</body>
</html>`;
  }
}

export const testReportGenerator = new TestReportGenerator();
