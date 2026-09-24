import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth';
import { isAdmin } from './policies';
import { Badge, Confirm, Control, FormActions, ImagePreview, LoadState, Notice, PageHeading, Pagination, RemoteSelect, number, useResource } from './shared';

export function Products() {
  const admin = isAdmin(useAuth().session.user);
  const [query, setQuery] = useSearchParams();
  const page = Math.max(1, Number(query.get('page')) || 1);
  const pageSize = [10, 20, 50, 100].includes(Number(query.get('pageSize'))) ? Number(query.get('pageSize')) : 20;
  const filters = Object.fromEntries(query);
  const resource = useResource('/Products', { ...filters, page, pageSize }, { keepPreviousData: true });
  const filterKey = JSON.stringify(Object.entries(filters).filter(([key]) => !['page', 'pageSize'].includes(key)));
  const [target, setTarget] = useState(null);
  const [message, setMessage] = useState('');
  const [filterError, setFilterError] = useState('');
  const [category, setCategory] = useState(filters.categoryId || '');
  const [supplier, setSupplier] = useState(filters.supplierId || '');
  useEffect(() => { setCategory(filters.categoryId || ''); setSupplier(filters.supplierId || ''); }, [filters.categoryId, filters.supplierId]);
  function update(values) { setQuery({ ...filters, ...values }); }
  function search(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.minPrice && values.maxPrice && Number(values.minPrice) > Number(values.maxPrice)) { setFilterError('El precio mínimo no puede superar el máximo.'); return; }
    setFilterError(''); setQuery(Object.fromEntries(Object.entries({ ...values, categoryId: category, supplierId: supplier, pageSize, page: 1 }).filter(([, value]) => value !== '')));
    // An explicit search also refreshes results when the filters have not changed.
    resource.reload();
  }
  return <>
    <PageHeading title="Productos" description="Consulta y administra tu catálogo de productos.">{admin && <><Link className="btn secondary" to="/generacion">Carga masiva</Link><Link className="btn" to="/productos/nuevo">+ Nuevo producto</Link></>}</PageHeading>
    <Notice success={message} error={filterError}/>
    <section className="panel"><form className="filter-form" onSubmit={search} key={filterKey}><div className="filter-row"><Control label="Buscar producto" name="search" defaultValue={filters.search || ''} placeholder="Nombre del producto…" maxLength={100}/><Control label="Ordenar por" name="sortBy" defaultValue={filters.sortBy || 'Id'}><option value="Id">Más antiguos</option><option value="Name">Nombre</option><option value="Price">Precio</option></Control><Control label="Dirección" name="descending" defaultValue={filters.descending || 'false'}><option value="false">Ascendente</option><option value="true">Descendente</option></Control><button className="btn" type="submit">Buscar</button></div><details><summary>Filtros avanzados</summary><div className="form-grid"><RemoteSelect label="Categoría" path="/Categories" displayKey="categoryName" value={category} onChange={setCategory}/><RemoteSelect label="Proveedor" path="/Suppliers" displayKey="companyName" value={supplier} onChange={setSupplier}/><Control label="Precio mínimo" name="minPrice" type="number" min="0" step="0.01" defaultValue={filters.minPrice}/><Control label="Precio máximo" name="maxPrice" type="number" min="0" step="0.01" defaultValue={filters.maxPrice}/><Control label="Existencias" name="inStock" defaultValue={filters.inStock || ''}><option value="">Todas</option><option value="true">Con existencias</option><option value="false">Sin existencias</option></Control><Control label="Estado comercial" name="discontinued" defaultValue={filters.discontinued || ''}><option value="">Todos</option><option value="false">Disponible</option><option value="true">Descontinuado</option></Control></div></details><button type="button" className="text-button" onClick={() => { setQuery({}); setCategory(''); setSupplier(''); setFilterError(''); }}>Limpiar filtros</button></form></section>
    <section className="panel product-results" aria-busy={resource.loading}>{resource.loading && resource.data && <div className="table-refresh" role="status">Actualizando productos…</div>}<LoadState resource={resource} empty={!resource.data?.items.length}><div className="table-scroll"><table><caption className="sr-only">Catálogo de productos</caption><thead><tr><th>Producto</th><th>Categoría</th><th>Proveedor</th><th>Precio</th><th>Existencias</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{resource.data?.items.map(product => <tr key={product.id}><td><Link className="row-title" to={`/productos/${product.id}`}>{product.productName}</Link><small>#{product.id}</small></td><td>{product.categoryName}</td><td>{product.supplierName}</td><td className="numeric">{number(product.unitPrice)}</td><td className="numeric">{number(product.unitsInStock)}</td><td><Badge active={!product.discontinued}>{product.discontinued ? 'Descontinuado' : 'Disponible'}</Badge></td><td><div className="row-actions"><Link to={`/productos/${product.id}`}>Ver</Link>{admin && <><Link to={`/productos/${product.id}/editar`}>Editar</Link><button className="text-button destructive" onClick={() => setTarget(product)}>Eliminar</button></>}</div></td></tr>)}</tbody></table></div></LoadState>{resource.data && <Pagination data={resource.data} page={page} pageSize={pageSize} setPage={value => update({ page: value })} loading={resource.loading} onPageSizeChange={value => update({ pageSize: value, page: 1 })}/>}</section>
    {target && <Confirm title="Eliminar producto" message={`¿Eliminar “${target.productName}” del catálogo? El registro se desactivará y se conservará su historial.`} onClose={() => setTarget(null)} onConfirm={async () => { await api.delete(`/Products/${target.id}`); setMessage('Producto eliminado.'); resource.reload(); }}/>}</>;
}

export function ProductDetail() {
  const admin = isAdmin(useAuth().session.user);
  const { id } = useParams();
  const resource = useResource(`/Products/${id}`);
  const product = resource.data?.product;
  const category = resource.data?.category;
  return <><PageHeading title="Detalle del producto" description="Información comercial, inventario y categoría."><Link className="btn secondary" to="/productos">Volver al catálogo</Link>{admin && product && <Link className="btn" to={`/productos/${id}/editar`}>Editar producto</Link>}</PageHeading><LoadState resource={resource}>{product && <div className="detail-grid"><section className="panel detail-card"><Badge active={!product.discontinued}>{product.discontinued ? 'Descontinuado' : 'Disponible'}</Badge><h2>{product.productName}</h2><div className="large-number">{number(product.unitPrice)}<small>Precio unitario</small></div><dl className="data-grid">{[['Identificador', product.id], ['Proveedor', product.supplierName], ['Cantidad por unidad', product.quantityPerUnit || 'Sin especificar'], ['En inventario', number(product.unitsInStock)], ['Unidades pedidas', number(product.unitsOnOrder)], ['Nivel de reposición', number(product.reorderLevel)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><section className="panel detail-card"><ImagePreview {...category} name={category.categoryName}/><h2>{category.categoryName}</h2><p>{category.description || 'Sin descripción de categoría.'}</p></section></div>}</LoadState></>;
}

export function ProductEditor() {
  const { id } = useParams();
  const resource = useResource(id ? `/Products/${id}` : null);
  return <><PageHeading title={id ? 'Editar producto' : 'Nuevo producto'} description="Completa los datos del producto y su inventario."/><LoadState resource={resource}><ProductForm key={id || 'new'} product={resource.data?.product}/></LoadState></>;
}
function ProductForm({ product }) {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState(product?.categoryId || '');
  const [supplierId, setSupplierId] = useState(product?.supplierId || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!data.productName.trim()) { setError('Ingresa el nombre del producto.'); return; }
    const payload = { productName: data.productName.trim(), quantityPerUnit: data.quantityPerUnit.trim() || null, categoryId: Number(categoryId), supplierId: Number(supplierId), unitPrice: Number(data.unitPrice), unitsInStock: Number(data.unitsInStock), unitsOnOrder: Number(data.unitsOnOrder), reorderLevel: Number(data.reorderLevel), discontinued: data.discontinued === 'on' };
    setBusy(true); setError('');
    try { const { data: saved } = product ? await api.put(`/Products/${product.id}`, payload) : await api.post('/Products', payload); navigate(`/productos/${saved.product.id}`, { replace: true }); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return <form className="panel editor-panel" onSubmit={submit}><Notice error={error}/><fieldset disabled={busy}><h2>Información del producto</h2><div className="form-grid"><Control label="Nombre del producto" name="productName" required maxLength={200} defaultValue={product?.productName}/><Control label="Cantidad por unidad" name="quantityPerUnit" maxLength={100} defaultValue={product?.quantityPerUnit || ''} placeholder="Ej. 1 unidad"/><RemoteSelect label="Categoría" path="/Categories" displayKey="categoryName" value={categoryId} onChange={setCategoryId} selectedLabel={product?.categoryName} required/><RemoteSelect label="Proveedor" path="/Suppliers" displayKey="companyName" value={supplierId} onChange={setSupplierId} selectedLabel={product?.supplierName} required/></div><h2>Precio e inventario</h2><div className="form-grid">{[['unitPrice', 'Precio unitario', '0.01'], ['unitsInStock', 'Unidades en inventario', '1'], ['unitsOnOrder', 'Unidades pedidas', '1'], ['reorderLevel', 'Nivel de reposición', '1']].map(([name, label, step]) => <Control key={name} label={label} name={name} type="number" min="0" max={name === 'unitPrice' ? '9999999999999999.99' : '2147483647'} step={step} required defaultValue={product?.[name] ?? 0}/>)}</div><label className="check-label"><input type="checkbox" name="discontinued" defaultChecked={product?.discontinued}/> Producto descontinuado</label><FormActions busy={busy} onCancel={() => navigate(product ? `/productos/${product.id}` : '/productos')} label={product ? 'Guardar cambios' : 'Crear producto'}/></fieldset></form>;
}
