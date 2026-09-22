import { useEffect, useRef, useState } from 'react'
import { store, loadCfg } from '@/lib/store'
import type { Todo } from '@/lib/store'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pin, PinOff, Trash2, Settings, GripVertical, ChevronDown, ChevronRight, Cloud, CloudOff, Cloudy } from 'lucide-react'

function useStore() {
  const [, setV] = useState(0)
  useEffect(() => store.subscribe(() => setV(v => v + 1)), [])
  return { todos: store.todos, status: store.status }
}

function dayLabel(ts: number) {
  const d = new Date(ts)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const day = new Date(d); day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function Home() {
  const snap = useStore()
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [cfgUrl, setCfgUrl] = useState('')
  const [cfgKey, setCfgKey] = useState('')
  const dragId = useRef<string | null>(null)

  useEffect(() => { store.init() }, [])

  const active = store.sorted.filter(t => !t.done)
  const done = store.sorted.filter(t => t.done)
  const archive = new Map<string, Todo[]>()
  for (const t of done) {
    const label = dayLabel(t.completed_at || t.created_at)
    if (!archive.has(label)) archive.set(label, [])
    archive.get(label)!.push(t)
  }

  const submit = () => {
    if (text.trim()) { store.add(text.trim()); setText('') }
  }

  const statusIcon = snap.status === 'online'
    ? <Cloud className="w-4 h-4 text-emerald-600" />
    : snap.status === 'connecting'
      ? <Cloudy className="w-4 h-4 text-amber-500 animate-pulse" />
      : snap.status === 'error'
        ? <CloudOff className="w-4 h-4 text-red-500" />
        : <CloudOff className="w-4 h-4 text-stone-400" />
  const statusText = { online: '云同步已连接', connecting: '连接中…', error: '同步连接失败', local: '本地模式' }[snap.status]

  return (
    <div className="min-h-screen w-full bg-[#f7e98e] bg-[radial-gradient(circle_at_30%_20%,#faf0ae,#f3e27f)] text-stone-800 flex justify-center selection:bg-amber-200">
      <div className="w-full max-w-md px-4 py-6 flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold tracking-wide text-stone-700 drop-shadow-sm">📌 小黄条</h1>
          <div className="flex items-center gap-2">
            <span title={statusText} className="flex items-center gap-1 text-xs text-stone-500">
              {statusIcon}{statusText}
            </span>
            <button
              className="p-1.5 rounded-full hover:bg-black/5 transition"
              onClick={() => {
                const c = loadCfg()
                setCfgUrl(c?.url || ''); setCfgKey(c?.key || '')
                setShowSettings(true)
              }}
            ><Settings className="w-4 h-4 text-stone-500" /></button>
          </div>
        </div>

        {/* 输入框 */}
        <div className="flex gap-2 mb-4">
          <Input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="随手记一条，回车保存…"
            className="bg-white/70 border-amber-200 focus-visible:ring-amber-300 shadow-sm"
          />
          <Button onClick={submit} className="bg-amber-500 hover:bg-amber-600 text-white shadow-sm shrink-0">记下</Button>
        </div>

        {/* 待办列表 */}
        <div className="space-y-2">
          {active.length === 0 && (
            <div className="text-center text-stone-400 text-sm py-10">暂无待办，享受当下 ✨</div>
          )}
          {active.map(t => (
            <div
              key={t.id}
              draggable
              onDragStart={() => { dragId.current = t.id }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragId.current && dragId.current !== t.id) store.reorder(dragId.current, t.id); dragId.current = null }}
              className="group flex items-center gap-2 bg-white/80 backdrop-blur rounded-lg px-3 py-2.5 shadow-sm border border-amber-100 hover:shadow transition"
            >
              <GripVertical className="w-4 h-4 text-stone-300 cursor-grab shrink-0" />
              <Checkbox
                checked={t.done}
                onCheckedChange={() => store.update(t.id, { done: true })}
                className="border-amber-400 data-[state=checked]:bg-amber-500"
              />
              {editing === t.id ? (
                <input
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onBlur={() => { if (editText.trim()) store.update(t.id, { text: editText.trim() }); setEditing(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(null) }}
                  className="flex-1 bg-transparent outline-none border-b border-amber-300 text-[15px]"
                />
              ) : (
                <span
                  className={`flex-1 text-[15px] cursor-text ${t.pinned ? 'font-semibold' : ''}`}
                  onClick={() => { setEditing(t.id); setEditText(t.text) }}
                >{t.text}</span>
              )}
              <button
                className="opacity-0 group-hover:opacity-100 transition p-1"
                title={t.pinned ? '取消置顶' : '置顶'}
                onClick={() => store.update(t.id, { pinned: !t.pinned })}
              >{t.pinned ? <PinOff className="w-4 h-4 text-amber-600" /> : <Pin className="w-4 h-4 text-stone-400" />}</button>
              <button
                className="opacity-0 group-hover:opacity-100 transition p-1"
                title="删除"
                onClick={() => store.remove(t.id)}
              ><Trash2 className="w-4 h-4 text-stone-400 hover:text-red-500" /></button>
            </div>
          ))}
        </div>

        {/* 归档回顾 */}
        {done.length > 0 && (
          <div className="mt-6">
            <button
              className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700 transition"
              onClick={() => setShowArchive(v => !v)}
            >
              {showArchive ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              回顾 · 已完成 {done.length} 项
            </button>
            {showArchive && (
              <div className="mt-2 space-y-3">
                {[...archive.entries()].map(([label, items]) => (
                  <div key={label}>
                    <div className="text-xs font-medium text-stone-400 mb-1">{label}</div>
                    <div className="space-y-1">
                      {items.map(t => (
                        <div key={t.id} className="group flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/40">
                          <Checkbox
                            checked
                            onCheckedChange={() => store.update(t.id, { done: false })}
                            className="border-stone-300 data-[state=checked]:bg-stone-400"
                          />
                          <span className="flex-1 text-sm line-through text-stone-400">{t.text}</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 transition p-1"
                            onClick={() => store.remove(t.id)}
                          ><Trash2 className="w-3.5 h-3.5 text-stone-300 hover:text-red-500" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 设置弹窗 */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="bg-[#fdf6d8]">
            <DialogHeader><DialogTitle>云同步设置（Supabase）</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-stone-500">填入你的 Supabase 项目 URL 和 anon key，两端即可实时同步。留空则为纯本地模式。</p>
              <Input placeholder="https://xxxx.supabase.co" value={cfgUrl} onChange={e => setCfgUrl(e.target.value)} />
              <Input placeholder="anon public key" value={cfgKey} onChange={e => setCfgKey(e.target.value)} type="password" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { store.disconnect(); setShowSettings(false) }}>断开同步</Button>
                <Button className="bg-amber-500 hover:bg-amber-600" onClick={() => {
                  if (cfgUrl.trim() && cfgKey.trim()) {
                    store.reconnect({ url: cfgUrl.trim(), key: cfgKey.trim() })
                    setShowSettings(false)
                  }
                }}>连接</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
