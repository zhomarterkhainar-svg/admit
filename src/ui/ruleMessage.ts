import { t } from '@/i18n';
import { ALL_EXERCISES } from '@/exercises/registry';

/** A technique rule's short message ("Knees cave in"), looked up across all exercises. */
export function ruleMessage(id: string): string {
  for (const ex of Object.values(ALL_EXERCISES)) {
    const r = [...ex.frameRules, ...ex.repRules].find((x) => x.id === id);
    if (r) return t(r.message);
  }
  return id;
}
