import React from 'react';

type AppErrorBoundaryState = {
  error?: Error;
};

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Render crash caught:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-red-500/40 bg-red-950/30 p-6 shadow-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
              Runtime Error
            </div>
            <h1 className="mt-3 text-2xl font-semibold text-white">
              前端渲染出错，已阻止黑屏
            </h1>
            <p className="mt-3 text-sm text-red-100/80">
              请把下面这段错误信息发给我，我会继续定位到具体文件和行。
            </p>
            <pre className="mt-4 overflow-auto rounded-xl bg-black/40 p-4 text-xs leading-6 text-red-100 whitespace-pre-wrap">
              {this.state.error.stack || this.state.error.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
