import { ContainerBlot, LeafBlot, Scope } from 'parchment'
import { cloneDeep, isEqual } from 'lodash'
import Emitter, { Events, Sources } from './emitter'
import logger from './logger'
import Scroll from '../blots/scroll'
import Cursor from '../blots/cursor'
// import { RangeStatic } from 'quill'

const debug = logger('quill:selection')

interface NormalizeRange {
  start: {
    node: Node
    offset: number
  }
  end: {
    node: Node
    offset: number
  }
  native: Range
}

export default class Selection {
  emitter
  scroll
  root: HTMLElement
  composing = false
  mouseDown = false
  savedRange: RangeStatic
  lastRange: RangeStatic
  cursor: Cursor

  constructor(scroll: Scroll, emitter: Emitter) {
    this.emitter = emitter
    this.scroll = scroll
    this.root = this.scroll.domNode
    this.cursor = this.scroll.create('cursor', this) as Cursor
    // savedRange is last non-null range
    console.log(this.cursor, '====')
    this.lastRange = this.savedRange = { index: 0, length: 0 }
    this.handleComposition()
    this.handleDragging()
    this.emitter.listenDOM('selectionchange', document, () => {
      if (!this.mouseDown) {
        setTimeout(this.update.bind(this, Sources.USER), 1)
      }
    })
    this.emitter.on(Events.SCROLL_BEFORE_UPDATE, () => {
      if (!this.hasFocus()) return
      const native = this.getNativeRange()
      if (native == null) return
      if (native.start.node === this.cursor.textNode) return // cursor.restore() will handle
      this.emitter.once(Events.SCROLL_UPDATE, () => {
        try {
          this.setNativeRange(
            native.start.node,
            native.start.offset,
            native.end.node,
            native.end.offset
          )
          this.update(Sources.SILENT)
        } catch (ignored) {
          // ignore
        }
      })
    })
    this.emitter.on(Events.SCROLL_OPTIMIZE, (mutations, context) => {
      if (context.range) {
        const { startNode, startOffset, endNode, endOffset } = context.range
        this.setNativeRange(startNode, startOffset, endNode, endOffset)
        this.update(Sources.SILENT)
      }
    })
    this.update(Sources.SILENT)
  }

  handleComposition() {
    this.root.addEventListener('compositionstart', () => {
      this.composing = true
    })
    this.root.addEventListener('compositionend', () => {
      this.composing = false
      if (this.cursor.parent) {
        const range = this.cursor.restore()
        if (!range) return
        setTimeout(() => {
          this.setNativeRange(
            range.startNode as Text,
            range.startOffset,
            range.endNode,
            range.endOffset
          )
        }, 1)
      }
    })
  }

  handleDragging() {
    this.emitter.listenDOM('mousedown', document.body, () => {
      this.mouseDown = true
    })
    this.emitter.listenDOM('mouseup', document.body, () => {
      this.mouseDown = false
      this.update(Sources.USER)
    })
  }

  focus() {
    if (this.hasFocus()) return
    this.root.focus()
    this.setRange(this.savedRange)
  }

  format(format, value) {
    this.scroll.update()
    const nativeRange = this.getNativeRange()
    if (
      nativeRange == null ||
      !nativeRange.native.collapsed ||
      this.scroll.query(format, Scope.BLOCK)
    )
      return
    if (nativeRange.start.node !== this.cursor.textNode) {
      const blot = this.scroll.find(nativeRange.start.node, false)
      if (blot == null) return
      // TODO Give blot ability to not split
      if (blot instanceof LeafBlot) {
        const after = blot.split(nativeRange.start.offset)
        blot.parent.insertBefore(this.cursor, after)
      } else {
        blot.insertBefore(this.cursor, nativeRange.start.node) // Should never happen
      }
      this.cursor.attach()
    }
    this.cursor.format(format, value)
    this.scroll.optimize()
    this.setNativeRange(this.cursor.textNode, this.cursor.textNode.data.length)
    this.update()
  }

