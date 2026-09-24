import React, { useEffect, useId, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';

export function useResource(path, params = {}, { keepPreviousData = false } = {}) {
  const key = JSON.stringify(params);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    if (!path) { setState({ data: null, loading: false, error: '' }); return; }
    const controller = new AbortController();
    setState(previous => ({ data: keepPreviousData ? previous.data : null, loading: true, error: '' }));
    api.get(path, { params: JSON.parse(key), signal: controller.signal }).then(({ data }) => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ data: null, loading: false, error: errorMessage(error) });
    });
    return () => controller.abort();
  }, [path, key, version, keepPreviousData]);
  return { ...state, keepPreviousData, reload: () => setVersion(value => value + 1) };
}

export function PageHeading({ eyebrow = 'CATÁLOGO', title, description, children }) {
  useEffect(() => { document.title = `${title} | Finanzauto`; }, [title]);
  return <header className="page-heading"><div><div className="section-tag">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{children}</div></header>;
}
export function Notice({ error, success }) { return error ? <div className="notice error" role="alert">{error}</div> : success ? <div className="notice success" role="status">{success}</div> : null; }
export function LoadState({ resource, children, empty = false }) {
  if (resource.loading && !(resource.keepPreviousData && resource.data)) return <div className="empty-state" role="status">Cargando información…</div>;
  if (resource.error) return <div className="empty-state"><Notice error={resource.error}/><button className="btn secondary" onClick={resource.reload}>Volver a intentar</button></div>;
  if (empty) return <div className="empty-state"><span className="empty-icon" aria-hidden="true">⌕</span><h3>No hay resultados</h3><p>Prueba con otros filtros o crea el primer registro.</p></div>;
  return children;
}
export function Control({ label, name, children, hint, ...props }) {
  const id = useId();
  return <div className="control"><label htmlFor={id}>{label}</label>{children ? <select id={id} name={name} {...props}>{children}</select> : <input id={id} name={name} aria-describedby={hint ? `${id}-hint` : undefined} {...props}/>} {hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
export function Pagination({ data, page, setPage, pageSize, setPageSize, onPageSizeChange, loading = false }) {
  const pages = Math.max(1, Math.ceil((data?.totalCount || 0) / pageSize));
  useEffect(() => { if (!loading && data && page > pages) setPage(pages); }, [data, page, pages, setPage, loading]);
  function changeSize(event) {
    const size = Number(event.target.value);
    // URL-based consumers must update page and size in a single navigation.
    if (onPageSizeChange) onPageSizeChange(size);
    else { setPageSize(size); setPage(1); }
  }
  return <div className="pagination"><span>{(data?.totalCount || 0).toLocaleString('es-CO')} registros</span><label>Por página <select aria-label="Registros por página" value={pageSize} disabled={loading} onChange={changeSize}>{[10, 20, 50, 100].map(size => <option key={size}>{size}</option>)}</select></label><div><button type="button" className="btn secondary" disabled={loading || page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior">←</button><span>Página {page} de {pages}</span><button type="button" className="btn secondary" disabled={loading || page >= pages} onClick={() => setPage(page + 1)} aria-label="Página siguiente">→</button></div></div>;
}
export function Dialog({ title, onClose, busy = false, children }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog className="portal-dialog" ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><div className="dialog-heading"><h2 id={id}>{title}</h2><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Cerrar ventana">×</button></div>{children}</dialog>;
}
export function FormActions({ busy, onCancel, label = 'Guardar cambios' }) { return <div className="form-actions"><button type="button" className="btn secondary" disabled={busy} onClick={onCancel}>Cancelar</button><button className="btn" type="submit" disabled={busy}>{busy ? 'Guardando…' : label}</button></div>; }
export function Confirm({ title, message, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() { setBusy(true); setError(''); try { await onConfirm(); onClose(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }
  return <Dialog title={title} onClose={onClose} busy={busy}><p>{message}</p><Notice error={error}/><div className="form-actions"><button className="btn secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn danger" disabled={busy} onClick={submit}>{busy ? 'Procesando…' : 'Confirmar'}</button></div></Dialog>;
}
export function Badge({ active, children }) { return <span className={`badge ${active === false ? 'muted' : ''}`}>{children || (active ? 'Activo' : 'Inactivo')}</span>; }
export const number = value => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(value ?? 0);
export function ImagePreview({ picture, pictureContentType, name }) {
  return picture && ['image/png', 'image/jpeg', 'image/webp'].includes(pictureContentType)
    ? <img className="category-picture" src={`data:${pictureContentType};base64,${picture}`} alt={`Imagen de ${name}`}/>
    : <div className="picture-placeholder">Sin imagen de categoría</div>;
}

// Each lookup is paginated; selecting an existing value never depends on the first page.
export function RemoteSelect({ label, path, displayKey, value, onChange, selectedLabel, required = false }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const resource = useResource(path, { search, page, pageSize: 20 });
  const items = resource.data?.items || [];
  const id = useId();
  return <div className="control remote-select"><label htmlFor={id}>{label}</label><input aria-label={`Buscar ${label.toLowerCase()}`} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por nombre…" maxLength={100}/><select id={id} required={required} value={value || ''} onChange={event => { const item = items.find(item => String(item.id) === event.target.value); onChange(event.target.value, item?.[displayKey]); }}><option value="">Selecciona una opción</option>{value && !items.some(item => String(item.id) === String(value)) && <option value={value}>{selectedLabel || `Seleccionado #${value}`}</option>}{items.map(item => <option key={item.id} value={item.id}>{item[displayKey]}</option>)}</select>{resource.loading && <small role="status">Cargando opciones…</small>}{resource.error && <><Notice error={resource.error}/><button className="text-button" type="button" onClick={resource.reload}>Reintentar opciones</button></>}<div className="lookup-pager"><button type="button" disabled={page === 1 || resource.loading} onClick={() => setPage(page - 1)}>Anterior</button><small>Página {page}</small><button type="button" disabled={resource.loading || page * 20 >= (resource.data?.totalCount || 0)} onClick={() => setPage(page + 1)}>Siguiente</button></div></div>;
}
