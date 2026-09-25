# Finanzauto · Portal React

SPA React con login, registro, catálogo, administración por rol y perfil. Consume la API .NET mediante un proxy `/api` y conserva el JWT en `localStorage`, conforme a la prueba técnica.

Para una explicación detallada de React, la arquitectura, los flujos y las decisiones de diseño, consulta [la guía del proyecto](GUIA_DEL_PROYECTO.md).

## Ejecutar

Requiere Node.js 22.12+ y backend en `http://localhost:8080`.

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir http://127.0.0.1:5173. En otras terminales se puede usar `npm`. Copiar `.env.example` a `.env` para cambiar `API_PROXY_TARGET`.

```powershell
npm.cmd test
npm.cmd run build
```

El servidor de producción debe servir `dist`, resolver rutas SPA con `index.html` y reenviar `/api/*` a la API quitando el prefijo. `vite preview` no sustituye al proxy de producción.

## Funciones y permisos

| Pantalla | Todos los roles autenticados | Admin |
|---|---|---|
| Productos | Búsqueda, filtros, paginación, orden y detalle con imagen de categoría | Crear, editar y eliminar |
| Categorías | Consultar detalles e imagen | Crear, editar, reemplazar/quitar imagen y eliminar |
| Proveedores | Búsqueda por nombre, ciudad y país; detalle | CRUD e importación JSON de 1–1.000 registros |
| Transportadoras | Búsqueda por empresa/teléfono, paginación, detalle, creación, edición y eliminación | Las mismas funciones |
| Órdenes | Búsqueda, filtros, paginación, detalle, creación, edición, eliminación de órdenes y líneas | Las mismas funciones |
| Carga masiva | Sin acceso de escritura | Generar entre 1 y 100.000 productos con confirmación |
| Usuarios (Employee) | Sin sección ni acceso por URL | Crear/editar empleados User, activar/desactivar y restablecer contraseña |
| Roles | Sin sección ni acceso por URL | CRUD de roles personalizados; Admin y User protegidos |
| Clientes (Customers) | Sin sección ni acceso por URL | Consulta, detalle, CRUD e importación JSON de 1–1.000 registros |
| Mi perfil | Consultar/editar datos personales y de contacto; cambiar contraseña propia | Las mismas funciones para su cuenta |

La API cambió durante la integración: ahora las escrituras de catálogo y socios requieren `AdminOnly`. El frontend refleja esos permisos; los demás roles comparten las mismas funciones de lectura. La API es responsable de autorizar todas las operaciones.

La gestión de empleados envía `roleId=2` en consultas y creación/edición, conforme al rol User fijo en `UserAdministrationService`. No modifica cuentas Admin desde esa sección. Antes de editar comprueba nuevamente que el empleado mantiene rol User.

## Contratos utilizados

- Login: `POST /Login`, `{ email, password }`.
- Registro: `POST /UserAdministration/Register`, `{ firstName, lastName, email, password }`.
- Productos: `GET/POST /Products`, `GET/PUT/DELETE /Products/{id}`.
- Generación: `POST /Product`, `{ count, categoryIds, supplierId, namePrefix, minPrice, maxPrice }`.
- Categorías: `POST /Category`, `GET /Categories`, `GET/PUT/DELETE /Categories/{id}`.
- Proveedores: `GET/POST /Suppliers`, `GET/PUT/DELETE /Suppliers/{id}`, `POST /Suppliers/Bulk`.
- Transportadoras: `GET/POST /Shippers`, `GET/PUT/DELETE /Shippers/{id}`. Escrituras con `{ companyName, phone }`: empresa obligatoria de hasta 200 caracteres, teléfono opcional de hasta 30. ID entero generado por el servidor. Todos los roles autenticados tienen acceso. La eliminación es lógica y devuelve 409 si existen pedidos activos; se muestra el mensaje del backend. No hay importación masiva para esta entidad.
- Clientes: `GET/POST /Customers`, `GET/PUT/DELETE /Customers/{id}`, `POST /Customers/Bulk`. El `id` es un entero autoincremental generado por el backend; creación, edición e importación envían solo datos de contacto, sin `id` ni `customerId`. Los JSON con identificadores se rechazan en el formulario de importación con una indicación para retirarlos.
- Perfil propio: `GET/PUT /Profile`. PUT recibe `firstName`, `lastName`, `email`, `birthDate`, `address`, `city`, `region`, `postalCode`, `country` y `homePhone`. El usuario se obtiene del JWT; no se envían `id` ni `roleId`. Todos los roles autenticados pueden gestionar su cuenta.
- Contraseña propia: `PUT /Profile/Password`, `{ currentPassword, newPassword }`, respuesta 204. Nueva contraseña de 12–128 caracteres; el frontend también pide confirmación, sin enviarla al servidor.
- Usuarios/roles: `/UserAdministration/Users`, `/UserAdministration/Roles`, operaciones por id y `POST .../{id}/Reactivate`.
- Restablecimiento: `PUT /UserAdministration/Users/ResetPassword`, `{ email, password }`, respuesta 204. La administración agrega `?id=...` para la cuenta seleccionada. El formulario público llama la ruta sin id; la recuperación sin sesión fue verificada manualmente por el usuario. No se presenta como un flujo de envío de correo.

