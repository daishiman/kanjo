// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidePage } from './pages/Guide.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('指標ガイドの静的説明', () => {
  it('APIが失敗しても用語と略語を参照できる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <GuidePage />
      </QueryClientProvider>,
    );

    expect(screen.getByText('略語の読み方')).toBeTruthy();
    expect(screen.getByText('決算書を読むための言葉')).toBeTruthy();
    expect(await screen.findByText(/現在値を取得できませんでした/)).toBeTruthy();
    expect(screen.getAllByText('取得できませんでした')).toHaveLength(3);
    expect(screen.queryByText('未取込')).toBeNull();
  });
});
