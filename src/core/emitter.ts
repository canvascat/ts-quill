import EventEmitter from 'eventemitter3'
import instances from './instances'
import logger from './logger'

const debug = logger('quill:events')
const EVENTS = ['selectionchange', 'mousedown', 'mouseup', 'click']

// 事件代理
EVENTS.forEach(eventName => {
  document.addEventListener(eventName, (...args) => {
    Array.from(document.querySelectorAll('.ql-container')).forEach(node => {
      const quill = instances.get(node)
      quill?.emitter.handleDOM(...args)
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
interface DOMListeners {
  [eventName: string]: {
    node: Node
    handler: Function
  }[]
}

export default class Emitter extends EventEmitter {
  static events = Events
  static sources = Sources

  DOMListeners: DOMListeners = {}

  constructor() {
    super()
    this.on('error', debug.error as EventEmitter.ListenerFn)
  }

  emit(event: string, ...args: any[]) {
    debug.log.call(debug, ...args)
    return super.emit(event, ...args)
  }

  handleDOM(event: Event, ...args: any[]) {
    this.DOMListeners[event.type]?.forEach(({ node, handler }) => {
      node.contains(event.target as Node) && handler(event, ...args)
    })
  }

  listenDOM(eventName: string, node: Node, handler: Function) {
    if (!this.DOMListeners[eventName]) this.DOMListeners[eventName] = []
    this.DOMListeners[eventName].push({ node, handler })
  }
}
