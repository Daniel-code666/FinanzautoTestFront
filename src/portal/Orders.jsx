import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, errorMessage } from '../lib/api';
import { Confirm, Control, FormActions, LoadState, Notice, PageHeading, Pagination, RemoteSelect, number, useResource } from './shared';

const shippingFields = [['shipName', 'Destinatario', 200], ['shipAddress', 'Dirección de envío', 300], ['shipCity', 'Ciudad', 100], ['shipRegion', 'Región', 100], ['shipPostalCode', 'Código postal', 20], ['shipCountry', 'País', 100]];
const dateFields = [['orderDate', 'Fecha de orden'], ['requiredDate', 'Fecha requerida'], ['shippedDate', 'Fecha de envío']];
const dateText = value => value ? new Date(value).toLocaleString('es-CO') : 'Sin especificar';
function localDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}
const utcDate = value => value ? new Date(value).toISOString() : null;

export function Orders() {
  const [filters, setFilters] = useState({});
  const [customer, setCustomer] = useState('');
  const [shipper, setShipper] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const resource = useResource('/Orders', { ...filters, page, pageSize }, { keepPreviousData: true });
  function search(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (values.fromDate && values.toDate && values.fromDate > values.toDate) { setError('La fecha inicial no puede superar la final.'); return; }
    setError('');
    setFilters(Object.fromEntries(Object.entries({ ...values, search: values.search.trim(), customerId: customer, shipVia: shipper, fromDate: utcDate(values.fromDate), toDate: utcDate(values.toDate) }).filter(([, value]) => value !== '' && value != null)));
    setPage(1); resource.reload();
  }
  return <>
    <PageHeading title="Órdenes" description="Gestiona pedidos, productos y datos de envío."><Link className="btn" to="/ordenes/nueva">+ Nueva orden</Link></PageHeading>
    <section className="panel"><form className="filter-form" onSubmit={search}>
      <Notice error={error}/>
      <Control label="Buscar por número, destinatario o ciudad" name="search" maxLength={100}/>
      <details><summary>Filtros avanzados</summary><div className="form-grid">
        <RemoteSelect label="Cliente" path="/Customers" displayKey="companyName" value={customer} onChange={setCustomer}/>
        <RemoteSelect label="Transportadora" path="/Shippers" displayKey="companyName" value={shipper} onChange={setShipper}/>
        <Control label="ID del empleado" name="employeeId" type="number" min="1" max="2147483647" step="1"/>
        <Control label="Desde (hora local)" name="fromDate" type="datetime-local" step="1"/>
        <Control label="Hasta (hora local)" name="toDate" type="datetime-local" step="1"/>
      </div></details><button className="btn" type="submit">Buscar</button>
    </form></section>
    <section className="panel product-results" aria-busy={resource.loading}>
      {resource.loading && resource.data && <div className="table-refresh" role="status">Actualizando órdenes…</div>}
      <LoadState resource={resource} empty={!resource.data?.items.length}><div className="table-scroll"><table>
        <caption className="sr-only">Órdenes</caption><thead><tr><th>Orden</th><th>Cliente</th><th>Fecha</th><th>Destino</th><th>Total</th><th>Acciones</th></tr></thead>
        <tbody>{resource.data?.items.map(order => <tr key={order.id}>
          <td><Link to={`/ordenes/${order.id}`}>#{order.id}</Link></td><td>#{order.customerId}</td><td>{dateText(order.orderDate)}</td>
          <td>{order.shipName || 'Sin destinatario'}<small>{order.shipCity}</small></td><td>{number(order.total)}</td>
          <td><div className="row-actions"><Link to={`/ordenes/${order.id}`}>Ver</Link><Link to={`/ordenes/${order.id}/editar`}>Editar</Link><button className="text-button destructive" onClick={() => setTarget(order)}>Eliminar</button></div></td>
        </tr>)}</tbody>
      </table></div></LoadState>
      {resource.data && <Pagination data={resource.data} {...{ page, setPage, pageSize, setPageSize }} loading={resource.loading}/>}
    </section>
    {target && <Confirm title="Eliminar orden" message={`¿Eliminar la orden #${target.id}? Se desactivarán la orden y todos sus detalles conservando el historial.`} onClose={() => setTarget(null)} onConfirm={async () => { await api.delete(`/Orders/${target.id}`); resource.reload(); }}/>} 
  </>;
}

