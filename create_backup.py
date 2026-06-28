import os

backup_file = "nw.txt"
root_dir = "."

ignore_dirs = {'.git', 'node_modules', '.next', 'dist', 'build', '.gemini'}
allowed_exts = {'.ts', '.tsx', '.js', '.jsx', '.css', '.json'}

def generate_tree(dir_path, prefix=""):
    tree_str = ""
    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return ""
        
    entries = [e for e in entries if e not in ignore_dirs and not e.startswith('.')]
    
    for i, entry in enumerate(entries):
        path = os.path.join(dir_path, entry)
        is_last = i == len(entries) - 1
        connector = "└── " if is_last else "├── "
        tree_str += f"{prefix}{connector}{entry}\n"
        
        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            tree_str += generate_tree(path, prefix + extension)
            
    return tree_str

with open(backup_file, "w", encoding="utf-8") as f:
    f.write("=== SITE ARCHITECTURE ===\n\n")
    f.write(generate_tree(root_dir))
    f.write("\n\n=== SOURCE CODE ===\n\n")
    
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith('.')]
        
        for file in files:
            if file == "nw.txt" or file.endswith(".py"):
                continue
                
            _, ext = os.path.splitext(file)
            if ext in allowed_exts:
                filepath = os.path.join(root, file)
                
                # Exclude package-lock.json and similar huge generated files
                if file in ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"]:
                    continue
                    
                try:
                    with open(filepath, "r", encoding="utf-8") as infile:
                        content = infile.read()
                        
                        # Sanitize API keys
                        if "apiKey" in content or "NEXT_PUBLIC_FIREBASE_API_KEY" in content:
                            content = content.replace(content, "/* File content hidden due to API keys */")
                            
                        f.write(f"\n\n--- FILE: {filepath} ---\n\n")
                        f.write(content)
                except Exception as e:
                    f.write(f"\n\n--- FILE: {filepath} (Error reading file) ---\n\n")

print(f"Successfully created {backup_file}")
