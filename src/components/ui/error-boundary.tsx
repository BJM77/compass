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
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-card rounded-xl border border-destructive/15 shadow-sm m-4">
          <div className="w-16 h-16 bg-danger-soft rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Failed to load this view</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Something went wrong while rendering this section of the dashboard. The rest of the application is still functioning normally.
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleReset} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="default" className="bg-panel text-panel-foreground flex items-center gap-2">
              Reload Page
            </Button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 p-4 bg-secondary/60 rounded-lg text-left overflow-auto max-w-2xl w-full text-xs text-destructive border border-destructive/15">
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
