# Mario POS 0.2.0 · Grid MX

Aplicación nativa de Punto de Venta para escritorio en Windows (**Windows 10 / 11 de 64 bits**), construida con **Tauri 2, React 19, Rust y SQLite**. Opera 100 % local y sin depender de internet para cobrar, gestionar inventario, clientes, créditos, turnos ni respaldos.

Esta edición `0.2.0` incorpora todas las mejoras operativas, de diseño, accesibilidad, multicaja y velocidad de Grid POS, conservando intactos el identificador `mx.grid.mario-pos`, la base de datos `mario.sqlite` y la identidad visual de **Super Mario Tienda**.

---

## 1. Guía rápida: Instalación desde cero (PC nueva o sin internet)

El instalador oficial (`Mario POS_0.2.0_x64-setup.exe`) **incluye el instalador offline de Microsoft Edge WebView2** y lo ejecuta en modo silencioso si el sistema aún no lo tiene (ideal para **Windows 10 LTSC** o equipos de mostrador sin conexión a internet).

1. **Verificar sistema operativo:**
   - En la PC de la tienda, abre **Inicio → Configuración → Sistema → Acerca de**.
   - Confirma que en **Tipo de sistema** indique **Sistema operativo de 64 bits, procesador x64** (Windows 10 o Windows 11). *No es compatible con Windows 7/8/8.1 ni sistemas de 32 bits.*
2. **Transferir el instalador:**
   - Copia el archivo completo `Mario POS_0.2.0_x64-setup.exe` (aprox. 213 MB) a una memoria USB y conéctala en la PC destino.
   - **Importante:** Nunca copies únicamente el archivo suelto `mario-pos.exe` a una PC nueva, ya que el ejecutable suelto no instala WebView2.
3. **Ejecutar el instalador:**
   - Haz doble clic sobre `Mario POS_0.2.0_x64-setup.exe`.
   - Si aparece la ventana azul de Windows SmartScreen (*"Windows protegió su PC"*), haz clic en **Más información** y luego en **Ejecutar de todas formas** (aparece porque el paquete no lleva firma comercial EV).
   - Acepta los permisos de administrador y sigue los pasos (**Siguiente → Instalar → Finalizar**). Puede tardar de 1 a 2 minutos mientras instala WebView2 en segundo plano.
4. **Abrir y configurar:**
   - Abre **Mario POS** desde el acceso directo del Escritorio o el menú Inicio.

---

## 2. Cómo actualizar de Mario POS 0.1.0 a 0.2.0 sin perder datos

La versión `0.2.0` utiliza exactamente la misma ruta de datos que `0.1.0`:
- **Identificador de aplicación:** `mx.grid.mario-pos`
- **Carpeta de datos:** `%APPDATA%\mx.grid.mario-pos` (ej. `C:\Users\<TuUsuario>\AppData\Roaming\mx.grid.mario-pos`)
- **Base de datos:** `mario.sqlite`
- **Respaldos automáticos y manuales:** `%APPDATA%\mx.grid.mario-pos\respaldos`

### Paso a paso seguro en la tienda

1. **Respaldo desde la aplicación (con Mario POS 0.1.0 abierto):**
   - Entra a **Administración → Respaldos** y exporta un respaldo hacia tu memoria USB.
   - Verifica en la USB que el archivo `.sqlite` se haya creado y tenga tamaño mayor a 0 KB.
2. **Cerrar todas las cajas:**
   - Termina cualquier cobro o impresión pendiente y **cierra Mario POS**.
   - Si usas multicaja en red local, cierra primero todas las cajas secundarias y actualiza primero la **Caja principal**.
3. **Respaldo físico de la carpeta de datos (con Mario POS cerrado):**
   - Presiona `Win + R`, escribe `%APPDATA%\mx.grid.mario-pos` y presiona **Enter**.
   - Copia toda esa carpeta a tu memoria USB dentro de una carpeta llamada `respaldo-Mario-antes-0.2.0` (asegúrate de incluir `mario.sqlite` y, si existen, `mario.sqlite-wal` y `mario.sqlite-shm`).
   - **No borres ni muevas los archivos originales de la PC.**
   - *Si esa carpeta no existe o no tiene `mario.sqlite`, detente antes de instalar y verifica con qué usuario de Windows se opera normalmente la caja.*
4. **Instalar la actualización 0.2.0:**
   - Asegúrate de estar en la **misma cuenta de usuario de Windows** donde siempre se usa Mario POS.
   - Si usas el paquete `Mario-POS-0.2.0-Tienda.zip`, descomprímelo completo en una carpeta y ejecuta **`ACTUALIZAR-MARIO.cmd`** (que lanza `Mario POS_0.2.0_x64-setup.exe /UPDATE`), o bien ejecuta directamente `Mario POS_0.2.0_x64-setup.exe`.
   - **Nunca desinstales la versión anterior manualmente** ni marques opciones de borrar datos de la aplicación.
