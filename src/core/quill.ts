import { merge } from 'lodash'
import * as Parchment from 'parchment'
import Delta from '../delta'
import Editor from './editor'
import Emitter, { Events, Sources } from './emitter'
import Module from './module'
import Selection from './selection'
import instances from './instances'
import logger, { Levels } from './logger'
import Theme from './theme'
import { QuillOptions, QuillOptionsStatic } from '../types'

interface importsMap {
  [name: string]: any
}

type Overload = [number, number, StringMap, Sources]

const debug = logger('quill')
const QUILL_VERSION = (globalThis as any).QUILL_VERSION || 'dev'

Object.assign(window as any, { instances })

export const globalRegistry = new Parchment.Registry()

export default class Quill {
  static DEFAULTS = {
    bounds: null,
    modules: {},
    placeholder: '',
    readOnly: false,
    registry: globalRegistry,
    scrollingContainer: null,
    theme: 'default'
  }
  static events = Events
  static sources = Sources
  static version = QUILL_VERSION
  static imports: importsMap = {
    delta: Delta,
    parchment: Parchment,
    'core/module': Module,
    'core/theme': Theme
  }

  static debug(limit?: Levels | boolean) {
    if (!limit) return
    if (limit === true) limit = 'log'
    logger.level(limit)
  }
  static find(node: Node) {
    return instances.get(node) || globalRegistry.find(node)
  }
  static import(name: string) {
    if (!this.imports[name]) debug.error(`Cannot import ${name}. Are you sure it was registered?`)
    return this.imports[name]
  }

  static register(path: string, def: any, suppressWarning?: boolean): void
  static register(defs: StringMap, suppressWarning?: boolean): void
  static register(path: string | StringMap, target?: any, overwrite?: boolean) {
    if (typeof path !== 'string') {
      const name = path.attrName || path.blotName
      if (typeof name === 'string') {
        // register(Blot | Attributor, overwrite)
        this.register(`formats/${name}`, path, target)
      } else {
        // { path: target }
        Object.keys(path).forEach(key => {
          this.register(key, path[key], target)
        })
      }
    } else {
      if (this.imports[path] != null && !overwrite) {
        debug.warn(`Overwriting ${path} with`, target)
      }
      this.imports[path] = target
      if (
        (path.startsWith('blots/') || path.startsWith('formats/')) &&
        target.blotName !== 'abstract'
      ) {
        globalRegistry.register(target)
      }
      if (typeof target.register === 'function') {
        target.register(globalRegistry)
      }
    }
  }

  options
  container
  root: HTMLDivElement
  scrollingContainer
  emitter = new Emitter()
  scroll
  editor
  selection
  theme
  keyboard
  clipboard
  history
  uploader

  constructor(container: string | Element, options: QuillOptions = {}) {
    this.options = expandConfig(container, options)
    this.container = this.options.container
    if (!this.container) {
      debug.error('Invalid Quill container', container)
      throw new Error('Invalid Quill container')
    }
    Quill.debug(this.options.debug)
    const html = this.container.innerHTML.trim()
    this.container.classList.add('ql-container')
    this.container.innerHTML = ''
    instances.set(this.container, this)
    this.root = this.addContainer('ql-editor')
    this.root.addEventListener('dragstart', e => {
      e.preventDefault()
    })
    this.root.classList.add('ql-blank')
    this.root.setAttribute('data-gramm', 'false')
    this.scrollingContainer = this.options.scrollingContainer || this.root
    // this.emitter = new Emitter();
    const ScrollBlot = this.options.registry.query(Parchment.ScrollBlot.blotName)
    this.scroll = new ScrollBlot(this.options.registry, this.root, {
      emitter: this.emitter
    })

    this.editor = new Editor(this.scroll)
    this.selection = new Selection(this.scroll, this.emitter)
    // 注册主题
    this.theme = new this.options.theme(this, this.options) // eslint-disable-line new-cap
    this.keyboard = this.theme.addModule('keyboard')
    this.clipboard = this.theme.addModule('clipboard')
    this.history = this.theme.addModule('history')
    this.uploader = this.theme.addModule('uploader')
    this.theme.init()
    // 事件监听
    this.emitter.on(Events.EDITOR_CHANGE, type => {
      if (type === Events.TEXT_CHANGE) {
        this.root.classList.toggle('ql-blank', this.editor.isBlank())
      }
    })
    this.emitter.on(Events.SCROLL_UPDATE, (source, mutations) => {
      const range = this.selection.lastRange
      const index = range && range.length === 0 ? range.index : undefined
      this.modify(() => this.editor.update(null, mutations, index), source)
    })
    const contents = this.clipboard.convert({
      html: `${html}<p><br></p>`,
      text: '\n'
    })
    this.setContents(contents)
    this.history.clear()
    if (this.options.placeholder) {
      this.root.setAttribute('data-placeholder', this.options.placeholder)
    }
    if (this.options.readOnly) {
      this.disable()
    }
  }

