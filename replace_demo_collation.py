import re

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Replace collatedMockSubmissions
mock_old = r"  \/\/ Mock collation dataset \(combining user inputs with 2 other mock BDMs\)\n  const collatedMockSubmissions = useMemo\(\(\) => \{.*?      \};\n    \}\n\n    return \{\n.*?\n    \};\n  \}, \[wins, risks, projectedWins, priorities, updates, majorUpdates, currentWeekFocusAccounts, twtwRoadblocks, twtwKpiActuals\]\);"

mock_new = """  // Mock collation dataset (combining user inputs with 2 other mock BDMs)
  const mappedSubmissions = useMemo(() => {
    return [
      {
        id: 'mock-me',
        userId: 'me-1',
        name: 'Me (Simulated User)',
        role: 'BDM',
        state: 'WA',
        status: 'SUBMITTED',
        wins,
        risks,
        majorUpdates,
        updates,
        projectedWins,
        priorities
      },
      {
        id: 'mock-sj',
        userId: 'sj-1',
        name: 'Sarah Jenkins',
        role: 'BDM',
        state: 'WA',
        status: 'SUBMITTED',
        wins: [
          { id: 'sj-w1', customer: 'BHP WA Operations', value: 340000, updateText: 'Logistics upgrade contract signed.', salespersonName: 'Sarah Jenkins', businessUnits: [] },
          { id: 'sj-w2', customer: 'Rio Tinto Fuel Run', value: 120000, updateText: 'Incremental trade volume won.', salespersonName: 'Sarah Jenkins', businessUnits: [] }
        ],
        risks: [
          { id: 'sj-r1', account: 'Fortescue Metals', value: 210000, mitigation: 'Meeting GM on Tuesday to align proposal schedule.', salespersonName: 'Sarah Jenkins' }
        ],
        majorUpdates: [],
        updates: 'Strong mining sector wins this week. Closed BHP logistics account. Fortescue is delayed but key sponsors remain aligned.',
        projectedWins: [
          { id: 'sj-p1', account: 'Woodside Energy', value: 450000, expectedDate: 'Late July', salespersonName: 'Sarah Jenkins', updateText: '' },
          { id: 'sj-p2', account: 'MinRes Pilbara', value: 180000, expectedDate: 'Next Week', salespersonName: 'Sarah Jenkins', updateText: '' }
        ],
        priorities: [
          { id: 'sj-pr1', text: 'Deliver Woodside technical response', salespersonName: 'Sarah Jenkins' },
          { id: 'sj-pr2', text: 'Finalise Rio Tinto post-implementation review', salespersonName: 'Sarah Jenkins' },
          { id: 'sj-pr3', text: 'Schedule Fortescue follow-up', salespersonName: 'Sarah Jenkins' }
        ]
      },
      {
        id: 'mock-mk',
        userId: 'mk-1',
        name: 'Marcus King',
        role: 'ACCOUNT_MANAGER',
        state: 'NSW',
        status: 'DRAFT',
        wins: [
          { id: 'mk-w1', customer: 'Sydney Rail Project', value: 85000, updateText: 'Extended maintenance contract.', salespersonName: 'Marcus King', businessUnits: [] }
        ],
        risks: [],
        majorUpdates: [],
        updates: 'Focusing on retention in public sector accounts.',
        projectedWins: [],
        priorities: [
          { id: 'mk-pr1', text: 'Quarterly review with Transport NSW', salespersonName: 'Marcus King' }
        ]
      }
    ];
  }, [wins, risks, majorUpdates, updates, projectedWins, priorities]);

  const submissionsByState = useMemo(() => {
    return mappedSubmissions.reduce((acc, sub) => {
      if (!acc[sub.state]) acc[sub.state] = [];
      acc[sub.state].push(sub);
      return acc;
    }, {} as Record<string, any[]>);
  }, [mappedSubmissions]);"""

content = re.sub(mock_old, mock_new, content, flags=re.DOTALL)


