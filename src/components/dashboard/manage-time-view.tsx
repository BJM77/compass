"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Plus, Trash2, Clock, CalendarClock, Users, XCircle, FileDown, Inbox, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type Task = {
  id: string;
  text: string;
  quadrant?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
};

type QuadrantData = {
  id: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  title: string;
  subtitle: string;
  description: string;
  action: string;
  icon: React.ElementType;
  colorClass: string;
  bgColorClass: string;
  borderColorClass: string;
};

const QUADRANTS: QuadrantData[] = [
  {
    id: 'Q1',
    title: 'Box 1: Do Now',
    subtitle: 'Urgent & Important',
    description: 'Crises, strict deadlines, sudden problems.',
    action: 'Do these right now.',
    icon: Clock,
    colorClass: 'text-red-600',
    bgColorClass: 'bg-red-50',
    borderColorClass: 'border-red-200',
  },
  {
    id: 'Q2',
    title: 'Box 2: Today',
    subtitle: 'Not Urgent & Important',
    description: 'Long-term planning, self-care, learning.',
    action: 'Put these in your calendar for later.',
    icon: CalendarClock,
    colorClass: 'text-blue-600',
    bgColorClass: 'bg-blue-50',
    borderColorClass: 'border-blue-200',
  },
  {
    id: 'Q3',
    title: 'Box 3: Delegate',
    subtitle: 'Urgent & Not Important',
    description: 'Most phone calls, interruptions, meetings.',
    action: 'Let someone else handle these if you can.',
    icon: Users,
    colorClass: 'text-amber-600',
    bgColorClass: 'bg-amber-50',
    borderColorClass: 'border-amber-200',
  },
  {
    id: 'Q4',
    title: 'Box 4: Delete',
    subtitle: 'Not Urgent & Not Important',
    description: 'Mindless scrolling, busywork that adds no value.',
    action: 'Cut these out of your day.',
    icon: XCircle,
    colorClass: 'text-slate-500',
    bgColorClass: 'bg-slate-50',
    borderColorClass: 'border-slate-200',
  }
];

export function ManageTimeView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');

  const handlePrint = () => {
    window.print();
  };

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text) return;
    
    setTasks(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(), text }
    ]);
    
    setNewTaskText('');
  };

  const removeTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const updateTaskText = (taskId: string, newText: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, text: newText } : t));
  };

  const setTaskQuadrant = (taskId: string, quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4' | undefined) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, quadrant } : t));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask();
    }
  };

  const inboxTasks = tasks.filter(t => !t.quadrant);

  return (
    <div className="max-w-6xl mx-auto space-y-8 print:m-0 print:p-0 print:max-w-none print:bg-white print:space-y-4">
      
      {/* Header section: Visible on screen, hidden on print unless specified */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:mb-8 print:flex-row print:border-b-2 print:border-slate-800 print:pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-indigo-600 print:text-slate-800" />
            Time Management Matrix
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1 max-w-2xl print:hidden">
            First, brain dump all your tasks into the inbox below. Then, select a quadrant (Do Now, Today, Delegate, Delete) for each to organize them into the Eisenhower Matrix.
          </p>
          {/* Print only subtitle showing date */}
          <p className="hidden print:block text-slate-600 font-bold mt-2">
            Plan for: {format(new Date(), 'EEEE, MMMM do yyyy')}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold tracking-wide">
            <Printer className="w-4 h-4 mr-2" />
            Print Matrix
          </Button>
        </div>
      </div>

      {/* Task Inbox - Hidden on print */}
      <Card className="border-2 shadow-sm print:hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <Inbox className="w-6 h-6 text-indigo-600" />
            Task Inbox
          </CardTitle>
          <CardDescription>Enter all your tasks here first, then assign them to a quadrant.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="What needs to get done? Add tasks here..."
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-12 text-base shadow-sm focus-visible:ring-indigo-500"
            />
            <Button 
              size="lg"
              onClick={addTask}
              disabled={!newTaskText.trim()}
              className="bg-slate-900 hover:bg-slate-800 text-white shrink-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Task
            </Button>
          </div>

          {inboxTasks.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wider mb-2">Uncategorized Tasks ({inboxTasks.length})</h3>
              <div className="space-y-3">
                {inboxTasks.map((task) => (
                  <div key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white p-3 md:p-4 rounded-lg border border-slate-200 shadow-sm transition-all hover:border-indigo-200">
                    <div className="flex-1">
                      <Input 
                        value={task.text}
                        onChange={(e) => updateTaskText(task.id, e.target.value)}
                        className="h-10 border-transparent hover:border-slate-200 focus:border-indigo-300 shadow-none px-2 font-medium text-slate-900 text-base"
                      />
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                      {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
                        const qData = QUADRANTS.find(x => x.id === q)!;
                        let shortLabel = "Q";
                        if (q === 'Q1') shortLabel = "Do Now";
                        if (q === 'Q2') shortLabel = "Today";
                        if (q === 'Q3') shortLabel = "Delegate";
                        if (q === 'Q4') shortLabel = "Delete";
                        
                        return (
                          <Button
                            key={q}
                            variant="outline"
                            size="sm"
                            onClick={() => setTaskQuadrant(task.id, q)}
                            className={`h-8 text-xs font-semibold ${qData.colorClass} border-transparent hover:${qData.bgColorClass} hover:border-${qData.colorClass.split('-')[1]}-200`}
                          >
                            {shortLabel}
                          </Button>
                        );
                      })}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTask(task.id)}
                        className="h-8 w-8 ml-1 text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {inboxTasks.length === 0 && tasks.length > 0 && (
            <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>All tasks categorized!</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 print:grid-cols-2">
        {QUADRANTS.map((quadrant) => {
          const qTasks = tasks.filter(t => t.quadrant === quadrant.id);
          
          return (
            <Card key={quadrant.id} className={`border-2 shadow-sm flex flex-col h-full print:shadow-none print:border-2 print:border-slate-300 ${quadrant.borderColorClass}`}>
              <CardHeader className={`pb-2 pt-3 ${quadrant.bgColorClass} print:bg-transparent print:border-b-2 print:border-slate-300 rounded-t-xl print:rounded-none flex-row justify-between items-start`}>
                <div>
                  <CardTitle className={`flex items-center gap-2 text-lg font-black ${quadrant.colorClass} print:text-slate-900`}>
                    <quadrant.icon className="w-5 h-5" />
                    {quadrant.title}
                  </CardTitle>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 p-4 flex flex-col gap-3 print:pt-4">
                {/* List of active tasks */}
                <div className="space-y-2 flex-1">
                  {qTasks.map((task) => (
                    <div key={task.id} className="flex items-start gap-2 group print:items-end print:border-b print:border-slate-200 print:pb-1">
                      <div className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 print:bg-slate-800 print:mb-2"></div>
                      <div className="flex-1">
                        <Input 
                          value={task.text}
                          onChange={(e) => updateTaskText(task.id, e.target.value)}
                          className="h-8 border-transparent hover:border-slate-200 focus:border-indigo-300 shadow-none px-2 font-medium print:border-none print:px-0 print:bg-transparent print:text-slate-900 print:text-sm print:resize-none print:h-auto"
                        />
                      </div>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setTaskQuadrant(task.id, undefined)}
                          title="Move back to inbox"
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Inbox className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTask(task.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {qTasks.length === 0 && (
                    <div className="text-sm text-slate-400 italic py-2 print:hidden">
                      No tasks in this quadrant.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
