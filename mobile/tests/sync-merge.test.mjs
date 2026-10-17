import assert from 'node:assert/strict';
import test from 'node:test';

// Direct algorithm test matching App.tsx implementation
function mergeLibrary(local, remote) {
  const remoteKeys = new Set(
    remote.map((s) => `${s.mediaType ?? 'series'}:${s.tmdbId ?? s.title.trim().toLowerCase()}`)
  );
  const localOnly = local.filter(
    (s) => !remoteKeys.has(`${s.mediaType ?? 'series'}:${s.tmdbId ?? s.title.trim().toLowerCase()}`)
  );
  return { merged: [...remote, ...localOnly], localOnly };
}

function mergeWatchlist(local, remote) {
  const remoteKeys = new Set(
    remote.map((w) => `${w.mediaType ?? 'series'}:${w.id || w.title.trim().toLowerCase()}`)
  );
  const localOnly = local.filter(
    (w) => !remoteKeys.has(`${w.mediaType ?? 'series'}:${w.id || w.title.trim().toLowerCase()}`)
  );
  return { merged: [...remote, ...localOnly], localOnly };
}

test('Cloud Sync - Watchlist bidirectional merge', async (t) => {
  await t.test('detects local-only items that must be pushed to Supabase (e.g. Rapunzel)', () => {
    const local = [
      { id: 38757, mediaType: 'movie', title: 'Tangled (Rapunzel)', posterPath: '/rapunzel.jpg' },
      { id: 1399, mediaType: 'series', title: 'Game of Thrones', posterPath: '/got.jpg' },
    ];
    const remote = [
      { id: 1399, mediaType: 'series', title: 'Game of Thrones', posterPath: '/got.jpg' },
    ];

    const { merged, localOnly } = mergeWatchlist(local, remote);

    assert.equal(merged.length, 2);
    assert.equal(localOnly.length, 1);
    assert.equal(localOnly[0].title, 'Tangled (Rapunzel)');
    assert.equal(localOnly[0].id, 38757);
  });

  await t.test('merges remote items not present locally', () => {
    const local = [
      { id: 100, mediaType: 'movie', title: 'Local Movie' },
    ];
    const remote = [
      { id: 200, mediaType: 'series', title: 'Remote Series' },
    ];

    const { merged, localOnly } = mergeWatchlist(local, remote);

    assert.equal(merged.length, 2);
    assert.ok(merged.some((m) => m.title === 'Remote Series'));
    assert.ok(merged.some((m) => m.title === 'Local Movie'));
    assert.equal(localOnly.length, 1);
    assert.equal(localOnly[0].title, 'Local Movie');
  });

  await t.test('deduplicates identical items by id and mediaType', () => {
    const local = [
      { id: 550, mediaType: 'movie', title: 'Fight Club' },
    ];
    const remote = [
      { id: 550, mediaType: 'movie', title: 'Fight Club' },
    ];

    const { merged, localOnly } = mergeWatchlist(local, remote);

    assert.equal(merged.length, 1);
    assert.equal(localOnly.length, 0);
  });

  await t.test('handles case-insensitive title matching when id is missing', () => {
    const local = [
      { id: 0, mediaType: 'series', title: 'Breaking Bad' },
    ];
    const remote = [
      { id: 0, mediaType: 'series', title: 'breaking bad' },
    ];

    const { merged, localOnly } = mergeWatchlist(local, remote);

    assert.equal(merged.length, 1);
    assert.equal(localOnly.length, 0);
  });
});

test('Cloud Sync - Library bidirectional merge', async (t) => {
  await t.test('identifies series created locally to push to cloud', () => {
    const local = [
      { title: 'Severance', collection: 'watching', watchedEpisodes: 5, totalEpisodes: 9, mediaType: 'series', tmdbId: 93405 },
      { title: 'Dark', collection: 'up_to_date', watchedEpisodes: 26, totalEpisodes: 26, mediaType: 'series', tmdbId: 70523 },
    ];
    const remote = [
      { title: 'Dark', collection: 'up_to_date', watchedEpisodes: 26, totalEpisodes: 26, mediaType: 'series', tmdbId: 70523 },
    ];

    const { merged, localOnly } = mergeLibrary(local, remote);

    assert.equal(merged.length, 2);
    assert.equal(localOnly.length, 1);
    assert.equal(localOnly[0].title, 'Severance');
  });

  await t.test('preserves empty lists without crash', () => {
    const { merged, localOnly } = mergeLibrary([], []);
    assert.deepEqual(merged, []);
    assert.deepEqual(localOnly, []);
  });
});

