import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface Todo {
  id: string
  text: string
  done: boolean
  pinned: boolean
  position: number
  created_at: number
  completed_at: number | null
}

export interface Note {
  id: string
  title: string
  content: string
  pinned: boolean
  updated_at: number
  created_at: number
}

export type SyncStatus = 'local' | 'connecting' | 'online' | 'error'

const LS_TODOS = 'sticky-todo-items'
const LS_NOTES = 'sticky-todo-notes'
const LS_CFG = 'sticky-todo-supabase'

export interface SupabaseCfg { url: string; key: string }

export function loadCfg(): SupabaseCfg | null {
  try {
    const raw = localStorage.getItem(LS_CFG)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
export function saveCfg(cfg: SupabaseCfg | null) {
  if (cfg) localStorage.setItem(LS_CFG, JSON.stringify(cfg))
  else localStorage.removeItem(LS_CFG)
}

function loadJson<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function saveJson(key: string, v: unknown) {
  localStorage.setItem(key, JSON.stringify(v))
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export class TodoStore {
  todos: Todo[] = []
  notes: Note[] = []
  status: SyncStatus = 'local'
  private sb: SupabaseClient | null = null
  private listeners = new Set<() => void>()
  private applyingRemote = false

  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach(f => f()) }

  get sorted(): Todo[] {
    return [...this.todos].sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) || a.position - b.position)
  }

  get sortedNotes(): Note[] {
    return [...this.notes].sort((a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.updated_at - a.updated_at)
  }

  private initPromise: Promise<void> | null = null

  init(): Promise<void> {
    // 防止 StrictMode/重复调用导致的并发初始化
    if (this.initPromise) return this.initPromise
    this.initPromise = this.doInit().finally(() => { this.initPromise = null })
    return this.initPromise
  }

  private async doInit() {
    // 重连前清理旧客户端和频道
    if (this.sb) {
      try { await this.sb.removeAllChannels() } catch { /* ignore */ }
      this.sb = null
    }
    this.todos = loadJson<Todo>(LS_TODOS)
    this.notes = loadJson<Note>(LS_NOTES)
    this.emit()
    const cfg = loadCfg()
    if (!cfg) return
    this.status = 'connecting'
    this.emit()
    try {
      this.sb = createClient(cfg.url, cfg.key)
      // 合并两张表：云端为准，本地独有的（离线新增）补传上去
      for (const table of ['todos', 'notes'] as const) {
        const { data, error } = await this.sb.from(table).select('*')
        if (error) throw error
        const remote = (data || []) as any[]
        const local = table === 'todos' ? this.todos : this.notes
        const remoteIds = new Set(remote.map(t => t.id))
        const localOnly = local.filter(t => !remoteIds.has(t.id))
        if (localOnly.length) await this.sb.from(table).upsert(localOnly as any)
        if (table === 'todos') this.todos = [...remote, ...localOnly] as Todo[]
        else this.notes = [...remote, ...localOnly] as Note[]
      }
      saveJson(LS_TODOS, this.todos)
      saveJson(LS_NOTES, this.notes)
      this.status = 'online'
      this.emit()
      this.sb.channel('sticky-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' },
          (payload) => this.onRemote('todos', payload))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notes' },
          (payload) => this.onRemote('notes', payload))
        .subscribe((s, err) => {
          if (s === 'CHANNEL_ERROR') {
            console.error('[sync] channel error', err)
            this.status = 'error'; this.emit()
          }
        })
    } catch (e) {
      console.error('[sync] init failed', e)
      this.status = 'error'
      this.emit()
    }
  }

  async reconnect(cfg: SupabaseCfg) {
    saveCfg(cfg)
    this.sb = null
    this.status = 'connecting'
    await this.init()
  }

  disconnect() {
    saveCfg(null)
    this.sb = null
    this.status = 'local'
    this.emit()
  }

  private onRemote(table: 'todos' | 'notes', payload: any) {
    this.applyingRemote = true
    const { eventType, new: row, old } = payload
    const list = table === 'todos' ? this.todos : this.notes
    let next: any[]
    if (eventType === 'DELETE') {
      next = list.filter(t => t.id !== old.id)
    } else {
      const i = list.findIndex(x => x.id === row.id)
      next = [...list]
      if (i >= 0) next[i] = row
      else next.push(row)
    }
    if (table === 'todos') { this.todos = next; saveJson(LS_TODOS, next) }
    else { this.notes = next; saveJson(LS_NOTES, next) }
    this.applyingRemote = false
    this.emit()
  }

  private push(fn: (sb: SupabaseClient) => unknown) {
    if (this.sb && !this.applyingRemote)
      Promise.resolve(fn(this.sb)).catch(() => { this.status = 'error'; this.emit() })
  }

  private commitTodos(next: Todo[], pushFn?: (sb: SupabaseClient) => unknown) {
    this.todos = next
    saveJson(LS_TODOS, next)
    this.emit()
    if (pushFn) this.push(pushFn)
  }

  private commitNotes(next: Note[], pushFn?: (sb: SupabaseClient) => unknown) {
    this.notes = next
    saveJson(LS_NOTES, next)
    this.emit()
    if (pushFn) this.push(pushFn)
  }

  // ============ 待办 ============

  add(text: string) {
    // 新事项追加到列表底部
    const maxPos = Math.max(-1, ...this.todos.filter(t => !t.done).map(t => t.position))
    const todo: Todo = {
      id: uid(), text, done: false, pinned: false,
      position: maxPos + 1, created_at: Date.now(), completed_at: null,
    }
    this.commitTodos([...this.todos, todo], sb => sb.from('todos').insert(todo))
  }

  update(id: string, patch: Partial<Todo>) {
    const next = this.todos.map(t => {
      if (t.id !== id) return t
      const merged = { ...t, ...patch }
      if (patch.done === true && !t.done) merged.completed_at = Date.now()
      if (patch.done === false) merged.completed_at = null
      return merged
    })
    const row = next.find(t => t.id === id)!
    this.commitTodos(next, sb => sb.from('todos').upsert(row))
  }

  remove(id: string) {
    this.commitTodos(this.todos.filter(t => t.id !== id), sb => sb.from('todos').delete().eq('id', id))
  }

  reorder(id: string, beforeId: string | null) {
    const list = this.sorted.filter(t => t.id !== id)
    const item = this.todos.find(t => t.id === id)!
    const idx = beforeId ? list.findIndex(t => t.id === beforeId) : list.length
    const insertAt = idx < 0 ? list.length : idx
    list.splice(insertAt, 0, item)
    let pos = 0
    const rePosed = list.map(t => ({ ...t, position: pos++ }))
    const map = new Map(rePosed.map(t => [t.id, t]))
    const next = this.todos.map(t => map.get(t.id) || t)
    this.commitTodos(next, sb => sb.from('todos').upsert(rePosed))
  }

  // ============ 随笔 ============

  addNote(title: string, content: string) {
    const now = Date.now()
    const note: Note = { id: uid(), title, content, pinned: false, updated_at: now, created_at: now }
    this.commitNotes([...this.notes, note], sb => sb.from('notes').insert(note))
    return note.id
  }

  updateNote(id: string, patch: Partial<Note>) {
    const next = this.notes.map(n => n.id === id ? { ...n, ...patch, updated_at: Date.now() } : n)
    const row = next.find(n => n.id === id)!
    this.commitNotes(next, sb => sb.from('notes').upsert(row))
  }

  removeNote(id: string) {
    this.commitNotes(this.notes.filter(n => n.id !== id), sb => sb.from('notes').delete().eq('id', id))
  }
}

export const store = new TodoStore()
