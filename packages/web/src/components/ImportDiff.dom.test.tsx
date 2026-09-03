// @vitest-environment jsdom

/** freeeなどMF明細以外の取込は、差分確認の失敗として扱わない。 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { type ConflictDecision, DiffPreview } from './ImportDiff.js';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

function Subject() {
  const [decisions, setDecisions] = useState<ConflictDecision[]>([]);
  const [fingerprint, setFingerprint] = useState<string | null>('old-preview');
  return (
    <>
      <DiffPreview
        files={[new File(['架空'], 'freee.zip')]}
        decisions={decisions}
        onDecisionsChange={setDecisions}
        onFingerprintChange={setFingerprint}
      />
      <output aria-label="preview fingerprint">{fingerprint ?? 'なし'}</output>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('freeeの差分対象外応答を赤いエラーにせず、通常取込へ案内する', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            supported: false,
            message: 'freeeの取引は差分確認の対象外です。このまま取込を実行できます。',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    ),
  );
  render(<Subject />, { wrapper });

  fireEvent.click(screen.getByRole('button', { name: '取り込む前に差分を見る' }));

  expect(await screen.findByText(/freeeの取引は差分確認の対象外/)).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status', { name: 'preview fingerprint' }).textContent).toBe('なし');
});
