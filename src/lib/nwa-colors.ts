/**
 * Person colours for the whole-team NWA view.
 *
 * Admins pick a colour per person on the Team (user management) page; it is stored as
 * users/{uid}.nwaColor (one of the palette ids below). People without a colour get one
 * automatically from a hash of their uid, so it is the same on every load.
 *
 * Each colour has a light tint (chip background), a stronger strip colour (left edge of a row)
 * and a dark ink for text on the tint (WCAG AA contrast against the tint).
 */
export interface NwaColor {
  id: string;
  label: string;
  /** Light tint: chip and legend background. */
  tint: string;
  /** Strong colour: the left strip on each row. */
  strip: string;
  /** Text colour on the tint. */
  ink: string;
}

export const NWA_COLORS: NwaColor[] = [
  { id: 'lavender', label: 'Light purple', tint: '#EDE4FF', strip: '#8B5CF6', ink: '#4C1D95' },
  { id: 'sky', label: 'Sky blue', tint: '#DBEAFE', strip: '#3B82F6', ink: '#1E3A8A' },
  { id: 'mint', label: 'Mint', tint: '#D1FAE5', strip: '#10B981', ink: '#064E3B' },
  { id: 'peach', label: 'Peach', tint: '#FFE4D6', strip: '#F97316', ink: '#7C2D12' },
  { id: 'rose', label: 'Rose', tint: '#FFE4E6', strip: '#F43F5E', ink: '#881337' },
  { id: 'lemon', label: 'Lemon', tint: '#FEF9C3', strip: '#EAB308', ink: '#713F12' },
  { id: 'teal', label: 'Teal', tint: '#CCFBF1', strip: '#14B8A6', ink: '#134E4A' },
  { id: 'pink', label: 'Pink', tint: '#FCE7F3', strip: '#EC4899', ink: '#831843' },
  { id: 'sage', label: 'Sage', tint: '#E6F0DC', strip: '#65A30D', ink: '#365314' },
  { id: 'sand', label: 'Sand', tint: '#F5EBDD', strip: '#B45309', ink: '#78350F' },
  { id: 'periwinkle', label: 'Periwinkle', tint: '#E0E7FF', strip: '#6366F1', ink: '#312E81' },
  { id: 'aqua', label: 'Aqua', tint: '#CFFAFE', strip: '#06B6D4', ink: '#164E63' },
];

const BY_ID = new Map(NWA_COLORS.map(c => [c.id, c]));

export function isNwaColorId(v: unknown): v is string {
  return typeof v === 'string' && BY_ID.has(v);
}

export function nwaColorById(id: string | null | undefined): NwaColor | null {
  return (id && BY_ID.get(id)) || null;
}

/** Small, stable string hash (FNV-1a, 32-bit). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Automatic colour for a uid (no admin choice). */
export function autoNwaColor(uid: string): NwaColor {
  return NWA_COLORS[hashString(uid || '') % NWA_COLORS.length];
}

/** The admin-set colour, else the automatic one. */
export function resolveNwaColor(uid: string, nwaColor?: string | null): NwaColor {
  return nwaColorById(nwaColor) || autoNwaColor(uid);
}

/**
 * Colours for a whole team. Admin-set colours always win. Everyone else gets their hashed
 * colour, moving to the next free colour if a teammate already has it (while free colours remain),
 * so two people rarely share a colour. People are processed in uid order, so the result only
 * depends on who is in the team, not on list order.
 */
export function assignTeamColors(users: { id: string; nwaColor?: string | null }[]): Record<string, NwaColor> {
  const out: Record<string, NwaColor> = {};
  const used = new Set<string>();
  users.forEach(u => {
    const c = nwaColorById(u.nwaColor);
    if (c) { out[u.id] = c; used.add(c.id); }
  });
  [...users].filter(u => !out[u.id]).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).forEach(u => {
    const start = hashString(u.id || '') % NWA_COLORS.length;
    let pick = NWA_COLORS[start];
    if (used.size < NWA_COLORS.length) {
      for (let i = 0; i < NWA_COLORS.length; i++) {
        const c = NWA_COLORS[(start + i) % NWA_COLORS.length];
        if (!used.has(c.id)) { pick = c; break; }
      }
    }
    out[u.id] = pick;
    used.add(pick.id);
  });
  return out;
}
