import React from 'react';
import { Navigate, Route } from 'react-router';
import Shell, { AdminGuard } from './Shell';
import { Products, ProductDetail, ProductEditor } from './Products';
import { Categories, Generation } from './Catalog';
import { Roles, Users } from './Administration';
import Partners from './Partners';
import Profile from './Profile';
import Shippers from './Shippers';
import { Orders, OrderDetail, OrderEditor } from './Orders';

export const portalRoutes = <Route element={<Shell/>}>
  <Route path="/inicio" element={<Navigate to="/productos" replace/>}/>
  <Route path="/productos" element={<Products/>}/>
  <Route path="/productos/:id" element={<ProductDetail/>}/>
  <Route path="/categorias" element={<Categories/>}/>
  <Route path="/transportadoras" element={<Shippers/>}/>
  <Route path="/ordenes" element={<Orders/>}/>
  <Route path="/ordenes/nueva" element={<OrderEditor/>}/>
  <Route path="/ordenes/:id" element={<OrderDetail/>}/>
  <Route path="/ordenes/:id/editar" element={<OrderEditor/>}/>
  <Route path="/proveedores" element={<Partners kind="suppliers"/>}/>
  <Route path="/mi-perfil" element={<Profile/>}/>
  <Route element={<AdminGuard/>}>
    <Route path="/productos/nuevo" element={<ProductEditor/>}/>
    <Route path="/productos/:id/editar" element={<ProductEditor/>}/>
    <Route path="/generacion" element={<Generation/>}/>
    <Route path="/admin" element={<Navigate to="/admin/usuarios" replace/>}/>
    <Route path="/admin/usuarios" element={<Users/>}/>
    <Route path="/admin/roles" element={<Roles/>}/>
    <Route path="/admin/clientes" element={<Partners kind="customers"/>}/>
  </Route>
</Route>;
