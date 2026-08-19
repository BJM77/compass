"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Plus, Trash2, Clock, CalendarClock, Users, XCircle, FileDown } from 'lucide-react';
import { format } from 'date-fns';

type Task = {
  id: string;
  text: string;
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
    title: 'Box 1: Do First',
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
    title: 'Box 2: Schedule',
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
  const [tasks, setTasks] = useState<Record<string, Task[]>>({
    Q1: [], Q2: [], Q3: [], Q4: []
  });
  const [newTaskText, setNewTaskText] = useState<Record<string, string>>({
    Q1: '', Q2: '', Q3: '', Q4: ''
  });

  const handlePrint = () => {
    window.print();
  };

  const addTask = (qId: string) => {
    const text = newTaskText[qId]?.trim();
    if (!text) return;
    
    setTasks(prev => ({
      ...prev,
      [qId]: [...prev[qId], { id: Date.now().toString() + Math.random().toString(), text }]
    }));
    
    setNewTaskText(prev => ({ ...prev, [qId]: '' }));
  };

  const removeTask = (qId: string, taskId: string) => {
    setTasks(prev => ({
      ...prev,
      [qId]: prev[qId].filter(t => t.id !== taskId)
    }));
  };

  const updateTask = (qId: string, taskId: string, newText: string) => {
    setTasks(prev => ({
      ...prev,
      [qId]: prev[qId].map(t => t.id === taskId ? { ...t, text: newText } : t)
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, qId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTask(qId);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 print:m-0 print:p-0 print:max-w-none print:bg-white">
      
      {/* Header section: Visible on screen, hidden on print unless specified */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:mb-8 print:flex-row print:border-b-2 print:border-slate-800 print:pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-indigo-600 print:text-slate-800" />
            Time Management Matrix
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1 max-w-2xl print:hidden">
            The Eisenhower Matrix turns a basic to-do list into a four-box grid. Sort tasks by checking if they are urgent and important to help you choose what to do first, schedule later, hand off, or drop completely.
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

      {/* The 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4 print:grid-cols-2">
        {QUADRANTS.map((quadrant) => {
          const qTasks = tasks[quadrant.id];
          
          return (
            <Card key={quadrant.id} className={`border-2 shadow-sm flex flex-col h-full print:shadow-none print:border-2 print:border-slate-300 ${quadrant.borderColorClass}`}>
              <CardHeader className={`pb-2 pt-3 ${quadrant.bgColorClass} print:bg-transparent print:border-b-2 print:border-slate-300 rounded-t-xl print:rounded-none`}>
                <CardTitle className={`flex items-center gap-2 text-lg font-black ${quadrant.colorClass} print:text-slate-900`}>
                  <quadrant.icon className="w-5 h-5" />
                  {quadrant.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="flex-1 p-4 flex flex-col gap-3 print:pt-4">
                {/* List of active tasks */}
                <div className="space-y-2 flex-1">
                  {qTasks.map((task, index) => (
                    <div key={task.id} className="flex items-start gap-2 group print:items-end print:border-b print:border-slate-200 print:pb-1">
                      <div className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 print:bg-slate-800 print:mb-2"></div>
                      <div className="flex-1">
                        <Input 
                          value={task.text}
                          onChange={(e) => updateTask(quadrant.id, task.id, e.target.value)}
                          className="h-8 border-transparent hover:border-slate-200 focus:border-indigo-300 shadow-none px-2 font-medium print:border-none print:px-0 print:bg-transparent print:text-slate-900 print:text-sm print:resize-none print:h-auto"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTask(quadrant.id, task.id)}
                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Input to add new task - hidden on print */}
                <div className="mt-4 pt-4 border-t border-slate-100 print:hidden">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Add a new item..."
                      value={newTaskText[quadrant.id]}
                      onChange={(e) => setNewTaskText(prev => ({ ...prev, [quadrant.id]: e.target.value }))}
                      onKeyDown={(e) => handleKeyDown(e, quadrant.id)}
                      className="h-9 text-sm"
                    />
                    <Button 
                      size="sm"
                      onClick={() => addTask(quadrant.id)}
                      disabled={!newTaskText[quadrant.id]?.trim()}
                      className={`shrink-0 ${quadrant.bgColorClass} ${quadrant.colorClass} hover:opacity-80 border ${quadrant.borderColorClass}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

    </div>
  );
}