  private addContainer(container: string | HTMLDivElement, refNode = null) {
    if (typeof container === 'string') {
      const className = container
      container = document.createElement('div')
      container.classList.add(className)
    }
    this.container.insertBefore(container, refNode)
    return container
  }

  blur() {
    this.selection.setRange(null)
  }

  /** 从编辑器删除文本，返回一个改变的Delta对象 */
  deleteText(index: number, length: number, source?: Sources): Delta {
    ;[index, length, , source] = overload(index, length, source)
    return this.modify(() => this.editor.deleteText(index, length), source, index, -1 * length)
  }

  disable() {
    this.enable(false)
  }

  enable(enabled = true) {
    this.scroll.enable(enabled)
    this.container.classList.toggle('ql-disabled', !enabled)
  }

  focus() {
    const { scrollTop } = this.scrollingContainer
    this.selection.focus()
    this.scrollingContainer.scrollTop = scrollTop
    this.scrollIntoView()
  }
  format(name: string, value: any, source?: Sources): Delta {
    return this.modify(() => {
      const range = this.getSelection(true) as RangeStatic
      let change = new Delta()
      if (range === null) {
        return change
      } else if (this.scroll.query(name, Parchment.Scope.BLOCK)) {
        change = this.editor.formatLine(range.index, range.length, {
          [name]: value
        })
      } else if (range.length === 0) {
        this.selection.format(name, value)
        return change
      } else {
        change = this.editor.formatText(range.index, range.length, {
          [name]: value
        })
      }
      this.setSelection(range, Sources.SILENT)
      return change
    }, source)
  }

  formatLine(index: number, length: number, source?: Sources): Delta
  formatLine(index: number, length: number, format: string, value: any, source?: Sources): Delta
  formatLine(index: number, length: number, formats: StringMap, source?: Sources): Delta
  formatLine(
    index: number,
    length: number,
    name?: string | StringMap | Sources,
    value?: any,
    source?: Sources
  ): Delta {
    let formats: StringMap
      // eslint-disable-next-line prefer-const
    ;[index, length, formats, source] = overload(index, length, name, value, source)
    return this.modify(() => this.editor.formatLine(index, length, formats), source, index, 0)
  }

  formatText(index: number, length: number, source?: Sources): Delta
  formatText(index: number, length: number, format: string, value: any, source?: Sources): Delta
  formatText(index: number, length: number, formats: StringMap, source?: Sources): Delta
  formatText(range: RangeStatic, format: string, value: any, source?: Sources): Delta
  formatText(range: RangeStatic, formats: StringMap, source?: Sources): Delta
  formatText(
    index: number | RangeStatic,
    length: number | string | StringMap,
    name?: any,
    value?: any,
    source?: Sources
  ) {
    // formatText(...args) {
    let formats: StringMap
      // eslint-disable-next-line prefer-const
    ;[index, length, formats, source] = overload(index, length, name, value, source)
    return this.modify(() => this.editor.formatText(index, length, formats), source, index, 0)
  }

  getBounds(index: number | RangeStatic, length = 0): BoundsStatic {
    const bounds = (typeof index === 'number'
      ? this.selection.getBounds(index, length)
      : this.selection.getBounds(index.index, index.length)) as DOMRect
    const containerBounds = this.container.getBoundingClientRect()
    return {
      bottom: bounds.bottom - containerBounds.top,
      height: bounds.height,
      left: bounds.left - containerBounds.left,
      right: bounds.right - containerBounds.left,
      top: bounds.top - containerBounds.top,
      width: bounds.width
    }
  }

  getContents(index = 0, length = this.getLength() - index) {
    ;[index, length] = overload(index, length)
    return this.editor.getContents(index, length)
  }

  getFormat(index = this.getSelection(true), length = 0) {
    if (typeof index === 'number') {
      return this.editor.getFormat(index, length)
    }
    return this.editor.getFormat(index.index, index.length)
  }

  getIndex(blot: any) {
    return blot.offset(this.scroll)
  }

  getLength(): number {
    return this.scroll.length()
  }

  getLeaf(index: number) {
    return this.scroll.leaf(index)
  }

  getLine(index: number) {
    return this.scroll.line(index)
  }

