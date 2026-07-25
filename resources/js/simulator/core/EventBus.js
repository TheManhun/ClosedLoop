export class EventBus {
    constructor() {
        this._handlers = new Map();
    }

    on(event, handler) {
        if (!this._handlers.has(event)) this._handlers.set(event, []);
        this._handlers.get(event).push({ handler, once: false });
        return () => this.off(event, handler);
    }

    once(event, handler) {
        if (!this._handlers.has(event)) this._handlers.set(event, []);
        this._handlers.get(event).push({ handler, once: true });
        return () => this.off(event, handler);
    }

    off(event, handler) {
        if (!this._handlers.has(event)) return;
        if (!handler) { this._handlers.delete(event); return; }
        const arr = this._handlers.get(event).filter(h => h.handler !== handler);
        if (arr.length === 0) this._handlers.delete(event); else this._handlers.set(event, arr);
    }

    emit(event, ...args) {
        if (!this._handlers.has(event)) return;
        const list = this._handlers.get(event).slice();
        for (const entry of list) {
            try {
                entry.handler(...args);
            } catch (e) {
                console.error('EventBus handler error for', event, e);
            }
            if (entry.once) this.off(event, entry.handler);
        }
    }
}

export default EventBus;
