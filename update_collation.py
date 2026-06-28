import sys
import re

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add utilities before useMemo for collatedMockSubmissions
utilities = """
  const formatEAV = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  const [mockItemFlags, setMockItemFlags] = useState<Record<string, {isHidden?: boolean, isStarred?: boolean}>>({});

  const toggleItemState = (subId: string, type: string, itemId: string, flag: 'isHidden' | 'isStarred') => {
    const key = `${subId}-${type}-${itemId}`;
    setMockItemFlags(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [flag]: !prev[key]?.[flag]
      }
    }));
  };

  const handleEditSubmission = (sub: any) => {
    toast({ title: 'Simulated Action', description: 'Edit button clicked for ' + sub.name });
  };

  const handleDeleteSubmission = (id: string) => {
    toast({ title: 'Simulated Action', description: 'Delete button clicked for submission ' + id, variant: 'destructive' });
  };

  // Mock collation dataset (combining user inputs with 2 other mock BDMs)
"""
content = re.sub(r'  // Mock collation dataset \(combining user inputs with 2 other mock BDMs\)\n', utilities, content, count=1)

# 2. Replace collatedMockSubmissions logic
old_collated_regex = r'  const collatedMockSubmissions = useMemo\(\(\) => \{.*?\}, \[wins, risks, updates, projectedWins, priorities, simUserRole, twtwKpiActuals, currentWeekFocusAccounts, twtwRoadblocks\]\);'

new_collated = """  const collatedMockSubmissions = useMemo(() => {
    // If registered user, we might want to pass kpis to updates
    let userUpdatesFormatted = updates ? `${updates}\\n\\n` : '';
    if (simUserRole === 'REGISTERED') {
      const kpis = `[KPI Actuals: ${twtwKpiActuals.callsMade}/${twtwKpiActuals.callsToMake} Calls, ${twtwKpiActuals.appointmentsSet}/${twtwKpiActuals.appointmentsToSet} Appts]`;
      const faCount = currentWeekFocusAccounts.length > 0 ? `\\n[Focus Accounts Active: ${currentWeekFocusAccounts.length}]` : '';
      const rb = twtwRoadblocks ? `\\n[Roadblocks: ${twtwRoadblocks}]` : '';
      userUpdatesFormatted = `${userUpdatesFormatted}${kpis}${faCount}${rb}`;
    }

    return {
      'WA': [
        {
          id: 'me-mock',
          name: 'Me (Simulated User)',
          wins: wins,
          risks: risks,
          updates: userUpdatesFormatted,
          majorUpdates: majorUpdates,
          projectedWins: projectedWins,
          priorities: priorities
        },
        {
          id: 'sj-mock',
          name: 'Sarah Jenkins (Senior BDM)',
          wins: [
            { id: 'sj1', customer: 'BHP WA Operations', value: 340000, updateText: 'Logistics upgrade contract signed.', salespersonName: 'Sarah Jenkins' },
            { id: 'sj2', customer: 'Rio Tinto Fuel Run', value: 120000, updateText: 'Incremental trade volume won.', salespersonName: 'Sarah Jenkins' }
          ],
          risks: [
            { id: 'sj3', account: 'Fortescue Metals', value: 210000, mitigation: 'Meeting GM on Tuesday to align proposal schedule.', salespersonName: 'Sarah Jenkins' }
          ],
          updates: 'Strong mining sector wins this week. Closed BHP logistics account. Fortescue is delayed but key sponsors remain aligned.',
          majorUpdates: [],
          projectedWins: [
            { id: 'sj4', account: 'Woodside Energy', value: 450000, expectedDate: 'Late July', salespersonName: 'Sarah Jenkins' },
            { id: 'sj5', account: 'MinRes Pilbara', value: 180000, expectedDate: 'Next Week', salespersonName: 'Sarah Jenkins' }
          ],
          priorities: [
            { id: 'sj6', text: 'Deliver Woodside technical response', salespersonName: 'Sarah Jenkins' },
            { id: 'sj7', text: 'Finalise Rio Tinto post-implementation review', salespersonName: 'Sarah Jenkins' },
            { id: 'sj8', text: 'Schedule Fortescue follow-up', salespersonName: 'Sarah Jenkins' }
          ]
        }
      ],
      'QLD': [
        {
          id: 'am-mock',
          name: 'Alex Mercer (Account Manager)',
          wins: [
            { id: 'am1', customer: 'Aurizon Fleet', value: 95000, updateText: 'Signed 12m extension.', salespersonName: 'Alex Mercer' },
            { id: 'am2', customer: 'Qube Ports trial', value: 60000, updateText: 'First trade route live.', salespersonName: 'Alex Mercer' }
          ],
          risks: [],
          updates: 'Qld logistics pipeline remains steady. Bulk transport volumes holding target.',
          majorUpdates: [],
          projectedWins: [
            { id: 'am3', account: 'Gladstone Coal', value: 310000, expectedDate: 'Within 30 Days', salespersonName: 'Alex Mercer' }
          ],
          priorities: [
            { id: 'am4', text: 'Conduct Qube post-implementation site review', salespersonName: 'Alex Mercer' },
            { id: 'am5', text: 'Finalise Gladstone commercial terms', salespersonName: 'Alex Mercer' }
          ]
        }
      ]
    };
  }, [wins, risks, updates, majorUpdates, projectedWins, priorities, simUserRole, twtwKpiActuals, currentWeekFocusAccounts, twtwRoadblocks]);"""

