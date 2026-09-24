import React, { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth';
import { isAdmin } from './policies';
import './portal.css';

export function AdminGuard() { return isAdmin(useAuth().session?.user) ? <Outlet/> : <Navigate to="/productos" replace/>; }
export default function Shell() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const links = [['/productos', '▦', 'Productos'], ['/categorias', '◈', 'Categorías'], ['/proveedores', '▤', 'Proveedores'], ['/generacion', '↗', 'Carga masiva']];
  const adminLinks = [['/admin/usuarios', '♙', 'Usuarios'], ['/admin/roles', '⌘', 'Roles'], ['/admin/clientes', '▣', 'Clientes']];
  function nav(items) { return items.map(([to, icon, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)}><span aria-hidden="true">{icon}</span>{label}</NavLink>); }
  return <div className="portal"><aside className={`sidebar ${open ? 'open' : ''}`}><NavLink className="portal-brand" to="/productos">finanzauto<span>.</span></NavLink><div className="workspace-label">PORTAL DE GESTIÓN</div><nav aria-label="Menú principal"><div className="nav-label">OPERACIÓN</div>{nav(links.filter(([path]) => path !== '/generacion' || isAdmin(session.user)))}{isAdmin(session.user) && <><div className="nav-label">ADMINISTRACIÓN</div>{nav(adminLinks)}</>}<div className="nav-label">MI CUENTA</div>{nav([['/mi-perfil', '○', 'Mi perfil']])}</nav><div className="sidebar-bottom"><span className="status-dot"/> Tu operación, conectada</div></aside><div className="portal-body"><header className="topbar"><button className="icon-button menu-toggle" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Abrir menú">☰</button><span className="breadcrumb">Portal <span>/</span> {([...links, ...adminLinks, ['/mi-perfil', '', 'Mi perfil']].find(([path]) => location.pathname.startsWith(path)) || links[0])[2]}</span><div className="account"><span className="avatar">{session.user.firstName?.[0]}{session.user.lastName?.[0]}</span><div><strong>{session.user.firstName} {session.user.lastName}</strong><small>{session.user.roleName}</small></div><button className="text-button" onClick={logout}>Salir</button></div></header><main className="portal-content"><Outlet/></main><footer className="portal-footer">Finanzauto · Portal de gestión<span>© {new Date().getFullYear()}</span></footer></div></div>;
}
