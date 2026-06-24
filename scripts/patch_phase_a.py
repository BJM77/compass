import re

def patch():
    with open('src/components/dashboard/demo-dash-view.tsx', 'r') as f:
        content = f.read()

    # 1. Remove previousFocusAccounts state
    state_target = "  const [previousFocusAccounts, setPreviousFocusAccounts] = useState<any[]>([]);"
    content = content.replace(state_target, "")

    # 2. Update loadPreviousFridayData to set currentWeekActions and currentWeekFocusAccounts
    load_target = """          setKpiReview(prev => ({
            ...prev,
            callsTarget: kpiTargets.callsToMake || 0,
            appointmentsTarget: kpiTargets.appointmentsToSet || 0,
            proposalsTarget: kpiTargets.proposalsToSend || 0,
            dealsTarget: kpiTargets.dealsToClose || 0,
            revenueTarget: kpiTargets.revenueTarget || 0
          }));
          setPreviousFocusAccounts(prevData.focusAccounts || []);
        }"""
        
    load_replacement = """          setKpiReview(prev => ({
            ...prev,
            callsTarget: kpiTargets.callsToMake || 0,
            appointmentsTarget: kpiTargets.appointmentsToSet || 0,
            proposalsTarget: kpiTargets.proposalsToSend || 0,
            dealsTarget: kpiTargets.dealsToClose || 0,
            revenueTarget: kpiTargets.revenueTarget || 0
          }));
          if (prevData.actionPlan) {
            setCurrentWeekActions(prevData.actionPlan.map((act: string) => ({ text: act, completed: false, update: '' })));
          }
          if (prevData.focusAccounts) {
            setCurrentWeekFocusAccounts(prevData.focusAccounts.map((fa: any) => ({ ...fa, status: 'WORKING', update: '' })));
          }
        }"""
    content = content.replace(load_target, load_replacement)

    # 3. Remove previousFocusAccounts from renderKPIReview
    render_kpi_target = """          {previousFocusAccounts.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-accent" /> Previous Week's Focus Accounts (from Friday Plan)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {previousFocusAccounts.map((acc: any, idx: number) => (
                  <div key={idx} className="p-3 bg-slate-50 border rounded-xl">
                    <p className="font-bold text-slate-800">{acc.accountName}</p>
                    <div className="flex gap-2 mt-1 text-[10px] text-slate-500">
                      <Badge variant="outline" className="text-[7px] font-black uppercase">{acc.actionType}</Badge>
                      <span className="font-black">${(acc.eav || 0).toLocaleString()}</span>
                    </div>
                    {acc.aboutAccount && <p className="text-[10px] text-slate-600 mt-1 line-clamp-2">{acc.aboutAccount}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}"""
    content = content.replace(render_kpi_target, "")

    # 4. Rename Phase A headers
    header_1_target = "Review Monday Commitments (Phase A)"
    header_1_replacement = "This Weeks Actions"
    content = content.replace(header_1_target, header_1_replacement)

    header_2_target = "Focus Account Progress Review (Phase A)"
    header_2_replacement = "Focus Account Progress Review"
    content = content.replace(header_2_target, header_2_replacement)

    with open('src/components/dashboard/demo-dash-view.tsx', 'w') as f:
        f.write(content)

patch()
