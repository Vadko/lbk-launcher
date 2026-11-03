export function teamMembers(team: string | null | undefined): string[] {
  if (!team) {
    return [];
  }
  return team
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
