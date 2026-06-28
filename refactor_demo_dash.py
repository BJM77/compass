import sys

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Remove state variables
content = content.replace("  const [simUserRole, setSimUserRole] = useState<'REGISTERED' | 'GUEST'>('REGISTERED');\n", "")
content = content.replace("  const [simDay, setSimDay] = useState<'THURSDAY' | 'FRIDAY'>('THURSDAY');\n", "")

# 2. Hardcode simUserRole logic
content = content.replace("if (simUserRole === 'REGISTERED') {", "if (true) {")
content = content.replace(", simUserRole, twtwKpiActuals", ", twtwKpiActuals")
content = content.replace("Role View: {simUserRole === 'GUEST' ? 'Guest User (Standard Questions)' : 'Registered Staff (Extended Context)'}", "Role View: Registered Staff (Extended Context)")
content = content.replace("{simUserRole === 'REGISTERED' && (", "{true && (")

# 3. Remove Banner
idx1 = content.find("      {/* Simulation Control Banner */}")
idx2 = content.find("      {/* Main Tabs */}")
if idx1 != -1 and idx2 != -1:
    content = content[:idx1] + content[idx2:]

# 4. Update TabsList
idx_tabs_start = content.find("<Tabs defaultValue=\"simulator\" className=\"w-full\">")
idx_tabs_list_end = content.find("</TabsList>", idx_tabs_start) + len("</TabsList>")

new_tabs_list = """<Tabs defaultValue="thursday" className="w-full">
        <TabsList className="bg-white border p-1.5 rounded-2xl shadow-sm mb-6 w-full md:w-auto flex flex-col md:flex-row gap-1">
          <TabsTrigger value="thursday" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
            <Calendar className="w-3.5 h-3.5" /> Thursday TWTW
          </TabsTrigger>
          <TabsTrigger value="friday" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
            <ClipboardList className="w-3.5 h-3.5" /> Friday FW (Combined Pack)
          </TabsTrigger>
          {isLeader && (
            <TabsTrigger value="collation" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
              <PieChart className="w-3.5 h-3.5" /> Executive Collation
            </TabsTrigger>
          )}
          {isLeader && (
            <TabsTrigger value="standouts" className="font-black uppercase text-[10px] tracking-widest flex items-center gap-1.5 py-2 px-4">
              <Star className="w-3.5 h-3.5" /> Key Standouts
            </TabsTrigger>
          )}
        </TabsList>"""

content = content[:idx_tabs_start] + new_tabs_list + content[idx_tabs_list_end:]

# 5. Fix TabsContent wrapping and strip Grid
grid_open_str = """        <TabsContent value="simulator" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Side - Current Day View */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* --- THURSDAY TWTW REPORT FORM --- */}
              {simDay === 'THURSDAY' && ("""
content = content.replace(grid_open_str, "        <TabsContent value=\"thursday\" className=\"mt-0\">")

# Find the junction between Thursday and Friday
junction_old = """              )}

              {/* --- FRIDAY COMBINED PACK FORM --- */}
              {simDay === 'FRIDAY' && ("""
junction_new = """        </TabsContent>

        <TabsContent value="friday" className="mt-0">"""
content = content.replace(junction_old, junction_new)

# Remove the end of the Friday block, the Right Side panel, and the grid wrappers
right_side_start = """              )}
            </div>

            {/* Right Side - Live Simulated Database State */}"""
right_side_end = """        </TabsContent>

        {/* --- TAB 3: EXECUTIVE COLLATION TAB --- */}"""

idx3 = content.find(right_side_start)
idx4 = content.find(right_side_end)
if idx3 != -1 and idx4 != -1:
    content = content[:idx3] + """        </TabsContent>

        {/* --- TAB 3: EXECUTIVE COLLATION TAB --- */}""" + content[idx4 + len(right_side_end):]

# 6. Wrap Executive Collation with `isLeader`
collation_old = """        {/* --- TAB 3: EXECUTIVE COLLATION TAB --- */}
        <TabsContent value="collation" className="mt-0">"""
collation_new = """        {/* --- TAB 3: EXECUTIVE COLLATION TAB --- */}
        {isLeader && (
        <TabsContent value="collation" className="mt-0">"""
content = content.replace(collation_old, collation_new)

