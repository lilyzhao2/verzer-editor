'use client';

import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

// Loading component for lazy-loaded components
const LoadingFallback = ({ componentName }: { componentName: string }) => (
  <div className="flex items-center justify-center h-64 bg-gray-50 border border-gray-200 rounded-lg">
    <div className="text-center">
      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
      <p className="text-gray-600">Loading {componentName}...</p>
    </div>
  </div>
);

// Lazy load heavy components
export const LazyDocumentCompare = lazy(() => import('./DocumentCompare'));
export const LazyParallelView = lazy(() => import('./ParallelView'));
export const LazyCompareView = lazy(() => import('./CompareView'));
export const LazyParagraphLineageView = lazy(() => import('./ParagraphLineageView'));
export const LazyProjectSetup = lazy(() => import('./ProjectSetup'));
export const LazyVersionHistorySidebar = lazy(() => import('./VersionHistorySidebar'));
export const LazyShareModal = lazy(() => import('./ShareModal'));

// Wrapper components with error boundaries and loading states
export const DocumentCompareWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingFallback componentName="Document Compare" />}>
    <LazyDocumentCompare {...props} />
  </Suspense>
);

export const ParallelViewWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingFallback componentName="Parallel View" />}>
    <LazyParallelView {...props} />
  </Suspense>
);

export const CompareViewWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingFallback componentName="Compare View" />}>
    <LazyCompareView {...props} />
  </Suspense>
);

export const ParagraphLineageViewWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingFallback componentName="Paragraph Lineage" />}>
    <LazyParagraphLineageView {...props} />
  </Suspense>
);

export const ProjectSetupWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingFallback componentName="Project Setup" />}>
    <LazyProjectSetup {...props} />
  </Suspense>
);

export const VersionHistorySidebarWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingFallback componentName="Version History" />}>
    <LazyVersionHistorySidebar {...props} />
  </Suspense>
);

export const ShareModalWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingFallback componentName="Share Modal" />}>
    <LazyShareModal {...props} />
  </Suspense>
);

// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used soon
  import('./ProjectSetup');
  import('./VersionHistorySidebar');
};

// Preload function for heavy components (call when user hovers over buttons)
export const preloadHeavyComponents = () => {
  import('./DocumentCompare');
  import('./ParallelView');
  import('./CompareView');
};