  getLines(index = 0, length = Number.MAX_VALUE) {
    if (typeof index !== 'number') {
      return this.scroll.lines(index.index, index.length)
    }
    return this.scroll.lines(index, length)
  }

  getModule(name: string) {
    return this.theme.modules[name]
  }

  getSelection(focus = false) {
    if (focus) this.focus()
    this.update() // Make sure we access getRange with editor in consistent state
    return this.selection.getRange()[0]
  }

  getSemanticHTML(index = 0, length = this.getLength() - index) {
    ;[index, length] = overload(index, length)
    return this.editor.getHTML(index, length)
  }

  getText(index = 0, length = this.getLength() - index) {
    ;[index, length] = overload(index, length)
    return this.editor.getText(index, length)
  }

  hasFocus() {
    return this.selection.hasFocus()
  }

  insertEmbed(index: number, embed: number, value: any, source?: Sources) {
    return this.modify(() => this.editor.insertEmbed(index, embed, value), source, index)
  }

  insertText(index: number, text: string, source?: Sources): Delta
  insertText(index: number, text: string, format: string, value: any, source?: Sources): Delta
  insertText(index: number, text: string, formats: StringMap, source?: Sources): Delta
  public insertText(
    index: number,
    text: string,
    name?: Sources | string | StringMap,
    value?: any,
    source?: Sources
  ) {
    let formats: StringMap
      // eslint-disable-next-line prefer-const
    ;[index, , formats, source] = overload(index, 0, name, value, source)
    return this.modify(
      () => this.editor.insertText(index, text, formats),
      source,
      index,
      text.length
    )
  }

  isEnabled() {
    return !this.container.classList.contains('ql-disabled')
  }

  off(...args) {
    return this.emitter.off(...args)
  }

  on(...args) {
    return this.emitter.on(...args)
  }

  once(...args) {
    return this.emitter.once(...args)
  }

  removeFormat(index: number, length: number, source?: Sources) {
    ;[index, length, , source] = overload(index, length, source)
    return this.modify(() => this.editor.removeFormat(index, length), source, index)
  }

  scrollIntoView() {
    this.selection.scrollIntoView(this.scrollingContainer)
  }

  setContents(delta: Delta, source?: Sources) {
    return this.modify(() => {
      delta = new Delta(delta)
      const length = this.getLength()
      const deleted = this.editor.deleteText(0, length)
      const applied = this.editor.applyDelta(delta)
      const lastOp = applied.ops[applied.ops.length - 1]
      if (
        lastOp != null &&
        typeof lastOp.insert === 'string' &&
        lastOp.insert[lastOp.insert.length - 1] === '\n'
      ) {
        this.editor.deleteText(this.getLength() - 1, 1)
        applied.delete(1)
      }
      return deleted.compose(applied)
    }, source)
  }

  setSelection(index: number, length: number, source?: Sources): void
  setSelection(range: RangeStatic, source?: Sources): void
  setSelection(index: number | RangeStatic, length?: number | Sources, source?: Sources) {
    if (index == null) {
      this.selection.setRange(null, length || Sources.API)
    } else {
      ;[index, length, , source] = overload(index, length, source)
      this.selection.setRange({ index, length }, source)
      if (source !== Sources.SILENT) {
        this.selection.scrollIntoView(this.scrollingContainer)
      }
    }
  }

  setText(text: string, source?: Sources) {
    const delta = new Delta().insert(text)
    return this.setContents(delta, source)
  }

  update(source?: Sources) {
    const change = this.scroll.update(source) // Will update selection before selection.update() does if text changes
    this.selection.update(source)
    // TODO this is usually undefined
    return change
  }

  updateContents(delta: Delta, source?: Sources) {
    return this.modify(() => this.editor.applyDelta(new Delta(delta), source), source, true)
  }

  // Handle selection preservation and TEXT_CHANGE emission
  // common to modification APIs
  private modify(modifier: Function, source, index: any = null, shift: any = null) {
    if (!this.isEnabled() && source === Sources.USER) {
      return new Delta()
    }
    let range = index == null ? null : this.getSelection()
    const oldDelta = this.editor.delta
    const change = modifier()
    if (range != null) {
      if (index === true) {
        index = range.index // eslint-disable-line prefer-destructuring
      }
      if (shift == null) {
        range = shiftRange(range, change, source)
      } else if (shift !== 0) {
        range = shiftRange(range, index, shift, source)
      }
      this.setSelection(range, Sources.SILENT)
    }
    if (change.length() > 0) {
      const args = [Events.TEXT_CHANGE, change, oldDelta, source]
      this.emitter.emit(Events.EDITOR_CHANGE, ...args)
      if (source !== Sources.SILENT) {
        this.emitter.emit(...args)
      }
    }
    return change
  }
}

