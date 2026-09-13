import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../netlify/functions/neo4j-query';

test('legacy Neo4j endpoint returns explicit 410 without parsing requests or using network', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Network must not be used'); };
  try {
    for (const method of ['GET', 'POST', 'DELETE']) {
      const request = new Request('https://example.test/api/neo4j-query', {
        method, ...(method === 'GET' ? {} : { body: 'not JSON' }),
      });
      const response = await handler(request);
      assert.equal(response.status, 410);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal((await response.json()).code, 'NEO4J_DISABLED');
    }
  } finally { globalThis.fetch = originalFetch; }
});

test('legacy request data is neither echoed nor treated as a query', async () => {
  const marker = 'private-client-marker';
  const response = await handler(new Request('https://example.test/api/neo4j-query', {
    method: 'POST', body: JSON.stringify({ consulta: 'ping', senha: marker }),
  }));
  const text = await response.text();
  assert.equal(response.status, 410);
  assert.ok(!text.includes(marker));
  assert.ok(text.includes('arquivos JSON'));
});
