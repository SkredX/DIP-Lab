/**
 * In beginner mode, strips trailing math notation from a control label so
 * people see plain English instead of symbols they haven't been taught yet.
 * "Threshold Intensity (r)" -> "Threshold Intensity"
 * "Red Channel Weight (w_R)" -> "Red Channel Weight"
 */
export function plainLabel(label: string, mode: 'beginner' | 'advanced'): string {
  if (mode === 'advanced') return label;
  return label.replace(/\s*\([^)]*[a-zA-Zγσμθ][^)]*\)\s*$/u, '').trim();
}
