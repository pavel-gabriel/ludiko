import { getSkill } from '@/engine/content/registry';
import { localize } from '@/engine/types';

/** "Adunarea până la 20, Silabe" for a list of skill ids (unknown ids are shown as they are) */
export function resolveSkillNames(ids: string[], lang: string): string {
  return ids.map((id) => localize(getSkill(id)?.title, lang) || id).join(', ');
}
