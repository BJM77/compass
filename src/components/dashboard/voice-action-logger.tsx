"use client";

import { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Save, Loader2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { getCurrentWeek } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

export function VoiceActionLogger({ userId, userName }: { userId: string, userName: string }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            setTranscript(prev => prev + event.results[i][0].transcript + ' ');
          } else {
            currentTranscript += event.results[i][0].transcript;
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
        toast({ variant: "destructive", title: "Microphone Error", description: event.error });
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, [toast]);

  const toggleRecording = () => {
    if (!recognitionRef.current) {
      toast({ variant: "destructive", title: "Not Supported", description: "Your browser does not support Voice Dictation. Please use Chrome or Safari." });
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleSave = async () => {
    if (!db || !transcript.trim()) return;
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId,
        userName,
        type: 'Site Visit', 
        description: transcript.trim(),
        date: format(new Date(), 'yyyy-MM-dd'),
        week: getCurrentWeek(),
        createdAt: serverTimestamp()
      });
      
      toast({ title: "Action Logged", description: "Voice note synchronized to Activity Logger." });
      setTranscript('');
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Failed to log action." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-card border-2 border-border/60 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-accent/20 transition-colors">
      {isRecording && <div className="absolute inset-0 bg-destructive/5 animate-pulse pointer-events-none" />}
      
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <h3 className="text-sm font-bold text-primary flex items-center gap-2 tracking-tight">
            <Play className="w-4 h-4 text-accent" />
            Field Dictation
          </h3>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-0.5">Voice-to-Text Outcome Logger</p>
        </div>
        
        <Button 
          onClick={toggleRecording}
          size="icon"
          className={`rounded-full w-12 h-12 shadow-lg transition-all duration-300 ${isRecording ? 'bg-destructive hover:bg-destructive/90 scale-110 shadow-destructive/20' : 'bg-panel hover:bg-panel/80'}`}
        >
          {isRecording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
        </Button>
      </div>

      <div className="space-y-3 relative z-10">
        <Textarea 
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Tap microphone to dictate outcome..."
          className="min-h-[100px] text-xs font-medium border-border bg-secondary/60 focus:bg-card resize-none shadow-inner"
        />
        
        <div className="flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={!transcript.trim() || isSaving || isRecording}
            className="bg-accent font-semibold text-xs h-9 gap-2 shadow-md hover:bg-accent/90"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Sync Log
          </Button>
        </div>
      </div>
    </div>
  );
}
