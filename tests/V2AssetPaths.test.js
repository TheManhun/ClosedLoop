import test from 'node:test';
import assert from 'node:assert/strict';

import { resourceImage, machineImage, scenarioImage, uiImage } from '../resources/js/v2/renderer/AssetPaths.js';

test('AssetPaths returns correct v2 paths and nulls', () => {
  assert.equal(resourceImage('trash.png'), '/images/resources/trash.png');
  assert.equal(machineImage('sewerage.png'), '/images/machines/sewerage.png');
  assert.equal(scenarioImage('dandenong_vic.png'), '/images/scenarios/dandenong_vic.png');
  assert.equal(uiImage('tools.png'), '/images/ui/tools.png');
  assert.equal(resourceImage(null), null);
  assert.equal(machineImage(''), null);
});
