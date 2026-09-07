import React from 'react';

export function ViewSkeleton() {
  return (
    <div className="w-full p-4 md:p-8 space-y-6 animate-pulse">
      <div className="flex justify-between items-end mb-6">
        <div>
          <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2"></div>
          <div className="h-4 w-96 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="hidden md:flex gap-2">
          <div className="h-10 w-24 bg-slate-100 rounded-lg"></div>
          <div className="h-10 w-24 bg-slate-100 rounded-lg"></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-white border border-slate-100 rounded-xl shadow-sm p-4">
            <div className="h-4 w-1/2 bg-slate-100 rounded mb-4"></div>
            <div className="h-8 w-3/4 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
      
      <div className="h-[400px] bg-white border border-slate-100 rounded-xl shadow-sm p-6">
        <div className="h-6 w-48 bg-slate-200 rounded mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="h-12 w-12 bg-slate-100 rounded-full shrink-0"></div>
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
                <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
