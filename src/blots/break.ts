import { EmbedBlot } from 'parchment'

export default class Break extends EmbedBlot {
  static pluginName = 'blots/break'
  static blotName = 'break'
  static tagName = 'BR'

  static value() {
    return undefined
  }

  optimize() {
    if (this.prev || this.next) {
      this.remove()
    }
  }

  length() {
    return 0
  }

  value() {
    return ''
  }
}
