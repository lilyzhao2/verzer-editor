/**
 * Error Monitoring & Analytics
 * Comprehensive error tracking and performance monitoring
 */

interface ErrorReport {
  id: string;
  timestamp: Date;
  type: 'error' | 'warning' | 'performance';
  message: string;
  stack?: string;
  component?: string;
  userId?: string;
  userAgent: string;
  url: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  id: string;
  timestamp: Date;
  metric: string;
  value: number;
  unit: string;
  component?: string;
  metadata?: Record<string, any>;
}

class ErrorMonitor {
  private errors: ErrorReport[] = [];
  private metrics: PerformanceMetric[] = [];
  private maxErrors = 1000;
  private maxMetrics = 5000;

  // Error tracking
  reportError(error: Error, component?: string, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium') {
    const errorReport: ErrorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type: 'error',
      message: error.message,
      stack: error.stack,
      component,
      userId: this.getCurrentUserId(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      severity,
      metadata: {
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        memory: (performance as any).memory ? {
          used: (performance as any).memory.usedJSHeapSize,
          total: (performance as any).memory.totalJSHeapSize,
          limit: (performance as any).memory.jsHeapSizeLimit,
        } : null,
      }
    };

    this.errors.push(errorReport);
    
    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`🚨 Error in ${component || 'Unknown'}:`, error);
      console.error('Error Report:', errorReport);
    }

    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(errorReport);
    }
  }

  // Performance tracking
  reportMetric(metric: string, value: number, unit: string, component?: string, metadata?: Record<string, any>) {
    const performanceMetric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      metric,
      value,
      unit,
      component,
      metadata,
    };

    this.metrics.push(performanceMetric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${metric}: ${value}${unit}`, component ? `(${component})` : '');
    }
  }

  // Get error statistics
  getErrorStats() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const lastDay = now - (24 * 60 * 60 * 1000);

    const recentErrors = this.errors.filter(e => e.timestamp.getTime() > lastHour);
    const dailyErrors = this.errors.filter(e => e.timestamp.getTime() > lastDay);

    return {
      total: this.errors.length,
      lastHour: recentErrors.length,
      lastDay: dailyErrors.length,
      bySeverity: {
        critical: this.errors.filter(e => e.severity === 'critical').length,
        high: this.errors.filter(e => e.severity === 'high').length,
        medium: this.errors.filter(e => e.severity === 'medium').length,
        low: this.errors.filter(e => e.severity === 'low').length,
      },
      byComponent: this.groupBy(this.errors, 'component'),
      recent: recentErrors.slice(-10), // Last 10 errors
    };
  }

  // Get performance statistics
  getPerformanceStats() {
    const now = Date.now();
    const lastHour = now - (60 * 60 * 1000);
    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > lastHour);

    return {
      total: this.metrics.length,
      lastHour: recentMetrics.length,
      byMetric: this.groupBy(this.metrics, 'metric'),
      byComponent: this.groupBy(this.metrics, 'component'),
      recent: recentMetrics.slice(-20), // Last 20 metrics
    };
  }

  // Get all data for debugging
  getAllData() {
    return {
      errors: this.errors,
      metrics: this.metrics,
      errorStats: this.getErrorStats(),
      performanceStats: this.getPerformanceStats(),
      timestamp: new Date().toISOString(),
    };
  }

  // Clear all data
  clearData() {
    this.errors = [];
    this.metrics = [];
  }

  // Export data for analysis
  exportData() {
    const data = this.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verzer-debug-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private getCurrentUserId(): string {
    // Try to get user ID from various sources
    return 'user-1'; // Default for now
  }

  private groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const group = String(item[key] || 'unknown');
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  private async sendToMonitoringService(errorReport: ErrorReport) {
    try {
      // In production, send to your monitoring service
      // await fetch('/api/monitoring', { method: 'POST', body: JSON.stringify(errorReport) });
      console.log('Would send to monitoring service:', errorReport);
    } catch (e) {
      console.error('Failed to send error to monitoring service:', e);
    }
  }
}

// Global error monitor instance
export const errorMonitor = new ErrorMonitor();

// Global error handlers
if (typeof window !== 'undefined') {
  // Unhandled errors
  window.addEventListener('error', (event) => {
    errorMonitor.reportError(
      new Error(event.message),
      'Global',
      'high'
    );
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    errorMonitor.reportError(
      new Error(event.reason?.message || 'Unhandled Promise Rejection'),
      'Global',
      'high'
    );
  });

  // Performance observer for long tasks
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'longtask') {
            errorMonitor.reportMetric(
              'long_task',
              entry.duration,
              'ms',
              'Performance',
              { startTime: entry.startTime }
            );
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.warn('PerformanceObserver not supported:', e);
    }
  }
}

// React Error Boundary helper
export const withErrorMonitoring = (WrappedComponent: React.ComponentType<any>) => {
  return class extends React.Component<any, { hasError: boolean }> {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      errorMonitor.reportError(
        error,
        WrappedComponent.name || 'Unknown',
        'high'
      );
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-semibold">Something went wrong</h3>
            <p className="text-red-600">An error occurred in {WrappedComponent.name || 'this component'}.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
            >
              Try Again
            </button>
          </div>
        );
      }

      return <WrappedComponent {...this.props} />;
    }
  };
};