export function expandConfig(
  container: string | Element,
  userConfig: QuillOptions
): QuillOptionsStatic {
  userConfig = merge(
    {
      container,
      modules: {
        clipboard: true,
        keyboard: true,
        history: true,
        uploader: true
      }
    },
    userConfig
  )
  if (!userConfig.theme || userConfig.theme === Quill.DEFAULTS.theme) {
    userConfig.theme = Theme
  } else {
    userConfig.theme = Quill.import(`themes/${userConfig.theme}`)
    if (userConfig.theme == null) {
      throw new Error(`Invalid theme ${userConfig.theme}. Did you register it?`)
    }
  }
  const themeConfig = merge({}, userConfig.theme.DEFAULTS)
  ;[themeConfig, userConfig].forEach(config => {
    config.modules = config.modules || {}
    Object.keys(config.modules).forEach(module => {
      if (config.modules[module] === true) {
        config.modules[module] = {}
      }
    })
  })
  const moduleNames = Object.keys(themeConfig.modules).concat(Object.keys(userConfig.modules))
  const moduleConfig = moduleNames.reduce((config, name) => {
    const moduleClass = Quill.import(`modules/${name}`)
    if (moduleClass == null) {
      debug.error(`Cannot load ${name} module. Are you sure you registered it?`)
    } else {
      config[name] = moduleClass.DEFAULTS || {}
    }
    return config
  }, {})
  // Special case toolbar shorthand
  if (
    userConfig.modules != null &&
    userConfig.modules.toolbar &&
    userConfig.modules.toolbar.constructor !== Object
  ) {
    userConfig.modules.toolbar = {
      container: userConfig.modules.toolbar
    }
  }
  userConfig = merge({}, Quill.DEFAULTS, { modules: moduleConfig }, themeConfig, userConfig)
  ;['bounds', 'container', 'scrollingContainer'].forEach(key => {
    if (typeof userConfig[key] === 'string') {
      userConfig[key] = document.querySelector(userConfig[key])
    }
  })
  userConfig.modules = Object.keys(userConfig.modules).reduce((config, name) => {
    if (userConfig.modules[name]) {
      config[name] = userConfig.modules[name]
    }
    return config
  }, {})
  return userConfig
}

export function overload(index: number, length: number, source?: Sources): Overload
export function overload(
  index: number,
  length: number,
  format: string,
  value: any,
  source?: Sources
): Overload
export function overload(
  index: number,
  length: number,
  formats: StringMap,
  source?: Sources
): Overload
export function overload(range: RangeStatic, format: string, value: any, source?: Sources): Overload
export function overload(range: RangeStatic, formats: StringMap, source?: Sources): Overload
export function overload(
  index: number | RangeStatic,
  length: number | string | StringMap,
  name?: any,
  value?: any,
  source?: Sources
): Overload {
  let formats: StringMap = {}
  if (typeof index !== 'number') {
    // Allow for throwaway end (used by insertText/insertEmbed)
    if (typeof length !== 'number') {
      source = value
      value = name
      name = length
    }
    length = index.length // eslint-disable-line prefer-destructuring
    index = index.index // eslint-disable-line prefer-destructuring
  } else if (typeof length !== 'number') {
    source = value
    value = name
    name = length
    length = 0
  }
  // Handle format being object, two format name/value strings or excluded
  if (typeof name === 'object') {
    formats = name
    source = value
  } else if (typeof name === 'string') {
    if (value != null) {
      formats[name] = value
    } else {
      source = name as Sources
    }
  }
  // Handle optional source
  source = source || Sources.API
  return [index, length, formats, source]
}

function shiftRange(range: RangeStatic, index: number, shift: number, source?: Sources): RangeStatic
function shiftRange(range: RangeStatic, change: Delta, source?: Sources): RangeStatic
function shiftRange(
  range: RangeStatic,
  index: number | Delta,
  length?: number | Sources,
  source?: Sources
) {
  if (range == null) return null
  let start
  let end
  if (index instanceof Delta) {
    ;[start, end] = [range.index, range.index + range.length].map(pos =>
      index.transformPosition(pos, source !== Sources.USER)
    )
  } else if (typeof index === 'number') {
    ;[start, end] = [range.index, range.index + range.length].map(pos => {
      if (pos < index || (pos === index && source === Sources.USER)) return pos
      return length >= 0 ? pos + length : Math.max(index, pos + length)
    })
  }
  return { index: start, length: end - start }
}
