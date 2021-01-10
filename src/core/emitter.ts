import EventEmitter from 'eventemitter3'
import instances from './instances'
import logger from './logger'

const debug = logger('quill:events')
const EVENTS = ['selectionchange', 'mousedown', 'mouseup', 'click']

EVENTS.forEach(eventName => {
  document.addEventListener(eventName, (...args) => {
    Array.from(document.querySelectorAll('.ql-container')).forEach(node => {
      const quill = instances.get(node)
      if (quill && quill.emitter) {
        quill.emitter.handleDOM(...args)
      }
    })
  })
})

export enum Sources {
  API = 'api',
  SILENT = 'silent',
  USER = 'user'
}
export enum Events {
  EDITOR_CHANGE = 'editor-change',
  SCROLL_BEFORE_UPDATE = 'scroll-before-update',
  SCROLL_BLOT_MOUNT = 'scroll-blot-mount',
  SCROLL_BLOT_UNMOUNT = 'scroll-blot-unmount',
  SCROLL_OPTIMIZE = 'scroll-optimize',
  SCROLL_UPDATE = 'scroll-update',
  SELECTION_CHANGE = 'selection-change',
  TEXT_CHANGE = 'text-change'
}

export default class Emitter extends EventEmitter {
  static events = Events

  static sources = Sources

  constructor() {
    super()
    this.listeners = {}
    this.on('error', debug.error)
  }

  emit(event: string, ...args: any[]) {
    debug.log.call(debug, ...args)
    return super.emit(event, ...args)
  }

  handleDOM(event, ...args: any[]) {
    ;(this.listeners[event.type] || []).forEach(({ node, handler }) => {
      if (event.target === node || node.contains(event.target)) {
        handler(event, ...args)
      }
    })
  }

  listenDOM(eventName: string, node: Node, handler: Function) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = []
    }
    this.listeners[eventName].push({ node, handler })
  }
}
