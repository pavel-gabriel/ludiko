import { describe, it, expect, beforeAll } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '../src/i18n/config';
import SkillPicker from '../src/components/play/SkillPicker';
import { MAX_SKILLS, type ItemGameKind } from '../src/services/itemGame';

beforeAll(async () => {
  await i18n.changeLanguage('ro');
});

function Harness({ kind = 'race', initial = [] as string[] }: { kind?: ItemGameKind; initial?: string[] }) {
  const [ids, setIds] = useState<string[]>(initial);
  return (
    <>
      <SkillPicker value={ids} onChange={setIds} kind={kind} />
      <output data-testid="value">{JSON.stringify(ids)}</output>
    </>
  );
}
const value = () => JSON.parse(screen.getByTestId('value').textContent ?? '[]') as string[];
const open = () => fireEvent.click(screen.getByRole('button', { name: /Alege singur abilitățile/ }));

describe('SkillPicker ("Ce exersăm?")', () => {
  it('has the title, the hint and quick presets', () => {
    render(<Harness />);
    expect(screen.getByText('Ce exersăm?')).toBeInTheDocument();
    for (const label of ['Adunare până la 20', 'Tabla înmulțirii', 'Silabe']) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('a preset selects its skills and toggles off again', () => {
    render(<Harness />);
    const silabe = screen.getByRole('button', { name: /Silabe/ });
    fireEvent.click(silabe);
    expect(value()).toEqual(['rom.syll.count.0', 'rom.syll.split.1']);
    expect(screen.getByText('Alese: 2/5')).toBeInTheDocument();
    expect(silabe).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(silabe);
    expect(value()).toEqual([]);
  });

  it('subject -> grade -> skill, multi-select across subjects', () => {
    render(<Harness />);
    open();
    // Matematică / clasa a II-a is a different list than Pregătitoare
    fireEvent.click(screen.getByRole('button', { name: 'Matematică' }));
    fireEvent.click(screen.getByRole('button', { name: 'III' }));
    fireEvent.click(screen.getByRole('button', { name: /Tabla înmulțirii cu 2, 3, 4 și 5/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Limba română' }));
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    fireEvent.click(screen.getByRole('button', { name: /Despărțirea cuvintelor în silabe/ }));
    expect(value()).toEqual(['mat.mul.table.small', 'rom.syll.split.1']);
  });

  it('chosen skills can be removed one by one or all at once', () => {
    render(<Harness initial={['mat.add.10', 'mat.sub.10']} />);
    fireEvent.click(screen.getByRole('button', { name: /Scoate: Adunarea în limitele 0–10/ }));
    expect(value()).toEqual(['mat.sub.10']);
    fireEvent.click(screen.getByRole('button', { name: 'Șterge alegerea' }));
    expect(value()).toEqual([]);
  });

  it('allows at most 5 skills', () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Matematică' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pregătitoare' }));
    const list = screen.getByRole('list', { name: 'Ce exersăm?' });
    for (const b of within(list).getAllByRole('button')) fireEvent.click(b);
    expect(value()).toHaveLength(MAX_SKILLS);
    expect(screen.getByText(/Ai ales deja 5 abilități/)).toBeInTheDocument();
    // the grade I list is now locked: nothing more can be added
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    for (const b of within(screen.getByRole('list', { name: 'Ce exersăm?' })).getAllByRole('button')) {
      expect(b).toBeDisabled();
    }
    expect(value()).toHaveLength(MAX_SKILLS);
  });

  it('text-comprehension skills cannot be picked for a race', () => {
    render(<Harness />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Limba română' }));
    fireEvent.click(screen.getByRole('button', { name: 'I' }));
    const text = screen.getByRole('button', { name: /Înțelegem un text scurt/ });
    expect(text).toBeDisabled();
    expect(within(text).getByText('nu merge în acest joc')).toBeInTheDocument();
    fireEvent.click(text);
    expect(value()).toEqual([]);
  });
});
