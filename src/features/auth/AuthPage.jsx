import { useState } from 'react'

function AuthPage({ auth }) {
  const [mode, setMode] = useState('sign-in')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isSignUp = mode === 'sign-up'
  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setNotice('')
    setSubmitting(true)
    const result = isSignUp
      ? await auth.signUp({ displayName: displayName.trim(), email: email.trim(), password })
      : await auth.signIn({ email: email.trim(), password })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.needsEmailConfirmation) {
      setNotice('가입 확인 메일을 보냈어요. 이메일 확인 후 로그인해 주세요.')
      setMode('sign-in')
      setPassword('')
    }
  }

  const switchMode = () => {
    setMode((current) => current === 'sign-in' ? 'sign-up' : 'sign-in')
    setError('')
    setNotice('')
  }

  if (!auth.isConfigured) return <section className="auth-page"><div className="auth-brand-mark" aria-hidden="true">ㄷ</div><p className="eyebrow">SUPABASE SETUP</p><h1>득근이 설정이 필요해요</h1><p className="auth-description">`.env.local`에 Supabase 환경변수를 설정한 뒤 개발 서버를 다시 시작해 주세요.</p><div className="auth-help"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code></div></section>

  if (auth.profileError && auth.user) return <section className="auth-page"><div className="auth-brand-mark" aria-hidden="true">ㄷ</div><p className="eyebrow">PROFILE CHECK</p><h1>프로필을 확인할 수 없어요</h1><p className="auth-description">{auth.profileError}</p><button className="auth-submit" type="button" onClick={auth.signOut}>로그아웃</button></section>

  return <section className="auth-page" aria-labelledby="auth-title">
    <div className="auth-brand-mark" aria-hidden="true">ㄷ</div>
    <p className="eyebrow">WORK OUT TOGETHER</p>
    <h1 id="auth-title">득근이<span className="brand-sparkle" aria-hidden="true">✦</span></h1>
    <p className="auth-description">친구들과 함께 운동 기록을 시작해요.</p>
    <div className="auth-card">
      <div className="auth-heading"><p className="section-kicker">{isSignUp ? 'JOIN DEUKGEUNI' : 'WELCOME BACK'}</p><h2>{isSignUp ? '새 계정 만들기' : '로그인'}</h2></div>
      <form noValidate onSubmit={submit}>
        {isSignUp && <label className="auth-field"><span>표시 이름</span><input autoComplete="name" maxLength="30" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>}
        <label className="auth-field"><span>이메일</span><input autoComplete="email" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="auth-field"><span>비밀번호</span><input autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength="6" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {(error || auth.error) && <p className="auth-error" role="alert">{error || auth.error}</p>}
        {notice && <p className="auth-notice" role="status">{notice}</p>}
        <button className="auth-submit" disabled={submitting} type="submit">{submitting ? '처리 중…' : isSignUp ? '회원가입' : '로그인'}</button>
      </form>
      <button className="auth-switch" type="button" onClick={switchMode}>{isSignUp ? '이미 계정이 있나요? 로그인' : '처음 오셨나요? 회원가입'}</button>
    </div>
  </section>
}

export default AuthPage
