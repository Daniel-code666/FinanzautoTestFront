import React, { useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { Confirm, Control, Dialog, FormActions, LoadState, Notice, PageHeading, Pagination, useResource } from './shared';

export default function Shippers() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [editor, setEditor] = useState(null);
  const [target, setTarget] = useState(null);
  const resource = useResource('/Shippers', { search, page, pageSize }, { keepPreviousData: true });
  function submitSearch(event) {
    event.preventDefault();
    setSearch(new FormData(event.currentTarget).get('search').trim());
    setPage(1);
    resource.reload();
  }
  return <>
    <PageHeading title="Transportadoras" description="Gestiona las empresas encargadas del transporte y sus teléfonos de contacto.">
      <button className="btn" onClick={() => setEditor({})}>+ Nueva transportadora</button>
    </PageHeading>
    <section className="panel">
      <form className="search-bar" onSubmit={submitSearch}>
        <Control label="Buscar empresa o teléfono" name="search" maxLength={100} placeholder="Empresa o teléfono…"/>
        <button className="btn" type="submit">Buscar</button>
      </form>
    </section>
    <section className="panel product-results" aria-busy={resource.loading}>
      {resource.loading && resource.data && <div className="table-refresh" role="status">Actualizando transportadoras…</div>}
      <LoadState resource={resource} empty={!resource.data?.items.length}>
        <div className="table-scroll"><table>
          <caption className="sr-only">Transportadoras</caption>
          <thead><tr><th>Empresa</th><th>Teléfono</th><th>Acciones</th></tr></thead>
          <tbody>{resource.data?.items.map(item => <tr key={item.id}>
            <td><strong>{item.companyName}</strong><small>#{item.id}</small></td>
            <td>{item.phone || 'Sin teléfono'}</td>
            <td><div className="row-actions">
              <button className="text-button" onClick={() => setEditor(item)}>Ver / editar</button>
              <button className="text-button destructive" onClick={() => setTarget(item)}>Eliminar</button>
            </div></td>
          </tr>)}</tbody>
        </table></div>
      </LoadState>
      {resource.data && <Pagination data={resource.data} {...{ page, setPage, pageSize, setPageSize }} loading={resource.loading}/>}
    </section>
    {editor && <ShipperEditor key={editor.id || 'new'} item={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); resource.reload(); }}/>} 
    {target && <Confirm title="Eliminar transportadora" message={`¿Eliminar “${target.companyName}”? Se desactivará el registro conservando su historial. No se puede eliminar si tiene pedidos activos.`} onClose={() => setTarget(null)} onConfirm={async () => { await api.delete(`/Shippers/${target.id}`); resource.reload(); }}/>} 
  </>;
}

function ShipperEditor({ item, onClose, onSaved }) {
  const resource = useResource(item.id ? `/Shippers/${item.id}` : null);
  const [busy, setBusy] = useState(false);
  return <Dialog title={item.id ? 'Editar transportadora' : 'Nueva transportadora'} onClose={onClose} busy={busy}>
    <LoadState resource={resource}><ShipperForm item={resource.data || {}} {...{ busy, setBusy, onClose, onSaved }}/></LoadState>
  </Dialog>;
}

function ShipperForm({ item, busy, setBusy, onClose, onSaved }) {
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const payload = { companyName: data.get('companyName').trim(), phone: data.get('phone').trim() || null };
    if (!payload.companyName) { setError('Ingresa el nombre de la empresa.'); return; }
    setBusy(true); setError('');
    try {
      if (item.id) await api.put(`/Shippers/${item.id}`, payload);
      else await api.post('/Shippers', payload);
      onSaved();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} aria-busy={busy}>
    <Notice error={error}/>
    <fieldset disabled={busy}>
      {item.id && <Control label="Identificador" value={item.id} readOnly/>}
      <Control label="Empresa" name="companyName" defaultValue={item.companyName || ''} required maxLength={200}/>
      <Control label="Teléfono" name="phone" type="tel" defaultValue={item.phone || ''} maxLength={30}/>
      {item.creationDate && <p className="subtle-note">Creada: {new Date(item.creationDate).toLocaleString('es-CO')}</p>}
      {item.updatedDate && <p className="subtle-note">Actualizada: {new Date(item.updatedDate).toLocaleString('es-CO')}</p>}
      <FormActions busy={busy} onCancel={onClose} label={item.id ? 'Guardar cambios' : 'Crear transportadora'}/>
    </fieldset>
  </form>;
}
