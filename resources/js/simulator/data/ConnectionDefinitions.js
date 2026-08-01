export default {
    power: {
        key: 'power',
        label: 'Power Cable',
        resourceCategories: ['electricity'],
        bidirectional: true,
        renderer: 'power',
        enabled: true
    },
    conveyor: {
        key: 'conveyor',
        label: 'Conveyor Belt',
        resourceCategories: ['solid'],
        bidirectional: false,
        renderer: 'conveyor',
        enabled: false,
        comingSoon: true
    },
    water: {
        key: 'water',
        label: 'Water Pipe',
        resourceCategories: ['water', 'wastewater'],
        bidirectional: false,
        renderer: 'water',
        enabled: true,
        comingSoon: false
    },
    gas: {
        key: 'gas',
        label: 'Gas Pipe',
        resourceCategories: ['gas'],
        bidirectional: false,
        renderer: 'gas',
        enabled: true,
        comingSoon: false
    }
};