# 7. Remove Guide Tab and close Collation `isLeader`
guide_start = """        </TabsContent>

        {/* ==========================================
         * GUIDE / ARCHITECTURE VIEW"""
guide_end = """        </TabsContent>"""
idx5 = content.find(guide_start)
idx6 = content.find(guide_end, idx5 + len(guide_start)) + len(guide_end)
if idx5 != -1 and idx6 != -1:
    content = content[:idx5] + "        </TabsContent>\n        )}" + content[idx6:]

# 8. Add STANDOUTS view right before </Tabs>
key_standouts_block = """
        {/* ==========================================
         * KEY STANDOUTS VIEW
         * ========================================== */}
        {isLeader && (
          <TabsContent value="standouts" className="mt-0">
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden flex items-center justify-between">
                <div className="relative z-10 space-y-2">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                    <Star className="w-8 h-8 fill-current text-amber-200" /> Key Standouts
                  </h2>
                  <p className="text-amber-100 font-medium max-w-xl text-sm leading-relaxed">
                    A curated selection of the most significant wins, risks, and updates highlighted across all submissions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Object.entries(collatedMockSubmissions).map(([state, subs]) => 
                  subs.flatMap(sub => {
                    const standouts = [];
                    (sub.wins || []).forEach(w => {
                      if (mockItemFlags[`${sub.id}-wins-${w.id}`]?.isStarred) standouts.push({ type: 'Win', ...w });
                    });
                    (sub.risks || []).forEach(r => {
                      if (mockItemFlags[`${sub.id}-risks-${r.id}`]?.isStarred) standouts.push({ type: 'Risk', ...r });
                    });
                    (sub.majorUpdates || []).forEach(m => {
                      if (mockItemFlags[`${sub.id}-majorUpdates-${m.id}`]?.isStarred) standouts.push({ type: 'Update', ...m });
                    });
                    (sub.projectedWins || []).forEach(p => {
                      if (mockItemFlags[`${sub.id}-projectedWins-${p.id}`]?.isStarred) standouts.push({ type: 'Projected', ...p });
                    });
                    (sub.priorities || []).forEach(p => {
                      if (mockItemFlags[`${sub.id}-priorities-${p.id}`]?.isStarred) standouts.push({ type: 'Priority', ...p });
                    });

                    return standouts.map((item, idx) => (
                      <div key={`${sub.id}-${idx}`} className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm relative group flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="flex justify-between items-start gap-2">
                            <Badge className={
                              item.type === 'Win' ? "bg-emerald-100 text-emerald-700 uppercase font-black text-[9px]" :
                              item.type === 'Risk' ? "bg-rose-100 text-rose-700 uppercase font-black text-[9px]" :
                              item.type === 'Projected' ? "bg-blue-100 text-blue-700 uppercase font-black text-[9px]" :
                              item.type === 'Priority' ? "bg-amber-100 text-amber-700 uppercase font-black text-[9px]" :
                              "bg-indigo-100 text-indigo-700 uppercase font-black text-[9px]"
                            }>
                              {item.type}
                            </Badge>
                            <Star className="w-4 h-4 text-amber-500 fill-current" />
                          </div>
                          
                          <div>
                            <div className="font-bold text-slate-800 line-clamp-2 leading-tight">
                              {item.customer || item.account || item.text}
                            </div>
                            {item.value ? (
                              <div className={
                                item.type === 'Risk' ? "text-rose-600 font-black mt-1" : 
                                item.type === 'Win' ? "text-emerald-600 font-black mt-1" :
                                "text-blue-600 font-black mt-1"
                              }>
                                {formatEAV(item.value)}
                              </div>
                            ) : null}
                            <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">{sub.name}</div>
                            {item.updateText && <div className="text-xs text-slate-600 mt-2 line-clamp-3">{item.updateText}</div>}
                            {item.mitigation && <div className="text-xs text-slate-600 mt-2 line-clamp-3"><span className="font-bold text-slate-700">Mitigation:</span> {item.mitigation}</div>}
                          </div>
                        </div>
                      </div>
                    ));
                  })
                )}
              </div>
            </div>
          </TabsContent>
        )}"""

content = content.replace("      </Tabs>\n\n      {/* --- SUCCESS DIALOGS --- */}", key_standouts_block + "\n      </Tabs>\n\n      {/* --- SUCCESS DIALOGS --- */}")


with open(file_path, "w") as f:
    f.write(content)

