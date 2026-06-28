import re
with open("src/components/dashboard/twiw-view.tsx", "r") as f:
    content = f.read()

m = re.search(r"const renderCollationHub = \(\) => \{.*?(?=  const renderKeyStandouts =)", content, re.DOTALL)
if m:
    print(m.group(0)[:1000])
    print("...")
    print(m.group(0)[-1000:])
