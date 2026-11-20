import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import React, { createElement } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';

const IconRefresh = (props) => createElement('svg', props);

test('shared list loading preserves table columns and exposes accessible busy states', () => {
  const tableRowsSource = readFileSync('client/src/components/common/TableSkeletonRows.jsx', 'utf8');
  const tableRowsTransformed = transformSync(tableRowsSource, { loader: 'jsx', jsx: 'automatic' }).code;

  const fnTable = new Function('React', 'jsx', 'jsxs', `
    ${tableRowsTransformed.replace(/import\s+[^;]+;/g, '').replace(/export\s+default\s+/g, '').replace(/export\s+/g, '')}
    return { default: TableSkeletonRows, ListSkeleton };
  `);
  const { default: Rows, ListSkeleton } = fnTable(React, jsxRuntime.jsx, jsxRuntime.jsxs);

  const refreshBtnSource = readFileSync('client/src/components/common/RefreshButton.jsx', 'utf8');
  const refreshBtnTransformed = transformSync(refreshBtnSource, { loader: 'jsx', jsx: 'automatic' }).code;

  const fnRefresh = new Function('React', 'useRef', 'useState', 'jsx', 'jsxs', 'IconRefresh', `
    ${refreshBtnTransformed.replace(/import\s+[^;]+;/g, '').replace(/export\s+default\s+/g, '').replace(/export\s+/g, '')}
    return RefreshButton;
  `);
  const RefreshButton = fnRefresh(React, React.useRef, React.useState, jsxRuntime.jsx, jsxRuntime.jsxs, IconRefresh);

  for (const columns of [5, 6, 7]) {
    const markup = renderToStaticMarkup(createElement('table', null,
      createElement('tbody', null, createElement(Rows, { columns }))));
    assert.equal((markup.match(/<tr /g) || []).length, 5);
    assert.equal((markup.match(/<td /g) || []).length, 5 * columns);
    assert.match(markup, /motion-safe:animate-pulse/);
  }
  const loading = renderToStaticMarkup(createElement(ListSkeleton));
  assert.match(loading, /role="status"/);
  assert.match(loading, /aria-label="Memuat data"/);
  const busy = renderToStaticMarkup(createElement(RefreshButton, { refreshing: true }));
  assert.match(busy, /disabled=""/);
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /motion-safe:animate-spin/);
  assert.match(busy, /Segarkan Data/);
  const ready = renderToStaticMarkup(createElement(RefreshButton));
  assert.doesNotMatch(ready, /disabled=""/);
  assert.match(ready, /aria-busy="false"/);
});
