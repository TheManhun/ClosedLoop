export default function calculateAnnualFlow({ resource, machine, connectedAnnualResourceAvailability = 0, connectionExists = false }) {
    // resource: { stable_key, annual_available, defaultUnit }
    // machine: { stable_key, annual_capacity, capacity_unit, default_operating_level }
    const provenance = {
        annualAvailable: resource && resource.dataStatus ? resource.dataStatus : 'placeholder',
        annualCapacity: machine && machine.data_status ? machine.data_status : 'placeholder',
        operatingLevel: (machine && (machine.default_operating_level ?? machine.defaultOperatingLevel)) ? 'placeholder' : 'placeholder',
        annualProcessed: 'calculated',
        annualUnprocessed: 'calculated',
        unresolvedPercent: 'calculated',
        machineUtilisationPercent: 'calculated'
    };

    const annualAvailable = Number((resource && (resource.annual_available ?? resource.annualAvailable)) || connectedAnnualResourceAvailability || 0);
    const annualCapacity = Number((machine && (machine.annual_capacity ?? machine.annualCapacity)) || 0);
    const operatingLevel = Number((machine && (machine.default_operating_level ?? machine.defaultOperatingLevel)) ?? 0);

    // Safety: ensure numbers are finite
    const safeAnnualAvailable = Number.isFinite(annualAvailable) && annualAvailable > 0 ? annualAvailable : 0;
    const safeAnnualCapacity = Number.isFinite(annualCapacity) && annualCapacity > 0 ? annualCapacity : 0;
    const safeOperatingLevel = Number.isFinite(operatingLevel) && operatingLevel > 0 ? operatingLevel : 0;

    const effectiveAnnualCapacity = safeAnnualCapacity * safeOperatingLevel;

    let actualAnnualInput = 0;
    if (connectionExists) {
        actualAnnualInput = Math.min(safeAnnualAvailable, effectiveAnnualCapacity);
    } else {
        actualAnnualInput = 0;
    }

    const annualUnprocessed = Math.max(safeAnnualAvailable - actualAnnualInput, 0);
    const unresolvedPercent = safeAnnualAvailable > 0 ? (annualUnprocessed / safeAnnualAvailable) * 100 : 0;
    const machineUtilisationPercent = safeAnnualCapacity > 0 ? (actualAnnualInput / safeAnnualCapacity) * 100 : 0;

    return {
        resourceKey: resource && (resource.stable_key || resource.stableKey) || (resource && resource.key) || null,
        machineKey: machine && (machine.stable_key || machine.stableKey) || (machine && machine.key) || null,
        annualAvailable: safeAnnualAvailable,
        annualProcessed: actualAnnualInput,
        annualUnprocessed: annualUnprocessed,
        unresolvedPercent: Number.isFinite(unresolvedPercent) ? Number(unresolvedPercent) : 0,
        annualCapacity: safeAnnualCapacity,
        operatingLevel: safeOperatingLevel,
        effectiveAnnualCapacity: effectiveAnnualCapacity,
        machineUtilisationPercent: Number.isFinite(machineUtilisationPercent) ? Number(machineUtilisationPercent) : 0,
        unit: (resource && (resource.unit || resource.defaultUnit || resource.default_unit)) || (machine && (machine.capacity_unit || machine.capacityUnit)) || 't/year',
        provenance
    };
}
