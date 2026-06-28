import re

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

# I will find the definition of `collatedMockSubmissions` and remove it.
# It starts with `const collatedMockSubmissions = useMemo(() => {`
# And ends with a closing `}, [...]);`

start_str = "const collatedMockSubmissions = useMemo(() => {"
start_idx = content.find(start_str)

if start_idx != -1:
    end_idx = content.find("]);", start_idx) + 3
    if end_idx != -1:
        # replace it with the mappedSubmissions definition
        new_def = """  const mappedSubmissions = useMemo(() => {
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
        
        content = content[:start_idx] + new_def + content[end_idx:]

with open(file_path, "w") as f:
    f.write(content)
