import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AuthGuard, AuthProvider, useAuth } from './auth';
import { api, errorMessage } from './lib/api';
import './styles.css';
import { portalRoutes } from './portal/routes';
import OperationResult from './components/OperationResult';

function Brand() { return <Link className="brand" to="/login" aria-label="Finanzauto, inicio"><span className="brand-mark">f<span>›</span></span>finanzauto<span className="brand-dot">.</span></Link>; }
function Layout({ children }) {
  return <div className="layout"><aside className="story"><Brand /><div className="story-content"><span className="eyebrow">PORTAL DE GESTIÓN</span><h1>Todo conectado.<br />Todo más <em>simple.</em></h1><p>Un solo lugar para gestionar tus productos<br className="desktop-break" /> y mantener tu operación en movimiento.</p><div className="illustration" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="tile tile-back"><span>▦</span><i/><i/></div><div className="tile tile-front"><div className="tile-icon">◈</div><div className="tile-lines"><i/><i/></div><span className="tile-check">✓</span></div><div className="float-dot">+</div></div><div className="story-caption"><span className="status-dot"/> Tu operación, en un mismo lugar</div></div><footer>FINANZAUTO <span>Conectamos posibilidades.</span></footer></aside><main><div className="mobile-brand"><Brand /></div><div className="form-container">{children}</div><div className="main-footer">Portal de gestión Finanzauto <span>© {new Date().getFullYear()}</span></div></main></div>;
}
function Field({ label, name, type = 'text', hint, ...props }) {
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  return <div className="field"><label htmlFor={name}>{label}</label><div className="input-wrap"><input id={name} name={name} type={password && visible ? 'text' : type} aria-describedby={hint ? `${name}-hint` : undefined} {...props}/>{password && <button className="reveal" type="button" aria-label={`${visible ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar' : 'Mostrar'}</button>}</div>{hint && <small id={`${name}-hint`}>{hint}</small>}</div>;
}
function AuthPage({ register = false }) {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { document.title = `${register ? 'Crear cuenta' : 'Iniciar sesión'} | Finanzauto`; }, [register]);
  if (session) return <Navigate to="/inicio" replace/>;
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (register && data.password !== data.confirmPassword) { setError('Las contraseñas no coinciden. Revisa ambos campos.'); return; }
    if (register && (!data.firstName.trim() || !data.lastName.trim())) { setError('Ingresa tus nombres y apellidos.'); return; }
    setBusy(true);
    try {
      if (register) {
        await api.post('/UserAdministration/Register', { firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim(), password: data.password }, { publicRequest: true });
        navigate('/login', { replace: true, state: { registered: true, email: data.email.trim() } });
      } else {
        const response = await api.post('/Login', { email: data.email.trim(), password: data.password }, { publicRequest: true });
        login(response.data);
        navigate('/inicio', { replace: true });
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <Layout><div className="section-tag"><span/> TU ESPACIO DE TRABAJO</div><h2>{register ? 'Crea tu cuenta' : 'Te damos la bienvenida'}</h2><p className="intro">{register ? 'Completa tus datos para comenzar.' : 'Ingresa tus datos para acceder al portal.'}</p><nav className="auth-tabs" aria-label="Acceso"><Link className={!register ? 'selected' : ''} to="/login" aria-current={!register ? 'page' : undefined}>Iniciar sesión</Link><Link className={register ? 'selected' : ''} to="/registro" aria-current={register ? 'page' : undefined}>Crear cuenta</Link></nav>{!register && location.state?.profileUpdated && <div className="notice success" role="status">Tus cambios se guardaron. Inicia sesión nuevamente.</div>}{!register && location.state?.registered && <div className="notice success" role="status">Tu cuenta fue creada. Ya puedes iniciar sesión.</div>}<form onSubmit={submit} aria-busy={busy}>{error && <div className="notice error" role="alert">{error}</div>}<fieldset disabled={busy}>{register && <div className="field-row"><Field label="Nombres" name="firstName" autoComplete="given-name" maxLength={100} required placeholder="Tus nombres"/><Field label="Apellidos" name="lastName" autoComplete="family-name" maxLength={100} required placeholder="Tus apellidos"/></div>}<Field label="Correo electrónico" name="email" type="email" autoComplete="username" maxLength={254} required placeholder="nombre@ejemplo.com" defaultValue={!register ? location.state?.email || '' : ''}/><Field label="Contraseña" name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 12 : undefined} maxLength={128} required placeholder={register ? 'Crea una contraseña segura' : 'Ingresa tu contraseña'} hint={register ? 'Usa entre 12 y 128 caracteres.' : undefined}/>{register ? <Field label="Confirmar contraseña" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="Repite tu contraseña"/> : <div className="forgot"><Link to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link></div>}<button className="primary" type="submit">{busy ? (register ? 'Creando cuenta…' : 'Ingresando…') : (register ? 'Crear mi cuenta' : 'Iniciar sesión')}<span aria-hidden="true">→</span></button></fieldset></form><p className="switch">{register ? '¿Ya tienes una cuenta?' : '¿Es tu primera vez aquí?'} <Link to={register ? '/login' : '/registro'}>{register ? 'Inicia sesión' : 'Crea tu cuenta'}</Link></p><div className="security-note"><span aria-hidden="true">♧</span> Acceso seguro a tu espacio de trabajo</div></Layout>;
}
function Recovery() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  useEffect(() => { document.title = 'Recuperar acceso | Finanzauto'; }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setError('');
    if (data.password !== data.confirmPassword) {
      setError('Las contraseñas no coinciden. Revisa ambos campos.');
      return;
    }
    const email = data.email.trim().toUpperCase();
    setBusy(true); setError('');
    try {
        await api.put('/UserAdministration/Users/ResetPassword', { email, password: data.password }, { publicRequest: true });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally { setBusy(false); }
  }
  return <Layout>
    <Link className="back" to="/login">← Volver al inicio de sesión</Link>
    <div className="recovery-icon" aria-hidden="true">↺</div>
    <h2>Recupera tu acceso</h2>
    <p className="intro">Ingresa el correo asociado a tu cuenta y la nueva contraseña.</p>
    {sent ? <>
      <div className="notice success" role="status">La contraseña se restableció correctamente. Ya puedes iniciar sesión con tu nueva contraseña.</div>
      <Link className="primary button-link" to="/login">Volver a iniciar sesión <span aria-hidden="true">→</span></Link>
    </> : <form onSubmit={submit} aria-busy={busy}>
      {error && <div className="notice error" role="alert">{error}</div>}
      <fieldset disabled={busy}>
        <Field label="Correo electrónico" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="nombre@ejemplo.com"/>
        <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} placeholder="Crea una contraseña segura" hint="Usa entre 12 y 128 caracteres."/>
        <Field label="Confirmar contraseña" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} placeholder="Repite tu nueva contraseña"/>
        <button className="primary" type="submit">{busy ? 'Restableciendo…' : 'Restablecer contraseña'}<span aria-hidden="true">→</span></button>
      </fieldset>
    </form>}
    <p className="switch">¿Aún no tienes cuenta? <Link to="/registro">Regístrate</Link></p>
  </Layout>;
}
function App() { return <AuthProvider><Routes><Route path="/login" element={<AuthPage key="login"/>}/><Route path="/registro" element={<AuthPage key="register" register/>}/><Route path="/recuperar-contrasena" element={<Recovery/>}/><Route element={<AuthGuard/>}>{portalRoutes}</Route><Route path="*" element={<Navigate to="/login" replace/>}/></Routes></AuthProvider>; }
createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App/><OperationResult/></BrowserRouter></React.StrictMode>);
