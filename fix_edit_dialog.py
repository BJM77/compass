import re

file_path = "src/components/dashboard/twiw-edit-dialog.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. State hooks
state_old = r"  const \[projectedWins, setProjectedWins\] = useState<any\[\]>\(\[\]\);\n  const \[priorities, setPriorities\] = useState<any\[\]>\(\[\]\);"
state_new = """  const [projectedWins, setProjectedWins] = useState<any[]>([]);
  const [priorities, setPriorities] = useState<any[]>([]);
  const [nextWeekActions, setNextWeekActions] = useState<string[]>([]);
  const [nextWeekRoadblocks, setNextWeekRoadblocks] = useState('');
  const [nextWeekSupport, setNextWeekSupport] = useState('');"""
content = re.sub(state_old, state_new, content)


# 2. useEffect population
effect_old = r"      setPriorities\(\(submission\.priorities \|\| \[\]\)\.map\(\(p: any\) => typeof p === 'string' \? \{ id: crypto\.randomUUID\(\), text: p, salespersonName: '' \} : \{ \.\.\.p, id: p\.id \|\| crypto\.randomUUID\(\) \}\)\);\n    \} else \{"
effect_new = """      setPriorities((submission.priorities || []).map((p: any) => typeof p === 'string' ? { id: crypto.randomUUID(), text: p, salespersonName: '' } : { ...p, id: p.id || crypto.randomUUID() }));
      setNextWeekActions(submission.nextWeekActions || []);
      setNextWeekRoadblocks(submission.nextWeekRoadblocks || '');
      setNextWeekSupport(submission.nextWeekSupport || '');
    } else {"""
content = re.sub(effect_old, effect_new, content)

# 3. handleSave payload
save_old = r"        priorities: priorities\.filter\(p => p\.text\.trim\(\)\),\n        updatedAt: serverTimestamp\(\)"
save_new = """        priorities: priorities.filter(p => p.text.trim()),
        nextWeekActions: nextWeekActions.filter(a => typeof a === 'string' && a.trim() !== ''),
        nextWeekRoadblocks,
        nextWeekSupport,
        updatedAt: serverTimestamp()"""
content = re.sub(save_old, save_new, content)

# 4. Add UI inputs at the bottom before </ScrollArea>
# Find: `<div className="space-y-2"> <h3 className="text-sm font-bold uppercase">Priorities</h3> ... </div> </div> </ScrollArea>`
ui_old = r"          <div className=\"space-y-2\">\n            <h3 className=\"text-sm font-bold uppercase\">Priorities<\/h3>\n            <div className=\"space-y-2\">\n              \{priorities\.map\(\(p, idx\) => \(\n                <div key=\{p\.id\} className=\"p-3 bg-slate-50 border rounded-lg space-y-2 relative flex gap-2\">\n                  <Input value=\{p\.text\} onChange=\{e => updateField\(setPriorities, priorities, p\.id, 'text', e\.target\.value\)\} placeholder=\"Priority\" className=\"h-8 text-xs flex-1\" \/>\n                  <Input value=\{p\.salespersonName\} onChange=\{e => updateField\(setPriorities, priorities, p\.id, 'salespersonName', e\.target\.value\)\} placeholder=\"Salesperson\" className=\"h-8 text-xs w-\[30%\]\" \/>\n                  <Button variant=\"ghost\" size=\"icon\" onClick=\{\(\) => removeRow\(setPriorities, priorities, p\.id\)\} className=\"h-8 w-8 text-red-500\"><Trash2 className=\"w-3 h-3\" \/><\/Button>\n                <\/div>\n              \)\)\}\n              <Button onClick=\{addPriorityRow\} variant=\"outline\" size=\"sm\" className=\"w-full text-xs\"><Plus className=\"w-3 h-3 mr-1\" \/> Add Priority<\/Button>\n            <\/div>\n          <\/div>\n\n        <\/div>"

ui_new = """          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase">Priorities</h3>
            <div className="space-y-2">
              {priorities.map((p, idx) => (
                <div key={p.id} className="p-3 bg-slate-50 border rounded-lg space-y-2 relative flex gap-2">
                  <Input value={p.text} onChange={e => updateField(setPriorities, priorities, p.id, 'text', e.target.value)} placeholder="Priority" className="h-8 text-xs flex-1" />
                  <Input value={p.salespersonName} onChange={e => updateField(setPriorities, priorities, p.id, 'salespersonName', e.target.value)} placeholder="Salesperson" className="h-8 text-xs w-[30%]" />
                  <Button variant="ghost" size="icon" onClick={() => removeRow(setPriorities, priorities, p.id)} className="h-8 w-8 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              <Button onClick={addPriorityRow} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Priority</Button>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-sm font-bold uppercase text-indigo-700">Friday Pack Fields</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold">Next Week Actions</label>
                {nextWeekActions.map((action, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={action} onChange={e => {
                      const newA = [...nextWeekActions];
                      newA[i] = e.target.value;
                      setNextWeekActions(newA);
                    }} className="h-8 text-xs flex-1" />
                    <Button variant="ghost" size="icon" onClick={() => setNextWeekActions(nextWeekActions.filter((_, idx) => idx !== i))} className="h-8 w-8 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                  </div>
                ))}
                <Button onClick={() => setNextWeekActions([...nextWeekActions, ''])} variant="outline" size="sm" className="w-full text-xs"><Plus className="w-3 h-3 mr-1" /> Add Action</Button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold">Roadblocks</label>
                <Textarea value={nextWeekRoadblocks} onChange={e => setNextWeekRoadblocks(e.target.value)} placeholder="Any roadblocks for next week?" className="text-xs min-h-[60px]" />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold">Support Needed</label>
                <Textarea value={nextWeekSupport} onChange={e => setNextWeekSupport(e.target.value)} placeholder="Management support needed?" className="text-xs min-h-[60px]" />
              </div>
            </div>
          </div>

        </div>"""
content = re.sub(ui_old, ui_new, content)


with open(file_path, "w") as f:
    f.write(content)

