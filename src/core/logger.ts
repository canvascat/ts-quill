export type Levels = 'error' | 'warn' | 'log' | 'info'

export type Logger = {
  [propName in Levels]: Function
}

const levels: Levels[] = ['error', 'warn', 'log', 'info']
let level: Levels = process.env.NODE_ENV === 'production' ? 'warn' : 'info'

function debug(method: Levels, ...args: any[]) {
  if (levels.indexOf(method) <= levels.indexOf(level)) {
    console[method](...args)
  }
}

export default function namespace(ns: string) {
  return levels.reduce(
    (logger: Logger, method) =>
      Object.assign(logger, { [method]: debug.bind(console, method, ns) }),
    {} as Logger
  )
}

namespace.level = (newLevel: Levels) => (level = newLevel)
debug.level = namespace.level
