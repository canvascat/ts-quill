import Delta from '../delta'
import { Sources } from '../core/emitter'
import Module from '../core/module'
import Quill from '../core'

export default class Uploader extends Module {
  static pluginName = 'modules/uploader'

  constructor(quill: Quill, options) {
    super(quill, options)
    quill.root.addEventListener('drop', e => {
      e.preventDefault()
      const position = document.caretPositionFromPoint(e.clientX, e.clientY) as CaretPosition
      const native = document.createRange()
      native.setStart(position.offsetNode, position.offset)
      native.setEnd(position.offsetNode, position.offset)
      const normalized = quill.selection.normalizeNative(native)
      const range = quill.selection.normalizedToRange(normalized)
      this.upload(range, (e.dataTransfer as DataTransfer).files as FileList)
    })
  }

  upload(range: RangeStatic, files: FileList) {
    const uploads: Array<File> = []
    Array.from(files).forEach(file => {
      if (file && this.options.mimetypes.includes(file.type)) {
        uploads.push(file)
      }
    })
    if (uploads.length > 0) {
      this.options.handler.call(this, range, uploads)
    }
  }
}

Uploader.DEFAULTS = {
  mimetypes: ['image/png', 'image/jpeg'],
  handler(range, files: Array<File>) {
    const promises: Promise<string>[] = files.map(file => {
      return new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => {
          resolve(reader.result as string)
        }
        reader.readAsDataURL(file)
      })
    })
    Promise.all(promises).then(images => {
      const update = images.reduce((delta: Delta, image) => {
        return delta.insert({ image })
      }, new Delta().retain(range.index).delete(range.length))
      this.quill.updateContents(update, Sources.USER)
      this.quill.setSelection(range.index + images.length, Sources.SILENT)
    })
  }
}
