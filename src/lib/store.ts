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

export type SyncStatus = 'local' | 'connecting' | 'online' | 'error'

const LS_TODOS = 'sticky-todo-items'
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

function loadLocal(): Todo[] {
  try { return JSON.parse(localStorage.getItem(LS_TODOS) || '[]') } catch { return [] }
}
function saveLocal(todos: Todo[]) {
  localStorage.setItem(LS_TODOS, JSON.stringify(todos))
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export class TodoStore {
  todos: Todo[] = []
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
    this.todos = loadLocal()
    this.emit()
    const cfg = loadCfg()
    if (!cfg) return
    this.status = 'connecting'
    this.emit()
    try {
      this.sb = createClient(cfg.url, cfg.key)
      const { data, error } = await this.sb.from('todos').select('*')
      if (error) throw error
      const remote = (data || []) as Todo[]
      // 合并：云端为准，本地有而云端没有的（离线新增）补传上去
      const remoteIds = new Set(remote.map(t => t.id))
      const localOnly = this.todos.filter(t => !remoteIds.has(t.id))
      if (localOnly.length) await this.sb.from('todos').upsert(localOnly)
      this.todos = [...remote, ...localOnly]
      saveLocal(this.todos)
      this.status = 'online'
      this.emit()
      this.sb.channel('todos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'todos' },
          (payload) => this.onRemote(payload))
        .subscribe((s, err) => {
          if (s === 'CHANNEL_ERROR') {
            console.error('[sync] channel error', err)
            ;(window as any).__syncErr = 'channel: ' + String((err as any)?.message || err)
            this.status = 'error'; this.emit()
          }
        })
    } catch (e) {
      console.error('[sync] init failed', e)
      ;(window as any).__syncErr = String((e as any)?.message || e)
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

  private onRemote(payload: any) {
    this.applyingRemote = true
    const { eventType, new: row, old } = payload
    if (eventType === 'DELETE') {
      this.todos = this.todos.filter(t => t.id !== old.id)
    } else {
      const t = row as Todo
      const i = this.todos.findIndex(x => x.id === t.id)
      if (i >= 0) this.todos[i] = t
      else this.todos.push(t)
      this.todos = [...this.todos]
    }
    saveLocal(this.todos)
    this.applyingRemote = false
    this.emit()
  }

  private push(fn: (sb: SupabaseClient) => unknown) {
    if (this.sb && !this.applyingRemote)
      Promise.resolve(fn(this.sb)).catch(() => { this.status = 'error'; this.emit() })
  }

  private commit(next: Todo[], pushFn?: (sb: SupabaseClient) => unknown) {
    this.todos = next
    saveLocal(next)
    this.emit()
    if (pushFn) this.push(pushFn)
  }

  add(text: string) {
    const minPos = Math.min(0, ...this.todos.filter(t => !t.done).map(t => t.position))
    const todo: Todo = {
      id: uid(), text, done: false, pinned: false,
      position: minPos - 1, created_at: Date.now(), completed_at: null,
    }
    this.commit([...this.todos, todo], sb => sb.from('todos').insert(todo))
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
    this.commit(next, sb => sb.from('todos').upsert(row))
  }

  remove(id: string) {
    this.commit(this.todos.filter(t => t.id !== id), sb => sb.from('todos').delete().eq('id', id))
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
    this.commit(next, sb => sb.from('todos').upsert(rePosed))
  }
}

export const store = new TodoStore()
