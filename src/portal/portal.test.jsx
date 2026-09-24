import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { AuthGuard, AuthProvider } from '../auth';
import { SESSION_KEY } from '../lib/session';
import { api } from '../lib/api';
import { portalRoutes } from './routes';

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }, errorMessage: error => error.response?.data?.description || error.message || 'Error de conexión' }));
const category = { id: 7, categoryName: 'CLOUD', description: 'Servicios cloud', picture: 'aW1hZ2U=', pictureContentType: 'image/png', hasPicture: true };
const product = { id: 42, productName: 'Servidor principal', categoryId: 7, categoryName: 'CLOUD', supplierId: 3, supplierName: 'Proveedor local', unitPrice: 1200.5, unitsInStock: 5, unitsOnOrder: 0, reorderLevel: 2, quantityPerUnit: '1 unidad', discontinued: false };
const employee = { id: 9, firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', roleId: 2, roleName: 'User', active: true };
const page = items => ({ items, totalCount: items.length, page: 1, pageSize: 20 });
function open(path, role = 'User') {
  if (role) localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: 'test-token', expiresAtUtc: new Date(Date.now() + 3600000).toISOString(), user: { id: 1, firstName: 'Test', lastName: 'Local', email: 'test@example.com', roleName: role, roleId: role === 'Admin' ? 1 : 2 } }));
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><Routes><Route path="/login" element={<h1>Acceso público</h1>}/><Route element={<AuthGuard/>}>{portalRoutes}</Route></Routes></AuthProvider></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  api.get.mockImplementation(async path => {
    if (path === '/Products') return { data: page([product]) };
    if (path === '/Products/42') return { data: { product, category } };
    if (path === '/Categories') return { data: page([category]) };
    if (path === '/Categories/7') return { data: category };
    if (path === '/Suppliers') return { data: page([{ id: 3, companyName: 'Proveedor local' }]) };
    if (path === '/Customers') return { data: page([{ id: 1, companyName: 'Cliente local', contactName: 'Ana', city: 'Bogotá' }]) };
    if (path === '/UserAdministration/Users') return { data: page([employee]) };
    if (path === '/UserAdministration/Users/9') return { data: employee };
    if (path === '/UserAdministration/Users/1') return { data: { ...employee, id: 1, roleId: 1, roleName: 'Admin' } };
    if (path === '/UserAdministration/Roles/2') return { data: { id: 2, name: 'User', active: true } };
    if (path === '/UserAdministration/Roles') return { data: page([{ id: 1, name: 'Admin', active: true }, { id: 2, name: 'User', active: true }, { id: 3, name: 'Operador', active: true }]) };
    throw new Error(`Unexpected GET ${path}`);
  });
  api.put.mockResolvedValue({ data: { product, category } }); api.post.mockResolvedValue({ data: { product, category } }); api.delete.mockResolvedValue({ status: 204 });
});
describe('Permisos y rutas', () => {
  it('requiere sesión para el catálogo', async () => { open('/productos', null); expect(await screen.findByText('Acceso público')).toBeTruthy(); expect(api.get).not.toHaveBeenCalled(); });
  it.each(['User', 'Operador'])('oculta y bloquea administración para %s incluso por URL', async role => { open('/admin/usuarios', role); expect(await screen.findByRole('heading', { name: 'Productos' })).toBeTruthy(); expect(screen.queryByRole('link', { name: /Usuarios/ })).toBeNull(); expect(api.get.mock.calls.some(([path]) => path.startsWith('/UserAdministration'))).toBe(false); });
  it('Admin administra solamente empleados User y crea sin escoger otro rol', async () => {
    open('/admin/usuarios', 'Admin'); await screen.findByText('ana@example.com');
    expect(api.get).toHaveBeenCalledWith('/UserAdministration/Users', expect.objectContaining({ params: expect.objectContaining({ roleId: 2 }) }));
    const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: '+ Nuevo usuario' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Nombres'), 'Luis'); await user.type(dialog.getByLabelText('Apellidos'), 'Gómez'); await user.type(dialog.getByLabelText('Correo electrónico'), 'luis@example.com'); await user.type(dialog.getByLabelText('Contraseña inicial'), 'ClaveSegura2026'); await user.type(dialog.getByLabelText('Confirmar contraseña'), 'ClaveSegura2026'); await user.click(dialog.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/UserAdministration/Users', { firstName: 'Luis', lastName: 'Gómez', email: 'luis@example.com', roleId: 2, password: 'ClaveSegura2026' }));
  });
  it('protege los roles base y habilita edición de los personalizados', async () => { open('/admin/roles', 'Admin'); await screen.findByText('Operador'); expect(screen.getAllByText('Rol base protegido')).toHaveLength(2); expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(1); });
  it('consulta clientes desde su servicio y permite crearlos como Admin', async () => { open('/admin/clientes', 'Admin'); expect(await screen.findByText('Cliente local')).toBeTruthy(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: '+ Nuevo cliente' })); const dialog = within(screen.getByRole('dialog')); await user.type(dialog.getByLabelText('Empresa'), 'Empresa nueva'); await user.click(dialog.getByRole('button', { name: 'Guardar cambios' })); await waitFor(() => expect(api.post).toHaveBeenCalledWith('/Customers', expect.objectContaining({ companyName: 'Empresa nueva' }))); });
  it('User no accede a formularios de escritura del catálogo', async () => { open('/productos/nuevo'); expect(await screen.findByRole('heading', { name: 'Productos' })).toBeTruthy(); expect(screen.queryByRole('link', { name: '+ Nuevo producto' })).toBeNull(); expect(screen.queryByRole('link', { name: 'Carga masiva' })).toBeNull(); });
});
describe('Catálogo conectado', () => {
  it('envía búsqueda y paginación al servidor', async () => {
    open('/productos'); await screen.findByText('Servidor principal'); const user = userEvent.setup();
    await user.type(screen.getByLabelText('Buscar producto'), 'servidor'); await user.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/Products', expect.objectContaining({ params: expect.objectContaining({ search: 'servidor', page: 1, pageSize: 20 }) })));
  });
  it('muestra detalle e imagen de categoría', async () => { open('/productos/42'); expect(await screen.findByRole('img', { name: 'Imagen de CLOUD' })).toBeTruthy(); expect(screen.getByText('Servicios cloud')).toBeTruthy(); });
  it('edita un producto enviando números y referencias correctas', async () => {
    open('/productos/42/editar', 'Admin'); const input = await screen.findByLabelText('Precio unitario'); const user = userEvent.setup(); await user.clear(input); await user.type(input, '1500.25'); await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/Products/42', expect.objectContaining({ unitPrice: 1500.25, categoryId: 7, supplierId: 3, discontinued: false })));
  });
  it('requiere confirmación antes de eliminar', async () => {
    open('/productos', 'Admin'); await screen.findByText('Servidor principal'); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Eliminar' })); expect(api.delete).not.toHaveBeenCalled(); await user.click(screen.getByRole('button', { name: 'Confirmar' })); await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/Products/42'));
  });
  it('preserva la imagen de categoría al editar sus textos', async () => {
    open('/categorias', 'Admin'); await screen.findByText('CLOUD'); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Ver / editar' })); await screen.findByDisplayValue('Servicios cloud'); await user.click(screen.getByRole('button', { name: 'Guardar cambios' })); await waitFor(() => expect(api.put).toHaveBeenCalledWith('/Categories/7', expect.objectContaining({ picture: 'aW1hZ2U=' })));
  });
  it('confirma la generación y muestra el resultado sin descargar todos los productos', async () => {
    api.post.mockResolvedValue({ data: { createdCount: 100000, elapsedMilliseconds: 123, generationId: 'generation-test' } });
    open('/generacion', 'Admin'); await screen.findByRole('option', { name: 'CLOUD' }); const user = userEvent.setup(); await user.selectOptions(screen.getByLabelText('Proveedor'), '3'); await user.selectOptions(screen.getByLabelText('Categoría a agregar'), '7'); await user.click(screen.getByRole('button', { name: 'Agregar a la distribución' })); await user.click(screen.getByRole('button', { name: 'Generar productos' })); expect(api.post).not.toHaveBeenCalled(); await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/Product', expect.objectContaining({ count: 100000, categoryIds: [7], supplierId: 3 }), { timeout: 300000 })); expect(await screen.findByText('100.000 productos creados')).toBeTruthy();
  });
  it('muestra errores del servidor y permite reintentar la consulta', async () => {
    const original = api.get.getMockImplementation(); let failed = false;
    api.get.mockImplementation((path, config) => { if (path === '/Products' && !failed) { failed = true; return Promise.reject(new Error('Servicio temporalmente no disponible')); } return original(path, config); });
    open('/productos'); expect(await screen.findByRole('alert')).toBeTruthy(); await userEvent.click(screen.getByRole('button', { name: 'Volver a intentar' })); expect(await screen.findByText('Servidor principal')).toBeTruthy();
  });
});
describe('Mi perfil', () => {
  it('User consulta su perfil y ve las escrituras pendientes', async () => { open('/mi-perfil'); const input = await screen.findByLabelText('Nombres'); expect(input.readOnly).toBe(true); expect(screen.queryByRole('button', { name: 'Guardar mis datos' })).toBeNull(); expect(api.get).toHaveBeenCalledWith('/UserAdministration/Users/1', expect.anything()); expect(screen.getByRole('button', { name: 'Cambiar contraseña' }).disabled).toBe(true); });
  it('Admin guarda su perfil conservando su rol y vuelve al login', async () => { open('/mi-perfil', 'Admin'); await screen.findByDisplayValue('ana@example.com'); await userEvent.click(screen.getByRole('button', { name: 'Guardar mis datos' })); await waitFor(() => expect(api.put).toHaveBeenCalledWith('/UserAdministration/Users/1', expect.objectContaining({ roleId: 1, email: 'ana@example.com' }))); expect(await screen.findByText('Acceso público')).toBeTruthy(); expect(localStorage.getItem(SESSION_KEY)).toBeNull(); });
});
