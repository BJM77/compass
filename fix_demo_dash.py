import re

with open("src/components/dashboard/demo-dash-view.tsx", "r") as f:
    content = f.read()

# Replace 'Me' with activeUserName
content = content.replace("salespersonName: 'Me'", "salespersonName: activeUserName")

# Replace button styling
old_button = 'className="w-full mt-4 text-xs font-black uppercase text-slate-500 border-dashed rounded-xl py-6 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"'
new_button = 'className="w-full text-[10px] font-black uppercase rounded-xl border-slate-200"'

content = content.replace(old_button, new_button)
content = content.replace('Add Priority Row', 'Add Custom Priority')

with open("src/components/dashboard/demo-dash-view.tsx", "w") as f:
    f.write(content)
