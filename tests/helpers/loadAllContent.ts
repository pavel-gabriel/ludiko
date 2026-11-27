/**
 * Tests only: load every content pack synchronously (eager glob), so tests can call `generateItems`,
 * `getItemsForSkill` and `getExplanation` for any skill without awaiting `ensurePacks`.
 * The app never imports this (it would bundle every pack into one chunk).
 */
import { registerPack, type PackData } from '../../src/engine/content/registry';

const packs = import.meta.glob<{ default: PackData }>('../../src/engine/content/packs/*.ts', { eager: true });

export function loadAllContentForTests(): void {
  for (const [file, mod] of Object.entries(packs)) {
    registerPack(file.replace(/^.*\/([^/]+)\.ts$/, '$1'), mod.default);
  }
}
