import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth';
import { api, errorMessage } from '../lib/api';
import { Badge, Control, Dialog, FormActions, LoadState, Notice, PageHeading, useResource } from './shared';

export default function Profile() {
  const { session, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const resource = useResource('/Profile');
  const [password, setPassword] = useState(false);
  const [savedProfile, setSavedProfile] = useState(null);
  function reauthenticate() { logout(); navigate('/login', { replace: true, state: { profileUpdated: true } }); }
  const user = savedProfile || resource.data || session.user;
  function profileSaved(profile) { setSavedProfile(profile); updateProfile(profile); }
  return <>
    <PageHeading eyebrow="MI CUENTA" title="Mi perfil" description="Consulta tus datos personales y gestiona tu acceso."/>
    <LoadState resource={resource}>
      <div className="detail-grid">
        <section className="panel editor-panel">
          <div className="profile-identity">
            <span className="avatar large">{user.firstName?.[0]}{user.lastName?.[0]}</span>
            <div><h2>{user.firstName} {user.lastName}</h2><Badge>{user.roleName}</Badge></div>
          </div>
          <ProfileForm key={`${user.id}:${user.updatedDate || ''}:${user.email}`} user={user} onSaved={profileSaved}/>
        </section>
        <section className="panel detail-card">
          <h2>Seguridad de la cuenta</h2>
          <p>Para cambiar tu contraseña, confirma primero la contraseña actual.</p>
          <button className="btn secondary" onClick={() => setPassword(true)}>Cambiar contraseña</button>
          <p className="subtle-note">Puedes guardar tus datos sin salir de la aplicación. Después de cambiar tu contraseña, volverás a iniciar sesión.</p>
        </section>
      </div>
    </LoadState>
    {password && <ProfilePasswordEditor onClose={() => setPassword(false)} onSaved={reauthenticate}/>}
  </>;
}
const contactFields = [
  ['address', 'Dirección', 300], ['city', 'Ciudad', 100],
  ['region', 'Región', 100], ['postalCode', 'Código postal', 20],
  ['country', 'País', 100], ['homePhone', 'Teléfono', 30],
];

function ProfileForm({ user, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.firstName.trim() || !data.lastName.trim()) { setError('Ingresa tus nombres y apellidos.'); return; }
    if (data.birthDate && data.birthDate > today) { setError('La fecha de nacimiento no puede estar en el futuro.'); return; }
    const payload = {
      firstName: data.firstName.trim(), lastName: data.lastName.trim(), email: data.email.trim(),
      birthDate: data.birthDate || null,
      ...Object.fromEntries(contactFields.map(([name]) => [name, data[name].trim() || null])),
    };
    setBusy(true); setError('');
    try { const { data: saved } = await api.put('/Profile', payload); onSaved(saved); }
    catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} aria-busy={busy}>
    <Notice error={error}/>
    <fieldset disabled={busy}>
      <h2>Datos personales</h2>
      <div className="form-grid">
        <Control label="Nombres" name="firstName" defaultValue={user.firstName} autoComplete="given-name" required maxLength={100}/>
        <Control label="Apellidos" name="lastName" defaultValue={user.lastName} autoComplete="family-name" required maxLength={100}/>
        <Control label="Correo electrónico" name="email" type="email" defaultValue={user.email} autoComplete="email" required maxLength={254}/>
        <Control label="Fecha de nacimiento" name="birthDate" type="date" defaultValue={user.birthDate || ''} max={today} autoComplete="bday"/>
      </div>
      <h2>Información de contacto</h2>
      <div className="form-grid">
        {contactFields.map(([name, label, maxLength]) => <Control key={name} {...{ name, label, maxLength }} defaultValue={user[name] || ''} type={name === 'homePhone' ? 'tel' : 'text'}/>)}
      </div>
      <Control label="Rol" value={user.roleName} readOnly/>
      <button className="btn" type="submit">{busy ? 'Guardando…' : 'Guardar mis datos'}</button>
    </fieldset>
  </form>;
}

function ProfilePasswordEditor({ onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.newPassword !== data.confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true); setError('');
    try {
      await api.put('/Profile/Password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      onSaved();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <Dialog title="Cambiar mi contraseña" busy={busy} onClose={onClose}>
    <form onSubmit={submit} aria-busy={busy}>
      <Notice error={error}/>
      <fieldset disabled={busy}>
        <Control label="Contraseña actual" name="currentPassword" type="password" autoComplete="current-password" required maxLength={128}/>
        <Control label="Nueva contraseña" name="newPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} hint="Entre 12 y 128 caracteres."/>
        <Control label="Confirmar nueva contraseña" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128}/>
        <FormActions busy={busy} onCancel={onClose} label="Cambiar contraseña"/>
      </fieldset>
    </form>
  </Dialog>;
}
