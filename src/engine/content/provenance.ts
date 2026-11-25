/**
 * Content & IP policy enforcement — see docs/LEGAL_CONTENT_POLICY.md.
 * Every third-party asset and every content record must carry a valid Provenance.
 */

export const ALLOWED_LICENCES = [
  'OWN',
  'RO-OFFICIAL-TEXT',
  'PD',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'CC-BY-SA-3.0',
  'CC-BY-SA-4.0',
  'OFL-1.1',
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Apache-2.0',
] as const;

export const PROVENANCE_KINDS = [
  'image',
  'audio',
  'font',
  'text',
  'item',
  'explanation',
  'library',
  'data',
] as const;

export const PROVENANCE_SOURCES = [
  'own',
  'generated',
  'ai-draft',
  'official-text',
  'public-domain',
  'open-licence',
] as const;

export type Licence = (typeof ALLOWED_LICENCES)[number];
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export interface Provenance {
  id: string;
  kind: ProvenanceKind;
  title: string;
  author: string;
  source: ProvenanceSource;
  licence: Licence;
  url?: string;
  licenceUrl?: string;
  retrieved?: string;
  version?: string;
  modified?: boolean;
  basis?: string;
  notes?: string;
}

const KNOWN_FIELDS = new Set([
  'id', 'kind', 'title', 'author', 'source', 'licence',
  'url', 'licenceUrl', 'retrieved', 'version', 'modified', 'basis', 'notes',
]);

/** Licences we must never use: non-commercial or no-derivatives (block paid plans / adaptation) */
const FORBIDDEN_LICENCE = /(^|[-_\s])(NC|ND)([-_\s]|$)|non-?commercial|no-?deriv/i;

/** Which licences each source may use */
const LICENCES_BY_SOURCE: Record<ProvenanceSource, readonly Licence[]> = {
  own: ['OWN'],
  generated: ['OWN'],
  'ai-draft': ['OWN'],
  'official-text': ['RO-OFFICIAL-TEXT'],
  'public-domain': ['PD', 'CC0-1.0'],
  'open-licence': [
    'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0',
    'OFL-1.1', 'MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Apache-2.0',
  ],
};

const isNonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Validate one provenance record. Returns a list of human-readable errors (empty = valid).
 */
export function validateProvenance(record: unknown, where = 'provenance'): string[] {
  const errors: string[] = [];
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return [`${where}: must be an object`];
  }
  const r = record as Record<string, unknown>;
  const label = `${where}${isNonEmpty(r.id) ? ` (${r.id})` : ''}`;

  for (const field of ['id', 'title', 'author'] as const) {
    if (!isNonEmpty(r[field])) errors.push(`${label}: missing "${field}"`);
  }
  for (const key of Object.keys(r)) {
    if (!KNOWN_FIELDS.has(key)) errors.push(`${label}: unknown field "${key}"`);
  }

  if (!PROVENANCE_KINDS.includes(r.kind as ProvenanceKind)) {
    errors.push(`${label}: invalid "kind" ${JSON.stringify(r.kind)}`);
  }

  const source = r.source as ProvenanceSource;
  if (!PROVENANCE_SOURCES.includes(source)) {
    errors.push(`${label}: invalid "source" ${JSON.stringify(r.source)}`);
  }

  const licence = r.licence;
  if (typeof licence === 'string' && FORBIDDEN_LICENCE.test(licence)) {
    errors.push(`${label}: licence "${licence}" is NC/ND — forbidden by content policy`);
  } else if (!ALLOWED_LICENCES.includes(licence as Licence)) {
    errors.push(`${label}: licence ${JSON.stringify(licence)} is not on the allowlist`);
  } else if (PROVENANCE_SOURCES.includes(source) && !LICENCES_BY_SOURCE[source].includes(licence as Licence)) {
    errors.push(`${label}: licence "${licence}" does not fit source "${source}"`);
  }

  /* Third-party material must be traceable */
  const thirdParty = source === 'open-licence' || source === 'public-domain' || source === 'official-text';
  if (thirdParty) {
    if (!isNonEmpty(r.url) || !/^https?:\/\//.test(r.url as string)) {
      errors.push(`${label}: third-party material needs a "url"`);
    }
    if (!isNonEmpty(r.retrieved) || !/^\d{4}-\d{2}-\d{2}$/.test(r.retrieved as string)) {
      errors.push(`${label}: third-party material needs "retrieved" as YYYY-MM-DD`);
    }
  }
  if (source === 'public-domain' && !isNonEmpty(r.basis)) {
    errors.push(`${label}: public-domain material needs a "basis" (why it is public domain)`);
  }
  if (r.modified !== undefined && typeof r.modified !== 'boolean') {
    errors.push(`${label}: "modified" must be a boolean`);
  }
  if (r.licenceUrl !== undefined && !/^https?:\/\//.test(String(r.licenceUrl))) {
    errors.push(`${label}: "licenceUrl" must be a URL`);
  }

  return errors;
}

/**
 * Walk any JSON value and validate every object found under a `provenance` key.
 * Also reports duplicate provenance ids.
 */
export function validateProvenanceTree(value: unknown, where: string, seenIds = new Set<string>()): string[] {
  const errors: string[] = [];
  const visit = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => visit(child, `${path}[${i}]`));
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, child] of Object.entries(node)) {
      if (key === 'provenance') {
        errors.push(...validateProvenance(child, `${path}.provenance`));
        const id = (child as Record<string, unknown> | null)?.id;
        if (typeof id === 'string') {
          if (seenIds.has(id)) errors.push(`${path}.provenance: duplicate id "${id}"`);
          seenIds.add(id);
        }
      }
      visit(child, `${path}.${key}`);
    }
  };
  visit(value, where);
  return errors;
}
