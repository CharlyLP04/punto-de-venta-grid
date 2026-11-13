# Mario POS 0.2.0 · Grid MX

Aplicación de escritorio para Windows con Tauri 2, React 19, Rust y SQLite.
Esta edición incorpora los cambios de Grid POS hasta `39ce353`, conservando la identidad y los datos de Mario.

## Desarrollo local

Requisitos: Node.js 20.19+ o 22.12+, Rust estable MSVC, Visual Studio C++ Build Tools, Windows SDK y WebView2.
Desde la carpeta del repositorio:

```powershell
npm ci
npm run desktop
```

`npm run dev` sirve para desarrollar la interfaz; las ventas reales requieren la aplicación Tauri.

## Actualización 0.2.0

- Historial de clientes, cargos y abonos; registros de movimientos de efectivo y cortes.
- Filtros compactos, marcas y sub-marcas en productos, inventario y proveedores.
- Navegación accesible, mejoras de contraste y carga diferida de paneles.
- Actualización de datos sin respuestas obsoletas y cálculos de tickets reutilizados.
- Impresión en cola, cierre que espera operaciones activas y conexión multicaja con certificado emparejado.
- Tema Mario/Luigi, iconos, preferencias por usuario y nombre comercial de Mario conservados.
- Caja y botón de cobro visibles a 1050×720, en PC y táctil, sin superposición con el catálogo.
- Vite 6.4.6 y exclusión de los archivos de compilación Rust del observador de desarrollo para evitar bloqueos en Windows.

## Datos y compatibilidad

Se mantienen el identificador `mx.grid.mario-pos`, el archivo `mario.sqlite`, los respaldos `mario-*.sqlite`, las claves locales `mario_*` y el ejecutable `mario-pos.exe`.
La actualización no cambia la ubicación de la base instalada por Mario 0.1.0. Los cambios se prepararon sin abrir ni modificar la base real del negocio.
Antes de instalar una actualización en la caja, exportar un respaldo desde la aplicación y conservarlo fuera del equipo.

El instalador NSIS conserva WebView2 offline silencioso:

```powershell
npm run installer
```

El instalador se genera en `src-tauri/target/release/bundle/nsis`. Construirlo requiere descargar el runtime; el ejecutable suelto no instala WebView2.

## Validación local

```powershell
npm run build
npm run test:native
npm run test:ui
npm audit
```

- Compilación TypeScript/Vite verificada.
- 15 pruebas nativas: ventas atómicas, importación, persistencia, migración, permisos, multicaja y certificado TLS.
- 12 pruebas de interfaz: producto común, permisos, filtros, importación, flujo fiscal simulado, acceso Mario y persistencia del tema. Incluyen accesibilidad y geometría de caja en claro/oscuro y PC/táctil.
- La interfaz usa un puente IPC simulado; las pruebas Rust validan las operaciones nativas por separado.
- Auditoría npm sin vulnerabilidades al preparar esta actualización.

No se validaron impresora, báscula ni una instalación en un equipo limpio. El flujo fiscal probado usa respuestas simuladas; no acredita timbrado real. No se generó ni instaló un instalador de producción.

## Alcance Git

Trabajo preparado en la rama local `codex/mario-actualizado`, basada en `origin/mario` e integrada con `origin/main`. No se publicó a GitHub ni se modificaron las ramas remotas.
