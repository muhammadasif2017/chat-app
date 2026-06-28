import { QueryClient } from '@tanstack/react-query';

describe('TanStack Query cache key matching — new message strategy', () => {
  const cid = 'conv-1';
  const emptySearchKey = ['messages', cid, ''] as const;

  const fakeInfiniteData = {
    pages: [{ messages: [{ id: '1', content: 'hello' }], nextCursor: null }],
    pageParams: [null],
  };

  const appendMessage = (old: typeof fakeInfiniteData | undefined) => {
    if (!old) return old;
    const last = old.pages.length - 1;
    const pages = old.pages.map((page, i) =>
      i === last ? { ...page, messages: [...page.messages, { id: '2', content: 'new' }] } : page,
    );
    return { ...old, pages };
  };

  it('setQueryData with 2-element key does NOT match 3-element rendered key (old bug)', () => {
    const qc = new QueryClient();
    qc.setQueryData(emptySearchKey, fakeInfiniteData);

    // This is what the old code did:
    qc.setQueryData(['messages', cid], appendMessage as never);

    const result = qc.getQueryData<typeof fakeInfiniteData>(emptySearchKey);
    expect(result?.pages[0].messages).toHaveLength(1);
  });

  it('setQueriesData with prefix key DOES match 3-element rendered key (fix)', () => {
    const qc = new QueryClient();
    qc.setQueryData(emptySearchKey, fakeInfiniteData);

    qc.setQueriesData<typeof fakeInfiniteData>({ queryKey: ['messages', cid] }, appendMessage);

    const result = qc.getQueryData<typeof fakeInfiniteData>(emptySearchKey);
    expect(result?.pages[0].messages).toHaveLength(2);
  });

  it('predicate !query.queryKey[2] skips active search caches', () => {
    const qc = new QueryClient();
    const searchKey = ['messages', cid, 'hello'] as const;
    qc.setQueryData(searchKey, fakeInfiniteData);

    qc.setQueriesData<typeof fakeInfiniteData>(
      { queryKey: ['messages', cid], predicate: (query) => !query.queryKey[2] },
      appendMessage,
    );

    const result = qc.getQueryData<typeof fakeInfiniteData>(searchKey);
    expect(result?.pages[0].messages).toHaveLength(1);
  });

  it('predicate !query.queryKey[2] still updates the no-search view', () => {
    const qc = new QueryClient();
    qc.setQueryData(emptySearchKey, fakeInfiniteData);

    qc.setQueriesData<typeof fakeInfiniteData>(
      { queryKey: ['messages', cid], predicate: (query) => !query.queryKey[2] },
      appendMessage,
    );

    const result = qc.getQueryData<typeof fakeInfiniteData>(emptySearchKey);
    expect(result?.pages[0].messages).toHaveLength(2);
  });
});
