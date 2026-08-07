import test from 'node:test';
import assert from 'node:assert/strict';

import UIManager from '../resources/js/v2/ui/UIManager.js';

test('UIManager shows machines summary when DataLoader has machines', () => {
  // Setup a fake DOM root
  const root = { innerText: '' };
  global.document = { getElementById: (id) => (id === 'closed-loop-v2-ui' ? root : null) };

  const mockDataLoader = {
    getMachines: () => [ { id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' } ]
  };

  const ui = new UIManager({ statusProviders: { dataLoader: mockDataLoader } });
  ui.initialise();

  assert.ok(root.innerText.includes('Machines: 2'));
  assert.ok(root.innerText.includes('First: Alpha'));
});
