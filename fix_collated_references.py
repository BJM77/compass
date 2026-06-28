import re

file_path = "src/components/dashboard/demo-dash-view.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Fix handleExportPdf references
# Replace `collatedMockSubmissions` with `submissionsByState` in handleExportPdf HTML generation
content = content.replace("Object.entries(collatedMockSubmissions)", "Object.entries(submissionsByState)")

# Fix Key Standouts references
# Replace `collatedMockSubmissions` with `submissionsByState`
content = content.replace("Object.entries(collatedMockSubmissions)", "Object.entries(submissionsByState)")

# Wait, the PDF export HTML generation uses `sub.name`, `sub.wins.replace` but now `sub.wins` is an array of objects!
pdf_old = r"                            <td class=\"bold\">\$\{sub\.name\}<\/td>\n                            <td class=\"whitespace-pre-line\">\$\{sub\.wins\.replace\(\/\\n\/g, '<br>'\)\}<\/td>\n                            <td class=\"whitespace-pre-line rose\">\$\{sub\.risks\.replace\(\/\\n\/g, '<br>'\)\}<\/td>\n                            <td class=\"whitespace-pre-line\">\$\{sub\.updates\.replace\(\/\\n\/g, '<br>'\)\}<\/td>\n                            <td class=\"whitespace-pre-line blue\">\$\{sub\.projected\.replace\(\/\\n\/g, '<br>'\)\}<\/td>\n                            <td class=\"whitespace-pre-line\">\$\{sub\.priorities\.replace\(\/\\n\/g, '<br>'\)\}<\/td>"

pdf_new = """                            <td class="bold">${sub.name}</td>
                            <td class="whitespace-pre-line">${(sub.wins || []).map((w: any) => `• ${w.customer} ($${w.value})`).join('<br>')}</td>
                            <td class="whitespace-pre-line rose">${(sub.risks || []).map((r: any) => `• ${r.account} ($${r.value})<br>Mitigation: ${r.mitigation}`).join('<br><br>')}</td>
                            <td class="whitespace-pre-line">${[sub.updates, ...(sub.majorUpdates || []).map((m: any) => `• ${m.customer} - ${m.updateText}`)].filter(Boolean).join('<br><br>')}</td>
                            <td class="whitespace-pre-line blue">${(sub.projectedWins || []).map((p: any) => `• ${p.account} ($${p.value})<br>Expected: ${p.expectedDate}`).join('<br><br>')}</td>
                            <td class="whitespace-pre-line">${(sub.priorities || []).map((p: any) => `• ${p.text}`).join('<br>')}</td>"""

content = re.sub(pdf_old, pdf_new, content)

with open(file_path, "w") as f:
    f.write(content)

