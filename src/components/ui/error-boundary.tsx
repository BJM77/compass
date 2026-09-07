"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in view component:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white rounded-xl border border-red-100 shadow-sm m-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Failed to load this view</h2>
          <p className="text-sm text-slate-500 mb-6 max-w-md">
            Something went wrong while rendering this section of the dashboard. The rest of the application is still functioning normally.
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleReset} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="default" className="bg-slate-900 text-white flex items-center gap-2">
              Reload Page
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 p-4 bg-slate-50 rounded-lg text-left overflow-auto max-w-2xl w-full text-xs text-red-800 border border-red-100">
              <p className="font-bold mb-1">{this.state.error.message}</p>
              <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
