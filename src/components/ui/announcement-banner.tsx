"use client";

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Megaphone, X, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

export function AnnouncementBanner() {
  const db = useFirestore();
  const [isVisible, setIsVisible] = useState(true);

  const announcementDocRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'systemAnnouncements', 'current');
  }, [db]);

  const { data: announcement, isLoading } = useDoc(announcementDocRef);

  // Reset visibility when a new system message is published
  useEffect(() => {
    if (announcement?.message) {
      setIsVisible(true);
    }
  }, [announcement?.message]);

  if (isLoading || !announcement?.active || !isVisible) return null;

  return (
    <div className="bg-accent text-white py-2.5 px-4 relative overflow-hidden animate-in slide-in-from-top duration-500 shadow-lg z-[60]">
      {/* Decorative shimmer animation */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
      
      <div className="container mx-auto flex items-center justify-between gap-4 relative">
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          <div className="bg-white/20 p-1.5 rounded-lg flex-shrink-0">
            <Megaphone className="w-4 h-4" />
          </div>
          <p className="text-xs md:text-sm font-bold tracking-tight truncate">
            <span className="uppercase tracking-widest text-[10px] bg-white/30 px-1.5 py-0.5 rounded mr-2 font-black">Broadcast</span>
            {announcement.message}
          </p>
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          aria-label="Dismiss announcement"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite linear;
        }
      `}</style>
    </div>
  );
}