function matchUser(users, ownerName) {
  if (!ownerName) return null;
  const lower = ownerName.trim().toLowerCase();
  
  let normalizedOwner = lower;
  if (normalizedOwner.includes(',')) {
    const parts = normalizedOwner.split(',');
    if (parts.length === 2) {
      normalizedOwner = `${parts[1].trim()} ${parts[0].trim()}`;
    }
  }

  // Exact match first
  let found = users.find(u => (u.name || '').trim().toLowerCase() === normalizedOwner);
  if (found) return found;

  // Exact match fallback on original lower
  found = users.find(u => (u.name || '').trim().toLowerCase() === lower);
  if (found) return found;

  // Partial match fallback
  found = users.find(u => {
    const uname = (u.name || '').trim().toLowerCase();
    
    // Check if all parts of normalizedOwner exist in uname
    const ownerParts = normalizedOwner.split(/\s+/);
    const allPartsMatch = ownerParts.every(part => uname.includes(part));
    if (allPartsMatch) return true;

    return uname.includes(normalizedOwner) || normalizedOwner.includes(uname);
  });
  
  return found || null;
}

const users = [
  { name: 'John Doe' },
  { name: 'Namra Khan' },
  { name: 'Isaac De Pina' }
];

console.log(matchUser(users, 'Doe, John'));
console.log(matchUser(users, 'Khan, Namra'));
console.log(matchUser(users, 'De Pina, Isaac'));
console.log(matchUser(users, 'Pina, Isaac de'));

