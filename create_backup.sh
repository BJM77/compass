#!/bin/bash
OUTPUT="/Users/bjmack/Desktop/Compass_Source_Code.txt"
echo "Generating Source Code Backup..." > "$OUTPUT"
echo "Generated at $(date)" >> "$OUTPUT"
echo "=========================================" >> "$OUTPUT"

find . -type f \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" -o -name "*.mjs" -o -name "*.css" -o -name "*.rules" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.next/*" \
  ! -path "*/.git/*" \
  ! -path "*/scratch/*" \
  ! -path "*/compass-v2/*" \
  ! -path "*/.gemini/*" \
  ! -name "package-lock.json" \
  ! -name "*.env*" \
  ! -name ".DS_Store" | sort | while read -r file; do
    echo -e "\n\n=========================================" >> "$OUTPUT"
    echo "FILE: $file" >> "$OUTPUT"
    echo "=========================================" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
done

echo "Done."
