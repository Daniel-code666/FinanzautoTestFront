import React, { useState } from 'react';
import { Link } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth';
import { isAdmin } from './policies';
import { Confirm, Control, Dialog, FormActions, ImagePreview, LoadState, Notice, PageHeading, Pagination, RemoteSelect, number, useResource } from './shared';

export function Categories() {
  const admin = isAdmin(useAuth().session.user);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const resource = useResource('/Categories', { page, pageSize, search });
  const [editor, setEditor] = useState(null);
  const [target, setTarget] = useState(null);
  const [message, setMessage] = useState('');
  return <><PageHeading title="Categorías" description="Organiza tus productos y administra la imagen de cada categoría.">{admin && <button className="btn" onClick={() => setEditor({})}>+ Nueva categoría</button>}</PageHeading><Notice success={message}/><section className="panel"><Search onSearch={value => { setSearch(value); setPage(1); }}/><LoadState resource={resource} empty={!resource.data?.items.length}><div className="table-scroll"><table><thead><tr><th>Categoría</th><th>Descripción</th><th>Imagen</th><th>Acciones</th></tr></thead><tbody>{resource.data?.items.map(category => <tr key={category.id}><td><strong>{category.categoryName}</strong><small>#{category.id}</small></td><td className="description-cell">{category.description || 'Sin descripción'}</td><td>{category.hasPicture ? 'Disponible' : 'Sin imagen'}</td><td><div className="row-actions"><button className="text-button" onClick={() => setEditor(category)}>{admin ? "Ver / editar" : "Ver categoría"}</button>{admin && <button className="text-button destructive" onClick={() => setTarget(category)}>Eliminar</button>}</div></td></tr>)}</tbody></table></div></LoadState>{resource.data && <Pagination {...{ page, setPage, pageSize, setPageSize }} data={resource.data}/>}</section>{editor && <CategoryEditor category={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setMessage('Categoría guardada.'); resource.reload(); }}/>} {target && <Confirm title="Eliminar categoría" message={`¿Desactivar “${target.categoryName}”? La API no permite eliminar categorías con productos activos.`} onClose={() => setTarget(null)} onConfirm={async () => { await api.delete(`/Categories/${target.id}`); resource.reload(); setMessage('Categoría eliminada.'); }}/>}</>;
}
function CategoryEditor({ category, onClose, onSaved }) {
  const detail = useResource(category.id ? `/Categories/${category.id}` : null);
  return <Dialog title={category.id ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}><LoadState resource={detail}><CategoryForm category={detail.data || {}} onClose={onClose} onSaved={onSaved}/></LoadState></Dialog>;
}
function CategoryForm({ category, onClose, onSaved }) {
  const admin = isAdmin(useAuth().session.user);
  const [picture, setPicture] = useState(category.picture || null);
  const [pictureContentType, setType] = useState(category.pictureContentType);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function readImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Selecciona una imagen PNG, JPEG o WebP de máximo 2 MiB.'); event.target.value = ''; return; }
    setReading(true); setError('');
    try {
      const result = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      setPicture(result.split(',')[1]); setType(file.type);
    } catch { setError('No se pudo leer la imagen. Intenta con otro archivo.'); } finally { setReading(false); }
  }
  async function submit(event) {
    event.preventDefault(); if (!admin || busy || reading) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.categoryName.trim()) { setError('Ingresa el nombre de la categoría.'); return; }
    setBusy(true); setError('');
    try { const payload = { categoryName: data.categoryName.trim(), description: data.description.trim() || null, picture }; if (category.id) await api.put(`/Categories/${category.id}`, payload); else await api.post('/Category', payload); onSaved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <form onSubmit={submit}><Notice error={error}/><fieldset disabled={!admin || busy || reading}><Control label="Nombre de categoría" name="categoryName" defaultValue={category.categoryName} required maxLength={100} placeholder="Ej. SERVIDORES o CLOUD"/><label className="textarea-label">Descripción<textarea name="description" defaultValue={category.description || ''} maxLength={2000} rows={3}/></label><Control label="Imagen de categoría" type="file" accept="image/png,image/jpeg,image/webp" onChange={readImage} hint="PNG, JPEG o WebP. Máximo 2 MiB."/><ImagePreview picture={picture} pictureContentType={pictureContentType} name={category.categoryName || 'la categoría'}/>{picture && <button type="button" className="text-button destructive" onClick={() => { setPicture(null); setType(null); }}>Quitar imagen</button>}{admin && <FormActions busy={busy || reading} onCancel={onClose}/>}</fieldset></form>;
}

export function Search({ onSearch }) { return <form className="search-bar" onSubmit={event => { event.preventDefault(); onSearch(new FormData(event.currentTarget).get('search').trim()); }}><Control name="search" label="Buscar" placeholder="Escribe un nombre…" maxLength={100}/><button className="btn secondary" type="submit">Buscar</button></form>; }

export function Generation() {
  const [categoryId, setCategoryId] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [categories, setCategories] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  function prepare(event) {
    event.preventDefault(); setError(''); setResult(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!categories.length) { setError('Agrega al menos una categoría a la distribución.'); return; }
    if (!data.namePrefix.trim()) { setError('Ingresa un prefijo para los productos.'); return; }
    if (Number(data.minPrice) > Number(data.maxPrice)) { setError('El precio mínimo no puede superar el máximo.'); return; }
    setConfirm({ count: Number(data.count), categoryIds: categories.map(item => Number(item.id)), supplierId: Number(supplierId), namePrefix: data.namePrefix.trim(), minPrice: Number(data.minPrice), maxPrice: Number(data.maxPrice) });
  }
  async function generate() {
    setBusy(true); setConfirm(null); setError('');
    try { const response = await api.post('/Product', confirm, { timeout: 300000 }); setResult(response.data); }
    catch (err) { setError(errorMessage(err)); if (!err.response || err.response.status >= 500) setUncertain(true); }
    finally { setBusy(false); }
  }
  return <><PageHeading title="Carga masiva" description="Genera productos aleatorios y distribúyelos entre tus categorías."><Link className="btn secondary" to="/productos">Ver catálogo</Link></PageHeading><div className="detail-grid"><form className="panel editor-panel" onSubmit={prepare}><Notice error={error}/>{uncertain && <div className="notice error" role="alert">No pudimos confirmar el resultado. Revisa el catálogo antes de repetir: una nueva solicitud crea otra carga.<button className="text-button" type="button" onClick={() => setUncertain(false)}>Ya revisé el catálogo</button></div>}<fieldset disabled={busy || uncertain}><h2>Configura la generación</h2><div className="form-grid"><Control label="Cantidad de productos" name="count" type="number" required min="1" max="100000" step="1" defaultValue="100000"/><Control label="Prefijo del nombre" name="namePrefix" required maxLength={100} defaultValue="Producto"/><Control label="Precio mínimo" name="minPrice" type="number" min="0" max="1000000000" step="0.01" required defaultValue="1"/><Control label="Precio máximo" name="maxPrice" type="number" min="0" max="1000000000" step="0.01" required defaultValue="10000"/></div><RemoteSelect label="Proveedor" path="/Suppliers" displayKey="companyName" value={supplierId} onChange={setSupplierId} required/><RemoteSelect label="Categoría a agregar" path="/Categories" displayKey="categoryName" value={categoryId} onChange={(id, label) => { setCategoryId(id); setCategoryLabel(label); }}/><button className="btn secondary" type="button" disabled={!categoryId || categories.length >= 100 || categories.some(item => String(item.id) === categoryId)} onClick={() => { setCategories([...categories, { id: categoryId, name: categoryLabel }]); setCategoryId(''); }}>Agregar a la distribución</button><ul className="selected-tags">{categories.map(item => <li key={item.id}>{item.name}<button type="button" aria-label={`Quitar ${item.name}`} onClick={() => setCategories(categories.filter(category => category.id !== item.id))}>×</button></li>)}</ul><button className="btn" type="submit">{busy ? 'Generando productos…' : 'Generar productos'}</button></fieldset>{busy && <p role="status">La generación está en curso. Mantén esta página abierta; el resultado se mostrará al finalizar.</p>}</form><aside className="panel detail-card"><div className="section-tag">PROCESAMIENTO MASIVO</div><h2>Hasta 100.000 productos</h2><p>Los productos se distribuyen de forma equilibrada entre las categorías seleccionadas.</p><p>Para el escenario de la prueba, crea <strong>SERVIDORES</strong> y <strong>CLOUD</strong> en Categorías y agrega ambas a la distribución.</p><Link to="/categorias">Administrar categorías →</Link><hr/><p>Cada ejecución agrega nuevos registros. No se reintenta automáticamente una carga.</p>{result && <div className="notice success" role="status"><strong>{number(result.createdCount)} productos creados</strong><p>Tiempo del servicio: {number(result.elapsedMilliseconds)} ms</p><small>Generación: {result.generationId}</small></div>}</aside></div>{confirm && <Confirm title="Confirmar carga masiva" message={`Se crearán ${number(confirm.count)} productos nuevos en ${confirm.categoryIds.length} categorías. ¿Deseas continuar?`} onClose={() => setConfirm(null)} onConfirm={generate}/>}</>;
}
