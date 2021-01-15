import Delta from '../delta'
import Quill from '../core/quill'
import Module from '../core/module'
import { TableCell, TableRow, TableBody, TableContainer, tableId } from '../formats/table'
import { Events, Sources } from '../core/emitter'

class Table extends Module {
  static register() {
    Quill.register(TableCell)
    Quill.register(TableRow)
    Quill.register(TableBody)
    Quill.register(TableContainer)
  }

  constructor(...args) {
    super(...args)
    this.listenBalanceCells()
  }

  deleteColumn() {
    const [table, row, cell] = this.getTable()
    if (cell == null) return
    const column = row.children.indexOf(cell)
    table.deleteColumn(column)
    this.quill.update(Sources.USER)
  }

  deleteRow() {
    const [, row] = this.getTable()
    if (row == null) return
    row.remove()
    this.quill.update(Sources.USER)
  }

  deleteTable() {
    const [table] = this.getTable()
    if (table == null) return
    const offset = table.offset()
    table.remove()
    this.quill.update(Sources.USER)
    this.quill.setSelection(offset, Sources.SILENT)
  }

  getTable(range = this.quill.getSelection()) {
    if (range == null) return [null, null, null, -1]
    const [cell, offset] = this.quill.getLine(range.index)
    if (cell == null || cell.statics.blotName !== TableCell.blotName) {
      return [null, null, null, -1]
    }
    const row = cell.parent
    const table = row.parent.parent
    return [table, row, cell, offset]
  }

  insertColumn(offset) {
    const range = this.quill.getSelection()
    const [table, row, cell] = this.getTable(range)
    if (cell == null) return
    const column = row.children.offset(cell)
    table.insertColumn(column + offset)
    this.quill.update(Sources.USER)
    let shift = row.parent.children.indexOf(row)
    if (offset === 0) {
      shift += 1
    }
    this.quill.setSelection(range.index + shift, range.length, Sources.SILENT)
  }

  insertColumnLeft() {
    this.insertColumn(0)
  }

  insertColumnRight() {
    this.insertColumn(1)
  }

  insertRow(offset) {
    const range = this.quill.getSelection()
    const [table, row, cell] = this.getTable(range)
    if (cell == null) return
    const index = row.parent.children.indexOf(row)
    table.insertRow(index + offset)
    this.quill.update(Sources.USER)
    if (offset > 0) {
      this.quill.setSelection(range, Sources.SILENT)
    } else {
      this.quill.setSelection(range.index + row.children.length, range.length, Sources.SILENT)
    }
  }

  insertRowAbove() {
    this.insertRow(0)
  }

  insertRowBelow() {
    this.insertRow(1)
  }

  insertTable(rows, columns) {
    const range = this.quill.getSelection()
    if (range == null) return
    const delta = new Array(rows).fill(0).reduce(memo => {
      const text = new Array(columns).fill('\n').join('')
      return memo.insert(text, { table: tableId() })
    }, new Delta().retain(range.index))
    this.quill.updateContents(delta, Sources.USER)
    this.quill.setSelection(range.index, Sources.SILENT)
  }

  listenBalanceCells() {
    this.quill.on(Events.SCROLL_OPTIMIZE, mutations => {
      mutations.some(mutation => {
        if (mutation.target.tagName === 'TABLE') {
          this.quill.once(Events.TEXT_CHANGE, (delta, old, source) => {
            if (source !== Sources.USER) return
            this.quill.scroll.descendants(TableContainer).forEach(table => {
              table.balanceCells()
            })
          })
          return true
        }
        return false
      })
    })
  }
}

export default Table
