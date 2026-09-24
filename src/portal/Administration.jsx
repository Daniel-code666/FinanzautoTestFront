import React, { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth';
import { Search } from './Catalog';
import { isBaseRole, isUserEmployee, USER_ROLE_ID } from './policies';
import { Badge, Confirm, Control, Dialog, FormActions, LoadState, Notice, PageHeading, Pagination, useResource } from './shared';

export function Users() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('true');
  const [editor, setEditor] = useState(null);
  const [target, setTarget] = useState(null);
  const [passwordUser, setPasswordUser] = useState(null);
  const [message, setMessage] = useState('');
  const resource = useResource('/UserAdministration/Users', { page, pageSize, search, active, roleId: USER_ROLE_ID });
  const userRole = useResource(`/UserAdministration/Roles/${USER_ROLE_ID}`);
  const roleAvailable = userRole.data?.active && userRole.data?.name === 'User';
  return <><PageHeading eyebrow="ADMINISTRACIÓN" title="Usuarios" description="Gestiona las cuentas de empleados con rol User."><button className="btn" disabled={!roleAvailable} onClick={() => setEditor({})}>+ Nuevo usuario</button></PageHeading><Notice success={message}/>{userRole.error && <Notice error={userRole.error}/>}<section className="panel"><div className="list-toolbar"><Search onSearch={value => { setSearch(value); setPage(1); }}/><Control label="Estado" value={active} onChange={event => { setActive(event.target.value); setPage(1); }}><option value="true">Activos</option><option value="false">Inactivos</option><option value="">Todos</option></Control></div><LoadState resource={resource} empty={!resource.data?.items.length}><div className="table-scroll"><table><thead><tr><th>Empleado</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{resource.data?.items.filter(isUserEmployee).map(user => <tr key={user.id}><td><strong>{user.firstName} {user.lastName}</strong><small>#{user.id}</small></td><td>{user.email}</td><td>{user.roleName}</td><td><Badge active={user.active}/></td><td><div className="row-actions"><button className="text-button" onClick={() => setEditor(user)}>Editar</button><button className="text-button" onClick={() => setPasswordUser(user)}>Contraseña</button><button className={`text-button ${user.active ? 'destructive' : ''}`} onClick={() => setTarget(user)}>{user.active ? 'Desactivar' : 'Reactivar'}</button></div></td></tr>)}</tbody></table></div></LoadState>{resource.data && <Pagination {...{ page, setPage, pageSize, setPageSize }} data={resource.data}/>}</section>{editor && <UserEditor user={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setMessage('Usuario guardado.'); resource.reload(); }}/>} {passwordUser && <PasswordEditor user={passwordUser} onClose={() => setPasswordUser(null)} onSaved={() => { setPasswordUser(null); setMessage('Contraseña restablecida.'); }}/>} {target && <Confirm title={target.active ? 'Desactivar usuario' : 'Reactivar usuario'} message={`¿${target.active ? 'Desactivar' : 'Reactivar'} la cuenta de ${target.firstName} ${target.lastName}? ${target.active ? 'Dejará de tener acceso al portal.' : 'Podrá iniciar sesión nuevamente.'}`} onClose={() => setTarget(null)} onConfirm={async () => { if (target.active) await api.delete(`/UserAdministration/Users/${target.id}`); else await api.post(`/UserAdministration/Users/${target.id}/Reactivate`); resource.reload(); setMessage('Estado del usuario actualizado.'); }}/>}</>;
}
function UserEditor({ user, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.firstName.trim() || !data.lastName.trim()) { setError('Ingresa los nombres y apellidos.'); return; }
    if (!user.id && data.password !== data.confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try {
      if (user.id) { const current = await api.get(`/UserAdministration/Users/${user.id}`); if (!isUserEmployee(current.data)) throw new Error('Esta cuenta ya no tiene rol User. Actualiza el listado.'); }
      const payload = { firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim(), roleId: USER_ROLE_ID, ...(!user.id ? { password: data.password } : {}) };
      if (user.id) await api.put(`/UserAdministration/Users/${user.id}`, payload); else await api.post('/UserAdministration/Users', payload);
      onSaved();
    } catch (err) { setError(err.isAxiosError ? errorMessage(err) : err.message); } finally { setBusy(false); }
  }
  return <Dialog title={user.id ? 'Editar usuario' : 'Nuevo usuario'} onClose={onClose} busy={busy}><form onSubmit={submit}><Notice error={error}/><fieldset disabled={busy}><div className="form-grid"><Control label="Nombres" name="firstName" defaultValue={user.firstName} required maxLength={100}/><Control label="Apellidos" name="lastName" defaultValue={user.lastName} required maxLength={100}/></div><Control label="Correo electrónico" name="email" type="email" defaultValue={user.email} required maxLength={254}/><Control label="Rol" value="User" readOnly/>{!user.id && <><Control label="Contraseña inicial" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required hint="Entre 12 y 128 caracteres."/><Control label="Confirmar contraseña" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></>}<FormActions busy={busy} onCancel={onClose}/></fieldset></form></Dialog>;
}
export function PasswordEditor({ user, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try { await api.put('/UserAdministration/Users/ResetPassword', { email: user.email.trim().toUpperCase(), password: data.password }, { params: { id: user.id } }); onSaved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <Dialog title="Cambiar contraseña" onClose={onClose} busy={busy}><p>{user.email}</p><form onSubmit={submit}><Notice error={error}/><fieldset disabled={busy}><Control label="Nueva contraseña" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint="Entre 12 y 128 caracteres."/><Control label="Confirmar contraseña" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/><FormActions busy={busy} onCancel={onClose} label="Cambiar contraseña"/></fieldset></form></Dialog>;
}

export function Roles() {
  const { session, logout } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('true');
  const [editor, setEditor] = useState(null);
  const [target, setTarget] = useState(null);
  const [message, setMessage] = useState('');
  const resource = useResource('/UserAdministration/Roles', { page, pageSize, search, active });
  return <><PageHeading eyebrow="ADMINISTRACIÓN" title="Roles" description="Administra los roles del portal. Admin y User son roles base."><button className="btn" onClick={() => setEditor({})}>+ Nuevo rol</button></PageHeading><Notice success={message}/><section className="panel"><div className="list-toolbar"><Search onSearch={value => { setSearch(value); setPage(1); }}/><Control label="Estado" value={active} onChange={event => { setActive(event.target.value); setPage(1); }}><option value="true">Activos</option><option value="false">Inactivos</option><option value="">Todos</option></Control></div><LoadState resource={resource} empty={!resource.data?.items.length}><div className="table-scroll"><table><thead><tr><th>Rol</th><th>Estado</th><th>Alcance</th><th>Acciones</th></tr></thead><tbody>{resource.data?.items.map(role => <tr key={role.id}><td><strong>{role.name}</strong><small>#{role.id}</small></td><td><Badge active={role.active}/></td><td>{role.name === 'Admin' ? 'Catálogo y administración' : 'Catálogo y mi perfil'}</td><td>{isBaseRole(role) ? <span className="subtle-note">Rol base protegido</span> : <div className="row-actions"><button className="text-button" onClick={() => setEditor(role)}>Editar</button><button className="text-button" onClick={() => setTarget(role)}>{role.active ? 'Desactivar' : 'Reactivar'}</button></div>}</td></tr>)}</tbody></table></div></LoadState>{resource.data && <Pagination {...{ page, setPage, pageSize, setPageSize }} data={resource.data}/>}</section><p className="subtle-note">Los roles personalizados comparten las funciones del catálogo. Solo Admin puede entrar a administración.</p>{editor && <RoleEditor role={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.reload(); setMessage('Rol guardado.'); }}/>} {target && <Confirm title={target.active ? 'Desactivar rol' : 'Reactivar rol'} message={`¿${target.active ? 'Desactivar' : 'Reactivar'} “${target.name}”? El estado del rol afecta el acceso de sus usuarios.`} onClose={() => setTarget(null)} onConfirm={async () => { if (target.active) await api.delete(`/UserAdministration/Roles/${target.id}`); else await api.post(`/UserAdministration/Roles/${target.id}/Reactivate`); if (target.id === session.user.roleId) logout(); else { resource.reload(); setMessage('Estado del rol actualizado.'); } }}/>}</>;
}
function RoleEditor({ role, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) { event.preventDefault(); if (busy) return; const name = new FormData(event.currentTarget).get('name').trim(); if (!name) { setError('Ingresa el nombre del rol.'); return; } setBusy(true); setError(''); try { if (role.id) await api.put(`/UserAdministration/Roles/${role.id}`, { name }); else await api.post('/UserAdministration/Roles', { name }); onSaved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }
  return <Dialog title={role.id ? 'Editar rol' : 'Nuevo rol'} busy={busy} onClose={onClose}><form onSubmit={submit}><Notice error={error}/><fieldset disabled={busy}><Control name="name" label="Nombre del rol" required maxLength={50} defaultValue={role.name}/><FormActions busy={busy} onCancel={onClose}/></fieldset></form></Dialog>;
}
