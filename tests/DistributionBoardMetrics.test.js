import test from 'node:test';
import assert from 'node:assert/strict';
import { getDistributionBoardMetrics } from '../resources/js/simulator/utils/distributionBoardMetrics.js';

test('distribution board reports underpowered load without overloading', () => {
    const metrics = getDistributionBoardMetrics({ ratedCapacity: 20 }, 12, 18);

    assert.equal(metrics.currentLoad, 12);
    assert.equal(metrics.unmetDemand, 6);
    assert.equal(metrics.remainingCapacity, 8);
    assert.equal(metrics.underpowered, true);
    assert.equal(metrics.overloaded, false);
    assert.equal(metrics.powerStatus, 'Underpowered');
});

test('distribution board caps load at rated capacity and flags overload', () => {
    const metrics = getDistributionBoardMetrics({ ratedCapacity: 20 }, 30, 25);

    assert.equal(metrics.currentLoad, 20);
    assert.equal(metrics.unmetDemand, 5);
    assert.equal(metrics.remainingCapacity, 0);
    assert.equal(metrics.underpowered, false);
    assert.equal(metrics.overloaded, true);
    assert.equal(metrics.powerStatus, 'Overloaded');
});
