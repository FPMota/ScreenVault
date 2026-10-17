import assert from 'node:assert/strict';
import test from 'node:test';

// Validate payload matching supabase/schema.sql constraints
function validateSeriesPayload(payload) {
  const errors = [];
  if (!payload.user_id || typeof payload.user_id !== 'string') {
    errors.push('user_id is required');
  }
  if (!payload.title || typeof payload.title !== 'string') {
    errors.push('title is required');
  }
  if (!['series', 'movie'].includes(payload.media_type)) {
    errors.push("media_type must be 'series' or 'movie'");
  }
  if (!['watching', 'finished_airing_to_continue', 'up_to_date'].includes(payload.collection)) {
    errors.push('invalid collection');
  }
  if (typeof payload.watched_episodes !== 'number' || payload.watched_episodes < 0) {
    errors.push('watched_episodes must be non-negative integer');
  }
  if (typeof payload.total_episodes !== 'number' || payload.total_episodes < 0) {
    errors.push('total_episodes must be non-negative integer');
  }
  if (payload.rating !== null && payload.rating !== undefined) {
    if (typeof payload.rating !== 'number' || payload.rating < 1 || payload.rating > 5) {
      errors.push('rating must be between 1 and 5');
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateWatchlistPayload(payload) {
  const errors = [];
  if (!payload.user_id || typeof payload.user_id !== 'string') {
    errors.push('user_id is required');
  }
  if (!payload.title || typeof payload.title !== 'string') {
    errors.push('title is required');
  }
  if (!['series', 'movie'].includes(payload.media_type)) {
    errors.push("media_type must be 'series' or 'movie'");
  }
  if (typeof payload.tmdb_id !== 'number') {
    errors.push('tmdb_id must be a number');
  }
  return { valid: errors.length === 0, errors };
}

test('Supabase Schema & Payload Validation', async (t) => {
  await t.test('accepts valid series_entries payload', () => {
    const payload = {
      user_id: '47d7a8e2-04e8-4663-95c5-4ad9e1cb4bf9',
      media_type: 'series',
      tmdb_id: 1399,
      poster_path: '/got.jpg',
      title: 'Game of Thrones',
      collection: 'watching',
      watched_episodes: 10,
      total_episodes: 73,
      rating: 5,
      review: 'Classic show',
      last_watched: 1729000000000,
    };
    const res = validateSeriesPayload(payload);
    assert.ok(res.valid, `Errors: ${res.errors.join(', ')}`);
  });

  await t.test('rejects invalid rating outside 1..5', () => {
    const payload = {
      user_id: '47d7a8e2-04e8-4663-95c5-4ad9e1cb4bf9',
      media_type: 'series',
      title: 'Dark',
      collection: 'up_to_date',
      watched_episodes: 26,
      total_episodes: 26,
      rating: 6, // invalid!
    };
    const res = validateSeriesPayload(payload);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('rating')));
  });

  await t.test('rejects invalid collection status', () => {
    const payload = {
      user_id: '47d7a8e2-04e8-4663-95c5-4ad9e1cb4bf9',
      media_type: 'series',
      title: 'Dark',
      collection: 'archived', // invalid!
      watched_episodes: 0,
      total_episodes: 26,
    };
    const res = validateSeriesPayload(payload);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('collection')));
  });

  await t.test('accepts valid watchlist payload', () => {
    const payload = {
      user_id: '47d7a8e2-04e8-4663-95c5-4ad9e1cb4bf9',
      tmdb_id: 38757,
      media_type: 'movie',
      title: 'Tangled',
      poster_path: '/rapunzel.jpg',
      overview: 'When the kingdom\'s most wanted bandit...',
    };
    const res = validateWatchlistPayload(payload);
    assert.ok(res.valid, `Errors: ${res.errors.join(', ')}`);
  });

  await t.test('rejects watchlist missing tmdb_id', () => {
    const payload = {
      user_id: '47d7a8e2-04e8-4663-95c5-4ad9e1cb4bf9',
      media_type: 'movie',
      title: 'No ID Movie',
    };
    const res = validateWatchlistPayload(payload);
    assert.equal(res.valid, false);
    assert.ok(res.errors.some((e) => e.includes('tmdb_id')));
  });
});