5. **Comprobación antes de empezar a vender:**
   - Abre Mario POS e inicia sesión con tu usuario habitual.
   - Verifica que estén presentes:
     - Tu catálogo de productos y existencias reales.
     - Clientes registrados, saldos pendientes e historial de abonos.
     - Historial de ventas y cortes anteriores.
   - Realiza una prueba de impresión si tienes impresora de tickets configurada.

### ⚠️ Qué hacer si al abrir aparece una tienda vacía o pide "Crear propietario"
- **Detente inmediatamente.** No crees una cuenta nueva, no importes catálogo ni registres ventas.
- Cierra Mario POS y revisa que hayas iniciado sesión con el **mismo usuario de Windows** de la tienda (cada usuario de Windows tiene su propia carpeta `%APPDATA%`).
- Verifica que el archivo `%APPDATA%\mx.grid.mario-pos\mario.sqlite` siga en su lugar. Si necesitas restaurar, utiliza tu respaldo en USB desde el centro de respaldos o solicita revisión antes de sobrescribir archivos.

---

## 3. Optimizaciones para Windows 10 y experiencia de usuario (0.2.0)

### Mejoras de velocidad y fluidez en el código
- **Búsqueda instantánea sin reordenar en cada tecla:** El filtrado del catálogo reutiliza un índice alfabético en memoria (`WeakMap`) y textos pre-normalizados sin acentos. Al escribir en el buscador o pasar el lector de código de barras, solo se filtran coincidencias sin volver a ejecutar `Intl.Collator` sobre los más de 1,300 productos en cada pulsación.
- **Consultas SQLite precompiladas (`prepare_cached`) y caché en RAM:** Las lecturas del estado de caja reutilizan sentencias compiladas en SQLite y operan con `PRAGMA temp_store = MEMORY` y `PRAGMA cache_size = -16000` (16 MB de caché de páginas en RAM), manteniendo la seguridad transaccional de `journal_mode = WAL` y `synchronous = FULL`.
- **Cálculo de catálogo en una sola pasada (CTEs):** Las existencias disponibles, lotes caducados y promociones activas se pre-agregan mediante CTEs en una sola lectura en lugar de ejecutar subconsultas correlacionadas por cada producto.
- **Totales del día indexados:** El cálculo de ventas y devoluciones del día emplea rangos UTC indexados (`idx_sales_created`, `idx_sales_user_created`, `idx_refunds_created`, `idx_refunds_user_created`) evitando escaneos completos de la tabla `sales`.
- **Migración segura v6 → v7 sobre bases en producción:** La actualización del esquema para soporte multicaja (`registers` y `shifts.register_id`) gestiona de forma atómica las restricciones de llave foránea en SQLite cuando la tienda ya cuenta con turnos abiertos o históricos, verificando `pragma_foreign_key_check` antes de confirmar.
- **Adaptación a pantallas Windows 10 con escala (DPI 125 % / 150 %):** La altura mínima de ventana baja a `1050×600` píxeles lógicos, permitiendo que pantallas de `1366×768` o con ampliación de texto en Windows 10 muestren siempre la barra de cobro y acciones sin recortes.

### Recomendaciones en Windows 10 para que la caja vuele
1. **Plan de energía en Alto rendimiento:** En *Panel de control → Opciones de energía*, selecciona **Alto rendimiento** y desactiva la suspensión automática del disco duro y del equipo en horario de tienda.
2. **Desactivar suspensión selectiva de USB (para escáner e impresora):** En *Opciones de energía → Cambiar la configuración del plan → Cambiar la configuración avanzada de energía → Configuración de USB*, pon **Configuración de suspensión selectiva de USB** en **Deshabilitado** para evitar que el lector de barras o el puerto COM tarden en despertar.
3. **Respetar el cierre limpio:** Siempre cierra Mario POS desde el botón `X` de la ventana y espera si indica *"Cerrando operaciones…"* antes de apagar la PC.

---

## 4. Desarrollo local y compilación

Requisitos de desarrollo: Node.js 20.19+ o 22.12+, Rust estable (`msvc`), Visual Studio C++ Build Tools, Windows SDK y WebView2.

```powershell
# Instalar dependencias exactas
npm ci

# Ejecutar en modo desarrollo nativo
npm run desktop

# Generar el instalador NSIS completo con WebView2 offline
npm run installer
```

El instalador queda en `src-tauri/target/release/bundle/nsis/Mario POS_0.2.0_x64-setup.exe`.

### Validación automatizada

```powershell
npm run build
npm run test:native
npm run test:ui
```

- **17 pruebas nativas (Rust):** ventas atómicas, importación Excel/CSV, persistencia, migraciones (incluyendo bases v5 y v6 con turnos activos), permisos, multicaja, corte del día y TLS.
- **20 pruebas de interfaz (Playwright):** producto común, permisos, filtros paginados, legibilidad y geometría a `1050×720` y `1050×600` (claro/oscuro y PC/táctil), importación, flujo fiscal simulado, pantalla de acceso Mario y persistencia del tema.
