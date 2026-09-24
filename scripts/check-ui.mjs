import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Isolated browser fixtures: no real user data or backend writes.
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('artifacts', { recursive: true });
const user = { id: 1, firstName: 'Andrea', lastName: 'Gómez', email: 'andrea@example.com', roleId: 1, roleName: 'Admin', active: true };
const category = { id: 1, categoryName: 'CLOUD', description: 'Servicios e infraestructura en la nube', hasPicture: false };
const products = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, productName: ['Servidor de aplicaciones', 'Almacenamiento empresarial', 'Instancia cloud dedicada', 'Servidor de respaldo'][index % 4], categoryId: 1, categoryName: 'CLOUD', supplierId: 1, supplierName: 'Proveedor principal', quantityPerUnit: '1 unidad', unitPrice: 1200 + index * 55.5, unitsInStock: 12 + index, unitsOnOrder: 0, reorderLevel: 2, discontinued: index === 5 }));
const paged = items => ({ items, totalCount: items.length, page: 1, pageSize: 20 });
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname.replace('/api', '');
  let body;
  if (path === '/Products') body = paged(products);
  else if (/^\/Products\/\d+$/.test(path)) body = { product: products[0], category };
  else if (path === '/Categories') body = paged([category]);
  else if (path === '/Suppliers') body = paged([{ id: 1, companyName: 'Proveedor principal' }]);
  else if (path === '/UserAdministration/Users') body = paged([{ ...user, id: 2, roleId: 2, roleName: 'User' }]);
  else if (path === '/UserAdministration/Users/1') body = user;
  else if (path === '/UserAdministration/Roles') body = paged([{ id: 1, name: 'Admin', active: true }, { id: 2, name: 'User', active: true }, { id: 3, name: 'Operador', active: true }]);
  else if (path === '/UserAdministration/Roles/2') body = { id: 2, name: 'User', active: true };
  else return route.fulfill({ status: 404, json: { description: 'Fixture no definida' } });
  await route.fulfill({ json: body });
});
await page.addInitScript(user => localStorage.setItem('finanzauto.session', JSON.stringify({ user, accessToken: 'visual-test', expiresAtUtc: new Date(Date.now() + 3600000).toISOString() })), user);
try {
  await page.goto('http://127.0.0.1:5173/productos');
  await page.getByRole('link', { name: 'Servidor de aplicaciones', exact: true }).first().waitFor();
  await page.screenshot({ path: 'artifacts/portal-desktop.png', fullPage: true });
  await page.getByRole('link', { name: '+ Nuevo producto' }).click();
  await page.getByLabel('Nombre del producto').waitFor();
  await page.screenshot({ path: 'artifacts/product-form.png', fullPage: true });
  await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
  await page.getByText('andrea@example.com', { exact: true }).waitFor();
  await page.getByRole('button', { name: '+ Nuevo usuario' }).click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: 'artifacts/admin-user-form.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await page.getByLabel('Nombres').waitFor();
  await page.screenshot({ path: 'artifacts/profile.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Productos', exact: true }).click();
  await page.getByRole('link', { name: 'Servidor de aplicaciones', exact: true }).first().waitFor();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: 'artifacts/portal-mobile.png', fullPage: true, animations: 'disabled' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No debe haber desbordamiento horizontal de la página móvil');
  assert.deepEqual(errors, [], 'Errores de ejecución del navegador');
  console.log('OK: navegación Admin, catálogo, formularios, perfil y móvil; sin errores JavaScript. Capturas en artifacts/.');
} finally { await browser.close(); }
