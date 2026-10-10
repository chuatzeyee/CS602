// VBA's Collection (New Collection) and Scripting.Dictionary (CreateObject("Scripting.Dictionary") or New Dictionary).
// Not taught in the course, but cheap and familiar to learners who know VBA from elsewhere.
import { deref, toNumber, toStr } from './coerce'
import { EMPTY, VbaError, bool, lng, newArray, obj, type Val, type VbaObject } from './runtime'
import { fn, need, opt, type Table } from './builtinsArgs'

const noMember = (cls: string, name: string): VbaError => new VbaError(438, `Object doesn't support this property or method: ${cls}.${name}`)
const isText = (v: Val): boolean => v.t === 'str'

/** New Collection: items by 1-based position or by a case-insensitive text key */
export function makeCollection(): VbaObject {
  const items: { key?: string; v: Val }[] = []
  const indexOf = (at: Val): number => {
    const a = deref(at)
    if (isText(a)) {
      const k = toStr(a).toLowerCase()
      const i = items.findIndex(x => x.key === k)
      if (i < 0) throw new VbaError(5)
      return i
    }
    const n = Math.round(toNumber(a))
    if (n < 1 || n > items.length) throw new VbaError(9)
    return n - 1
  }
  const add = (args: Val[], named: Record<string, Val>): Val => {
    const v = need(args, named, 0, 'Item')
    const keyArg = opt(args, named, 1, 'Key')
    let key: string | undefined
    if (keyArg) {
      if (!isText(deref(keyArg))) throw new VbaError(13)
      key = toStr(keyArg).toLowerCase()
      if (items.some(x => x.key === key)) throw new VbaError(457)
    }
    const before = opt(args, named, 2, 'Before')
    const after = opt(args, named, 3, 'After')
    const at = before ? indexOf(before) : after ? indexOf(after) + 1 : items.length
    items.splice(at, 0, { key, v })
    return EMPTY
  }
  const read = (name: string, args: Val[], named: Record<string, Val>): Val => {
    switch (name.toLowerCase()) {
      case 'add': return add(args, named)
      case 'count': return lng(items.length)
      case 'item': return items[indexOf(need(args, named, 0, 'Index'))].v
      case 'remove': items.splice(indexOf(need(args, named, 0, 'Index')), 1); return EMPTY
      default: throw noMember('Collection', name)
    }
  }
  return {
    className: 'Collection',
    get: read,
    call: read,
    set(name) { throw noMember('Collection', name) },
    defaultGet: (args) => (args.length ? items[indexOf(args[0])].v : obj(null)),
    enumerate: () => items.map(x => x.v),
  }
}

/** Scripting.Dictionary: unique keys (text keys case-sensitive unless CompareMode = vbTextCompare) */
export function makeDictionary(): VbaObject {
  const map = new Map<string, { key: Val; v: Val }>()
  let textMode = false
  const slot = (k: Val): string => {
    const key = deref(k)
    switch (key.t) {
      case 'str': return `s:${textMode ? key.v.toLowerCase() : key.v}`
      case 'bool': return `b:${key.v}`
      case 'empty': return 'e:'
      case 'byte': case 'int': case 'long': case 'single': case 'double': case 'currency': case 'date': return `n:${key.v}`
      default: throw new VbaError(5)
    }
  }
  const array = (vals: Val[]): Val => {
    const a = newArray([{ lo: 0, hi: vals.length - 1 }], 'Variant')
    vals.forEach((v, i) => { a.data[i] = v })
    return { t: 'arr', v: a }
  }
  // reading a missing key adds it with an Empty item, as Scripting.Dictionary does
  const item = (k: Val): Val => {
    const s = slot(k)
    if (!map.has(s)) map.set(s, { key: deref(k), v: EMPTY })
    return map.get(s)!.v
  }
  const read = (name: string, args: Val[], named: Record<string, Val>): Val => {
    switch (name.toLowerCase()) {
      case 'add': {
        const k = need(args, named, 0, 'Key')
        const s = slot(k)
        if (map.has(s)) throw new VbaError(457)
        map.set(s, { key: deref(k), v: need(args, named, 1, 'Item') })
        return EMPTY
      }
      case 'exists': return bool(map.has(slot(need(args, named, 0, 'Key'))))
      case 'item': return item(need(args, named, 0, 'Key'))
      case 'count': return lng(map.size)
      case 'keys': return array([...map.values()].map(x => x.key))
      case 'items': return array([...map.values()].map(x => x.v))
      case 'remove': {
        const s = slot(need(args, named, 0, 'Key'))
        if (!map.delete(s)) throw new VbaError(32811, 'Method \'Remove\' of object \'IDictionary\' failed: the key is not in the dictionary')
        return EMPTY
      }
      case 'removeall': map.clear(); return EMPTY
      case 'comparemode': return lng(textMode ? 1 : 0)
      default: throw noMember('Dictionary', name)
    }
  }
  const put = (k: Val, value: Val): void => {
    const s = slot(k)
    const old = map.get(s)
    map.set(s, { key: old ? old.key : deref(k), v: value })
  }
  return {
    className: 'Dictionary',
    get: read,
    call: read,
    set(name, args, value) {
      const key = name.toLowerCase()
      if (key === 'item' && args.length) return put(args[0], value)
      if (key === 'comparemode') {
        if (map.size) throw new VbaError(5)
        textMode = toNumber(value) === 1
        return
      }
      if (key === 'key' && args.length) {
        const old = map.get(slot(args[0]))
        if (!old) throw new VbaError(32811)
        map.delete(slot(args[0]))
        put(value, old.v)
        return
      }
      throw noMember('Dictionary', name)
    },
    defaultGet: (args) => (args.length ? item(args[0]) : obj(null)),
    defaultSet: (args, value) => { if (args.length) put(args[0], value); else throw new VbaError(450) },
    enumerate: () => [...map.values()].map(x => x.key),
  }
}

/** an object for New <class>, or undefined when the lab has no such class */
export function newObject(className: string): VbaObject | undefined {
  const c = className.toLowerCase()
  if (c === 'collection') return makeCollection()
  if (c === 'dictionary') return makeDictionary()
  return undefined
}

export function objectFunctions(): Table {
  return [
    ['createobject', fn((_c, a, n) => {
      const cls = toStr(need(a, n, 0, 'Class')).trim().toLowerCase()
      if (cls === 'scripting.dictionary') return obj(makeDictionary())
      throw new VbaError(429, `ActiveX component can't create object: ${cls} is not available in the lab`)
    })],
  ]
}
