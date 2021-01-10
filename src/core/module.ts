export default class Module {
  static DEFAULTS = {}
  constructor(quill, options = {}) {
    this.quill = quill
    this.options = options
  }
}