# 2. Add helper functions
helpers_old = r"  const toggleMockItemFlag = \(id: string, flag: 'isStarred' \| 'isHidden'\) => \{\n    setMockItemFlags\(prev => \(\{\n      \.\.\.prev,\n      \[id\]: \{\n        \.\.\.\(prev\[id\] \|\| \{\}\),\n        \[flag\]: !prev\[id\]\?\.\[flag\]\n      \}\n    \}\)\);\n  \};"

helpers_new = """  const toggleMockItemFlag = (id: string, flag: 'isStarred' | 'isHidden') => {
    setMockItemFlags(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [flag]: !prev[id]?.[flag]
      }
    }));
  };

  const toggleItemState = (subId: string, type: 'wins' | 'risks' | 'majorUpdates' | 'projectedWins' | 'priorities', itemId: string, flag: 'isStarred' | 'isHidden') => {
    const key = `${subId}-${type}-${itemId}`;
    toggleMockItemFlag(key, flag);
  };

  const handleEditSubmission = (sub: any) => {
    toast({ title: 'Simulator Mode', description: 'Editing is disabled in the simulator view.' });
  };

  const handleDeleteSubmission = (id: string) => {
    toast({ title: 'Simulator Mode', description: 'Deleting is disabled in the simulator view.' });
  };

  const formatEAV = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  const renderItem = (item: any, type: string, subId: string, content: React.ReactNode) => {
    const key = `${subId}-${type}-${item.id}`;
    const flags = mockItemFlags[key] || {};
    if (flags.isHidden) return null;
    return (
      <div key={key} className="relative group p-2 mb-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
          <Button size="icon" variant="secondary" className={`w-6 h-6 shadow-sm border bg-white ${flags.isStarred ? 'border-amber-400 text-amber-500' : 'border-slate-200 text-slate-400 hover:text-amber-500'}`} onClick={() => toggleItemState(subId, type as any, item.id, 'isStarred')}>
            <Star className={`w-3 h-3 ${flags.isStarred ? 'fill-current' : ''}`} />
          </Button>
          <Button size="icon" variant="secondary" className="w-6 h-6 shadow-sm border border-slate-200 bg-white hover:text-slate-600 text-slate-400" onClick={() => toggleItemState(subId, type as any, item.id, 'isHidden')}>
            <EyeOff className="w-3 h-3" />
          </Button>
        </div>
        <div className="pr-8">
          {content}
        </div>
      </div>
    );
  };"""

content = re.sub(helpers_old, helpers_new, content, flags=re.DOTALL)

# 3. Replace TabsContent collation
tabs_old = r"        \{\/\* --- TAB 3: EXECUTIVE COLLATION TAB --- \*\/}.*?        \{\/\* ==========================================\n         \* KEY STANDOUTS VIEW"

