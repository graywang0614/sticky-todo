import { useEffect, useState } from 'react'
import { store } from '@/lib/store'
import type { Todo, Note } from '@/lib/store'
import LoginScreen from '@/pages/LoginScreen'
import { Pin, PinOff, Plus, X, Check, Trash2, Undo2, Lock, LockOpen, RefreshCw } from 'lucide-react'

function useStore() {
  const [, setV] = useState(0)
  useEffect(() => store.subscribe(() => setV(v => v + 1)), [])
  return { todos: store.todos, notes: store.notes }
}

/** 面板锁定状态（localStorage 持久化，两个窗口通过 storage 事件联动） */
function useLock() {
  const [locked, setLocked] = useState(() => localStorage.getItem('sticky-float-locked') === '1')
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'sticky-float-locked') setLocked(e.newValue === '1')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  const toggle = () => {
    const v = !locked
    localStorage.setItem('sticky-float-locked', v ? '1' : '0')
    setLocked(v)
  }
  return { locked, toggle }
}

function dayLabel(ts: number) {
  const d = new Date(ts)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day = new Date(d); day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff < 7) return `${week} ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const dragStyle = { WebkitAppRegion: 'drag' } as any
const noDrag = { WebkitAppRegion: 'no-drag' } as any

/** 壁纸亮度：亮壁纸时加深面板保证白字清晰（Electron 注入，非浮窗环境恒为深色） */
function useWallpaperLight() {
  const [light, setLight] = useState(false)
  useEffect(() => {
    const api = (window as any).floatBg
    if (api?.onBrightness) api.onBrightness((v: string) => setLight(v === 'light'))
  }, [])
  return light
}

function usePanelCls() {
  const light = useWallpaperLight()
  return light
    ? 'bg-black/60 backdrop-blur-[2px] rounded-xl'
    : 'bg-black/30 backdrop-blur-[2px] rounded-xl'
}

function WinBar({ title }: { title: string }) {
  const { locked, toggle } = useLock()
  const [, setV] = useState(0)
  useEffect(() => store.subscribe(() => setV(v => v + 1)), [])
  return (
    <div className={`h-7 shrink-0 flex items-center justify-between px-3 ${locked ? '' : 'cursor-move'}`}
      style={locked ? noDrag : dragStyle}>
      <span className="text-[11px] font-bold tracking-widest text-white/70">{title}</span>
      <span className="flex items-center gap-1" style={noDrag}>
        <button className="text-white/50 hover:text-white px-1" title="手动同步"
          onClick={() => store.refresh()}>
          <RefreshCw className={`w-3.5 h-3.5 ${store.status === 'connecting' ? 'animate-spin' : ''}`} />
        </button>
        <button className="text-white/50 hover:text-white px-1" onClick={toggle}
          title={locked ? '解锁面板' : '锁定面板（防误关）'}>
          {locked ? <Lock className="w-3.5 h-3.5 text-amber-300" /> : <LockOpen className="w-3.5 h-3.5" />}
        </button>
        {!locked && (
          <button className="text-white/50 hover:text-white px-1"
            onClick={() => window.close()} title="隐藏（Ctrl+Alt+G 唤回）">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </span>
    </div>
  )
}

/** 随笔浮窗 */
function NotesPanel() {
  useStore()
  const panelCls = usePanelCls()
  const [editNote, setEditNote] = useState<Note | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const notes = store.sortedNotes

  const openEdit = (n: Note | 'new') => {
    setEditNote(n)
    setTitle(n === 'new' ? '' : n.title)
    setContent(n === 'new' ? '' : n.content)
  }
  const save = () => {
    if (editNote === 'new') {
      if (title.trim() || content.trim())
        store.addNote(title.trim() || content.split('\n')[0].slice(0, 20) || '无标题', content.trim())
    } else if (editNote) {
      store.updateNote(editNote.id, { title: title.trim() || '无标题', content: content.trim() })
    }
    setEditNote(null)
  }

  return (
    <div className={`w-full h-screen text-white select-none flex flex-col overflow-hidden ${panelCls}`}
      style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)' }}>
      <WinBar title="STICKY NOTES · 随笔" />
      <div className="flex items-center justify-between px-4 pt-1 pb-2">
        <h2 className="text-2xl font-extrabold">随笔</h2>
        <button onClick={() => openEdit('new')} className="p-1 hover:bg-white/15 rounded" title="写随笔" style={noDrag}>
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {notes.length === 0 && <div className="text-sm text-white/60">暂无随笔，点右上角 ＋ 添加</div>}
        {notes.map(n => (
          <div key={n.id} className="cursor-pointer group" onClick={() => openEdit(n)}>
            <div className="flex items-center gap-1.5">
              {n.pinned && <Pin className="w-3 h-3 text-amber-300" />}
              <span className="font-bold text-[15px] flex-1 truncate">{n.title || '无标题'}</span>
              <span className="hidden group-hover:flex items-center gap-1" style={noDrag}>
                <button className="p-0.5 hover:bg-white/15 rounded" title={n.pinned ? '取消置顶' : '置顶'}
                  onClick={e => { e.stopPropagation(); store.updateNote(n.id, { pinned: !n.pinned }) }}>
                  {n.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button className="p-0.5 hover:bg-white/15 rounded hover:text-red-300" title="删除"
                  onClick={e => { e.stopPropagation(); store.removeNote(n.id) }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
            {n.content && <div className="text-[13px] text-white/85 leading-snug whitespace-pre-line line-clamp-3">{n.content}</div>}
            <div className="text-[11px] text-white/50 mt-0.5">
              {new Date(n.updated_at).toLocaleString('zh-CN', { hour12: false })}
            </div>
          </div>
        ))}
      </div>
      {editNote && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col p-4 z-10 rounded-xl">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="标题"
            className="bg-white/10 rounded px-2 py-1.5 mb-2 font-bold outline-none border border-white/20" />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="内容…（密码、地址、账号等）" autoFocus
            className="flex-1 bg-white/10 rounded px-2 py-1.5 outline-none border border-white/20 text-sm leading-relaxed resize-none" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => setEditNote(null)} className="flex-1 bg-white/15 rounded py-1.5 text-sm hover:bg-white/25">取消</button>
            <button onClick={save} className="flex-1 bg-white/85 text-black rounded py-1.5 text-sm font-medium hover:bg-white">保存</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** 待办浮窗（Todo / Done 双页） */
function TodosPanel() {
  useStore()
  const panelCls = usePanelCls()
  const [page, setPage] = useState<'todo' | 'done'>('todo')
  const [quickAdd, setQuickAdd] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const active = store.sorted.filter(t => !t.done)
  const doneList = [...store.todos].filter(t => t.done)
    .sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
  const groups = new Map<string, Todo[]>()
  for (const t of doneList) {
    const l = dayLabel(t.completed_at || t.created_at)
    if (!groups.has(l)) groups.set(l, [])
    groups.get(l)!.push(t)
  }

  const submitQuick = () => {
    if (quickAdd.trim()) { store.add(quickAdd.trim()); setQuickAdd('') }
  }

  return (
    <div className={`w-full h-screen text-white select-none flex flex-col overflow-hidden ${panelCls}`}
      style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)' }}>
      <WinBar title="STICKY NOTES · TODO" />
      <div className="flex items-center justify-between px-4 pt-1 pb-2">
        <div className="flex items-baseline gap-3">
          <button onClick={() => setPage('todo')}
            className={`text-2xl font-extrabold transition ${page === 'todo' ? '' : 'text-white/35 hover:text-white/60'}`}>Todo</button>
          <button onClick={() => setPage('done')}
            className={`text-2xl font-extrabold transition ${page === 'done' ? '' : 'text-white/35 hover:text-white/60'}`}>Done</button>
        </div>
        {page === 'todo' && (
          <button onClick={() => setShowAdd(v => !v)} className="p-1 hover:bg-white/15 rounded" title="快速添加" style={noDrag}>
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col" style={{ scrollbarWidth: 'thin' }}>
        {page === 'todo' ? (
          <>
            <div className="space-y-1.5">
              {active.length === 0 && !showAdd && <div className="text-sm text-white/60">暂无待办，点击下方空白处记录第一条 ✨</div>}
              {active.map(t => (
                <div key={t.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => store.update(t.id, { done: true })}
                    title="完成"
                    className="w-2.5 h-2.5 rounded-full bg-white/60 hover:bg-emerald-400 shrink-0 transition-colors"
                  />
                  {editing === t.id ? (
                    <input autoFocus value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onBlur={() => { if (editText.trim()) store.update(t.id, { text: editText.trim() }); setEditing(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }}
                      className="flex-1 bg-white/10 rounded px-1.5 py-0.5 text-[15px] outline-none border border-white/30" />
                  ) : (
                    <span className={`flex-1 text-[15px] cursor-text ${t.pinned ? 'font-bold' : ''}`}
                      title="点击编辑"
                      onClick={() => { setEditing(t.id); setEditText(t.text) }}>{t.text}</span>
                  )}
                  <span className="hidden group-hover:flex items-center gap-0.5 shrink-0" style={noDrag}>
                    <button className="p-1 rounded-full bg-emerald-500/90 hover:bg-emerald-400" title="完成"
                      onClick={() => store.update(t.id, { done: true })}>
                      <Check className="w-3 h-3" />
                    </button>
                    <button className="p-1 rounded-full bg-amber-500/90 hover:bg-amber-400" title={t.pinned ? '取消置顶' : '置顶'}
                      onClick={() => store.update(t.id, { pinned: !t.pinned })}>
                      {t.pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    </button>
                    <button className="p-1 rounded-full bg-red-500/90 hover:bg-red-400" title="删除"
                      onClick={() => store.remove(t.id)}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
            {/* 底部输入框（追加在列表末尾） */}
            {showAdd && (
              <input autoFocus value={quickAdd} onChange={e => setQuickAdd(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitQuick(); if (e.key === 'Escape') setShowAdd(false) }}
                onBlur={() => { submitQuick(); setShowAdd(false) }}
                placeholder="输入后回车保存…"
                className="mt-1.5 w-full bg-black/40 rounded px-2 py-1.5 text-sm outline-none placeholder-white/50 border border-white/20" />
            )}
            {/* 空白区域：点击即新建 */}
            <div className="flex-1 min-h-[60px] cursor-text" title="点击空白处新建待办"
              onClick={() => setShowAdd(true)} />
          </>
        ) : (
          <div className="space-y-3">
            {doneList.length === 0 && <div className="text-sm text-white/60">还没有已完成的事项</div>}
            {[...groups.entries()].map(([label, items]) => (
              <div key={label}>
                <div className="text-[13px] font-bold text-white/60 mb-1">{label}</div>
                <div className="space-y-1.5">
                  {items.map(t => (
                    <div key={t.id} className="flex items-center gap-2 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                      <span className="flex-1 text-[15px] text-white/80">{t.text}</span>
                      <span className="hidden group-hover:flex items-center gap-1 shrink-0" style={noDrag}>
                        <button className="p-1 rounded-full bg-sky-500/90 hover:bg-sky-400" title="回退到待办"
                          onClick={() => store.update(t.id, { done: false })}>
                          <Undo2 className="w-3 h-3" />
                        </button>
                        <button className="p-1 rounded-full bg-red-500/90 hover:bg-red-400" title="彻底删除"
                          onClick={() => store.remove(t.id)}>
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** 透明桌面浮窗视图（按 ?view= 区分两个独立窗口） */
export default function DesktopFloat() {
  const view = new URLSearchParams(window.location.hash.split('?')[1] || '').get('view') || 'todo'
  const [, setV] = useState(0)

  useEffect(() => {
    const un = store.subscribe(() => setV(v => v + 1))
    store.init()
    document.documentElement.classList.add('desktop-float')
    document.body.classList.add('desktop-float')
    return () => {
      un()
      document.documentElement.classList.remove('desktop-float')
      document.body.classList.remove('desktop-float')
    }
  }, [])

  // 未登录：显示登录页
  if (store.status === 'need-auth') return <LoginScreen />

  return view === 'notes' ? <NotesPanel /> : <TodosPanel />
}
