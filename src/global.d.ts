interface StringMap {
  [key: string]: any
}
interface RangeStatic {
  index: number
  length: number
}
interface BoundsStatic {
  bottom: number
  left: number
  right: number
  top: number
  height: number
  width: number
}

declare type Nullable<T> = T | null
