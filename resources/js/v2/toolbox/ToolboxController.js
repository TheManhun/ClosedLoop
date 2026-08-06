export default class ToolboxController {
  constructor({ eventBus } = {}) {
    this.eventBus = eventBus;
    this.tools = new Map();
  }

  initialise() {
    // Register tools or adapters. No placement logic here.
  }

  destroy() {
    this.tools.clear();
  }
}
