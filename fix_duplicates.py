import re

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    lines = f.readlines()

new_lines = []
skip_count = 0
for i, line in enumerate(lines):
    if skip_count > 0:
        skip_count -= 1
        continue
    
    if "const [majorUpdates, setMajorUpdates] = useState<any[]>([]);" in line:
        continue # Remove duplicate state
        
    if "const addMajorUpdateRow = () => setMajorUpdates([...majorUpdates, { id: crypto.randomUUID(), updateText: '', customer: '', value: 0, salespersonName: 'Me', businessUnits: [] }]);" in line:
        skip_count = 8 # Remove duplicate functions
        continue
        
    new_lines.append(line)

with open(file_path, "w") as f:
    f.writelines(new_lines)

