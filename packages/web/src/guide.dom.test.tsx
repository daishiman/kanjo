// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidePage } from './pages/Guide.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('指標ガイドの静的説明 (使い方画面の『用語と目安』)', () => {
  it('APIが失敗しても用語と略語を参照できる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/guide?topic=terms']}>
          <GuidePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('略語の読み方')).toBeTruthy();
    expect(screen.getByText('決算書を読むための言葉')).toBeTruthy();
    expect(await screen.findByText(/現在値を取得できませんでした/)).toBeTruthy();
    // 充足度の 3 行は失敗を「取得できませんでした」と出し、未取込と取り違えない
    const coverage = screen.getByRole('heading', { name: 'データ充足度チェック' }).closest('section');
    if (!coverage) throw new Error('データ充足度チェックの節が無い');
    expect(within(coverage).getAllByText('取得できませんでした')).toHaveLength(3);
    expect(screen.queryByText('未取込')).toBeNull();
  });
});
