"use client";

import { useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { useAuth } from '@/contexts/auth-context';
import { TestWeeklyGoals } from '@/components/dashboard/test/test-weekly-goals';
import { TestBDMWeeklySubmission } from '@/components/dashboard/test/test-bdm-weekly-submission';
import { TestFridayReviewHub } from '@/components/dashboard/test/test-friday-review-hub';
import { TestGMWeeklyReview } from '@/components/dashboard/test/test-gm-weekly-review';
import { TestGMReportGenerator } from '@/components/dashboard/test/test-gm-report-generator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, AlertTriangle } from 'lucide-react';

export default function TestPage() {
  const { user, profile } = useAuth();
  
  const userId = user?.uid || '';
  const userName = profile?.name || 'Test User';

  return (
    <AuthGuard>
      <div className="container mx-auto p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            TEST ENVIRONMENT
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            This page points to isolated test data collections. Changes here do not affect production data.
          </p>
        </div>

        <Tabs defaultValue="monday" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="monday">Monday Plan</TabsTrigger>
            <TabsTrigger value="friday_submission">Friday Submission</TabsTrigger>
            <TabsTrigger value="friday_hub">Friday Review Hub</TabsTrigger>
            <TabsTrigger value="gm">GM Command Hub</TabsTrigger>
            <TabsTrigger value="pdf">PDF Dispatch</TabsTrigger>
          </TabsList>
          
          <TabsContent value="monday">
            <TestWeeklyGoals userId={userId} />
          </TabsContent>
          
          <TabsContent value="friday_submission">
            <TestBDMWeeklySubmission userId={userId} userName={userName} />
          </TabsContent>
          
          <TabsContent value="friday_hub">
            <TestFridayReviewHub />
          </TabsContent>
          
          <TabsContent value="gm">
            <TestGMWeeklyReview />
          </TabsContent>

          <TabsContent value="pdf">
            <TestGMReportGenerator />
          </TabsContent>
        </Tabs>
      </div>
    </AuthGuard>
  );
}
