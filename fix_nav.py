import re

file_path = "src/app/dashboard/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# I want NAV_ITEMS to look exactly like this:
desired_nav_items = """const NAV_ITEMS = [
  { view: 'DASHBOARD' as DashboardView,         label: 'Dashboard',         icon: LayoutDashboard,  adminOnly: false, group: 'main' },
  { view: 'ARCHIVE' as DashboardView,           label: 'Weekly Snapshot',   icon: Archive,          adminOnly: false, group: 'main' },
  { view: 'FACT_FINDING' as DashboardView,      label: 'Fact Finding',      icon: FileSearch,       adminOnly: false, group: 'main' },
  { view: 'DEMO_DASH' as DashboardView,         label: 'The Week',          icon: CalendarCheck,    adminOnly: false, group: 'main' },
  { view: 'CALL_PLANNING' as DashboardView,     label: 'Call Plans',        icon: PhoneCall,        adminOnly: false, group: 'main' },
  { view: 'WHITE_SPACE' as DashboardView,       label: 'White Space',       icon: LayoutGrid,       adminOnly: false, group: 'main' },
  { view: 'OPS_REPORT' as DashboardView,        label: 'Ops Report',        icon: AlertCircle,      adminOnly: false, group: 'main' },
  { view: 'DATA_EXPLORER' as DashboardView,     label: 'Data Explorer',     icon: Database,         adminOnly: true,  group: 'main' },
  { view: 'SETTINGS' as DashboardView,          label: 'Settings',          icon: Settings,         adminOnly: false, group: 'main' },
  
  // Admin Items
  { view: 'TEAM_GOALS' as DashboardView,        label: 'Team Goals',        icon: Star,             adminOnly: true,  group: 'admin' },
  { view: 'BRIEFS' as DashboardView,            label: 'Briefs',            icon: Sparkles,         adminOnly: true,  group: 'admin' },
  { view: 'STRATEGY' as DashboardView,          label: 'Strategy',          icon: Map,              adminOnly: true,  group: 'admin' },
  { view: 'TEAM' as DashboardView,              label: 'Team',              icon: Users,            adminOnly: true,  group: 'admin' },
  { view: 'GM_REVIEW' as DashboardView,         label: 'GM Command Hub',    icon: Shield,           adminOnly: true,  group: 'admin' },
  { view: 'UPLOAD' as DashboardView,            label: 'CRM Import',        icon: Upload,           adminOnly: true,  group: 'admin' },
];"""

start_str = "const NAV_ITEMS = ["
end_str = "];"
start_idx = content.find(start_str)
end_idx = content.find(end_str, start_idx) + len(end_str)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + desired_nav_items + content[end_idx:]

with open(file_path, "w") as f:
    f.write(content)

