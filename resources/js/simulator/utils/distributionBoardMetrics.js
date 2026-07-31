export function getDistributionBoardMetrics(record, incomingAvailablePower = 0, connectedDemand = 0) {
    const ratedCapacity = Number.isFinite(Number(record?.ratedCapacity)) ? Number(record.ratedCapacity) : 20;
    const incomingPower = Number.isFinite(Number(incomingAvailablePower)) ? Number(incomingAvailablePower) : 0;
    const demand = Number.isFinite(Number(connectedDemand)) ? Number(connectedDemand) : 0;

    const currentLoad = Math.min(demand, incomingPower, ratedCapacity);
    const unmetDemand = Math.max(0, demand - currentLoad);
    const remainingCapacity = Math.max(0, ratedCapacity - currentLoad);
    const overloaded = demand > ratedCapacity;
    const underpowered = demand > incomingPower;
    const powerStatus = overloaded ? 'Overloaded' : (underpowered ? 'Underpowered' : (currentLoad > 0 ? 'Active' : 'Offline'));
    const status = overloaded ? 'fault' : (underpowered ? 'warning' : (currentLoad > 0 ? 'working' : 'neutral'));

    return {
        ratedCapacity,
        incomingAvailablePower: incomingPower,
        connectedDemand: demand,
        currentLoad,
        unmetDemand,
        remainingCapacity,
        overloaded,
        underpowered,
        powerStatus,
        status,
    };
}
