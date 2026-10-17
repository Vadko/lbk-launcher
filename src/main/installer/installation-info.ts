import type { AchievementsComponent, InstallationInfo } from '@/shared/types';

// A components-only change keeps the record as installed; only the achievements entry is replaced or dropped.
export function withAchievementsComponent(
  base: InstallationInfo,
  achievements: AchievementsComponent | null
): InstallationInfo {
  const components = {
    ...(base.components ?? { text: { installed: false, files: [] } }),
  };
  delete components.achievements;
  return {
    ...base,
    components: achievements ? { ...components, achievements } : components,
  };
}
