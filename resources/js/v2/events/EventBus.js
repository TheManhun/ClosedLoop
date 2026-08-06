export default class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  initialise() {
    // Ready to register listeners.
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
  }

  off(event, handler) {
    const set = this.listeners.get(event);
    if (set) set.delete(handler);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const h of Array.from(set)) h(payload);
  }

  destroy() {
    this.listeners.clear();
  }
}
