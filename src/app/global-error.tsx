'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="font-body antialiased bg-background">
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-900 p-4">
          <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
          <p className="text-lg text-gray-600 mb-8 max-w-md text-center">
            A critical error occurred. Please try refreshing the page or contact support if the issue persists.
          </p>
          <button
            onClick={() => reset()}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
