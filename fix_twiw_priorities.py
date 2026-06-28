import re

file_path = "src/components/dashboard/twiw-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

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
                                  <Button variant="ghost" size="icon" onClick={() => removePriorityRow(p.id)} className="h-8 w-8 text-red-500 rounded-xl">
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
                              <Button variant="ghost" size="icon" onClick={() => removePriorityRow(p.id)} className="h-6 w-6 text-red-500 rounded-lg">
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

with open(file_path, "w") as f:
    f.write(content)