  getBounds(index, length = 0) {
    const scrollLength = this.scroll.length()
    index = Math.min(index, scrollLength - 1)
    length = Math.min(index + length, scrollLength - 1) - index
    let node
    let [leaf, offset] = this.scroll.leaf(index)
    if (leaf == null) return null
    ;[node, offset] = leaf.position(offset, true)
    const range = document.createRange()
    if (length > 0) {
      range.setStart(node, offset)
      ;[leaf, offset] = this.scroll.leaf(index + length)
      if (leaf == null) return null
      ;[node, offset] = leaf.position(offset, true)
      range.setEnd(node, offset)
      return range.getBoundingClientRect()
    }
    let side = 'left'
    let rect
    if (node instanceof Text) {
      if (offset < node.data.length) {
        range.setStart(node, offset)
        range.setEnd(node, offset + 1)
      } else {
        range.setStart(node, offset - 1)
        range.setEnd(node, offset)
        side = 'right'
      }
      rect = range.getBoundingClientRect()
    } else {
      rect = leaf.domNode.getBoundingClientRect()
      if (offset > 0) side = 'right'
    }
    return {
      bottom: rect.top + rect.height,
      height: rect.height,
      left: rect[side],
      right: rect[side],
      top: rect.top,
      width: 0
    }
  }

  getNativeRange() {
    const selection = document.getSelection()
    if (selection == null || selection.rangeCount <= 0) return null
    const nativeRange = selection.getRangeAt(0)
    if (nativeRange == null) return null
    const range = this.normalizeNative(nativeRange)
    debug.info('getNativeRange', range)
    return range
  }

  getRange() {
    const normalized = this.getNativeRange()
    if (normalized == null) return [null, null]
    const range = this.normalizedToRange(normalized)
    return [range, normalized]
  }

  hasFocus() {
    return document.activeElement === this.root || contains(this.root, document.activeElement)
  }

  normalizedToRange(range: NormalizeRange): RangeStatic {
    const positions: Array<[Node, number]> = [[range.start.node, range.start.offset]]
    if (!range.native.collapsed) {
      positions.push([range.end.node, range.end.offset])
    }
    const indexes = positions.map(position => {
      const [node, offset] = position
      const blot = this.scroll.find(node, true)
      const index = blot.offset(this.scroll)
      if (offset === 0) {
        return index
      } else if (blot instanceof ContainerBlot) {
        return index + blot.length()
      }
      return index + blot.index(node, offset)
    })
    const end = Math.min(Math.max(...indexes), this.scroll.length() - 1)
    const start = Math.min(end, ...indexes)
    return { index: start, length: end - start }
  }

  normalizeNative(nativeRange: Range): Nullable<NormalizeRange> {
    if (
      !contains(this.root, nativeRange.startContainer) ||
      (!nativeRange.collapsed && !contains(this.root, nativeRange.endContainer))
    ) {
      return null
    }
    const range = {
      start: {
        node: nativeRange.startContainer,
        offset: nativeRange.startOffset
      },
      end: { node: nativeRange.endContainer, offset: nativeRange.endOffset },
      native: nativeRange
    }
    ;[range.start, range.end].forEach(position => {
      let { node, offset } = position
      while (!(node instanceof Text) && node.childNodes.length > 0) {
        if (node.childNodes.length > offset) {
          node = node.childNodes[offset]
          offset = 0
        } else if (node.childNodes.length === offset) {
          node = node.lastChild as Node
          if (node instanceof Text) {
            offset = node.data.length
          } else if (node.childNodes.length > 0) {
            // Container case
            offset = node.childNodes.length
          } else {
            // Embed case
            offset = node.childNodes.length + 1
          }
        } else {
          break
        }
      }
      position.node = node
      position.offset = offset
    })
    return range
  }

