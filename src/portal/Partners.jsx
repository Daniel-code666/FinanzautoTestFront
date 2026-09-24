import React, { useState } from 'react';
import { useAuth } from '../auth';
import { api, errorMessage } from '../lib/api';
import { isAdmin } from './policies';
import { Confirm, Control, Dialog, FormActions, LoadState, Notice, PageHeading, Pagination, useResource } from './shared';

const contactFields = [
  ['companyName', 'Empresa', 200, true], ['contactName', 'Nombre de contacto', 100],
  ['contactTitle', 'Cargo del contacto', 100], ['phone', 'Teléfono', 30],
  ['address', 'Dirección', 300], ['city', 'Ciudad', 100], ['region', 'Región', 100],
  ['postalCode', 'Código postal', 20], ['country', 'País', 100], ['fax', 'Fax', 30],
];
const config = {
  customers: { path: '/Customers', title: 'Clientes', singular: 'cliente', fields: contactFields },
  suppliers: { path: '/Suppliers', title: 'Proveedores', singular: 'proveedor', fields: [...contactFields, ['homePage', 'Página web', 2048]] },
};

export default function Partners({ kind }) {
  const settings = config[kind];
  const admin = isAdmin(useAuth().session.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState({});
  const resource = useResource(settings.path, { ...filters, page, pageSize });
  const [editor, setEditor] = useState(null);
  const [target, setTarget] = useState(null);
  const [bulk, setBulk] = useState(false);
  const [message, setMessage] = useState('');
  return <>
    <PageHeading eyebrow={kind === 'customers' ? 'ADMINISTRACIÓN' : 'CATÁLOGO'} title={settings.title} description={`Consulta los datos de contacto de tus ${settings.title.toLowerCase()}.`}>
      {admin && <><button className="btn secondary" onClick={() => setBulk(true)}>Importar JSON</button><button className="btn" onClick={() => setEditor({})}>+ Nuevo {settings.singular}</button></>}
    </PageHeading>
    <Notice success={message} />
    <section className="panel"><form className="filter-form" onSubmit={event => { event.preventDefault(); setFilters(Object.fromEntries(new FormData(event.currentTarget))); setPage(1); }}><div className="filter-row"><Control label="Buscar empresa o contacto" name="search" maxLength={100} placeholder="Nombre…" /><Control label="Ciudad" name="city" maxLength={100} /><Control label="País" name="country" maxLength={100} /><button className="btn">Buscar</button></div></form></section>
    <section className="panel"><LoadState resource={resource} empty={!resource.data?.items.length}><div className="table-scroll"><table><thead><tr><th>Empresa</th><th>Contacto</th><th>Ciudad / país</th><th>Teléfono</th><th>Acciones</th></tr></thead><tbody>{resource.data?.items.map(item => <tr key={item.id}><td><strong>{item.companyName}</strong><small>#{item.id}</small></td><td>{item.contactName || 'Sin contacto'}<small>{item.contactTitle}</small></td><td>{[item.city, item.country].filter(Boolean).join(' / ') || 'Sin especificar'}</td><td>{item.phone || '—'}</td><td><div className="row-actions"><button className="text-button" onClick={() => setEditor(item)}>{admin ? 'Ver / editar' : 'Ver detalle'}</button>{admin && <button className="text-button destructive" onClick={() => setTarget(item)}>Eliminar</button>}</div></td></tr>)}</tbody></table></div></LoadState>{resource.data && <Pagination {...{ page, setPage, pageSize, setPageSize }} data={resource.data} />}</section>
    {editor && <PartnerEditor key={`${kind}-${editor.id || 'new'}`} kind={kind} settings={settings} item={editor} editable={admin} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.reload(); setMessage('Datos guardados.'); }} />}
    {target && <Confirm title={`Eliminar ${settings.singular}`} message={`¿Eliminar “${target.companyName}”? Se desactivará el registro. El servicio puede rechazar la operación si existen referencias activas.`} onClose={() => setTarget(null)} onConfirm={async () => { await api.delete(`${settings.path}/${encodeURIComponent(target.id)}`); resource.reload(); setMessage('Registro eliminado.'); }} />}
    {bulk && <BulkImport settings={settings} kind={kind} onClose={() => setBulk(false)} onSaved={count => { setBulk(false); resource.reload(); setMessage(`${count} registros importados.`); }} />}
  </>;
}
function PartnerEditor({ kind, settings, item, editable, onClose, onSaved }) {
  const detail = useResource(item.id ? `${settings.path}/${encodeURIComponent(item.id)}` : null);
  const [busy, setBusy] = useState(false);
  return <Dialog title={`${item.id ? (editable ? 'Editar' : 'Detalle de') : 'Nuevo'} ${settings.singular}`} onClose={onClose} busy={busy}><LoadState resource={detail}><PartnerForm {...{ kind, settings, editable, onClose, onSaved, busy, setBusy }} item={detail.data || {}} /></LoadState></Dialog>;
}
function PartnerForm({ kind, settings, item, editable, onClose, onSaved, busy, setBusy }) {
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); if (!editable || busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.companyName.trim()) { setError('Ingresa el nombre de la empresa.'); return; }
    const payload = Object.fromEntries(settings.fields.map(([name]) => [name, data[name]?.trim() || null]));
    setBusy(true); setError('');
    try { if (item.id) await api.put(`${settings.path}/${encodeURIComponent(item.id)}`, payload); else await api.post(settings.path, payload); onSaved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}><Notice error={error} /><fieldset disabled={busy}>{kind === 'customers' && <Control label="Identificador de cliente" value={item.id || ''} readOnly placeholder="Asignado al guardar" hint="El servidor genera un número entero automáticamente. No se puede editar." />}<div className="form-grid">{settings.fields.map(([name, label, maxLength, required]) => <Control key={name} {...{ name, label, maxLength, required }} defaultValue={item[name] || ''} readOnly={!editable} />)}</div>{item.creationDate && <p className="subtle-note">Creado: {new Date(item.creationDate).toLocaleDateString('es-CO')}</p>}{editable ? <FormActions busy={busy} onCancel={onClose} /> : <button className="btn secondary" type="button" onClick={onClose}>Cerrar</button>}</fieldset></form>;
}
function BulkImport({ settings, kind, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const example = JSON.stringify([{ companyName: 'Empresa ejemplo', contactName: 'Ana Pérez', city: 'Bogotá', country: 'Colombia', phone: '3001234567' }], null, 2);
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setError(''); let entries;
    try {
      const raw = new FormData(event.currentTarget).get('records');
      if (new Blob([raw]).size > 7 * 1024 * 1024) throw new Error('El contenido no puede superar 7 MiB.');
      entries = JSON.parse(raw);
      if (!Array.isArray(entries) || entries.length < 1 || entries.length > 1000) throw new Error('Incluye entre 1 y 1.000 registros en un arreglo JSON.');
      for (const [index, item] of entries.entries()) {
        if (!item || typeof item !== 'object' || typeof item.companyName !== 'string' || !item.companyName.trim()) throw new Error(`Registro ${index + 1}: falta la empresa.`);
        if (kind === 'customers' && ('customerId' in item || 'id' in item)) throw new Error(`Registro ${index + 1}: elimina id y customerId; el servidor genera el identificador automáticamente.`);
        for (const [name, label, max] of settings.fields) if (item[name] != null && (typeof item[name] !== 'string' || item[name].length > max)) throw new Error(`Registro ${index + 1}: revisa ${label.toLowerCase()} (máximo ${max} caracteres).`);
      }
    } catch (err) { setError(err instanceof SyntaxError ? 'El JSON no es válido. Revisa comillas, comas y corchetes.' : err.message); return; }
    setBusy(true);
    try { const { data } = await api.post(`${settings.path}/Bulk`, entries, { timeout: 120000 }); onSaved(data.createdCount); } catch (err) { setError(`${errorMessage(err)}${!err.response ? ' Revisa el listado antes de repetir la importación.' : ''}`); } finally { setBusy(false); }
  }
  return <Dialog title={`Importar ${settings.title.toLowerCase()}`} onClose={onClose} busy={busy}><p>Pega entre 1 y 1.000 registros. Cada envío crea nuevos registros.</p><details><summary>Ver ejemplo de formato</summary><pre className="json-example">{example}</pre></details><form onSubmit={submit}><Notice error={error} /><fieldset disabled={busy}><label className="textarea-label">Registros JSON<textarea name="records" rows={10} required placeholder={example} /></label><FormActions busy={busy} onCancel={onClose} label="Importar registros" /></fieldset></form></Dialog>;
}
