export default class Renderer {
  constructor({ eventBus } = {}) {
    this.eventBus = eventBus;
    this.initialised = false;
  }

  initialise() {
    this.initialised = true;
  }

  render(frame) {
    if (!this.initialised) return;
    // Rendering responsibilities only. No DOM globals here.
  }

  destroy() {
    this.initialised = false;
  }
}
