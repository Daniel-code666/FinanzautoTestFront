import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = process.env.FRONT_URL || 'http://127.0.0.1:5173';
const suffix = Date.now().toString();
const email = `portal.check.${suffix}@example.com`;
const password = `Test-${crypto.randomUUID()}`;
let token;
const productIds = [];
let categoryId;
let fixtureUserId;
let adminToken;
let supplierId;
let customerId;
async function request(path, method = 'GET', body) {
  const response = await fetch(`${root}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}
async function check() { try {
  let adminEmail = process.env.CHECK_EMAIL;
  let adminPassword = process.env.CHECK_PASSWORD;
  if (process.env.BACKEND_ENV_FILE) {
    const env = Object.fromEntries((await readFile(process.env.BACKEND_ENV_FILE, 'utf8')).split(/\r?\n/).filter(line => /^BOOTSTRAP_ADMIN_(EMAIL|PASSWORD)=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
    adminEmail = env.BOOTSTRAP_ADMIN_EMAIL; adminPassword = env.BOOTSTRAP_ADMIN_PASSWORD;
  }
  if (adminEmail && adminPassword) adminToken = (await request('/Login', 'POST', { email: adminEmail, password: adminPassword })).accessToken;
  fixtureUserId = (await request('/UserAdministration/Register', 'POST', { firstName: 'Prueba', lastName: 'Portal', email, password })).id;
  token = (await request('/Login', 'POST', { email, password })).accessToken;
  assert.ok(token);
  const denied = await fetch(`${root}/api/Category`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ categoryName: `Denied ${suffix}` }) });
  assert.equal(denied.status, 403, 'La API debe negar escrituras de catálogo a User');
  if (!adminToken) {
    const products = await request('/Products?page=1&pageSize=10');
    assert.ok(Array.isArray(products.items));
    if (products.items.length) assert.ok((await request(`/Products/${products.items[0].id}`)).category);
    assert.ok(Array.isArray((await request('/Categories?pageSize=10')).items));
    assert.ok(Array.isArray((await request('/Suppliers?pageSize=10')).items));
    assert.equal((await request(`/UserAdministration/Users/${fixtureUserId}`)).email, email);
    console.log('OK: registro/login, catálogo paginado, detalle, categorías, proveedores, perfil propio y rechazo de escrituras a User.');
    return;
  }
  token = adminToken;
  const supplier = await request('/Suppliers', 'POST', { companyName: `Proveedor prueba ${suffix}`, city: 'Bogotá' }); supplierId = supplier.id;
  const customer = await request('/Customers', 'POST', { companyName: `Cliente prueba ${suffix}` }); customerId = customer.id;
  const editedCustomer = await request(`/Customers/${customerId}`, 'PUT', { companyName: `Cliente actualizado ${suffix}`, contactName: 'Prueba' });
  assert.equal(editedCustomer.contactName, 'Prueba');
  const suppliers = await request('/Suppliers?pageSize=1');
  assert.ok(suppliers.items.length, 'Se requiere al menos un proveedor activo');
  const category = await request('/Category', 'POST', { categoryName: `Prueba front ${suffix}`, description: 'Fixture de integración', picture: null });
  categoryId = category.id;
  const payload = { productName: `Prueba front ${suffix}`, categoryId, supplierId: suppliers.items[0].id, quantityPerUnit: '1 unidad', unitPrice: 100.25, unitsInStock: 5, unitsOnOrder: 0, reorderLevel: 1, discontinued: false };
  const created = await request('/Products', 'POST', payload); productIds.push(created.product.id);
  assert.equal(created.category.id, categoryId);
  const edited = await request(`/Products/${created.product.id}`, 'PUT', { ...payload, unitPrice: 150.75 });
  assert.equal(edited.product.unitPrice, 150.75);
  const filtered = await request(`/Products?categoryId=${categoryId}&page=1&pageSize=10&minPrice=150&sortBy=Price`);
  assert.equal(filtered.totalCount, 1);
  const generated = await request('/Product', 'POST', { count: 2, categoryIds: [categoryId], supplierId: suppliers.items[0].id, namePrefix: `Prueba ${suffix}`, minPrice: 1, maxPrice: 2 });
  assert.equal(generated.createdCount, 2);
  const all = await request(`/Products?categoryId=${categoryId}&pageSize=100`);
  for (const item of all.items) if (!productIds.includes(item.id)) productIds.push(item.id);
  assert.equal(all.totalCount, 3);
  console.log('OK: registro/login, clientes, proveedores, categorías, CRUD de producto, filtros, generación de 2 productos y permisos reales.');
} finally {
  if (adminToken) token = adminToken;
  for (const id of productIds) await request(`/Products/${id}`, 'DELETE');
  if (categoryId) await request(`/Categories/${categoryId}`, 'DELETE');
  if (customerId) await request(`/Customers/${customerId}`, 'DELETE');
  if (supplierId) await request(`/Suppliers/${supplierId}`, 'DELETE');
  if (fixtureUserId && adminToken) await request(`/UserAdministration/Users/${fixtureUserId}`, 'DELETE');
  if (fixtureUserId && !adminToken) console.log(`Cuenta técnica conservada: ${email}`);
  if (adminToken) console.log('Finalizó la limpieza de los registros de prueba creados (eliminación lógica).');
} }
await check();
