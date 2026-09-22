import { useEffect, useState } from 'react'
import { store } from '@/lib/store'
import type { Note } from '@/lib/store'
import { Checkbox } from '@/components/ui/checkbox'
import { Pin, Plus, X } from 'lucide-react'

function useStore() {
  const [, setV] = useState(0)
  useEffect(() => store.subscribe(() => setV(v => v + 1)), [])
  return { todos: store.todos, notes: store.notes }
}

/**
 * 透明桌面浮窗视图（Windows Electron 专用）
 * 配合 frameless + transparent 窗口，文字直接浮在壁纸上
 */
export default function DesktopFloat() {
  useStore()
  const [quickAdd, setQuickAdd] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editNote, setEditNote] = useState<Note | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')

  useEffect(() => {
    store.init()
    document.documentElement.classList.add('desktop-float')
    document.body.classList.add('desktop-float')
    return () => {
      document.documentElement.classList.remove('desktop-float')
      document.body.classList.remove('desktop-float')
    }
  }, [])

  const activeTodos = store.sorted.filter(t => !t.done)
  const notes = store.sortedNotes

  const submitQuick = () => {
    if (quickAdd.trim()) { store.add(quickAdd.trim()); setQuickAdd('') }
  }

  const closeNoteEditor = () => {
    if (editNote) store.updateNote(editNote.id, { title: noteTitle.trim() || '无标题', content: noteContent.trim() })
    setEditNote(null)
  }

  return (
    <div className="w-full h-screen text-white select-none flex flex-col overflow-hidden"
      style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.7)' }}>
      {/* 拖拽区（顶部） */}
      <div className="h-8 shrink-0 flex items-center justify-between px-3"
        style={{ WebkitAppRegion: 'drag' } as any}>
        <span className="text-xs font-bold tracking-widest opacity-80">GRAY NOTE</span>
        <button
          className="text-white/60 hover:text-white px-1"
          style={{ WebkitAppRegion: 'no-drag' } as any}
          onClick={() => window.close()}
          title="隐藏（Ctrl+Alt+G 唤回）"
        ><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-5" style={{ scrollbarWidth: 'thin' }}>
        {/* 随笔区 */}
        <section>
          <h2 className="text-2xl font-extrabold mb-2">随笔</h2>
          <div className="space-y-3">
            {notes.length === 0 && <div className="text-sm text-white/60">暂无随笔</div>}
            {notes.map(n => (
              <div key={n.id} className="cursor-pointer group"
                onClick={() => { setEditNote(n); setNoteTitle(n.title); setNoteContent(n.content) }}>
                <div className="flex items-center gap-1.5">
                  {n.pinned && <Pin className="w-3 h-3" />}
                  <span className="font-bold text-[15px]">{n.title || '无标题'}</span>
                </div>
                {n.content && (
                  <div className="text-[13px] text-white/85 leading-snug whitespace-pre-line line-clamp-3">{n.content}</div>
                )}
                <div className="text-[11px] text-white/50 mt-0.5">
                  {new Date(n.updated_at).toLocaleString('zh-CN', { hour12: false })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Todo 区 */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-extrabold">Todo</h2>
            <button onClick={() => setShowAdd(v => !v)} className="p-1 hover:bg-white/10 rounded" title="快速添加">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          {showAdd && (
            <input
              autoFocus
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitQuick(); if (e.key === 'Escape') setShowAdd(false) }}
              onBlur={() => { submitQuick(); setShowAdd(false) }}
              placeholder="回车快速添加待办…"
              className="w-full mb-2 bg-black/30 rounded px-2 py-1.5 text-sm outline-none placeholder-white/50 border border-white/20"
            />
          )}
          <div className="space-y-1.5">
            {activeTodos.length === 0 && <div className="text-sm text-white/60">暂无待办 ✨</div>}
            {activeTodos.map(t => (
              <div key={t.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => store.update(t.id, { done: true })}
                  className="border-white/70 data-[state=checked]:bg-white/80 data-[state=checked]:text-black"
                />
                <span className={`text-[15px] ${t.pinned ? 'font-bold' : ''}`}>{t.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 随笔编辑浮层 */}
      {editNote && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col p-4 z-10">
          <input
            value={noteTitle}
            onChange={e => setNoteTitle(e.target.value)}
            className="bg-white/10 rounded px-2 py-1.5 mb-2 font-bold outline-none border border-white/20"
            placeholder="标题"
          />
          <textarea
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            className="flex-1 bg-white/10 rounded px-2 py-1.5 outline-none border border-white/20 text-sm leading-relaxed resize-none"
            placeholder="内容…"
            autoFocus
          />
          <button
            onClick={closeNoteEditor}
            className="mt-2 bg-white/85 text-black rounded py-1.5 text-sm font-medium hover:bg-white"
          >保存</button>
        </div>
      )}
    </div>
  )
}
