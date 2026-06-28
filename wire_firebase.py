import re

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Imports
imports_old = r"import \{ useState, useMemo, useEffect \} from 'react';\nimport \{ Card, CardContent, CardHeader, CardTitle, CardDescription \} from '@\/components\/ui\/card';"
imports_new = """import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { TwiwEditDialog } from './twiw-edit-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';"""
content = re.sub(imports_old, imports_new, content)


# 2. Add db setup inside component
# Find: const { isLeader } = useAuth();
#       const { toast } = useToast();
db_old = r"  const \{ isLeader, user, profile \} = useAuth\(\);\n  const \{ toast \} = useToast\(\);"
db_new = """  const { isLeader, user, profile } = useAuth();
  const { toast } = useToast();
  const db = useFirestore();

  const activeUserId = user?.uid;
  const activeUserName = profile?.name || user?.email || 'Unknown';
  const activeUserRole = profile?.role || 'BDM';
  const activeUserState = profile?.state || 'WA';
  const selectedWeek = getCurrentWeek();

  // Load existing submission for current user
  const submissionDocId = activeUserId ? `${activeUserId}_${selectedWeek}` : null;
  const { data: mySubmission } = useDoc(
    db && submissionDocId ? doc(db, 'twiwSubmissions', submissionDocId) : null
  );

  // Load all team submissions for collation (leaders only)
  const twiwQuery = useMemo(() => {
    if (!db || !isLeader) return null;
    return query(collection(db, 'twiwSubmissions'), where('week', '==', selectedWeek));
  }, [db, isLeader, selectedWeek]);
  
  const { data: allSubmissions } = useCollection(twiwQuery);

  const [editingSubmission, setEditingSubmission] = useState<any>(null);"""
content = re.sub(db_old, db_new, content)

# 3. Handle useEffect for loading data
use_effect_old = r"  \/\/ --- Simulation Controls State ---\n\n  \/\/ --- Mock Database \/ State ---"
use_effect_new = """  // Load data into state when available
  useEffect(() => {
    if (mySubmission) {
      setWins(mySubmission.wins || []);
      setRisks(mySubmission.risks || []);
      setUpdates(mySubmission.updates || '');
      setMajorUpdates(mySubmission.majorUpdates || []);
      setProjectedWins(mySubmission.projectedWins || []);
      setPriorities(mySubmission.priorities || []);
      setTwtwStatus(mySubmission.status || 'NONE');
      setNextWeekActions(mySubmission.nextWeekActions || ['']);
      setNextWeekRoadblocks(mySubmission.nextWeekRoadblocks || '');
      setNextWeekSupport(mySubmission.nextWeekSupport || '');
    } else {
      setTwtwStatus('NONE');
    }
  }, [mySubmission]);"""
content = re.sub(use_effect_old, use_effect_new, content)


# 4. Handle Save to Firebase
save_old = r"  const handleFridaySubmit = \(status: 'DRAFT' \| 'SUBMITTED'\) => \{\n    setTwtwStatus\(status\);\n    toast\(\{\n      title: status === 'SUBMITTED' \? 'Friday Pack Submitted' : 'Draft Saved',\n      description: 'The simulation state has been updated\.',\n      className: 'bg-emerald-50 border-emerald-200 text-emerald-800',\n    \}\);\n  \};"

save_new = """  const [isSaving, setIsSaving] = useState(false);

  const handleFridaySubmit = async (status: 'DRAFT' | 'SUBMITTED') => {
    if (!db || !submissionDocId) return;
    setIsSaving(true);
    try {
      const payload = {
        userId: activeUserId,
        name: activeUserName,
        role: activeUserRole,
        state: activeUserState,
        week: selectedWeek,
        status,
        wins,
        risks,
        updates,
        majorUpdates,
        projectedWins,
        priorities,
        nextWeekActions: nextWeekActions.filter(a => a.trim() !== ''),
        nextWeekRoadblocks,
        nextWeekSupport,
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'twiwSubmissions', submissionDocId), payload, { merge: true });
      setTwtwStatus(status);
      toast({
        title: status === 'SUBMITTED' ? 'Friday Pack Submitted' : 'Draft Saved',
        description: 'Your report has been saved to the server.',
        className: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save submission.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };"""

content = re.sub(save_old, save_new, content)

# 5. Remove mock dataset entirely
mock_old = r"  \/\/ Mock collation dataset \(combining user inputs with 2 other mock BDMs\)\n  const mappedSubmissions = useMemo\(\(\) => \{.*?  \}, \[mappedSubmissions\]\);"
mock_new = """  const mappedSubmissions = useMemo(() => {
    return allSubmissions || [];
  }, [allSubmissions]);

  const submissionsByState = useMemo(() => {
    return mappedSubmissions.reduce((acc, sub) => {
      const state = sub.state || 'Unknown';
      if (!acc[state]) acc[state] = [];
      acc[state].push(sub);
      return acc;
    }, {} as Record<string, any[]>);
  }, [mappedSubmissions]);"""

