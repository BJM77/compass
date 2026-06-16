"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { MobileDashboard } from '@/components/dashboard/mobile-dashboard';
import { useIsMobile } from '@/lib/mobile-utils';
import { Loader2 } from 'lucide-react';
import { PipelineProvider } from '@/contexts/pipeline-context';

export default function MobileDashboardPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }

      // If on desktop, redirect to the main dashboard
      if (!isMobile && !isRedirecting) {
        setIsRedirecting(true);
        router.push('/dashboard');
      }
    }
  }, [user, loading, router, isMobile, isRedirecting]);

  if (loading || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F6F8]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // Only render on mobile
  if (!isMobile) return null;

  return (
    <PipelineProvider>
      <MobileDashboard userId={user.uid} userName={profile?.name || user.email || 'User'} />
    </PipelineProvider>
  );
}
