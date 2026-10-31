const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { createApp } = require('../src/app');
const { currentWeekRange, storageObjectPath } = require('../src/routes/mentor');

test('health endpoint is public and mentor endpoints require a bearer token', async (context) => {
  const server = createApp().listen(0);
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const { port } = server.address();

  const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: 'ok' });

  const mentorResponse = await fetch(`http://127.0.0.1:${port}/api/mentor/dashboard`);
  assert.equal(mentorResponse.status, 401);
});

test('currentWeekRange returns Monday-to-Monday UTC boundaries', () => {
  const { start, end } = currentWeekRange(new Date('2026-10-25T18:30:00.000Z'));

  assert.equal(start, '2026-10-19T00:00:00.000Z');
  assert.equal(end, '2026-10-26T00:00:00.000Z');
});

test('storageObjectPath accepts a stored object path', () => {
  assert.equal(storageObjectPath('incube-1/livrable.pdf', 'deliverables'), 'incube-1/livrable.pdf');
});

test('storageObjectPath extracts a path from a Supabase public URL', () => {
  assert.equal(
    storageObjectPath(
      'https://project.supabase.co/storage/v1/object/public/deliverables/mon%20fichier.pdf',
      'deliverables',
      'https://project.supabase.co',
    ),
    'mon fichier.pdf',
  );
});

test('storageObjectPath rejects URLs outside the configured Supabase project', () => {
  assert.throws(
    () => storageObjectPath(
      'https://example.com/storage/v1/object/public/deliverables/file.pdf',
      'deliverables',
      'https://project.supabase.co',
    ),
    (error) => error.status === 400,
  );
});

test('storageObjectPath rejects objects in another bucket', () => {
  assert.throws(
    () => storageObjectPath(
      'https://project.supabase.co/storage/v1/object/public/private/file.pdf',
      'deliverables',
      'https://project.supabase.co',
    ),
    (error) => error.status === 400,
  );
});
