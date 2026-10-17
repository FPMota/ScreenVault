import assert from 'node:assert/strict';
import test from 'node:test';

// Transformation logic from mobile/lib/tmdb.ts
function transformTmdbResults(rawResults) {
  return rawResults
    .filter((item) => item.media_type === 'tv' || item.media_type === 'movie')
    .map((item) => ({
      id: item.id,
      mediaType: (item.media_type === 'tv' ? 'series' : 'movie'),
      title: (item.title || item.name || '').trim(),
      posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : undefined,
      backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : undefined,
      overview: item.overview || undefined,
    }));
}

test('TMDB Response Transformation', async (t) => {
  await t.test('filters out person entities from multi-search results', () => {
    const raw = [
      { id: 1, media_type: 'movie', title: 'Inception' },
      { id: 2, media_type: 'person', name: 'Christopher Nolan' },
      { id: 3, media_type: 'tv', name: 'Westworld' },
    ];
    const transformed = transformTmdbResults(raw);
    assert.equal(transformed.length, 2);
    assert.ok(!transformed.some((item) => item.title === 'Christopher Nolan'));
  });

  await t.test('maps tv name to title and converts media_type tv to series', () => {
    const raw = [{ id: 1399, media_type: 'tv', name: 'Game of Thrones' }];
    const transformed = transformTmdbResults(raw);
    assert.equal(transformed[0].title, 'Game of Thrones');
    assert.equal(transformed[0].mediaType, 'series');
  });

  await t.test('formats poster and backdrop URLs correctly with TMDB CDN base', () => {
    const raw = [
      {
        id: 38757,
        media_type: 'movie',
        title: 'Tangled',
        poster_path: '/ym7KjR.jpg',
        backdrop_path: '/hZk.jpg',
      },
    ];
    const transformed = transformTmdbResults(raw);
    assert.equal(transformed[0].posterPath, 'https://image.tmdb.org/t/p/w500/ym7KjR.jpg');
    assert.equal(transformed[0].backdropPath, 'https://image.tmdb.org/t/p/w780/hZk.jpg');
  });

  await t.test('handles missing or null poster_path gracefully as undefined', () => {
    const raw = [
      {
        id: 99999,
        media_type: 'movie',
        title: 'Indie Film',
        poster_path: null,
      },
    ];
    const transformed = transformTmdbResults(raw);
    assert.equal(transformed[0].posterPath, undefined);
  });
});

