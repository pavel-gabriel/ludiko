import { beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import ProfileForm from '@/components/profiles/ProfileForm';
import SeatsPanel from '@/components/teacher/classes/SeatsPanel';
import ReportButton from '@/components/ui/ReportButton';
import ro from '@/i18n/ro.json';
import en from '@/i18n/en.json';

// F5 / F6: short privacy hints next to every free-text name or label a child or teacher types.

beforeAll(async () => {
  await i18n.changeLanguage('ro');
});

describe('privacyHints strings', () => {
  it('exist in both languages and are not empty', () => {
    for (const dict of [ro, en] as Array<Record<string, any>>) {
      expect(dict.privacyHints.nickname.length).toBeGreaterThan(10);
      expect(dict.privacyHints.teacherLabel.length).toBeGreaterThan(10);
      expect(dict.privacyHints.reportComment.length).toBeGreaterThan(10);
    }
  });

  it('use the exact Romanian wording from the privacy plan', () => {
    expect(ro.privacyHints.nickname).toBe('Folosește o poreclă sau inițiale, nu numele real');
    expect(ro.privacyHints.reportComment).toBe('Nu scrie nume sau date personale');
  });

  it('teacher deletion strings have every step name used by the orchestration', () => {
    for (const dict of [ro, en] as Array<Record<string, any>>) {
      const steps = dict.privacyHints.teacherDelete.steps;
      for (const step of ['classes', 'sessions', 'templates', 'profile', 'account']) {
        expect(steps[step]).toBeTruthy();
      }
    }
  });
});

describe('nickname hint (F5)', () => {
  it('shows the hint under the profile nickname field', () => {
    render(
      <MemoryRouter>
        <ProfileForm defaultLanguage="ro" onSubmit={() => {}} onCancel={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(ro.privacyHints.nickname)).toBeInTheDocument();
    cleanup();
  });
});

describe('teacher label hint (F5)', () => {
  it('shows the hint next to the seat label box in SeatsPanel', () => {
    render(
      <SeatsPanel
        classId="c1"
        seats={[]}
        onAdd={async () => {}}
        onUnlink={async () => {}}
        onRemove={async () => {}}
      />,
    );
    expect(screen.getByTestId('seat-labels-privacy')).toHaveTextContent(ro.privacyHints.teacherLabel);
    cleanup();
  });
});

describe('report comment hint (F6)', () => {
  it('shows the hint under the comment box when the report dialog is open', () => {
    render(<ReportButton itemId="item-1" />);
    fireEvent.click(screen.getByRole('button', { name: ro.report.button }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('report-privacy-hint')).toHaveTextContent(ro.privacyHints.reportComment);
    cleanup();
  });
});
