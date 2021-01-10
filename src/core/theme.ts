export default class Theme {
  static DEFAULTS = {
    modules: {}
  }
  static themes = {
    default: Theme
  }

  quill
  options
  modules = {}

  constructor(quill, options) {
    this.quill = quill
    this.options = options
  }

  init() {
    Object.keys(this.options.modules).forEach(name => {
      if (this.modules[name] == null) {
        this.addModule(name)
      }
    })
  }

  addModule(name: string) {
    const ModuleClass = this.quill.constructor.import(`modules/${name}`)
    this.modules[name] = new ModuleClass(this.quill, this.options.modules[name] || {})
    return this.modules[name]
  }
}