content = re.sub(mock_old, mock_new, content, flags=re.DOTALL)


# 6. Update toggles and action handlers to use Firebase
toggles_old = r"  const toggleMockItemFlag = \(id: string, flag: 'isStarred' \| 'isHidden'\) => \{\n    setMockItemFlags\(prev => \(\{\n      \.\.\.prev,\n      \[id\]: \{\n        \.\.\.\(prev\[id\] \|\| \{\}\),\n        \[flag\]: !prev\[id\]\?\.\[flag\]\n      \}\n    \}\)\);\n  \};\n\n  const toggleItemState = \(subId: string, type: 'wins' \| 'risks' \| 'majorUpdates' \| 'projectedWins' \| 'priorities', itemId: string, flag: 'isStarred' \| 'isHidden'\) => \{\n    const key = `\$\{subId\}-\$\{type\}-\$\{itemId\}`;\n    toggleMockItemFlag\(key, flag\);\n  \};\n\n  const handleEditSubmission = \(sub: any\) => \{\n    toast\(\{ title: 'Simulator Mode', description: 'Editing is disabled in the simulator view\.' \}\);\n  \};\n\n  const handleDeleteSubmission = \(id: string\) => \{\n    toast\(\{ title: 'Simulator Mode', description: 'Deleting is disabled in the simulator view\.' \}\);\n  \};"

toggles_new = """  const toggleItemState = async (subId: string, arrayField: 'wins'|'risks'|'majorUpdates'|'projectedWins'|'priorities', itemId: string, flag: 'isStarred'|'isHidden') => {
    if (!db) return;
    const sub = mappedSubmissions.find(s => s.id === subId);
    if (!sub) return;

    const items = sub[arrayField] || [];
    const itemIndex = items.findIndex((i: any) => i.id === itemId);
    if (itemIndex === -1) return;

    items[itemIndex][flag] = !items[itemIndex][flag];
    try {
      await updateDoc(doc(db, 'twiwSubmissions', subId), { [arrayField]: items });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Could not update item state', variant: 'destructive' });
    }
  };

  const handleEditSubmission = (sub: any) => {
    setEditingSubmission(sub);
  };

  const handleDeleteSubmission = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'twiwSubmissions', id));
      toast({ title: 'Submission deleted' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error deleting submission', variant: 'destructive' });
    }
  };"""

content = re.sub(toggles_old, toggles_new, content, flags=re.DOTALL)

# 7. renderItem needs updating to read flag from the item itself, not mockItemFlags
renderitem_old = r"  const renderItem = \(item: any, type: string, subId: string, content: React\.ReactNode\) => \{\n    const key = `\$\{subId\}-\$\{type\}-\$\{item\.id\}`;\n    const flags = mockItemFlags\[key\] \|\| \{\};\n    if \(flags\.isHidden\) return null;\n    return \(\n      <div key=\{key\} className=\"relative group p-2 mb-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-all\">\n        <div className=\"absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10\">\n          <Button size=\"icon\" variant=\"secondary\" className=\{`w-6 h-6 shadow-sm border bg-white \$\{flags\.isStarred \? 'border-amber-400 text-amber-500' : 'border-slate-200 text-slate-400 hover:text-amber-500'\}`\} onClick=\{\(\) => toggleItemState\(subId, type as any, item\.id, 'isStarred'\)\}>\n            <Star className=\{`w-3 h-3 \$\{flags\.isStarred \? 'fill-current' : ''\}`\} \/>\n          <\/Button>\n          <Button size=\"icon\" variant=\"secondary\" className=\"w-6 h-6 shadow-sm border border-slate-200 bg-white hover:text-slate-600 text-slate-400\" onClick=\{\(\) => toggleItemState\(subId, type as any, item\.id, 'isHidden'\)\}>\n            <EyeOff className=\"w-3 h-3\" \/>\n          <\/Button>\n        <\/div>"

