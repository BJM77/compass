import re

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Replace Major Updates textarea with Table
major_updates_old = r"                  \{\/\* General Updates \*\/}.*?<\/CardContent>\n                  <\/Card>"
major_updates_new = """                  {/* General Updates */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4 flex flex-row items-center justify-between">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-500" /> Performance Narrative (Major Updates)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                              <th className="text-left pb-2 w-[20%]">Customer</th>
                              <th className="text-right pb-2 w-[15%]">EAV ($)</th>
                              <th className="text-left pb-2 w-[20%]">Business Unit</th>
                              <th className="text-left pb-2 w-[20%]">Update</th>
                              <th className="text-left pb-2 w-[15%]">Salesperson</th>
                              <th className="text-center pb-2 w-[5%]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {majorUpdates.map((m) => (
                              <tr key={m.id}>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={m.customer} 
                                    onChange={(e) => updateMajorUpdateField(m.id, 'customer', e.target.value)} 
                                    placeholder="e.g. Acme Corp" 
                                    className="h-8 text-xs font-semibold"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    type="number"
                                    value={m.value || ''} 
                                    onChange={(e) => updateMajorUpdateField(m.id, 'value', parseFloat(e.target.value) || 0)} 
                                    placeholder="Value" 
                                    className="h-8 text-xs font-black text-right text-blue-600"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <div className="flex flex-wrap gap-1">
                                    {BUSINESS_UNITS.map(bu => (
                                      <Badge 
                                        key={bu} 
                                        variant={(m.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                                        className="cursor-pointer text-[9px] px-1 py-0"
                                        onClick={() => toggleMajorUpdateBU(m.id, bu)}
                                      >
                                        {bu}
                                      </Badge>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-2 pr-2">
                                  <div className="relative">
                                    <Input 
                                      value={m.updateText || ''} 
                                      onChange={(e) => updateMajorUpdateField(m.id, 'updateText', e.target.value)} 
                                      placeholder="e.g. Major milestone reached" 
                                      className="h-8 text-xs"
                                      maxLength={200}
                                    />
                                    <div className="absolute -bottom-3 right-0 text-[8px] text-slate-400 font-bold">{(m.updateText || '').length}/200</div>
                                  </div>
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={m.salespersonName} 
                                    onChange={(e) => updateMajorUpdateField(m.id, 'salespersonName', e.target.value)} 
                                    placeholder="Name" 
                                    className="h-8 text-xs"
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <Button variant="ghost" size="icon" onClick={() => removeMajorUpdateRow(m.id)} className="h-8 w-8 text-red-500 rounded-xl">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {majorUpdates.length === 0 && (
                              <tr>
                                <td colSpan={6} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                                  No major updates found. Add a custom row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked View */}
                      <div className="block sm:hidden space-y-4">
                        {majorUpdates.map((m, idx) => (
                          <div key={m.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 relative">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-slate-400">Update #{idx + 1}</span>
                              <Button variant="ghost" size="icon" onClick={() => removeMajorUpdateRow(m.id)} className="h-6 w-6 text-red-500 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400">Customer</label>
                              <Input 
                                value={m.customer} 
                                onChange={(e) => updateMajorUpdateField(m.id, 'customer', e.target.value)} 
                                placeholder="e.g. Acme Corp" 
                                className="h-8 text-xs font-semibold bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400">Business Unit</label>
                              <div className="flex flex-wrap gap-1">
                                {BUSINESS_UNITS.map(bu => (
                                  <Badge 
                                    key={bu} 
                                    variant={(m.businessUnits || []).includes(bu) ? 'default' : 'outline'}
                                    className="cursor-pointer text-[10px] px-2 py-0.5 bg-white shadow-sm"
                                    onClick={() => toggleMajorUpdateBU(m.id, bu)}
                                  >
                                    {bu}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400">EAV ($)</label>
                                <Input 
                                  type="number"
                                  value={m.value || ''} 
                                  onChange={(e) => updateMajorUpdateField(m.id, 'value', parseFloat(e.target.value) || 0)} 
                                  placeholder="Value" 
                                  className="h-8 text-xs font-black text-blue-600 bg-white"
                                />
                              </div>
                              <div className="space-y-1 relative">
                                <label className="text-[9px] font-black uppercase text-slate-400">Update</label>
                                <Input 
                                  value={m.updateText || ''} 
                                  onChange={(e) => updateMajorUpdateField(m.id, 'updateText', e.target.value)} 
                                  placeholder="Update text" 
                                  className="h-8 text-xs bg-white"
                                  maxLength={200}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400">Salesperson</label>
                                <Input 
                                  value={m.salespersonName} 
                                  onChange={(e) => updateMajorUpdateField(m.id, 'salespersonName', e.target.value)} 
                                  placeholder="Name" 
                                  className="h-8 text-xs bg-white"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button onClick={addMajorUpdateRow} variant="outline" size="sm" className="w-full mt-4 text-xs font-black uppercase text-slate-500 border-dashed rounded-xl py-6 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                        <Plus className="w-4 h-4 mr-2" /> Add Major Update Row
                      </Button>
                    </CardContent>
                  </Card>"""
