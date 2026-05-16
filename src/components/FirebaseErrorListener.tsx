'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (incomingError: FirestorePermissionError) => {
      console.error('FirebaseErrorListener: Caught permission error', incomingError);
      
      // Instead of throwing and crashing the app, we show a toast and log it.
      // This allows the user to continue using the rest of the app.
      toast({
        variant: "destructive",
        title: "Database Access Restricted",
        description: `Permission denied for ${incomingError.request.path}. Some data may not be visible.`,
      });
      
      // We still set the error in state if we want to show a global alert,
      // but we won't throw it here to avoid a fatal crash.
      setError(incomingError);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  // We no longer throw the error here.
  // if (error) {
  //   const errorToThrow = error;
  //   throw errorToThrow;
  // }

  return null;
}