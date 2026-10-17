import assert from 'node:assert/strict';
import test from 'node:test';

// Calculation helper logic replicating App.tsx behavior
function computeProgress(series, personal = {}) {
  const watched = personal[series.title]?.watchedEpisodes ?? series.watchedEpisodes ?? 0;
  const total = series.totalEpisodes || 0;
  const percentage = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;
  const remaining = Math.max(0, total - watched);
  return { watched, total, percentage, remaining };
}

function determineCollection(watched, total) {
  if (total > 0 && watched >= total) {
    return 'up_to_date';
  }
  if (watched > 0) {
    return 'watching';
  }
  return 'watching';
}

function toggleEpisode(watchedList, episodeKey) {
  const set = new Set(watchedList);
  if (set.has(episodeKey)) {
    set.delete(episodeKey);
  } else {
    set.add(episodeKey);
  }
  return Array.from(set);
}

test('Series Calculations & Progress Logic', async (t) => {
  await t.test('calculates percentage correctly for in-progress show', () => {
    const series = { title: 'Succession', totalEpisodes: 39, watchedEpisodes: 13 };
    const res = computeProgress(series);
    assert.equal(res.percentage, 33);
    assert.equal(res.remaining, 26);
    assert.equal(res.watched, 13);
  });

  await t.test('caps percentage at 100% when watched exceeds total', () => {
    const series = { title: 'Arcane', totalEpisodes: 9, watchedEpisodes: 10 };
    const res = computeProgress(series);
    assert.equal(res.percentage, 100);
    assert.equal(res.remaining, 0);
  });

  await t.test('handles 0 total episodes gracefully without divide by zero', () => {
    const series = { title: 'Upcoming Show', totalEpisodes: 0, watchedEpisodes: 0 };
    const res = computeProgress(series);
    assert.equal(res.percentage, 0);
    assert.equal(res.remaining, 0);
  });

  await t.test('prioritizes personal data over base series entry', () => {
    const series = { title: 'Shogun', totalEpisodes: 10, watchedEpisodes: 2 };
    const personal = { Shogun: { watchedEpisodes: 8 } };
    const res = computeProgress(series, personal);
    assert.equal(res.watched, 8);
    assert.equal(res.percentage, 80);
    assert.equal(res.remaining, 2);
  });

  await t.test('categorizes completed show as up_to_date', () => {
    assert.equal(determineCollection(10, 10), 'up_to_date');
    assert.equal(determineCollection(12, 10), 'up_to_date');
  });

  await t.test('categorizes partially watched show as watching', () => {
    assert.equal(determineCollection(3, 10), 'watching');
  });

  await t.test('toggles episode key in watched list correctly', () => {
    let list = ['S1E1'];
    list = toggleEpisode(list, 'S1E2');
    assert.deepEqual(list.sort(), ['S1E1', 'S1E2']);

    // Toggling existing episode unmarks it
    list = toggleEpisode(list, 'S1E1');
    assert.deepEqual(list, ['S1E2']);
  });
});