content = re.sub(major_updates_old, major_updates_new, content, flags=re.DOTALL)


# 2. Replace Priorities
priorities_old = r"                  \{\/\* Priorities \*\/}.*?<\/CardContent>\n                  <\/Card>"
priorities_new = """                  {/* Priorities */}
                  <Card className="border shadow-md">
                    <CardHeader className="bg-slate-50 border-b py-4">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                        <Target className="w-4 h-4 text-accent" /> Priorities for Week Ahead
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="uppercase text-[9px] font-black tracking-widest border-b border-slate-100 text-slate-400">
                              <th className="text-left pb-2 w-[60%]">Priority</th>
                              <th className="text-left pb-2 w-[30%]">Salesperson</th>
                              <th className="text-center pb-2 w-[10%]">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {priorities.map((p) => (
                              <tr key={p.id}>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={p.text} 
                                    onChange={(e) => updatePriorityField(p.id, 'text', e.target.value)} 
                                    placeholder="e.g. Focus on Neerabup zone wins" 
                                    className="h-8 text-xs font-semibold"
                                  />
                                </td>
                                <td className="py-2 pr-2">
                                  <Input 
                                    value={p.salespersonName} 
                                    onChange={(e) => updatePriorityField(p.id, 'salespersonName', e.target.value)} 
                                    placeholder="Salesperson" 
                                    className="h-8 text-xs"
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <Button variant="ghost" size="icon" onClick={() => removePriority(p.id)} className="h-8 w-8 text-red-500 rounded-xl">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            {priorities.length === 0 && (
                              <tr>
                                <td colSpan={3} className="text-center py-6 text-[10px] uppercase font-black tracking-widest text-slate-400 bg-slate-50/30 rounded-xl">
                                  No priorities added yet. Add a custom row.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked View */}
                      <div className="block sm:hidden space-y-4">
                        {priorities.map((p, idx) => (
                          <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2 relative">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black uppercase text-slate-400">Priority #{idx + 1}</span>
                              <Button variant="ghost" size="icon" onClick={() => removePriority(p.id)} className="h-6 w-6 text-red-500 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400">Priority</label>
                              <Input 
                                value={p.text} 
                                onChange={(e) => updatePriorityField(p.id, 'text', e.target.value)} 
                                placeholder="e.g. Focus on Neerabup zone wins" 
                                className="h-8 text-xs font-semibold bg-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase text-slate-400">Salesperson</label>
                              <Input 
                                value={p.salespersonName} 
                                onChange={(e) => updatePriorityField(p.id, 'salespersonName', e.target.value)} 
                                placeholder="Name" 
                                className="h-8 text-xs bg-white"
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button onClick={addPriorityRow} variant="outline" size="sm" className="w-full mt-4 text-xs font-black uppercase text-slate-500 border-dashed rounded-xl py-6 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                        <Plus className="w-4 h-4 mr-2" /> Add Priority Row
                      </Button>
                    </CardContent>
                  </Card>"""
content = re.sub(priorities_old, priorities_new, content, flags=re.DOTALL)


# 3. Add `updatePriorityField`, `addPriorityRow`, `majorUpdates` state
# Need to replace the `newPriority` logic
state_old = r"  const \[newPriority, setNewPriority\] = useState\(''\);\n  const \[newPrioritySalesperson, setNewPrioritySalesperson\] = useState\(''\);"
state_new = "  const [majorUpdates, setMajorUpdates] = useState<any[]>([]);"
content = re.sub(state_old, state_new, content)

funcs_old = r"  const addPriority = \(\) => \{\n.*?setNewPrioritySalesperson\(''\);\n  \};\n  const removePriority = \(id: string\) => setPriorities\(priorities\.filter\(p => p\.id !== id\)\);"
funcs_new = """  const addPriorityRow = () => setPriorities([...priorities, { id: crypto.randomUUID(), text: '', salespersonName: 'Me' }]);
  const removePriority = (id: string) => setPriorities(priorities.filter(p => p.id !== id));
  const updatePriorityField = (id: string, field: string, val: any) => {
    setPriorities(priorities.map(p => p.id === id ? { ...p, [field]: val } : p));
  };
  const addMajorUpdateRow = () => setMajorUpdates([...majorUpdates, { id: crypto.randomUUID(), updateText: '', customer: '', value: 0, salespersonName: 'Me', businessUnits: [] }]);
  const removeMajorUpdateRow = (id: string) => setMajorUpdates(majorUpdates.filter(m => m.id !== id));
  const updateMajorUpdateField = (id: string, field: string, val: any) => setMajorUpdates(majorUpdates.map(m => m.id === id ? { ...m, [field]: val } : m));
  const toggleMajorUpdateBU = (id: string, bu: string) => setMajorUpdates(majorUpdates.map(m => {
      if (m.id !== id) return m;
      const bus = m.businessUnits || [];
      const newBus = bus.includes(bu) ? bus.filter((b: string) => b !== bu) : [...bus, bu];
      return { ...m, businessUnits: newBus };
    }));"""
content = re.sub(funcs_old, funcs_new, content, flags=re.DOTALL)

with open(file_path, "w") as f:
    f.write(content)