content = re.sub(old_collated_regex, new_collated, content, flags=re.DOTALL)

# 3. Add renderItem to JSX rendering scope
# It should be at the start of TabsContent value="collation"
render_item = """
  const renderItem = (item: any, type: string, subId: string, content: React.ReactNode) => {
    const key = `${subId}-${type}-${item.id}`;
    const flags = mockItemFlags[key] || {};
    if (flags.isHidden) return null;
    return (
      <div key={key} className="relative group p-2 mb-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-all">
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10">
          <Button size="icon" variant="secondary" className={cn("w-6 h-6 shadow-sm border bg-white", flags.isStarred ? "border-amber-400 text-amber-500" : "border-slate-200 text-slate-400 hover:text-amber-500")} onClick={() => toggleItemState(subId, type, item.id, 'isStarred')}>
            <Star className={cn("w-3 h-3", flags.isStarred && "fill-current")} />
          </Button>
          <Button size="icon" variant="secondary" className="w-6 h-6 shadow-sm border border-slate-200 bg-white hover:text-slate-600 text-slate-400" onClick={() => toggleItemState(subId, type, item.id, 'isHidden')}>
            <EyeOff className="w-3 h-3" />
          </Button>
        </div>
        <div className="pr-8">
          {content}
        </div>
      </div>
    );
  };

  return (
"""

content = content.replace("  return (\n    <div className=\"space-y-6 animate-in fade-in duration-500 pb-20 relative\">", render_item + "    <div className=\"space-y-6 animate-in fade-in duration-500 pb-20 relative\">", 1)


# 4. Replace the Master Executive Collation JSX block
old_jsx_regex = r'<div className="p-6 space-y-10">.*?</div>.*?<!-- Hidden Print Container -->'
new_jsx = """<div className="p-6 space-y-12 max-h-[800px] overflow-y-auto">
                {Object.entries(collatedMockSubmissions).map(([state, subs]) => (
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
                                <div className="font-bold text-slate-800 mb-2">{sub.name}</div>
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
                ))}
              </div>

              {/* Hidden Print Container */}"""
content = re.sub(r'<div className="p-6 space-y-10">.*?</div>\s*\{\/\* Hidden Print Container \*\/\}', new_jsx, content, flags=re.DOTALL)

# 5. Fix the print string replacements
# Because we changed `collatedMockSubmissions` structure, the print rendering logic also needs to be updated.
print_container = """{/* Hidden Print Container */}
              <div id="twtw-demo-print-area" className="hidden">
                {Object.entries(collatedMockSubmissions).map(([state, subs]) => `
                  <div class="avoid-break">
                    <div class="region-title">${state} Region</div>
                    <table>
                      <thead>
                        <tr>
                          <th style="width: 20%">Key Wins</th>
                          <th style="width: 20%">Churn Risk</th>
                          <th style="width: 20%">Major Updates</th>
                          <th style="width: 20%">30 Day Projected</th>
                          <th style="width: 20%">Priorities</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${subs.map(sub => `
                          <tr>
                            <td class="whitespace-pre-line">${(sub.wins||[]).map(w => '• ' + w.customer + ' - ' + w.updateText).join('<br>')}</td>
                            <td class="whitespace-pre-line rose">${(sub.risks||[]).map(r => '• ' + r.account + ' - ' + r.mitigation).join('<br>')}</td>
                            <td class="whitespace-pre-line">${sub.updates ? sub.updates + '<br><br>' : ''}${(sub.majorUpdates||[]).map(m => '• ' + m.customer + ' - ' + m.updateText).join('<br>')}</td>
                            <td class="whitespace-pre-line blue">${(sub.projectedWins||[]).map(p => '• ' + p.account + ' - ' + p.updateText).join('<br>')}</td>
                            <td class="whitespace-pre-line"><b>${sub.name}</b><br>${(sub.priorities||[]).map(p => '• ' + p.text).join('<br>')}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                `).join('')}
              </div>"""

content = re.sub(r'\{\/\* Hidden Print Container \*\/\}.*?</div>', print_container, content, flags=re.DOTALL)

with open(file_path, "w") as f:
    f.write(content)