  rangeToNative(range) {
    const indexes = range.collapsed ? [range.index] : [range.index, range.index + range.length]
    const args = []
    const scrollLength = this.scroll.length()
    indexes.forEach((index, i) => {
      index = Math.min(scrollLength - 1, index)
      const [leaf, leafOffset] = this.scroll.leaf(index)
      const [node, offset] = leaf.position(leafOffset, i !== 0)
      args.push(node, offset)
    })
    if (args.length < 2) {
      return args.concat(args)
    }
    return args
  }

  scrollIntoView(scrollingContainer: HTMLElement) {
    const range = this.lastRange
    if (range == null) return
    const bounds = this.getBounds(range.index, range.length)
    if (bounds == null) return
    const limit = this.scroll.length() - 1
    const [first] = this.scroll.line(Math.min(range.index, limit))
    let last = first
    if (range.length > 0) {
      ;[last] = this.scroll.line(Math.min(range.index + range.length, limit))
    }
    if (first == null || last == null) return
    const scrollBounds = scrollingContainer.getBoundingClientRect()
    if (bounds.top < scrollBounds.top) {
      scrollingContainer.scrollTop -= scrollBounds.top - bounds.top
    } else if (bounds.bottom > scrollBounds.bottom) {
      scrollingContainer.scrollTop += bounds.bottom - scrollBounds.bottom
    }
  }

  setNativeRange(
    startNode: Node,
    startOffset,
    endNode = startNode,
    endOffset = startOffset,
    force = false
  ) {
    debug.info('setNativeRange', startNode, startOffset, endNode, endOffset)
    if (
      startNode != null &&
      (this.root.parentNode == null || startNode.parentNode == null || endNode.parentNode == null)
    ) {
      return
    }
    const selection = document.getSelection()
    if (selection == null) return
    if (startNode != null) {
      if (!this.hasFocus()) this.root.focus()
      const { native } = this.getNativeRange() || {}
      if (
        native == null ||
        force ||
        startNode !== native.startContainer ||
        startOffset !== native.startOffset ||
        endNode !== native.endContainer ||
        endOffset !== native.endOffset
      ) {
        if (startNode.tagName === 'BR') {
          startOffset = Array.from(startNode.parentNode.childNodes).indexOf(startNode)
          startNode = startNode.parentNode
        }
        if (endNode.tagName === 'BR') {
          endOffset = Array.from(endNode.parentNode.childNodes).indexOf(endNode)
          endNode = endNode.parentNode
        }
        const range = document.createRange()
        range.setStart(startNode, startOffset)
        range.setEnd(endNode, endOffset)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    } else {
      selection.removeAllRanges()
      this.root.blur()
    }
  }

  setRange(range: Nullable<RangeStatic>, force: boolean, source: Sources): void
  setRange(range: Nullable<RangeStatic>, source: Sources): void
  setRange(range: Nullable<RangeStatic>, force: boolean | Sources = false, source = Sources.API) {
    if (typeof force === 'string') {
      source = force
      force = false
    }
    debug.info('setRange', range)
    if (range != null) {
      const args = this.rangeToNative(range)
      this.setNativeRange(...args, force)
    } else {
      this.setNativeRange(null)
    }
    this.update(source)
  }

  update(source = Sources.USER) {
    const oldRange = this.lastRange
    const [lastRange, nativeRange] = this.getRange()
    this.lastRange = lastRange
    if (this.lastRange != null) {
      this.savedRange = this.lastRange
    }
    if (!isEqual(oldRange, this.lastRange)) {
      if (
        !this.composing &&
        nativeRange != null &&
        nativeRange.native.collapsed &&
        nativeRange.start.node !== this.cursor.textNode
      ) {
        this.cursor.restore()
      }
      const args = [Events.SELECTION_CHANGE, cloneDeep(this.lastRange), cloneDeep(oldRange), source]
      this.emitter.emit(Events.EDITOR_CHANGE, ...args)
      if (source !== Sources.SILENT) {
        this.emitter.emit(...args)
      }
    }
  }
}

function contains(parent: Node, descendant: Node | null) {
  return descendant?.parentNode ? parent.contains(descendant) : false
}
