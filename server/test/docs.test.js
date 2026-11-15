import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { openapiSpecification } from '../src/config/swagger.js';

function fakePrisma() {
  return {
    state: {},
    $transaction: async () => [],
  };
}

async function withServer(run) {
  const server = createApp({ prisma: fakePrisma() }).listen(0, '127.0.0.1');
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    await run(base);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test('docs: openapi.json mengembalikan spesifikasi OpenAPI 3.x valid dan 34 operasi', async () => {
  assert.equal(openapiSpecification.openapi, '3.0.3');
  assert.equal(openapiSpecification.info.title, 'SIPKITA REST API');

  const paths = openapiSpecification.paths;
  assert.ok(paths, 'paths harus terdefinisi');

  // Hitung total method operasi yang terdokumentasi
  const operations = [];
  for (const [pathKey, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (['get', 'post', 'patch', 'delete', 'put'].includes(method)) {
        operations.push(`${method.toUpperCase()} ${pathKey}`);
        assert.ok(operation.summary, `Operasi ${method.toUpperCase()} ${pathKey} harus memiliki summary`);
        assert.ok(operation.tags?.length, `Operasi ${method.toUpperCase()} ${pathKey} harus memiliki tags`);
        assert.ok(operation.responses, `Operasi ${method.toUpperCase()} ${pathKey} harus memiliki responses`);
      }
    }
  }

  assert.equal(operations.length, 34, `Harus ada tepat 34 operasi terdokumentasi, ditemukan ${operations.length}`);

  await withServer(async (base) => {
    // 1. Uji /openapi.json
    const resOpenApi = await fetch(`${base}/openapi.json`);
    assert.equal(resOpenApi.status, 200);
    assert.match(resOpenApi.headers.get('content-type'), /application\/json/);
    const bodyOpenApi = await resOpenApi.json();
    assert.equal(bodyOpenApi.openapi, '3.0.3');
    assert.equal(Object.keys(bodyOpenApi.paths).length, 28);

    // 2. Uji /api/openapi.json
    const resApiOpenApi = await fetch(`${base}/api/openapi.json`);
    assert.equal(resApiOpenApi.status, 200);

    // 3. Uji /docs (Scalar API Reference UI)
    const resDocs = await fetch(`${base}/docs`);
    assert.equal(resDocs.status, 200);
    assert.match(resDocs.headers.get('content-type'), /text\/html/);
    const html = await resDocs.text();
    assert.ok(html.includes('scalar') || html.includes('api-reference'), 'Halaman /docs harus memuat referensi Scalar');

    // 4. Uji /api/docs
    const resApiDocs = await fetch(`${base}/api/docs`);
    assert.equal(resApiDocs.status, 200);
  });
});

