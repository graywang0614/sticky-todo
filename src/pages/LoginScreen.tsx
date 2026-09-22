import { useState } from 'react'
import { store } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tip, setTip] = useState('')

  const submit = async () => {
    if (!email.trim() || !password) { setError('请填写邮箱和密码'); return }
    if (password.length < 6) { setError('密码至少 6 位'); return }
    setBusy(true); setError(''); setTip('')
    const err = mode === 'login'
      ? await store.signIn(email.trim(), password)
      : await store.signUp(email.trim(), password)
    setBusy(false)
    if (err) {
      setError(err)
      if (mode === 'register' && err.includes('confirm')) setTip('注册成功，请先到邮箱点确认链接再登录')
    } else if (mode === 'register' && store.status === 'need-auth') {
      setTip('注册成功！如需邮箱验证，请查收邮件后登录')
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#f7e98e] bg-[radial-gradient(circle_at_30%_20%,#faf0ae,#f3e27f)] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📒</div>
          <h1 className="text-2xl font-extrabold text-stone-700">Sticky Notes</h1>
          <p className="text-sm text-stone-500 mt-1">随手记，随处见</p>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-6 space-y-4">
          <div className="flex bg-stone-100 rounded-lg p-1">
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); setTip('') }}
                className={`flex-1 py-1.5 rounded-md text-sm transition ${mode === m ? 'bg-amber-500 text-white font-medium shadow-sm' : 'text-stone-500'}`}>
                {m === 'login' ? '登录' : '注册'}
              </button>
            ))}
          </div>
          <Input type="email" placeholder="邮箱" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="bg-stone-50" />
          <Input type="password" placeholder="密码（至少 6 位）" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className="bg-stone-50" />
          {error && <div className="text-sm text-red-500">{error}</div>}
          {tip && <div className="text-sm text-emerald-600">{tip}</div>}
          <Button onClick={submit} disabled={busy}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white">
            {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
          </Button>
          <p className="text-xs text-stone-400 text-center">你的数据仅自己可见，云端加密存储</p>
        </div>
      </div>
    </div>
  )
}
