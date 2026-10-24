import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h2 className="text-4xl font-bold mb-4">404</h2>
      <p className="text-xl text-foreground/75 mb-8">This page could not be found.</p>
      <Link 
        href="/"
        className="px-6 py-2 bg-black text-white rounded-md hover:bg-panel/80 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
