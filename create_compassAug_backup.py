import os
import re

EXCLUDE_DIRS = {'.git', 'node_modules', '.next', 'public', 'scratch', 'scripts', 'docs'}
EXCLUDE_FILES = {
    '.env', '.env.local', '.env.development', '.env.production', '.DS_Store',
    'package-lock.json', 'compassAug.txt', 'tsconfig.tsbuildinfo'
}
EXCLUDE_EXTS = {'.txt', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pyc', '.md', '.py', '.sh'}
INCLUDE_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.mjs', '.yaml', '.html'}

def redact_keys(content):
    # redact common API keys (Firebase, OpenAI, etc)
    content = re.sub(r'AIza[0-9A-Za-z-_]{35}', '[REDACTED_API_KEY]', content)
    content = re.sub(r'(?i)(api_?key\s*[:=]\s*["\']?)[a-zA-Z0-9-_]{20,}(["\']?)', r'\1[REDACTED]\2', content)
    content = re.sub(r'sk-[a-zA-Z0-9]{32,}', '[REDACTED_API_KEY]', content)
    return content

def main():
    output_file = 'compassAug.txt'
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk('.'):
            # modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            
            for file in files:
                if file in EXCLUDE_FILES or file.startswith('.env'):
                    continue
                ext = os.path.splitext(file)[1]
                if ext not in INCLUDE_EXTS:
                    continue

                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as infile:
                        content = infile.read()
                        content = redact_keys(content)
                        outfile.write(f"--- File: {filepath} ---\n")
                        outfile.write(content)
                        outfile.write("\n\n")
                except Exception as e:
                    print(f"Skipping {filepath} due to error: {e}")
    print("Backup completed successfully to compassAug.txt")

if __name__ == '__main__':
    main()
