"use client";

import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, signInAnonymously } from 'firebase/auth';
import { useAuth as useFirebaseAuth, useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Compass, AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth as useContextAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestState, setGuestState] = useState('QLD');
  const router = useRouter();
  const auth = useFirebaseAuth();
  const { setMockAuth } = useContextAuth();
  const { toast } = useToast();
  const db = useFirestore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    setLoading(true);
    setError('');
    
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      
      // Record login time
      if (db && cred.user) {
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            lastLoginAt: serverTimestamp(),
            isOnline: true
          }, { merge: true });
        } catch (e) {
          console.warn("Could not log login time", e);
        }
      }

      // Set cookie for middleware
      document.cookie = "auth_status=1; path=/; max-age=86400";

      router.push('/dashboard');
    } catch (err: any) {
      console.error("Auth error:", err);
      // Detailed error reporting for territory troubleshooting
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid corporate credentials. Please verify your email and password.');
      } else if (err.code === 'auth/user-disabled') {
        setError('This account has been disabled. Contact system administration.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Auth provider not enabled. Please enable Email/Password in Firebase Console.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Access throttled due to multiple failed attempts. Please wait.');
      } else {
        setError(`Authentication Error (${err.code || 'Unknown'}): Please check your connection and configuration.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth) return;
    if (!email) {
      setError('Please enter your corporate email address first.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Recovery Dispatched",
        description: "A secure reset link has been sent to your corporate email.",
      });
    } catch (err: any) {
      setError('Could not initiate recovery. Verify your email address.');
    }
  };

  const handleDemoBypass = () => {
    setMockAuth({
      uid: 'demo-leader-123',
      name: 'Demo Executive',
      role: 'LEADER',
      territory: 'METRO_NORTH',
      specialisation: 'Strategic Operations',
      isMock: true
    });
    // Set cookie for middleware
    document.cookie = "auth_status=1; path=/; max-age=86400";
    router.push('/dashboard');
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    
    const lowerEmail = guestEmail.toLowerCase().trim();
    if (!lowerEmail.endsWith('@teamglobalexp.com')) {
      setError('Guest access requires a valid @teamglobalexp.com email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cred = await signInAnonymously(auth);
      
      if (db && cred.user) {
        await setDoc(doc(db, 'users', cred.user.uid), {
          email: lowerEmail,
          name: guestName,
          state: guestState,
          role: 'GUEST',
          isGuest: true,
          lastLoginAt: serverTimestamp(),
          isOnline: true
        }, { merge: true });
      }

      document.cookie = "auth_status=1; path=/; max-age=86400";
      router.push('/dashboard');
    } catch (err: any) {
      console.error("Guest Auth error:", err);
      setError(`Guest Access Error (${err.code || 'Unknown'}): Please check your connection.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F7F6F8]">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="bg-primary p-3 rounded-2xl shadow-lg hover:rotate-3 transition-transform cursor-pointer">
            <Compass className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold font-headline text-primary tracking-tight">BDM Compass</h1>
          <p className="text-muted-foreground font-medium">Enterprise Performance Visibility Hub</p>
        </div>

        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-sm">
          <Tabs defaultValue="corporate" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-t-xl rounded-b-none h-12 bg-slate-100/50">
              <TabsTrigger value="corporate" className="text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-none rounded-tl-xl rounded-tr-none">Corporate</TabsTrigger>
              <TabsTrigger value="guest" className="text-xs font-bold uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-none rounded-tr-xl rounded-tl-none">Guest Access</TabsTrigger>
            </TabsList>
            
            <TabsContent value="corporate" className="m-0 border-t border-slate-100">
              <CardHeader className="space-y-1 pt-6">
                <CardTitle className="text-2xl font-bold">Secure Access</CardTitle>
                <CardDescription>
                  Identify yourself to access the WA Territory governance nodes.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {error && (
                  <Alert variant="destructive" className="py-3 border-red-200 bg-red-50/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Corporate Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="name@company.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-muted/30 border-transparent focus:border-primary/20 transition-all"
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" title="Password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Access Key</Label>
                      <Button 
                        variant="link" 
                        type="button" 
                        onClick={handlePasswordReset}
                        className="p-0 h-auto text-[10px] text-accent font-bold uppercase tracking-widest"
                      >
                        Recovery
                      </Button>
                    </div>
                    <Input 
                      id="password" 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-muted/30 border-transparent focus:border-primary/20 transition-all"
                      required 
                    />
                  </div>
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-11 font-bold" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Authorize Connection"}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pb-6">
                 <div className="text-[10px] text-center text-muted-foreground/60 px-4 leading-relaxed font-medium">
                    PROTECTED SYSTEM. Unauthorized access attempts are flagged for review by the Governance Committee.
                 </div>
              </CardFooter>
            </TabsContent>

            <TabsContent value="guest" className="m-0 border-t border-slate-100">
              <CardHeader className="space-y-1 pt-6">
                <CardTitle className="text-2xl font-bold">TWTW Guest Portal</CardTitle>
                <CardDescription>
                  Submit your weekly performance update. Passwordless entry.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {error && (
                  <Alert variant="destructive" className="py-3 border-red-200 bg-red-50/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs font-medium">{error}</AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleGuestLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestEmail" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Corporate Email</Label>
                    <Input 
                      id="guestEmail" 
                      type="email" 
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="bg-muted/30 border-transparent focus:border-primary/20 transition-all"
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your Name</Label>
                    <Input 
                      id="guestName" 
                      type="text" 
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="bg-muted/30 border-transparent focus:border-primary/20 transition-all"
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestState" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Operating State</Label>
                    <Select value={guestState} onValueChange={setGuestState} required>
                      <SelectTrigger className="w-full bg-muted/30 border-transparent focus:border-primary/20 transition-all">
                        <SelectValue placeholder="Select your state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QLD">Queensland (QLD)</SelectItem>
                        <SelectItem value="SA">South Australia (SA)</SelectItem>
                        <SelectItem value="WA">Western Australia (WA)</SelectItem>
                        <SelectItem value="SME">SME</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20 h-11 font-bold text-white mt-2" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Access Guest Portal"}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pb-6">
                 <div className="text-[10px] text-center text-muted-foreground/60 px-4 leading-relaxed font-medium">
                    Guest access is restricted to the TWTW module only. Other governance nodes are inaccessible.
                 </div>
              </CardFooter>
            </TabsContent>
          </Tabs>
        </Card>

        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 text-[10px] text-center space-y-1">
          <p className="font-bold text-primary opacity-60 uppercase tracking-widest">System Security: Active</p>
          <p className="text-muted-foreground font-medium">Encryption: AES-256-GCM • Auth Node: Firebase SSL</p>
        </div>
      </div>
    </div>
  );
}
