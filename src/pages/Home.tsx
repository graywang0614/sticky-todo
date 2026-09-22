import { useEffect, useRef, useState } from 'react'
import { store, loadCfg } from '@/lib/store'
import type { Todo, Note } from '@/lib/store'
import LoginScreen from '@/pages/LoginScreen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Pin, PinOff, Trash2, Settings, GripVertical, ChevronDown, ChevronRight, Cloud, CloudOff, Cloudy, Plus, ArrowLeft, Undo2, UserRound } from 'lucide-react'

function useStore() {
  const [, setV] = useState(0)
  useEffect(() => store.subscribe(() => setV(v => v + 1)), [])
  return { todos: store.todos, notes: store.notes, status: store.status }
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

function timeLabel(ts: number) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Home() {
  const snap = useStore()
  const [tab, setTab] = useState<'todo' | 'note'>('todo')
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [cfgUrl, setCfgUrl] = useState('')
  const [cfgKey, setCfgKey] = useState('')
  // 随笔编辑状态：null=列表，'new'=新建，否则为笔记 id
  const [noteId, setNoteId] = useState<string | null | 'new'>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [armed, setArmed] = useState<{ id: string; dir: 'left' | 'right' } | null>(null)
  const dragId = useRef<string | null>(null)
  const touchTimer = useRef<ReturnType<typeof setTimeout>>(undefined as any)
  // 滑动手势状态
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null)
  const swipeStart = useRef<{ x: number; y: number; id: string } | null>(null)
  const swipeDx = useRef(0)
  const swipeHandled = useRef(false)

  const onTouchStartItem = (t: Todo, e: React.TouchEvent) => {
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, id: t.id }
    touchTimer.current = setTimeout(() => setArmed({ id: t.id, dir: 'left' }), 500)
  }
  const onTouchMoveItem = (t: Todo, e: React.TouchEvent) => {
    const s = swipeStart.current
    if (!s || s.id !== t.id) return
    const dx = e.touches[0].clientX - s.x
    const dy = e.touches[0].clientY - s.y
    if (Math.abs(dy) > Math.abs(dx)) { swipeStart.current = null; swipeDx.current = 0; setSwipe(null); return }
    clearTimeout(touchTimer.current)
    swipeDx.current = dx
    setSwipe({ id: t.id, dx })
  }
  const onTouchEndItem = (t: Todo) => {
    clearTimeout(touchTimer.current)
    const s = swipeStart.current
    const dx = swipeDx.current
    swipeStart.current = null
    swipeDx.current = 0
    if (s && s.id === t.id && Math.abs(dx) > 15) {
      // 标记本次为滑动操作，屏蔽浏览器随后合成的 click
      swipeHandled.current = true
      setTimeout(() => { swipeHandled.current = false }, 400)
      if (armed?.id === t.id) {
        // 已滑开状态：反向回滑只负责收起，不再切到另一侧
        const isReverse = (armed.dir === 'right' && dx < -25) || (armed.dir === 'left' && dx > 25)
        if (isReverse) setArmed(null)
        // 同向继续滑：保持原状态，不做任何事
      } else if (dx > 90) {
        // 右滑：停住，露出完成按钮
        setArmed({ id: t.id, dir: 'right' })
      } else if (dx < -60) {
        // 左滑：停住，露出置顶/删除按钮
        setArmed({ id: t.id, dir: 'left' })
      }
    }
    setSwipe(null)
  }

  useEffect(() => { store.init() }, [])

  // 未登录：显示登录页
  if (snap.status === 'need-auth') {
    return <LoginScreen />
  }

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

  const openNote = (n: Note) => {
    setNoteId(n.id); setNoteTitle(n.title); setNoteContent(n.content)
  }
  const closeNote = () => {
    if (noteId === 'new') {
      if (noteTitle.trim() || noteContent.trim())
        store.addNote(noteTitle.trim() || noteContent.split('\n')[0].slice(0, 20) || '无标题', noteContent.trim())
    } else if (noteId) {
      store.updateNote(noteId, { title: noteTitle.trim() || '无标题', content: noteContent.trim() })
    }
    setNoteId(null)
  }

  const statusIcon = snap.status === 'online'
    ? <Cloud className="w-4 h-4 text-emerald-600" />
    : snap.status === 'connecting'
      ? <Cloudy className="w-4 h-4 text-amber-500 animate-pulse" />
      : snap.status === 'error'
        ? <CloudOff className="w-4 h-4 text-red-500" />
        : <CloudOff className="w-4 h-4 text-stone-400" />
  const statusText = { online: '云同步已连接', connecting: '连接中…', error: '同步连接失败', local: '本地模式' }[snap.status]

  // 随笔编辑页
  if (noteId !== null) {
    return (
      <div className="min-h-screen w-full bg-[#f7e98e] bg-[radial-gradient(circle_at_30%_20%,#faf0ae,#f3e27f)] text-stone-800 flex justify-center">
        <div className="w-full max-w-md px-4 py-6 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={closeNote} className="p-1.5 rounded-full hover:bg-black/5 transition">
              <ArrowLeft className="w-5 h-5 text-stone-600" />
            </button>
            <span className="text-sm text-stone-400">返回自动保存</span>
          </div>
          <Input
            value={noteTitle}
            onChange={e => setNoteTitle(e.target.value)}
            placeholder="标题"
            className="bg-white/70 border-amber-200 mb-3 font-semibold"
          />
          <Textarea
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            placeholder="随手记点长期有用的东西：密码、地址、账号……"
            className="bg-white/70 border-amber-200 flex-1 min-h-[60vh] text-[15px] leading-relaxed"
            autoFocus
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#f7e98e] bg-[radial-gradient(circle_at_30%_20%,#faf0ae,#f3e27f)] text-stone-800 flex justify-center selection:bg-amber-200">
      <div className="w-full max-w-md px-4 py-6 flex flex-col"
        onClick={e => {
          // 点击卡片以外的空白处：收回所有滑开的卡片
          if (armed && !(e.target as HTMLElement).closest('.relative.overflow-hidden.rounded-lg')) setArmed(null)
        }}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-wide text-stone-700 drop-shadow-sm">📒 Sticky Notes</h1>
          <div className="flex items-center gap-2">
            <span title={statusText} className="flex items-center gap-1 text-xs text-stone-500">
              {statusIcon}{statusText}
            </span>
            {snap.status === 'online' && (
              <button
                className="p-1.5 rounded-full hover:bg-black/5 transition"
                title="个人中心"
                onClick={() => setShowAccount(true)}
              ><UserRound className="w-4 h-4 text-stone-500" /></button>
            )}
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

        {/* 标签页 */}
        <div className="flex gap-1 mb-4 bg-white/40 rounded-lg p-1 w-fit">
          {(['todo', 'note'] as const).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-1.5 rounded-md text-sm transition ${tab === k ? 'bg-amber-500 text-white shadow-sm font-medium' : 'text-stone-500 hover:text-stone-700'}`}
            >{k === 'todo' ? '待办' : '随笔'}</button>
          ))}
        </div>

        {tab === 'todo' ? (
          <>
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
              {active.map(t => {
                const dx = swipe?.id === t.id ? swipe.dx : (armed?.id === t.id ? (armed.dir === 'right' ? 92 : -92) : 0)
                return (
                <div key={t.id} className="relative overflow-hidden rounded-lg">
                  {/* 右滑底层：完成按钮（常驻左侧，卡片右滑露出即可点） */}
                  <div className="absolute inset-y-0 left-0 flex items-center pl-2">
                    <button
                      className="px-3 py-1.5 rounded-md bg-emerald-500/95 text-white shadow text-sm font-medium"
                      title="完成"
                      onClick={() => { store.update(t.id, { done: true }); setArmed(null) }}
                    >✓ 完成</button>
                  </div>
                  {/* 左滑底层：置顶 / 删除按钮（常驻右侧） */}
                  <div className="absolute inset-y-0 right-0 flex items-center gap-1.5 pr-2">
                    <button
                      className="p-1.5 rounded-md bg-amber-500/95 text-white shadow"
                      title={t.pinned ? '取消置顶' : '置顶'}
                      onClick={() => { store.update(t.id, { pinned: !t.pinned }); setArmed(null) }}
                    >{t.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}</button>
                    <button
                      className="p-1.5 rounded-md bg-red-500/95 text-white shadow"
                      title="删除"
                      onClick={() => { store.remove(t.id); setArmed(null) }}
                    ><Trash2 className="w-4 h-4" /></button>
                  </div>
                <div
                  draggable
                  onDragStart={() => { dragId.current = t.id }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { if (dragId.current && dragId.current !== t.id) store.reorder(dragId.current, t.id); dragId.current = null }}
                  onTouchStart={e => onTouchStartItem(t, e)}
                  onTouchMove={e => onTouchMoveItem(t, e)}
                  onTouchEnd={() => onTouchEndItem(t)}
                  style={{
                    transform: dx ? `translateX(${Math.min(dx, 140)}px)` : undefined,
                    transition: swipe?.id === t.id ? 'none' : 'transform 0.25s ease',
                    touchAction: 'pan-y',
                  }}
                  className="group relative flex items-center gap-2 bg-white rounded-lg px-3 py-2.5 shadow-sm border border-amber-100 hover:shadow transition sm:hover:-translate-x-[92px]"
                >
                  <GripVertical className="w-4 h-4 text-stone-300 cursor-grab shrink-0 max-sm:hidden" />
                  {/* 圆点（点击即完成，与 Done 页样式一致） */}
                  <button
                    className="w-2.5 h-2.5 rounded-full bg-stone-400/70 hover:bg-emerald-500 shrink-0 transition-colors"
                    title="完成"
                    onClick={() => store.update(t.id, { done: true })}
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
                      className={`flex-1 min-w-0 break-all text-[15px] cursor-text ${t.pinned ? 'font-semibold' : ''}`}
                      onClick={() => {
                        // 滑动后的合成 click 不响应
                        if (swipeHandled.current) { swipeHandled.current = false; return }
                        // 已滑开状态时，点文字先收起而不是进入编辑
                        if (armed?.id === t.id) { setArmed(null); return }
                        setEditing(t.id); setEditText(t.text)
                      }}
                    >{t.text}</span>
                  )}
                </div>
                </div>
                )
              })}
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
                              <button
                                className="p-0.5 text-stone-400 hover:text-sky-600 transition"
                                title="回退到待办"
                                onClick={() => store.update(t.id, { done: false })}
                              ><Undo2 className="w-4 h-4" /></button>
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
          </>
        ) : (
          <>
            {/* 随笔列表 */}
            <Button
              onClick={() => { setNoteId('new'); setNoteTitle(''); setNoteContent('') }}
              className="w-full mb-4 bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
            ><Plus className="w-4 h-4 mr-1" />写一条随笔</Button>
            <div className="space-y-2">
              {store.sortedNotes.length === 0 && (
                <div className="text-center text-stone-400 text-sm py-10">还没有随笔。密码、地址、常用账号…记在这里不会丢 📝</div>
              )}
              {store.sortedNotes.map(n => (
                <div
                  key={n.id}
                  className="group bg-white rounded-lg px-3 py-2.5 shadow-sm border border-amber-100 hover:shadow transition cursor-pointer"
                  onClick={() => openNote(n)}
                >
                  <div className="flex items-center gap-2">
                    {n.pinned === true && <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                    <span className="flex-1 font-medium text-[15px] truncate">{n.title || '无标题'}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition p-1"
                      title={n.pinned ? '取消置顶' : '置顶'}
                      onClick={e => { e.stopPropagation(); store.updateNote(n.id, { pinned: !n.pinned }) }}
                    >{n.pinned ? <PinOff className="w-4 h-4 text-amber-600" /> : <Pin className="w-4 h-4 text-stone-400" />}</button>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition p-1"
                      title="删除"
                      onClick={e => { e.stopPropagation(); store.removeNote(n.id) }}
                    ><Trash2 className="w-4 h-4 text-stone-400 hover:text-red-500" /></button>
                  </div>
                  {n.content && <div className="text-sm text-stone-500 truncate mt-0.5">{n.content}</div>}
                  <div className="text-xs text-stone-400 mt-1">{timeLabel(n.updated_at)}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 个人中心弹窗 */}
        <Dialog open={showAccount} onOpenChange={setShowAccount}>
          <DialogContent className="bg-[#fdf6d8]">
            <DialogHeader><DialogTitle>个人中心</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-white/60 rounded-xl p-4">
                <div className="w-11 h-11 rounded-full bg-amber-500 flex items-center justify-center">
                  <UserRound className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-xs text-stone-400">当前账户</div>
                  <div className="font-medium text-stone-700">{store.userEmail || '未登录'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1"
                  onClick={() => { store.signOut(); setShowAccount(false) }}>
                  切换账户
                </Button>
                <Button variant="outline" className="flex-1 text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => { store.signOut(); setShowAccount(false) }}>
                  退出登录
                </Button>
              </div>
              <p className="text-xs text-stone-400 text-center">退出后回到登录页，云端数据不会丢失</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* 设置弹窗 */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="bg-[#fdf6d8]">
            <DialogHeader><DialogTitle>云同步设置（Supabase）</DialogTitle></DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-stone-500">云端已内置，开箱即用，无需任何设置。高级用户可填入自己的 Supabase 配置覆盖默认值；「断开同步」切换为纯本地模式。</p>
              <Input placeholder="https://xxxx.supabase.co" value={cfgUrl} onChange={e => setCfgUrl(e.target.value)} />
              <Input placeholder="anon public key" value={cfgKey} onChange={e => setCfgKey(e.target.value)} type="password" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { store.signOut(); setShowSettings(false) }}>退出登录</Button>
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