tabs_new = """        {/* --- TAB 3: EXECUTIVE COLLATION TAB --- */}
        {isLeader && (
        <TabsContent value="collation" className="mt-0">
          <Card className="border shadow-md bg-white">
            <CardHeader className="bg-slate-50/50 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between py-5 gap-4">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" /> Master Executive TWTW Collation
                </CardTitle>
                <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  How executive reports look with combined registered data vs guest data
                </CardDescription>
              </div>
              <Button 
                onClick={handleExportPdf}
                className="bg-indigo-600 hover:bg-indigo-750 text-white font-black h-10 text-[10px] uppercase tracking-widest rounded-xl gap-2 shadow-md w-full sm:w-auto"
              >
                <ClipboardCheck className="w-4 h-4" /> Export to Landscape PDF
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-6 space-y-12 max-h-[800px] overflow-y-auto">
                {Object.entries(submissionsByState).length === 0 ? (
                   <div className="text-center py-24 text-slate-400 text-xs font-bold uppercase tracking-widest">
                     No submissions available to collate yet.
                   </div>
                ) : (
                  Object.entries(submissionsByState).map(([state, subs]) => (
                    <div key={state} className="space-y-4">
                      <h3 className="text-lg font-black uppercase text-slate-800 border-b border-slate-200 pb-2 flex items-center gap-2">
                        {state} Region <Badge variant="secondary" className="ml-2 bg-slate-100 text-slate-500 font-black">{subs.length} Reps</Badge>
                      </h3>
                      
                      <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="uppercase text-[9px] font-black tracking-widest text-slate-500">
                              <th className="p-3 w-[20%]">Key Wins</th>
                              <th className="p-3 w-[20%]">Churn Risk</th>
                              <th className="p-3 w-[20%]">Major Updates</th>
                              <th className="p-3 w-[20%]">30 Day Projected</th>
                              <th className="p-3 w-[20%]">Priorities</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {subs.map((sub, idx) => (
                              <tr key={idx} className="align-top relative group">
                                <td className="p-3 text-slate-600">
                                  {(sub.wins || []).map((w: any) => renderItem(w, 'wins', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{w.customer}</div>
                                      <div className="text-emerald-600 font-semibold">{formatEAV(w.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{w.salespersonName || 'N/A'}</div>
                                      {w.businessUnits && w.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {w.businessUnits.join(', ')}</div>}
                                      {w.updateText && <div className="mt-1">{w.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.risks || []).map((r: any) => renderItem(r, 'risks', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{r.account}</div>
                                      <div className="text-rose-600 font-semibold">{formatEAV(r.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{r.salespersonName || 'N/A'}</div>
                                      <div className="mt-1 text-slate-500">Mitigation: {r.mitigation}</div>
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {sub.updates && (
                                    <div className="p-2 mb-2 bg-amber-50 border border-amber-100 rounded-lg whitespace-pre-wrap">{sub.updates}</div>
                                  )}
                                  {(sub.majorUpdates || []).map((m: any) => renderItem(m, 'majorUpdates', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{m.customer}</div>
                                      {m.value > 0 && <div className="text-blue-600 font-semibold">{formatEAV(m.value)}</div>}
                                      <div className="text-[10px] text-slate-500 mt-1">{m.salespersonName || 'N/A'}</div>
                                      {m.businessUnits && m.businessUnits.length > 0 && <div className="text-[9px] text-slate-400 mt-1">BU: {m.businessUnits.join(', ')}</div>}
                                      {m.updateText && <div className="mt-1">{m.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.projectedWins || []).map((p: any) => renderItem(p, 'projectedWins', sub.id, (
                                    <>
                                      <div className="font-bold text-slate-800">{p.account}</div>
                                      <div className="text-blue-600 font-semibold">{formatEAV(p.value)}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{p.salespersonName || 'N/A'}</div>
                                      <div className="mt-1 text-slate-500">Expected: {p.expectedDate}</div>
                                      {p.updateText && <div className="mt-1 text-[10px]">{p.updateText}</div>}
                                    </>
                                  )))}
                                </td>
                                <td className="p-3 text-slate-600">
                                  {(sub.priorities || []).map((p: any) => renderItem(p, 'priorities', sub.id, (
                                    <>
                                      <div>{p.text}</div>
                                      <div className="text-[10px] text-slate-500 mt-1">{p.salespersonName || 'N/A'}</div>
                                    </>
                                  )))}
                                  <div className="mt-4 flex gap-2">
                                    <Button size="sm" variant="outline" className="w-full text-[10px] uppercase font-black" onClick={() => handleEditSubmission(sub)}><Edit3 className="w-3.5 h-3.5 mr-1" /> Edit</Button>
                                    <Button size="sm" variant="destructive" className="w-full text-[10px] uppercase font-black" onClick={() => handleDeleteSubmission(sub.id)}><Trash2 className="w-3.5 h-3.5 mr-1" /> Delete</Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* ==========================================
         * KEY STANDOUTS VIEW"""

content = re.sub(tabs_old, tabs_new, content, flags=re.DOTALL)

with open(file_path, "w") as f:
    f.write(content)

