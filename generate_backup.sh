#!/bin/bash
OUTPUT="Backup.txt"

echo "=== SITE ARCHITECTURE ===" > "$OUTPUT"
find src public package.json tsconfig.json tailwind.config.ts next.config.mjs firebase.json firestore.rules -type f 2>/dev/null | sort >> "$OUTPUT"
echo -e "\n=== SOURCE CODE ===\n" >> "$OUTPUT"

find src public -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.css" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) | sort | while read -r file; do
    echo "---------------------------------------------------" >> "$OUTPUT"
    echo "FILE: $file" >> "$OUTPUT"
    echo "---------------------------------------------------" >> "$OUTPUT"
    cat "$file" >> "$OUTPUT"
    echo -e "\n" >> "$OUTPUT"
done

for file in package.json tsconfig.json tailwind.config.ts postcss.config.mjs next.config.mjs firebase.json firestore.rules; do
    if [ -f "$file" ]; then
        echo "---------------------------------------------------" >> "$OUTPUT"
        echo "FILE: $file" >> "$OUTPUT"
        echo "---------------------------------------------------" >> "$OUTPUT"
        cat "$file" >> "$OUTPUT"
        echo -e "\n" >> "$OUTPUT"
    fi
done

echo "Backup generated at $OUTPUT"