export function OrderDetail() {
  const { id } = useParams();
  const resource = useResource(`/Orders/${id}`);
  const [target, setTarget] = useState(null);
  const order = resource.data;
  return <>
    <PageHeading title={`Orden #${id}`} description="Detalle de productos, importes y envío."><Link className="btn secondary" to="/ordenes">Volver a órdenes</Link>{order && <Link className="btn" to={`/ordenes/${id}/editar`}>Editar orden</Link>}</PageHeading>
    <LoadState resource={resource}>{order && <>
      <section className="panel detail-card"><dl className="data-grid">
        {[['Cliente', `#${order.customerId}`], ['Empleado', `#${order.employeeId}`], ['Transportadora', order.shipVia ? `#${order.shipVia}` : 'Sin asignar'], ...dateFields.map(([key, label]) => [label, dateText(order[key])]), ...shippingFields.map(([key, label]) => [label, order[key] || 'Sin especificar']), ['Creada', dateText(order.creationDate)], ['Actualizada', dateText(order.updatedDate)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl><p>Flete: <strong>{number(order.freight)}</strong></p><p>Total de la orden: <strong>{number(order.total)}</strong></p></section>
      <section className="panel"><div className="table-scroll"><table>
        <caption className="sr-only">Detalles de la orden</caption><thead><tr><th>Producto</th><th>Precio unitario</th><th>Cantidad</th><th>Descuento</th><th>Total</th><th>Acciones</th></tr></thead>
        <tbody>{order.details.map(line => <tr key={line.orderDetailId}><td><Link to={`/productos/${line.productId}`}>Producto #{line.productId}</Link><small>Detalle #{line.orderDetailId}</small></td><td>{number(line.unitPrice)}</td><td>{number(line.quantity)}</td><td>{number(line.discount * 100)} %</td><td>{number(line.total)}</td><td><button className="text-button destructive" onClick={() => setTarget(line)}>Eliminar línea</button></td></tr>)}</tbody>
      </table></div>{!order.details.length && <p className="empty-state">La orden no tiene detalles activos. Puedes agregar productos desde Editar orden.</p>}</section>
    </>}</LoadState>
    {target && <Confirm title="Eliminar línea" message={`¿Eliminar el producto #${target.productId} de esta orden? El detalle se desactivará y el total se recalculará.`} onClose={() => setTarget(null)} onConfirm={async () => { await api.delete(`/Orders/${id}/Details/${target.orderDetailId}`); resource.reload(); }}/>} 
  </>;
}

export function OrderEditor() {
  const { id } = useParams();
  const resource = useResource(id ? `/Orders/${id}` : null);
  return <><PageHeading title={id ? `Editar orden #${id}` : 'Nueva orden'} description="Selecciona el cliente, los productos y los datos de envío."/>
    <LoadState resource={resource}><OrderForm key={id || 'new'} order={resource.data}/></LoadState>
  </>;
}

function OrderForm({ order }) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(order?.customerId || '');
  const [shipper, setShipper] = useState(order?.shipVia || '');
  const [lines, setLines] = useState(() => (order?.details || []).map(line => ({ ...line, key: `saved-${line.orderDetailId}` })));
  const [product, setProduct] = useState('');
  const [productName, setProductName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function addLine() {
    if (!product) { setError('Selecciona un producto para agregar.'); return; }
    if (lines.some(line => line.productId === Number(product))) { setError('Este producto ya está en la orden.'); return; }
    if (lines.length >= 1000) { setError('Una orden admite hasta 1.000 líneas.'); return; }
    setLines([...lines, { key: `new-${product}`, productId: Number(product), productName, quantity: 1, discount: 0 }]);
    setProduct(''); setProductName(''); setError('');
  }
  function changeLine(key, field, value) { setLines(current => current.map(line => line.key === key ? { ...line, [field]: value } : line)); }
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!lines.length) { setError('Agrega al menos un producto.'); return; }
    const dates = Object.fromEntries(dateFields.map(([key]) => [key, utcDate(values[key])]));
    if ((dates.requiredDate && dates.requiredDate < dates.orderDate) || (dates.shippedDate && dates.shippedDate < dates.orderDate)) { setError('Las fechas requerida y de envío no pueden ser anteriores a la orden.'); return; }
    const payload = {
      customerId: Number(customer), shipVia: shipper ? Number(shipper) : null, ...dates, freight: Number(values.freight),
      ...Object.fromEntries(shippingFields.map(([key]) => [key, values[key].trim() || null])),
      details: lines.map(line => ({ ...(line.orderDetailId ? { orderDetailId: line.orderDetailId } : {}), productId: line.productId, quantity: Number(line.quantity), discount: Number(line.discount) })),
    };
    setBusy(true); setError('');
    try {
      const { data } = order ? await api.put(`/Orders/${order.id}`, payload) : await api.post('/Orders', payload);
      navigate(`/ordenes/${data.id}`, { replace: true });
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return <form className="panel editor-panel" onSubmit={submit} aria-busy={busy}>
    <Notice error={error}/><fieldset disabled={busy}>
      <h2>Datos de la orden</h2><div className="form-grid">
        <RemoteSelect label="Cliente" path="/Customers" displayKey="companyName" value={customer} onChange={setCustomer} required/>
        <RemoteSelect label="Transportadora (opcional)" path="/Shippers" displayKey="companyName" value={shipper} onChange={setShipper}/>
        {dateFields.map(([key, label]) => <Control key={key} label={`${label} (hora local)`} name={key} type="datetime-local" step="1" required={key === 'orderDate'} defaultValue={localDate(order?.[key] || (key === 'orderDate' ? new Date().toISOString() : null))}/>)}
        <Control label="Flete" name="freight" type="number" min="0" max="9999999999999999.99" step="0.01" required defaultValue={order?.freight || 0}/>
      </div><p className="subtle-note">El empleado se asigna desde la sesión al crear la orden. Las fechas se muestran en tu hora local.</p>
      <h2>Datos de envío</h2><div className="form-grid">{shippingFields.map(([name, label, maxLength]) => <Control key={name} {...{ name, label, maxLength }} defaultValue={order?.[name] || ''}/>)}</div>
      <h2>Productos ({lines.length}/1.000)</h2>
      <RemoteSelect label="Producto para agregar" path="/Products" displayKey="productName" value={product} onChange={(value, label) => { setProduct(value); setProductName(label || ''); }}/>
      <button className="btn secondary" type="button" onClick={addLine} disabled={lines.length >= 1000}>Agregar producto</button>
      <p className="subtle-note">El precio lo asigna el servidor al agregar el producto. Las líneas existentes conservan su precio. Descuento: 0 = sin descuento, 0,10 = 10 %, 1 = 100 %.</p>
      {order && <p className="subtle-note">Para eliminar una línea guardada, usa Eliminar línea en el detalle de la orden. Guarda primero los cambios que quieras conservar.</p>}
      <div className="table-scroll"><table><caption className="sr-only">Productos de la orden</caption><thead><tr><th>Producto</th><th>Precio guardado</th><th>Cantidad</th><th>Descuento (0 a 1)</th><th>Acciones</th></tr></thead>
        <tbody>{lines.map(line => <tr key={line.key}><td>{line.productName || `Producto #${line.productId}`}<small>#{line.productId}</small></td><td>{line.orderDetailId ? number(line.unitPrice) : 'Al guardar'}</td>
          <td><Control label={`Cantidad del producto ${line.productId}`} type="number" min="1" max="2147483647" step="1" required value={line.quantity} onChange={event => changeLine(line.key, 'quantity', event.target.value)}/></td>
          <td><Control label={`Descuento del producto ${line.productId}`} type="number" min="0" max="1" step="0.0001" required value={line.discount} onChange={event => changeLine(line.key, 'discount', event.target.value)}/></td>
          <td>{!line.orderDetailId ? <button className="text-button destructive" type="button" onClick={() => setLines(lines.filter(item => item.key !== line.key))}>Quitar</button> : 'Guardada'}</td>
        </tr>)}</tbody></table></div>
      <FormActions busy={busy} onCancel={() => navigate(order ? `/ordenes/${order.id}` : '/ordenes')} label={order ? 'Guardar cambios' : 'Crear orden'}/>
    </fieldset>
  </form>;
}
