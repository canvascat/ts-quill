export type Levels = 'error' | 'warn' | 'log' | 'info'

export interface Logger {
  [propName: string]: Function
}

const levels: Levels[] = ['error', 'warn', 'log', 'info']
let level: Levels = 'warn'

function debug(method: Levels, ...args: any[]) {
  if (levels.indexOf(method) <= levels.indexOf(level)) {
    console[method](...args)
  }
}

function namespace(ns: string) {
  return levels.reduce((logger: Logger, method) => {
    logger[method] = debug.bind(console, method, ns)
    return logger
  }, {})
}

namespace.level = (newLevel: Levels) => (level = newLevel)
debug.level = namespace.level

export default namespace
