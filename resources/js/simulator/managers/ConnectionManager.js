export default class ConnectionManager {
    constructor(scene, buildingManager) {
        this.scene = scene;
        this.buildingManager = buildingManager;
        this._connections = new Map(); // id -> record
        this._nextId = 1;
    }

    _setLayerDepth(renderer, type) {
        if (!renderer) return;
        const layerDepth = {
            power: 100,
            conveyor: 90,
            water: 80,
            gas: 70,
            steam: 60,
            default: 50
        };
        const depth = layerDepth[type] || layerDepth.default;
        if (renderer.container) {
            renderer.container.setDepth(depth);
        }
        if (renderer.graphics) {
            renderer.graphics.setDepth(depth);
        }
        if (renderer.flowIndicator) {
            try {
                if (renderer.flowIndicator.container) renderer.flowIndicator.container.setDepth(1100);
                if (renderer.flowIndicator.graphics) renderer.flowIndicator.graphics.setDepth(1100);
            } catch (e) {}
        }
        if (renderer.gasIndicator) {
            try {
                if (renderer.gasIndicator.container) renderer.gasIndicator.container.setDepth(1100);
                if (renderer.gasIndicator.graphics) renderer.gasIndicator.graphics.setDepth(1100);
            } catch (e) {}
        }
        if (Array.isArray(renderer.bolts)) {
            renderer.bolts.forEach((bolt) => {
                try { bolt.setDepth(1100); } catch (e) {}
            });
        }
    }

    _getConnectionDepth(connectionType) {
        const type = String(connectionType || '').toLowerCase();
        if (type === 'power') return 100;
        if (type === 'conveyor') return 90;
        if (type === 'water') return 80;
        if (type === 'gas') return 70;
        if (type === 'steam') return 60;
        return 50;
    }

    _getConnectionEndpoint(record) {
        if (!record) return null;
        return this.scene._getRecordCenter(record);
    }

    _createSceneContainer() {
        const add = this.scene && this.scene.add;
        if (!add) return null;
        if (typeof add.container === 'function') return add.container();
        if (typeof add === 'function') return add();
        return null;
    }

    _createSceneGraphics() {
        const add = this.scene && this.scene.add;
        if (!add) return null;
        if (typeof add.graphics === 'function') return add.graphics();
        if (typeof add === 'function') return add();
        return null;
    }

    _getLineStyle(connectionType) {
        const type = String(connectionType || '').toLowerCase();
        if (type === 'water') return { width: 5, color: 0x3b82f6, alpha: 1 };
        if (type === 'gas') return { width: 4, color: 0x14b8a6, alpha: 1 };
        if (type === 'conveyor') return { width: 4, color: 0x4b5563, alpha: 1 };
        return { width: 4, color: 0x111111, alpha: 1 };
    }

    _getFlowIndicatorSpeed(connectionType) {
        const type = String(connectionType || '').toLowerCase();
        if (type === 'water') return 0.18;
        return 0.12;
    }

    _getFlowIndicatorMetadata(connection) {
        const base = {
            resourceKey: null,
            resourceName: null,
            flowRate: null,
            flowUnit: null,
            temperature: null,
            pressure: null,
            quality: null,
            state: 'normal'
        };

        if (!connection) return base;

        const metadata = {
            ...base,
            resourceKey: connection.resourceKey ?? null,
            resourceName: connection.resourceName ?? null,
            flowRate: connection.flowRate ?? null,
            flowUnit: connection.flowUnit ?? null,
            temperature: connection.temperature ?? connection.temperatureC ?? null,
            pressure: connection.pressure ?? connection.pressureBar ?? null,
            quality: connection.quality ?? null,
            state: connection.state ?? 'normal'
        };

        if (metadata.state == null || metadata.state === '') metadata.state = 'normal';
        return metadata;
    }

    _getFlowIndicatorItemCount(connection) {
        const type = String(connection && connection.type ? connection.type : '').toLowerCase();
        if (type === 'conveyor') return 3;
        return 1;
    }

    _getConnectionResourceIcon(connection) {
        const candidates = [
            connection && connection.resourceIcon,
            connection && connection.metadata && connection.metadata.resourceIcon,
            connection && connection.icon,
            connection && connection.resourceKey,
            connection && connection.resourceName
        ];

        const icon = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
        if (icon) return String(icon).toLowerCase();

        const type = String(connection && connection.type ? connection.type : '').toLowerCase();
        return type === 'conveyor' ? 'crate' : null;
    }

    _getConveyorItemStyle(connection) {
        if (!connection) return { size: 8, color: 0x6b7280, shape: 'crate' };

        const metadata = this._getFlowIndicatorMetadata(connection);
        const identity = [metadata.resourceKey, metadata.resourceName, metadata.resourceIcon].find((value) => typeof value === 'string' && value.trim().length > 0);
        const text = identity ? String(identity).toLowerCase() : '';

        if (/plastic|pellet|flake/.test(text)) {
            return { size: 5, color: 0x60a5fa, shape: 'pellet' };
        }

        if (/tyre|tire|rubber/.test(text)) {
            return { size: 6, color: 0x111827, shape: 'ring' };
        }

        if (/glass|pane|bottle/.test(text)) {
            return { size: 6, color: 0xcbd5e1, shape: 'diamond' };
        }

        if (/battery|cell|powercell/.test(text)) {
            return { size: 6, color: 0x1f2937, shape: 'battery' };
        }

        if (/municipal|waste|garbage|trash/.test(text)) {
            return { size: 7, color: 0x4b5563, shape: 'bundle' };
        }

        if (/farm|biomass|organic|feed|compost/.test(text)) {
            return { size: 7, color: 0x6b8f3d, shape: 'bundle' };
        }

        return { size: 8, color: 0x6b7280, shape: 'crate' };
    }

    _getFlowIndicatorStyle(connection) {
        if (!connection) return null;

        const metadata = this._getFlowIndicatorMetadata(connection);
        const identity = [metadata.resourceKey, metadata.resourceName].find((value) => typeof value === 'string' && value.trim().length > 0);
        const text = identity ? String(identity).toLowerCase() : '';

        if (/wastewater|sewer|sewage|effluent|greywater/.test(text)) {
            return { size: 9, color: 0x7c2d12, shape: 'droplet' };
        }

        if (/treated|recycled|purified/.test(text)) {
            return { size: 9, color: 0x7dd3fc, shape: 'droplet' };
        }

        const type = String(connection.type || '').toLowerCase();
        const state = String(metadata.state || 'normal').toLowerCase();
        let color = 0x3b82f6;

        if (type === 'water') {
            if (state === 'idle') color = 0x64748b;
            else if (state === 'restricted') color = 0x92400e;
            else if (state === 'blocked') color = 0x7f1d1d;
            else if (state === 'fault') color = 0xdc2626;
            else color = 0x3b82f6;
            return { size: 9, color, shape: 'droplet' };
        }

        if (type === 'gas') {
            return { size: 9, color: 0xfacc15, shape: 'bubble-cluster' };
        }

        if (type === 'conveyor') {
            return this._getConveyorItemStyle(connection);
        }

        return { size: 9, color, shape: 'droplet' };
    }

    _destroyFlowIndicator(renderer) {
        if (!renderer || !renderer.flowIndicator) return;
        try {
            if (renderer.flowIndicator.items && renderer.flowIndicator.items.length) {
                renderer.flowIndicator.items.forEach((item) => {
                    try {
                        if (item && item.container) item.container.destroy();
                        if (item && item.graphics && item.graphics !== item.container) item.graphics.destroy();
                    } catch (e) {}
                });
            }
            if (renderer.flowIndicator.container) {
                renderer.flowIndicator.container.destroy();
            }
            if (renderer.flowIndicator.graphics && renderer.flowIndicator.graphics !== renderer.flowIndicator.container) {
                renderer.flowIndicator.graphics.destroy();
            }
        } catch (e) {}
        renderer.flowIndicator = null;
    }

    createFlowIndicator(connection) {
        const renderer = connection && connection._renderer;
        if (!renderer) return null;

        if (renderer.flowIndicator && renderer.flowIndicator.items && renderer.flowIndicator.items.length) {
            if (!Number.isFinite(connection.flowProgress)) {
                connection.flowProgress = 0;
            }
            return renderer.flowIndicator;
        }

        const style = this._getFlowIndicatorStyle(connection);
        if (!style) return null;

        const items = [];
        const itemCount = this._getFlowIndicatorItemCount(connection);

        for (let index = 0; index < itemCount; index += 1) {
            const container = this._createSceneContainer();
            if (!container) return null;
            container.setDepth(1100);
            container.setScrollFactor(1);
            container.disableInteractive && container.disableInteractive();
            if (container.input) container.input.enabled = false;

            const graphics = this._createSceneGraphics();
            if (!graphics) return null;
            graphics.setDepth(1100);
            graphics.setScrollFactor(1);
            graphics.disableInteractive && graphics.disableInteractive();
            if (graphics.input) graphics.input.enabled = false;
            container.add(graphics);

            items.push({
                container,
                graphics,
                size: style.size,
                color: style.color,
                resourceIcon: this._getConnectionResourceIcon(connection),
                tween: null,
                lastStart: null,
                lastEnd: null,
                anchorX: 0,
                anchorY: 0
            });
        }

        const flowIndicator = {
            items,
            container: items[0] ? items[0].container : null,
            graphics: items[0] ? items[0].graphics : null,
            metadata: this._getFlowIndicatorMetadata(connection),
            rendererKey: String(connection.type || '').toLowerCase() || 'generic',
            setPosition(x, y) {
                items.forEach((item) => {
                    try {
                        if (item && item.container) item.container.setPosition(x, y);
                    } catch (e) {}
                });
            }
        };

        renderer.flowIndicator = flowIndicator;
        connection.flowMetadata = flowIndicator.metadata;
        flowIndicator.items.forEach((entry) => {
            if (entry) {
                entry.resourceStyle = style;
            }
        });
        if (!Number.isFinite(connection.flowProgress)) {
            connection.flowProgress = 0;
        }
        return flowIndicator;
    }

    _createGasIndicator(connection) {
        const renderer = connection && connection._renderer;
        if (!renderer) return null;
        if (renderer.gasIndicator && renderer.gasIndicator.container) return renderer.gasIndicator;

        const container = this._createSceneContainer();
        if (!container) return null;
        container.setDepth(1100);
        container.setScrollFactor(1);
        container.disableInteractive && container.disableInteractive();
        if (container.input) container.input.enabled = false;

        const graphics = this._createSceneGraphics();
        if (!graphics) return null;
        graphics.setDepth(1100);
        graphics.setScrollFactor(1);
        graphics.disableInteractive && graphics.disableInteractive();
        if (graphics.input) graphics.input.enabled = false;
        container.add(graphics);

        const indicator = { container, graphics, tween: null, lastStart: null, lastEnd: null, anchorX: 0, anchorY: 0 };
        renderer.gasIndicator = indicator;
        return indicator;
    }

    _startGasIndicatorTween(connection, indicator, start, end) {
        if (!indicator || !start || !end) return;
        try {
            if (indicator.tween) {
                try { indicator.tween.stop(); } catch (e) {}
            }
            const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
            const duration = Math.max(900, distance * 2.2);
            indicator.lastStart = start;
            indicator.lastEnd = end;
            indicator.anchorX = start.x;
            indicator.anchorY = start.y;
            indicator.container.setVisible(true);
            indicator.container.setPosition(start.x, start.y);
            indicator.tween = this.scene.tweens.add({
                targets: indicator.container,
                x: { from: start.x, to: end.x },
                y: { from: start.y, to: end.y },
                duration,
                ease: 'Linear',
                repeat: -1,
                onUpdate: () => {
                    try {
                        const from = this.buildingManager.getMachine(connection.sourceBuildingId);
                        const to = this.buildingManager.getMachine(connection.targetBuildingId);
                        if (!from || !to) return;
                        const liveStart = this._getConnectionEndpoint(from) || this.scene._getRecordCenter(from);
                        const liveEnd = this._getConnectionEndpoint(to) || this.scene._getRecordCenter(to);
                        if (!liveStart || !liveEnd) return;
                        const dx = liveEnd.x - liveStart.x;
                        const dy = liveEnd.y - liveStart.y;
                        const currentX = indicator.container.x;
                        const currentY = indicator.container.y;
                        const progress = Math.max(0, Math.min(1, Math.hypot(currentX - liveStart.x, currentY - liveStart.y) / Math.max(1, Math.hypot(dx, dy))));
                        const clampedX = liveStart.x + dx * progress;
                        const clampedY = liveStart.y + dy * progress;
                        indicator.container.setPosition(clampedX, clampedY);
                        indicator.anchorX = clampedX;
                        indicator.anchorY = clampedY;
                    } catch (e) {}
                },
                onRepeat: () => {
                    try {
                        const from = this.buildingManager.getMachine(connection.sourceBuildingId);
                        const to = this.buildingManager.getMachine(connection.targetBuildingId);
                        if (!from || !to) return;
                        const liveStart = this._getConnectionEndpoint(from) || this.scene._getRecordCenter(from);
                        const liveEnd = this._getConnectionEndpoint(to) || this.scene._getRecordCenter(to);
                        if (!liveStart || !liveEnd) return;
                        indicator.container.setPosition(liveStart.x, liveStart.y);
                        indicator.tween.stop();
                        indicator.tween = this.scene.tweens.add({
                            targets: indicator.container,
                            x: { from: liveStart.x, to: liveEnd.x },
                            y: { from: liveStart.y, to: liveEnd.y },
                            duration: Math.max(900, Math.hypot(liveEnd.x - liveStart.x, liveEnd.y - liveStart.y) * 2.2),
                            ease: 'Linear',
                            repeat: -1,
                            onUpdate: () => {
                                try {
                                    const current = this.buildingManager.getMachine(connection.sourceBuildingId);
                                    const target = this.buildingManager.getMachine(connection.targetBuildingId);
                                    if (!current || !target) return;
                                    const liveStart2 = this._getConnectionEndpoint(current) || this.scene._getRecordCenter(current);
                                    const liveEnd2 = this._getConnectionEndpoint(target) || this.scene._getRecordCenter(target);
                                    if (!liveStart2 || !liveEnd2) return;
                                    const dx2 = liveEnd2.x - liveStart2.x;
                                    const dy2 = liveEnd2.y - liveStart2.y;
                                    const currentX2 = indicator.container.x;
                                    const currentY2 = indicator.container.y;
                                    const progress2 = Math.max(0, Math.min(1, Math.hypot(currentX2 - liveStart2.x, currentY2 - liveStart2.y) / Math.max(1, Math.hypot(dx2, dy2))));
                                    const clampedX2 = liveStart2.x + dx2 * progress2;
                                    const clampedY2 = liveStart2.y + dy2 * progress2;
                                    indicator.container.setPosition(clampedX2, clampedY2);
                                    indicator.anchorX = clampedX2;
                                    indicator.anchorY = clampedY2;
                                } catch (e) {}
                            }
                        });
                    } catch (e) {}
                }
            });
        } catch (e) {}
    }

    _updateGasIndicator(connection, start, end) {
        const renderer = connection && connection._renderer;
        const indicator = renderer && renderer.gasIndicator;
        if (!indicator || !start || !end) return;

        const previousStart = indicator.lastStart || null;
        const previousEnd = indicator.lastEnd || null;
        const startChanged = !previousStart || Math.abs((start.x || 0) - (previousStart.x || 0)) > 0.001 || Math.abs((start.y || 0) - (previousStart.y || 0)) > 0.001;
        const endChanged = !previousEnd || Math.abs((end.x || 0) - (previousEnd.x || 0)) > 0.001 || Math.abs((end.y || 0) - (previousEnd.y || 0)) > 0.001;

        if (!indicator.tween || !indicator.tween.isPlaying() || startChanged || endChanged) {
            this._startGasIndicatorTween(connection, indicator, start, end);
        }

        indicator.container.setVisible(true);
        indicator.graphics.setVisible(true);
        indicator.graphics.clear();
        indicator.graphics.lineStyle(1, 0x92400e, 0.85);
        indicator.graphics.fillStyle(0xfef3c7, 0.95);
        indicator.graphics.beginPath();
        indicator.graphics.fillCircle(0, 0, 7);
        indicator.graphics.closePath();
        indicator.graphics.fillPath();
        indicator.graphics.fillStyle(0xfcd34d, 0.9);
        indicator.graphics.beginPath();
        indicator.graphics.fillCircle(-4, -2, 3.2);
        indicator.graphics.fillCircle(3, -1, 2.4);
        indicator.graphics.fillCircle(1, 3, 2.8);
        indicator.graphics.closePath();
        indicator.graphics.fillPath();
    }

    _destroyGasIndicator(renderer) {
        if (!renderer || !renderer.gasIndicator) return;
        try {
            const indicator = renderer.gasIndicator;
            if (indicator && indicator.tween) {
                try { indicator.tween.stop(); } catch (e) {}
            }
            if (indicator && indicator.container) indicator.container.destroy();
            if (indicator && indicator.graphics && indicator.graphics !== indicator.container) indicator.graphics.destroy();
        } catch (e) {}
        renderer.gasIndicator = null;
    }

    _startWaterIndicatorTween(connection, item, start, end) {
        if (!item || !start || !end) return;
        try {
            if (item.tween) {
                try { item.tween.stop(); } catch (e) {}
            }
            const distance = Math.hypot(end.x - start.x, end.y - start.y) || 1;
            const duration = Math.max(800, distance * 2.4);
            item.lastStart = start;
            item.lastEnd = end;
            item.anchorX = start.x;
            item.anchorY = start.y;
            item.container.setVisible(true);
            item.container.setPosition(start.x, start.y);
            item.tween = this.scene.tweens.add({
                targets: item.container,
                x: { from: start.x, to: end.x },
                y: { from: start.y, to: end.y },
                duration,
                ease: 'Linear',
                repeat: -1,
                onUpdate: () => {
                    try {
                        const from = this.buildingManager.getMachine(connection.sourceBuildingId);
                        const to = this.buildingManager.getMachine(connection.targetBuildingId);
                        if (!from || !to) return;
                        const liveStart = this._getConnectionEndpoint(from) || this.scene._getRecordCenter(from);
                        const liveEnd = this._getConnectionEndpoint(to) || this.scene._getRecordCenter(to);
                        if (!liveStart || !liveEnd) return;
                        const dx = liveEnd.x - liveStart.x;
                        const dy = liveEnd.y - liveStart.y;
                        const currentX = item.container.x;
                        const currentY = item.container.y;
                        const progress = Math.max(0, Math.min(1, Math.hypot(currentX - liveStart.x, currentY - liveStart.y) / Math.max(1, Math.hypot(dx, dy))));
                        const clampedX = liveStart.x + dx * progress;
                        const clampedY = liveStart.y + dy * progress;
                        item.container.setPosition(clampedX, clampedY);
                        item.anchorX = clampedX;
                        item.anchorY = clampedY;
                    } catch (e) {}
                },
                onRepeat: () => {
                    try {
                        const from = this.buildingManager.getMachine(connection.sourceBuildingId);
                        const to = this.buildingManager.getMachine(connection.targetBuildingId);
                        if (!from || !to) return;
                        const liveStart = this._getConnectionEndpoint(from) || this.scene._getRecordCenter(from);
                        const liveEnd = this._getConnectionEndpoint(to) || this.scene._getRecordCenter(to);
                        if (!liveStart || !liveEnd) return;
                        item.container.setPosition(liveStart.x, liveStart.y);
                        item.tween.stop();
                        item.tween = this.scene.tweens.add({
                            targets: item.container,
                            x: { from: liveStart.x, to: liveEnd.x },
                            y: { from: liveStart.y, to: liveEnd.y },
                            duration: Math.max(800, Math.hypot(liveEnd.x - liveStart.x, liveEnd.y - liveStart.y) * 2.4),
                            ease: 'Linear',
                            repeat: -1,
                            onUpdate: () => {
                                try {
                                    const current = this.buildingManager.getMachine(connection.sourceBuildingId);
                                    const target = this.buildingManager.getMachine(connection.targetBuildingId);
                                    if (!current || !target) return;
                                    const liveStart2 = this._getConnectionEndpoint(current) || this.scene._getRecordCenter(current);
                                    const liveEnd2 = this._getConnectionEndpoint(target) || this.scene._getRecordCenter(target);
                                    if (!liveStart2 || !liveEnd2) return;
                                    const dx2 = liveEnd2.x - liveStart2.x;
                                    const dy2 = liveEnd2.y - liveStart2.y;
                                    const currentX2 = item.container.x;
                                    const currentY2 = item.container.y;
                                    const progress2 = Math.max(0, Math.min(1, Math.hypot(currentX2 - liveStart2.x, currentY2 - liveStart2.y) / Math.max(1, Math.hypot(dx2, dy2))));
                                    const clampedX2 = liveStart2.x + dx2 * progress2;
                                    const clampedY2 = liveStart2.y + dy2 * progress2;
                                    item.container.setPosition(clampedX2, clampedY2);
                                    item.anchorX = clampedX2;
                                    item.anchorY = clampedY2;
                                } catch (e) {}
                            }
                        });
                    } catch (e) {}
                }
            });
        } catch (e) {}
    }

    updateFlowIndicator(connection, delta) {
        const renderer = connection && connection._renderer;
        const indicator = renderer && renderer.flowIndicator;
        const item = indicator && indicator.items && indicator.items[0] ? indicator.items[0] : null;
        if (!item) return;

        const indicatorType = String(connection.type || '').toLowerCase();
        if (indicatorType !== 'water' && indicatorType !== 'gas' && indicatorType !== 'conveyor') return;

        if (!Number.isFinite(connection.flowProgress)) {
            connection.flowProgress = 0;
        }

        const deltaSeconds = Number(delta) / 1000;
        const safeDelta = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
        connection.flowProgress = (connection.flowProgress + this._getFlowIndicatorSpeed(connection.type) * safeDelta) % 1;
        if (connection.flowProgress < 0) connection.flowProgress = 0;

        const from = this.buildingManager.getMachine(connection.sourceBuildingId);
        const to = this.buildingManager.getMachine(connection.targetBuildingId);
        if (!from || !to) return;

        const start = this._getConnectionEndpoint(from) || this.scene._getRecordCenter(from);
        const end = this._getConnectionEndpoint(to) || this.scene._getRecordCenter(to);
        if (!start || !end) return;

        const previousStart = item.lastStart || null;
        const previousEnd = item.lastEnd || null;
        const startChanged = !previousStart || Math.abs((start.x || 0) - (previousStart.x || 0)) > 0.001 || Math.abs((start.y || 0) - (previousStart.y || 0)) > 0.001;
        const endChanged = !previousEnd || Math.abs((end.x || 0) - (previousEnd.x || 0)) > 0.001 || Math.abs((end.y || 0) - (previousEnd.y || 0)) > 0.001;

        if (indicatorType === 'water') {
            if (!item.tween || !item.tween.isPlaying() || startChanged || endChanged) {
                this._startWaterIndicatorTween(connection, item, start, end);
            }
            this._renderFlowIndicator(connection, start, end);
            return;
        }

        if (indicatorType === 'gas') {
            this._updateGasIndicator(connection, start, end);
            return;
        }

        this._renderFlowIndicator(connection, start, end);
    }

    _renderFlowIndicator(connection, start, end) {
        const renderer = connection && connection._renderer;
        const indicator = renderer && renderer.flowIndicator;
        const item = indicator && indicator.items && indicator.items[0] ? indicator.items[0] : null;
        if (!item || !start || !end) return;

        const style = this._getFlowIndicatorStyle(connection);
        if (!style) {
            indicator.items.forEach((entry) => {
                if (entry && entry.container) entry.container.setVisible(false);
            });
            return;
        }

        indicator.metadata = this._getFlowIndicatorMetadata(connection);
        connection.flowMetadata = indicator.metadata;
        indicator.items.forEach((entry) => {
            if (entry) {
                entry.resourceStyle = style;
            }
        });

        const indicatorType = String(connection.type || '').toLowerCase();
        const progress = Number.isFinite(connection.flowProgress) ? connection.flowProgress : 0;
        const baseX = start.x;
        const baseY = start.y;
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const count = Math.max(1, indicator.items.length);

        indicator.items.forEach((entry, index) => {
            if (!entry || !entry.container) return;
            const offset = count === 1 ? 0 : index / count;
            const itemProgress = (progress + offset) % 1;
            const x = baseX + dx * itemProgress;
            const y = baseY + dy * itemProgress;
            entry.container.setVisible(true);
            entry.container.setPosition(x, y);

            if (entry.graphics) {
                entry.graphics.setVisible(true);
            }
            if (entry.graphics) {
                entry.graphics.clear();
                entry.graphics.lineStyle(0);
                entry.graphics.fillStyle(style.color, 1);
                if (indicatorType === 'conveyor') {
                    const size = style.size || 8;
                    const shape = style.shape || 'crate';
                    if (shape === 'pellet') {
                        entry.graphics.beginPath();
                        entry.graphics.fillCircle(0, 0, size * 0.42);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                        entry.graphics.fillStyle(0xdbeafe, 0.9);
                        entry.graphics.beginPath();
                        entry.graphics.fillCircle(-size * 0.12, -size * 0.08, size * 0.14);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                    } else if (shape === 'ring') {
                        entry.graphics.lineStyle(1.2, 0x111827, 0.95);
                        entry.graphics.beginPath();
                        entry.graphics.fillCircle(0, 0, size * 0.42);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                        entry.graphics.lineStyle(1.2, 0x111827, 0.95);
                        entry.graphics.beginPath();
                        entry.graphics.strokeCircle(0, 0, size * 0.42);
                        entry.graphics.closePath();
                        entry.graphics.strokePath();
                    } else if (shape === 'diamond') {
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(0, -size * 0.46);
                        entry.graphics.lineTo(size * 0.36, 0);
                        entry.graphics.lineTo(0, size * 0.46);
                        entry.graphics.lineTo(-size * 0.36, 0);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                    } else if (shape === 'battery') {
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(-size * 0.34, -size * 0.24);
                        entry.graphics.lineTo(size * 0.34, -size * 0.24);
                        entry.graphics.lineTo(size * 0.34, size * 0.24);
                        entry.graphics.lineTo(-size * 0.34, size * 0.24);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                        entry.graphics.fillStyle(0x9ca3af, 0.8);
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(-size * 0.18, -size * 0.16);
                        entry.graphics.lineTo(size * 0.18, -size * 0.16);
                        entry.graphics.lineTo(size * 0.18, size * 0.16);
                        entry.graphics.lineTo(-size * 0.18, size * 0.16);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                    } else if (shape === 'bundle') {
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(-size * 0.28, -size * 0.2);
                        entry.graphics.lineTo(size * 0.12, -size * 0.3);
                        entry.graphics.lineTo(size * 0.32, -size * 0.06);
                        entry.graphics.lineTo(size * 0.08, size * 0.3);
                        entry.graphics.lineTo(-size * 0.32, size * 0.21);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                        entry.graphics.fillStyle(0x111827, 0.4);
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(-size * 0.2, -size * 0.06);
                        entry.graphics.lineTo(size * 0.02, -size * 0.14);
                        entry.graphics.lineTo(size * 0.18, size * 0.02);
                        entry.graphics.lineTo(0, size * 0.12);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                    } else {
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(-size * 0.45, -size * 0.3);
                        entry.graphics.lineTo(size * 0.45, -size * 0.3);
                        entry.graphics.lineTo(size * 0.45, size * 0.2);
                        entry.graphics.lineTo(size * 0.2, size * 0.4);
                        entry.graphics.lineTo(-size * 0.2, size * 0.4);
                        entry.graphics.lineTo(-size * 0.45, size * 0.2);
                        entry.graphics.closePath();
                        entry.graphics.fillPath();
                        entry.graphics.lineStyle(1.2, 0x111827, 0.85);
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(-size * 0.45, -size * 0.3);
                        entry.graphics.lineTo(size * 0.45, -size * 0.3);
                        entry.graphics.lineTo(size * 0.45, size * 0.2);
                        entry.graphics.lineTo(size * 0.2, size * 0.4);
                        entry.graphics.lineTo(-size * 0.2, size * 0.4);
                        entry.graphics.lineTo(-size * 0.45, size * 0.2);
                        entry.graphics.closePath();
                        entry.graphics.strokePath();
                        entry.graphics.lineStyle(1, 0xe5e7eb, 0.8);
                        entry.graphics.beginPath();
                        entry.graphics.moveTo(-size * 0.18, -size * 0.12);
                        entry.graphics.lineTo(size * 0.18, -size * 0.12);
                        entry.graphics.lineTo(size * 0.18, size * 0.04);
                        entry.graphics.lineTo(-size * 0.18, size * 0.04);
                        entry.graphics.closePath();
                        entry.graphics.strokePath();
                    }
                } else if (indicatorType === 'gas') {
                    const radius = style.size * 0.45;
                    entry.graphics.beginPath();
                    entry.graphics.fillCircle(0, 0, radius);
                    entry.graphics.closePath();
                    entry.graphics.fillPath();
                    entry.graphics.fillStyle(0xffffff, 0.65);
                    entry.graphics.beginPath();
                    entry.graphics.fillCircle(-radius * 0.3, -radius * 0.3, radius * 0.25);
                    entry.graphics.closePath();
                    entry.graphics.fillPath();
                } else {
                    entry.graphics.beginPath();
                    entry.graphics.moveTo(0, -style.size * 0.7);
                    entry.graphics.lineTo(style.size * 0.5, -style.size * 0.1);
                    entry.graphics.lineTo(style.size * 0.25, style.size * 0.55);
                    entry.graphics.lineTo(0, style.size * 0.75);
                    entry.graphics.lineTo(-style.size * 0.25, style.size * 0.55);
                    entry.graphics.lineTo(-style.size * 0.5, -style.size * 0.1);
                    entry.graphics.closePath();
                    entry.graphics.fillPath();
                }
            }
        });
    }

    _drawBoltShape(bolt) {
        if (!bolt) return;
        bolt.clear();
        bolt.lineStyle(2.5, 0xfef3c7, 1);
        bolt.beginPath();
        bolt.moveTo(-8, -6);
        bolt.lineTo(0, -6);
        bolt.lineTo(-3, -16);
        bolt.lineTo(10, -2);
        bolt.lineTo(2, -2);
        bolt.lineTo(6, 10);
        bolt.closePath();
        bolt.strokePath();
        bolt.fillStyle(0xfbbf24, 1);
        bolt.fillPath();
    }

    _startPowerBoltAnimation(rec) {
        const renderer = rec && rec._renderer;
        if (!renderer || !Array.isArray(renderer.bolts) || renderer.bolts.length === 0) return;

        const from = this.buildingManager.getMachine(rec.sourceBuildingId);
        const to = this.buildingManager.getMachine(rec.targetBuildingId);
        if (!from || !to) return;

        const start = this._getConnectionEndpoint(from) || this.scene._getRecordCenter(from);
        const end = this._getConnectionEndpoint(to) || this.scene._getRecordCenter(to);
        renderer.start = start;
        renderer.end = end;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const rotation = Math.atan2(dy, dx);
        const distance = Math.hypot(dx, dy);
        const duration = Math.max(800, distance * 1.8);

        renderer.bolts.forEach((bolt) => {
            try {
                if (bolt._boltTween) {
                    try { bolt._boltTween.stop(); } catch (e) {}
                }
                bolt.setVisible(true);
                bolt.setAlpha(1);
                bolt.setRotation(rotation);
                bolt.setPosition(start.x, start.y);
                this._drawBoltShape(bolt);
                bolt._boltTween = this.scene.tweens.add({
                    targets: bolt,
                    x: { from: start.x, to: end.x },
                    y: { from: start.y, to: end.y },
                    duration,
                    ease: 'Linear',
                    repeat: -1,
                    onUpdate: () => {
                        try {
                            const current = this.buildingManager.getMachine(rec.sourceBuildingId);
                            const target = this.buildingManager.getMachine(rec.targetBuildingId);
                            if (current && target) {
                                const liveStart = this.scene._getRecordCenter(current);
                                const liveEnd = this.scene._getRecordCenter(target);
                                const liveRotation = Math.atan2(liveEnd.y - liveStart.y, liveEnd.x - liveStart.x);
                                bolt.setRotation(liveRotation);
                                this._drawBoltShape(bolt);
                            }
                        } catch (e) {}
                    },
                    onRepeat: () => {
                        try {
                            const current = this.buildingManager.getMachine(rec.sourceBuildingId);
                            const target = this.buildingManager.getMachine(rec.targetBuildingId);
                            if (current && target) {
                                const liveStart = this.scene._getRecordCenter(current);
                                const liveEnd = this.scene._getRecordCenter(target);
                                const liveRotation = Math.atan2(liveEnd.y - liveStart.y, liveEnd.x - liveStart.x);
                                bolt.setRotation(liveRotation);
                                this._drawBoltShape(bolt);
                            }
                        } catch (e) {}
                    }
                });
            } catch (e) {}
        });
    }

    _getConveyorRailLayout(start, end) {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.hypot(dx, dy) || 1;
        const directionX = dx / length;
        const directionY = dy / length;
        const perpendicularX = -directionY;
        const perpendicularY = directionX;
        const railOffset = 7;
        const supportSpacing = 24;

        const railAStart = { x: start.x + perpendicularX * railOffset, y: start.y + perpendicularY * railOffset };
        const railBStart = { x: start.x - perpendicularX * railOffset, y: start.y - perpendicularY * railOffset };
        const railAEnd = { x: end.x + perpendicularX * railOffset, y: end.y + perpendicularY * railOffset };
        const railBEnd = { x: end.x - perpendicularX * railOffset, y: end.y - perpendicularY * railOffset };

        const supportCount = Math.max(1, Math.floor(length / supportSpacing));
        const supports = [];
        for (let index = 0; index <= supportCount; index += 1) {
            const t = index / Math.max(1, supportCount);
            supports.push({
                x: start.x + dx * t,
                y: start.y + dy * t,
                halfWidth: 4,
                normalX: perpendicularX,
                normalY: perpendicularY
            });
        }

        const tieDistance = 18;
        const ties = [];
        const tieCount = Math.max(1, Math.floor(length / tieDistance));
        for (let index = 0; index <= tieCount; index += 1) {
            const t = index / Math.max(1, tieCount);
            const x = start.x + dx * t;
            const y = start.y + dy * t;
            ties.push({
                start: { x: x - perpendicularX * 3.5, y: y - perpendicularY * 3.5 },
                end: { x: x + perpendicularX * 3.5, y: y + perpendicularY * 3.5 }
            });
        }

        return {
            railAStart,
            railBStart,
            railAEnd,
            railBEnd,
            supports,
            ties
        };
    }

    _drawConveyorRails(connection, start, end) {
        const renderer = connection && connection._renderer;
        const graphics = renderer && renderer.graphics;
        if (!renderer || !graphics || !start || !end) return;

        const layout = this._getConveyorRailLayout(start, end);
        const railWidth = 2.2;

        graphics.clear();
        graphics.lineStyle(railWidth, 0x374151, 1);
        graphics.beginPath();
        graphics.moveTo(layout.railAStart.x, layout.railAStart.y);
        graphics.lineTo(layout.railAEnd.x, layout.railAEnd.y);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(layout.railBStart.x, layout.railBStart.y);
        graphics.lineTo(layout.railBEnd.x, layout.railBEnd.y);
        graphics.strokePath();

        graphics.lineStyle(1.2, 0xe5e7eb, 0.85);
        graphics.beginPath();
        graphics.moveTo(layout.railAStart.x, layout.railAStart.y);
        graphics.lineTo(layout.railAEnd.x, layout.railAEnd.y);
        graphics.strokePath();
        graphics.beginPath();
        graphics.moveTo(layout.railBStart.x, layout.railBStart.y);
        graphics.lineTo(layout.railBEnd.x, layout.railBEnd.y);
        graphics.strokePath();

        layout.ties.forEach((tie) => {
            graphics.lineStyle(1.1, 0x6b7280, 0.95);
            graphics.beginPath();
            graphics.moveTo(tie.start.x, tie.start.y);
            graphics.lineTo(tie.end.x, tie.end.y);
            graphics.strokePath();
        });

        layout.supports.forEach((support) => {
            graphics.lineStyle(1.4, 0x4b5563, 0.9);
            graphics.beginPath();
            graphics.moveTo(support.x - support.normalX * support.halfWidth, support.y - support.normalY * support.halfWidth);
            graphics.lineTo(support.x + support.normalX * support.halfWidth, support.y + support.normalY * support.halfWidth);
            graphics.strokePath();
        });
    }

    createConnection(def, fromRecord, toRecord, opts = {}) {
        // def: connection definition (from ConnectionDefinitions)
        if (!def || !fromRecord || !toRecord) return null;
        const id = this._nextId++;
        const rec = {
            id,
            type: def.key,
            resourceId: def.resourceCategories ? def.resourceCategories[0] : null,
            sourceBuildingId: fromRecord.id,
            targetBuildingId: toRecord.id,
            fromMachineId: fromRecord.id,
            toMachineId: toRecord.id,
            sourceRecord: fromRecord,
            targetRecord: toRecord,
            fromPort: opts.fromPort || null,
            toPort: opts.toPort || null,
            direction: opts.direction || (def.bidirectional ? 'bidirectional' : 'unidirectional'),
            capacity: opts.capacity || 0,
            resourceKey: opts.resourceKey ?? null,
            resourceName: opts.resourceName ?? null,
            flowRate: opts.flowRate ?? null,
            flowUnit: opts.flowUnit ?? opts.unit ?? null,
            temperature: opts.temperature ?? opts.temperatureC ?? null,
            pressure: opts.pressure ?? opts.pressureBar ?? null,
            quality: opts.quality ?? null,
            state: opts.state ?? 'normal',
            resourceIcon: opts.resourceIcon ?? (String(def.key || def.type || '').toLowerCase() === 'conveyor' ? 'crate' : null),
            status: 'active',
            active: true,
            flowProgress: Number.isFinite(opts.flowProgress) ? opts.flowProgress : 0,
            _renderer: null
        };

        try {
            const start = this._getConnectionEndpoint(fromRecord) || this.scene._getRecordCenter(fromRecord);
            const end = this._getConnectionEndpoint(toRecord) || this.scene._getRecordCenter(toRecord);
            const isPowerConnection = String(def.key || def.type || '').toLowerCase() === 'power';
            let renderer = null;

            if (isPowerConnection) {
                renderer = this.scene._createPowerCable({ id, start, end, includeSymbols: false });
                if (renderer && renderer.container) {
                    renderer.container.setDepth(this._getConnectionDepth(def.key));
                    renderer.container.setScrollFactor(1);
                    renderer.container.disableInteractive && renderer.container.disableInteractive();
                    renderer.container.input && (renderer.container.input.enabled = false);

                    const bolt = this._createSceneGraphics();
                    if (bolt) {
                        bolt.setPosition(start.x, start.y);
                        bolt.setDepth(1100);
                        bolt.setVisible(false);
                        bolt.setScrollFactor(1);
                        bolt.setAlpha(1);
                        bolt.disableInteractive && bolt.disableInteractive();
                        bolt.input && (bolt.input.enabled = false);
                        renderer.bolts = [bolt];
                    }

                    rec._renderer = renderer;
                    this._setLayerDepth(renderer, def.key);
                    this._startPowerBoltAnimation(rec);
                }
            } else {
                const style = this._getLineStyle(def.key);
                const g = this._createSceneGraphics();
                if (g) {
                    g.setDepth(this._getConnectionDepth(def.key));
                    g.disableInteractive && g.disableInteractive();
                    g.input && (g.input.enabled = false);
                    renderer = { graphics: g, start, end };
                    rec._renderer = renderer;
                    if (String(def.key || def.type || '').toLowerCase() === 'conveyor') {
                        this._drawConveyorRails(rec, start, end);
                    } else {
                        g.lineStyle(style.width, style.color, style.alpha);
                        g.beginPath(); g.moveTo(start.x, start.y); g.lineTo(end.x, end.y); g.strokePath();
                    }
                }
            }

            rec._renderer = renderer;
            const indicatorType = String(def.key || def.type || '').toLowerCase();
            if (indicatorType === 'water' || indicatorType === 'conveyor') {
                this.createFlowIndicator(rec);
            } else if (indicatorType === 'gas') {
                this._createGasIndicator(rec);
            }
            this._setLayerDepth(renderer, def.key);
        } catch (e) {
            console.warn('Failed to render connection', e);
        }

        this._connections.set(id, rec);
        this._syncRecordConnections();
        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) {}
        }
        return rec;
    }

    removeConnection(id) {
        const rec = this._connections.get(id);
        if (!rec) return false;
        try {
            if (rec._renderer) {
                if (Array.isArray(rec._renderer.bolts)) {
                    rec._renderer.bolts.forEach((bolt) => {
                        try {
                            if (bolt._boltTween) {
                                try { bolt._boltTween.stop(); } catch (e) {}
                            }
                            bolt.destroy();
                        } catch (e) {}
                    });
                }
                if (rec._renderer.container) {
                    rec._renderer.container.destroy();
                } else if (rec._renderer.graphics) {
                    rec._renderer.graphics.destroy();
                }
                this._destroyFlowIndicator(rec._renderer);
                this._destroyGasIndicator(rec._renderer);
            }
        } catch (e) {}
        this._connections.delete(id);
        this._syncRecordConnections();
        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) {}
        }
        return true;
    }

    getConnectionAtPoint(x, y) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const threshold = 12;
        let closest = null;
        let closestDistance = Number.POSITIVE_INFINITY;
        for (const rec of this._connections.values()) {
            if (!rec._renderer) continue;
            const start = this._getConnectionEndpoint(this.buildingManager.getMachine(rec.sourceBuildingId)) || this.scene._getRecordCenter(this.buildingManager.getMachine(rec.sourceBuildingId));
            const end = this._getConnectionEndpoint(this.buildingManager.getMachine(rec.targetBuildingId)) || this.scene._getRecordCenter(this.buildingManager.getMachine(rec.targetBuildingId));
            if (!start || !end) continue;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.hypot(dx, dy) || 1;
            const px = x - start.x;
            const py = y - start.y;
            const dot = (px * dx + py * dy) / length;
            const clamped = Math.max(0, Math.min(length, dot));
            const projX = start.x + (dx / length) * clamped;
            const projY = start.y + (dy / length) * clamped;
            const dist = Math.hypot(x - projX, y - projY);
            if (dist <= threshold && dist < closestDistance) {
                closestDistance = dist;
                closest = rec;
            }
        }
        return closest;
    }

    _syncRecordConnections() {
        const all = this.getAll();
        for (const record of this.buildingManager.getPlacedMachines()) {
            if (!record) continue;
            record.connections = all.filter((conn) => conn && (conn.sourceBuildingId === record.id || conn.targetBuildingId === record.id));
        }
    }

    getConnection(id) { return this._connections.get(id); }
    getAll() { return Array.from(this._connections.values()); }

    updateConnectionsForBuilding(buildingId) {
        if (!buildingId) return;
        for (const rec of this._connections.values()) {
            if (rec.sourceBuildingId !== buildingId && rec.targetBuildingId !== buildingId) continue;
            try {
                const from = this.buildingManager.getMachine(rec.sourceBuildingId);
                const to = this.buildingManager.getMachine(rec.targetBuildingId);
                if (!from || !to) continue;
                const start = this._getConnectionEndpoint(from) || this.scene._getRecordCenter(from);
                const end = this._getConnectionEndpoint(to) || this.scene._getRecordCenter(to);
                if (rec._renderer) {
                    if (rec.type === 'power') {
                        try {
                            if (rec._renderer && Array.isArray(rec._renderer.bolts)) {
                                this._startPowerBoltAnimation(rec);
                            }
                        } catch (e) {}
                    }
                    if (rec.type === 'power' && rec._renderer.graphics && rec._renderer.symbols) {
                        try {
                            rec._renderer.graphics.clear();
                            rec._renderer.graphics.lineStyle(6, 0x0b0b0b, 1);
                            rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                            rec._renderer.graphics.lineStyle(2, 0x2b2b2b, 0.6);
                            rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                            rec._renderer.start = start; rec._renderer.end = end;
                            const dx = end.x - start.x;
                            const dy = end.y - start.y;
                            for (let i = 0; i < rec._renderer.symbols.length; i++) {
                                const img = rec._renderer.symbols[i];
                                img.x = start.x;
                                img.y = start.y;
                                img.rotation = Math.atan2(dy, dx);
                            }
                        } catch (e) { /* ignore */ }
                    } else if (rec._renderer.graphics) {
                        try {
                            rec._renderer.graphics.clear();
                            if (String(rec.type || '').toLowerCase() === 'conveyor') {
                                this._drawConveyorRails(rec, start, end);
                            } else {
                                const style = this._getLineStyle(rec.type);
                                rec._renderer.graphics.lineStyle(style.width, style.color, style.alpha);
                                rec._renderer.graphics.beginPath(); rec._renderer.graphics.moveTo(start.x, start.y); rec._renderer.graphics.lineTo(end.x, end.y); rec._renderer.graphics.strokePath();
                            }
                            rec._renderer.start = start; rec._renderer.end = end;
                        } catch (e) {}
                    }
                    const indicatorType = String(rec.type || '').toLowerCase();
                    if (indicatorType === 'water' || indicatorType === 'conveyor') {
                        try {
                            if (!rec._renderer.flowIndicator) {
                                this.createFlowIndicator(rec);
                            }
                            this._renderFlowIndicator(rec, start, end);
                        } catch (e) {}
                    } else if (indicatorType === 'gas') {
                        try {
                            if (!rec._renderer.gasIndicator) {
                                this._createGasIndicator(rec);
                            }
                            this._updateGasIndicator(rec, start, end);
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }
        this._syncRecordConnections();
        if (typeof this.scene._refreshPowerBalance === 'function') {
            try { this.scene._refreshPowerBalance(); } catch (e) {}
        }
    }

    updateAnimations(time, delta) {
        if (!this._connections) return;
        const deltaSeconds = Math.max(0, (delta || 0) / 1000);
        for (const rec of this._connections.values()) {
            const renderer = rec._renderer;
            if (!renderer) continue;
            const isActive = rec.active !== false && rec.status !== 'inactive';

            if (rec.type === 'power') {
                if (!isActive) {
                    if (Array.isArray(renderer.bolts)) {
                        renderer.bolts.forEach((bolt) => {
                            try {
                                if (bolt._boltTween) {
                                    bolt._boltTween.stop();
                                }
                            } catch (e) {}
                            bolt.clear();
                            bolt.setVisible(false);
                        });
                    }
                    continue;
                }

                if (!Array.isArray(renderer.bolts) || renderer.bolts.length === 0) continue;
                if (!renderer.bolts[0]._boltTween || !renderer.bolts[0]._boltTween.isPlaying()) {
                    this._startPowerBoltAnimation(rec);
                }
                continue;
            }

            const indicatorType = String(rec.type || '').toLowerCase();
            if ((indicatorType !== 'water' && indicatorType !== 'gas' && indicatorType !== 'conveyor') || !isActive) {
                if (renderer.flowIndicator && renderer.flowIndicator.container) {
                    renderer.flowIndicator.container.setVisible(false);
                }
                continue;
            }

            if (!renderer.flowIndicator) {
                this.createFlowIndicator(rec);
            }

            this.updateFlowIndicator(rec, delta);
        }
    }

    // Update renderer endpoints for any connections that reference the given record
    updateConnectionsForRecord(record) {
        if (!record) return;
        this.updateConnectionsForBuilding(record.id);
    }

    removeConnectionsForBuilding(buildingId) {
        if (!buildingId) return 0;
        const toRemove = [];
        for (const [id, rec] of this._connections.entries()) {
            const matches = rec.sourceBuildingId === buildingId || rec.targetBuildingId === buildingId;
            if (matches) toRemove.push(id);
        }
        for (const id of toRemove) {
            this.removeConnection(id);
        }
        return toRemove.length;
    }

    // Remove any connections referencing the given record
    removeConnectionsForRecord(record) {
        if (!record) return 0;
        return this.removeConnectionsForBuilding(record.id);
    }
}