renderitem_new = """  const renderItem = (item: any, type: string, subId: string, content: React.ReactNode) => {
    const key = `${subId}-${type}-${item.id}`;
    if (item.isHidden) return null;
    return (
      <div key={key} className="relative group p-2 mb-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
          <Button size="icon" variant="secondary" className={`w-6 h-6 shadow-sm border bg-white ${item.isStarred ? 'border-amber-400 text-amber-500' : 'border-slate-200 text-slate-400 hover:text-amber-500'}`} onClick={() => toggleItemState(subId, type as any, item.id, 'isStarred')}>
            <Star className={`w-3 h-3 ${item.isStarred ? 'fill-current' : ''}`} />
          </Button>
          <Button size="icon" variant="secondary" className="w-6 h-6 shadow-sm border border-slate-200 bg-white hover:text-slate-600 text-slate-400" onClick={() => toggleItemState(subId, type as any, item.id, 'isHidden')}>
            <EyeOff className="w-3 h-3" />
          </Button>
        </div>"""

content = re.sub(renderitem_old, renderitem_new, content, flags=re.DOTALL)


# 8. Key standouts flag check needs updating
standouts_old = r"              <div className=\"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6\">\n                \{Object\.entries\(submissionsByState\)\.map\(\(\[state, subs\]\) => \n                  subs\.flatMap\(sub => \{\n                    const standouts = \[\];\n                    \(sub\.wins \|\| \[\]\)\.forEach\(w => \{\n                      if \(mockItemFlags\[`\$\{sub\.id\}-wins-\$\{w\.id\}`\]\?\.isStarred\) standouts\.push\(\{ type: 'Win', \.\.\.w \}\);\n                    \}\);\n                    \(sub\.risks \|\| \[\]\)\.forEach\(r => \{\n                      if \(mockItemFlags\[`\$\{sub\.id\}-risks-\$\{r\.id\}`\]\?\.isStarred\) standouts\.push\(\{ type: 'Risk', \.\.\.r \}\);\n                    \}\);\n                    \(sub\.majorUpdates \|\| \[\]\)\.forEach\(m => \{\n                      if \(mockItemFlags\[`\$\{sub\.id\}-majorUpdates-\$\{m\.id\}`\]\?\.isStarred\) standouts\.push\(\{ type: 'Update', \.\.\.m \}\);\n                    \}\);\n                    \(sub\.projectedWins \|\| \[\]\)\.forEach\(p => \{\n                      if \(mockItemFlags\[`\$\{sub\.id\}-projectedWins-\$\{p\.id\}`\]\?\.isStarred\) standouts\.push\(\{ type: 'Projected', \.\.\.p \}\);\n                    \}\);\n                    \(sub\.priorities \|\| \[\]\)\.forEach\(p => \{\n                      if \(mockItemFlags\[`\$\{sub\.id\}-priorities-\$\{p\.id\}`\]\?\.isStarred\) standouts\.push\(\{ type: 'Priority', \.\.\.p \}\);\n                    \}\);"

standouts_new = """              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.entries(submissionsByState).map(([state, subs]) => 
                  subs.flatMap(sub => {
                    const standouts: any[] = [];
                    (sub.wins || []).forEach((w: any) => {
                      if (w.isStarred) standouts.push({ type: 'Win', ...w });
                    });
                    (sub.risks || []).forEach((r: any) => {
                      if (r.isStarred) standouts.push({ type: 'Risk', ...r });
                    });
                    (sub.majorUpdates || []).forEach((m: any) => {
                      if (m.isStarred) standouts.push({ type: 'Update', ...m });
                    });
                    (sub.projectedWins || []).forEach((p: any) => {
                      if (p.isStarred) standouts.push({ type: 'Projected', ...p });
                    });
                    (sub.priorities || []).forEach((p: any) => {
                      if (p.isStarred) standouts.push({ type: 'Priority', ...p });
                    });"""

content = re.sub(standouts_old, standouts_new, content, flags=re.DOTALL)


# 9. Add EditDialog rendering at the bottom
end_old = r"    <\/div>\n  \);\n\}"
end_new = """    </div>
    
    <TwiwEditDialog
      submission={editingSubmission}
      open={editingSubmission !== null}
      onOpenChange={(open) => {
        if (!open) setEditingSubmission(null);
      }}
    />
    </>
  );
}"""
content = content.replace("    </div>\n  );\n}", end_new)
content = content.replace("export function DemoDashView() {\n", "export function DemoDashView() {\n  return (\n    <>")

# Also fix the initial return missing a wrapping `<>` because I added it at the end
# Actually, the entire return is `return ( <div className="space-y-6"> ...`
# Let's just find `return (\n    <div className="space-y-6 max-w-[1600px] mx-auto pb-24">`
wrapper_old = r"  return \(\n    <div className=\"space-y-6 max-w-\[1600px\] mx-auto pb-24\">"
wrapper_new = """  return (
    <>
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24">"""
content = re.sub(wrapper_old, wrapper_new, content)


with open(file_path, "w") as f:
    f.write(content)