Las consultas se paginan en el servidor; no se descargan 100.000 registros. Los selectores también tienen búsqueda y paginación. El detalle de producto conserva `{ product, category }`. Las imágenes admiten PNG/JPEG/WebP hasta 2 MiB y se preservan al editar textos. Los precios no suponen una moneda que la API no especifica.

La generación exige confirmación y no se reintenta automáticamente. Si se pierde la respuesta, se solicita revisar el catálogo antes de repetir. Crear primero SERVIDORES y CLOUD desde Categorías y seleccionarlas para reproducir el escenario de la prueba.

## Alcance adicional

Customers, transportadoras, órdenes con detalles, perfil propio y recuperación sin sesión ya están integrados. La sección `/transportadoras` se implementa en `src/portal/Shippers.jsx` y reutiliza los controles, diálogos y paginador compartidos; la tabla permanece visible mientras se actualiza y Buscar refresca incluso con los mismos criterios.

### Órdenes

`src/portal/Orders.jsx` ofrece `/ordenes`, `/ordenes/nueva`, `/ordenes/:id` y `/ordenes/:id/editar` para todos los roles autenticados, conforme al controlador actual. Consume `GET/POST /Orders`, `GET/PUT/DELETE /Orders/{id}` y `DELETE /Orders/{orderId}/Details/{detailId}`.

- Búsqueda por número de orden, destinatario o ciudad; filtros por cliente, ID de empleado, transportadora y rango de fechas. Consultas y selectores paginados en servidor.
- El formulario envía cliente, transportadora opcional, fechas UTC, flete, datos de envío y entre 1 y 1.000 detalles. Las fechas se muestran e introducen en hora local y se convierten a UTC al enviar.
- El empleado lo obtiene el backend de la sesión. No se envían empleado, precios unitarios ni totales: el servidor fija el precio al agregar cada producto y devuelve los importes calculados. Los detalles existentes conservan su precio histórico.
- Cada detalle envía producto, cantidad entera positiva y descuento entre 0 y 1 con hasta cuatro decimales. Se impiden productos duplicados. Al editar se conserva `orderDetailId`; el producto de una línea guardada no se puede cambiar.
- Omitir un detalle del PUT no lo elimina. Por eso las líneas guardadas se eliminan con confirmación desde el detalle de la orden mediante su endpoint específico. Las líneas nuevas se pueden quitar del formulario antes de guardar. Eliminar una orden desactiva también sus detalles.
- Se muestran IDs de cliente, empleado y productos cuando la respuesta no incluye nombres. Los productos del detalle enlazan al catálogo. Los errores del backend se muestran conservando el formulario; las operaciones exitosas usan el modal global.

Esta integración se compiló sin ejecutar pruebas funcionales ni automatizadas, conforme a la indicación vigente del usuario.

## Sesión e interfaz

