// A small in-memory queue shared by Axios (plain JS) and the React modal.
// Store messages only, never request bodies, tokens or passwords.
let messages = [];
let nextId = 0;
const listeners = new Set();

export function subscribeToFeedback(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFeedbackSnapshot() { return messages; }

export function showSuccess({ title, message }) {
  messages = [...messages, { id: ++nextId, title, message }];
  listeners.forEach(listener => listener());
}

export function dismissFeedback(id) {
  messages = messages.filter(message => message.id !== id);
  listeners.forEach(listener => listener());
}

export function successForResponse(response) {
  const { config, status, data } = response;
  if (![200, 201, 204].includes(status) || config.successFeedback === false) return null;
  const method = config.method?.toLowerCase();
  if (!['post', 'put', 'patch', 'delete'].includes(method)) return null;
  if (config.successFeedback?.title && config.successFeedback?.message) return config.successFeedback;
  const path = (config.url || '').split('?')[0].replace(/\/+$/, '');

  if (path === '/Login') return null;
  if (path === '/UserAdministration/Register') return {
    title: 'Cuenta creada', message: 'Tu cuenta se creó correctamente. Ya puedes iniciar sesión.',
  };
  if (path === '/Profile/Password') return {
    title: 'Contraseña actualizada', message: 'Tu contraseña se cambió correctamente. Inicia sesión con la nueva contraseña.',
  };
  if (path === '/UserAdministration/Users/ResetPassword') return {
    title: 'Contraseña restablecida', message: 'La contraseña se restableció correctamente.',
  };
  if (path === '/Profile') return {
    title: 'Perfil actualizado', message: 'Tus datos se guardaron correctamente.',
  };
  if (path === '/Product' || /^\/(Customers|Suppliers)\/Bulk$/.test(path)) {
    const subject = path === '/Product' ? 'productos' : path.startsWith('/Customers') ? 'clientes' : 'proveedores';
    const count = Number.isInteger(data?.createdCount) ? data.createdCount.toLocaleString('es-CO') : null;
    return { title: path === '/Product' ? 'Productos generados' : 'Importación completada', message: count ? `Se crearon ${count} ${subject} correctamente.` : 'La creación de los registros finalizó correctamente.' };
  }
  if (/^\/UserAdministration\/(Users|Roles)\/\d+\/Reactivate$/.test(path)) {
    const subject = path.includes('/Users/') ? 'Usuario' : 'Rol';
    return { title: `${subject} reactivado`, message: `El ${subject.toLowerCase()} se reactivó correctamente.` };
  }

  const entities = [
    [/^\/Orders\/\d+\/Details\/\d+$/, 'Detalle de orden', false],
    [/^\/Orders(?:\/\d+)?$/, 'Orden', true],
    [/^\/Shippers(?:\/\d+)?$/, 'Transportadora', true],
    [/^\/Products(?:\/[^/]+)?$/, 'Producto', false],
    [/^\/(?:Category|Categories)(?:\/[^/]+)?$/, 'Categoría', true],
    [/^\/Suppliers(?:\/[^/]+)?$/, 'Proveedor', false],
    [/^\/Customers(?:\/[^/]+)?$/, 'Cliente', false],
    [/^\/UserAdministration\/Users(?:\/\d+)?$/, 'Usuario', false],
    [/^\/UserAdministration\/Roles(?:\/\d+)?$/, 'Rol', false],
  ];
  const entity = entities.find(([pattern]) => pattern.test(path));
  if (!entity) return null;
  const [, label, feminine] = entity;
  const article = feminine ? 'La' : 'El';
  const ending = feminine ? 'a' : 'o';
  if (method === 'delete') {
    const deactivation = label === 'Usuario' || label === 'Rol';
    return {
      title: `${label} ${deactivation ? 'desactivad' : 'eliminad'}${ending}`,
      message: `${article} ${label.toLowerCase()} se desactivó correctamente. El registro se conserva en el historial.`,
    };
  }
  return method === 'post'
    ? { title: `${label} cread${ending}`, message: `${article} ${label.toLowerCase()} se creó correctamente.` }
    : { title: `${label} actualizad${ending}`, message: `${article} ${label.toLowerCase()} se actualizó correctamente.` };
}