- JWT y usuario en `finanzauto.session`, sin contraseñas almacenadas.
- Axios añade Bearer; 401 protegido limpia la sesión.
- Expiración y cambios de sesión sincronizados entre pestañas.
- Guard de autenticación y guard Admin para acceso directo por URL.
- Guardar el perfil mantiene la sesión y actualiza el nombre y correo visibles con la respuesta de la API, conservando el JWT y su vencimiento. Cambiar la contraseña vuelve al login.
- Validaciones del DTO, carga, errores de API y confirmaciones de desactivación.
- Modal global de resultado tras crear, actualizar, eliminar/desactivar, reactivar o completar cargas masivas. También cubre registro, perfil y contraseñas; aparece cuando la API confirma el éxito y permanece disponible al cambiar de pantalla.
- Navegación móvil, tablas con desplazamiento horizontal y diálogos accesibles.

## Docker y CI

El único Compose del conjunto está en el backend, `C:\Users\Administrador\source\repos\Finanzauto\docker-compose.yml`. Agrupa `front`, `api` y `db` en el proyecto `finanzauto`, con imágenes y contenedores separados. Ejecutar desde esa carpeta:

```powershell
cd C:\Users\Administrador\source\repos\Finanzauto
docker compose up --build -d
```

Abrir http://localhost:5174. El `.env` del backend define `FRONT_CONTEXT` con la ruta de esta carpeta; `.env.example` usa `../Front` para una disposición de carpetas hermanas. No se copia ni mueve el código del frontend. Nginx consume `api:8080` por la red común `finanzauto_default`; el volumen de PostgreSQL permanece como `finanzauto_postgres_data`. Para actualizar solo el frontend: `docker compose up --build -d --no-deps front` desde el backend. Ya no se usa el proyecto independiente `finanzauto-front`.

`.github/workflows/frontend.yml` instala dependencias, ejecuta pruebas, compila y construye Docker. Preparado para un repositorio cuya raíz sea esta carpeta; no se ha publicado ni ejecutado en GitHub.

## Verificación

La actualización de `/Profile` se realizó leyendo controladores, DTOs y servicio. Por solicitud del usuario se omitieron las pruebas de ese cambio y del modal global de resultado; los resultados siguientes corresponden a una versión anterior. Las pruebas y fixtures de perfil deberán actualizarse al nuevo contrato antes de ejecutarlas nuevamente.

- 2 pruebas de sesión y 16 de interfaz con Vitest/Testing Library: rutas, roles, CRUD, filtros, imágenes, confirmación, generación y perfil. API simulada en estas pruebas.
- `node scripts/check-ui.mjs`: Edge headless con datos simulados; navegación Admin y escritorio/móvil, capturas en `artifacts/`, sin errores JavaScript ni desbordamiento horizontal global. Requiere Edge instalado y Vite activo.
- `node scripts/check-api.mjs`: API real mediante Vite. Sin credenciales Admin verifica registro/login, lecturas, perfil y rechazo de escrituras User. Crea una cuenta técnica `portal.check.*@example.com` que permanece si no hay acceso Admin.
- Para comprobar escrituras reales, definir `CHECK_EMAIL`/`CHECK_PASSWORD` de un Admin vigente o `BACKEND_ENV_FILE` con bootstrap vigente. Crea fixtures propias y las desactiva al finalizar. No imprime contraseñas ni tokens. No se completó esa variante en esta sesión: el bootstrap actual devuelve 401; no se restablecieron cuentas existentes.
- Build e imagen Docker verificados. Las pruebas simuladas no sustituyen una prueba de todas las escrituras con credenciales Admin reales.

## Organización

`GUIA_DEL_PROYECTO.md`: explicación para aprender y mantener el proyecto. `src/components/OperationResult.jsx`: modal global de resultado. `src/lib/operation-feedback.js`: mensajes y cola de notificaciones de operaciones.

`src/main.jsx`: acceso público. `src/auth.jsx`: sesión y guard. `src/lib/api.js`: cliente HTTP. `src/portal/routes.jsx`: rutas modulares, con Products, Catalog, Partners, Administration y Profile. `shared.jsx`: controles, consultas cancelables, paginación, diálogos y selectores remotos. `policies.js`: reglas de rol.
