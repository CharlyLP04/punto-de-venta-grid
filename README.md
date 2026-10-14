# Mario POS · Grid MX

Base de aplicación **nativa de escritorio para Windows**, con Tauri 2, React 19, Vite, Tailwind 4 y SQLite mediante Rust. No utiliza navegador externo, IndexedDB ni servicios remotos para cobrar.

## Ejecutar desde el código

Requisitos de desarrollo: Node.js 20.19+ o 22.12+, Rust estable con toolchain MSVC, Visual Studio Build Tools con Desktop development with C++, Windows SDK y WebView2.

```powershell
cd "C:\Users\col28\Documents\Codex\2026-10-05\resumen-de-los-pilares-clave-1\outputs\mario-pos"
npm install
npm run desktop
```

Para producir el instalador NSIS:

```powershell
npm run installer
```

Se instalaron las dependencias y se compiló correctamente el ejecutable Windows x64 en modo release con npm run tauri -- build --no-bundle. Se incluyen package-lock.json y Cargo.lock. No se ejecutaron pruebas ni se abrió la aplicación, por petición del usuario. La compilación no equivale a validación para operación comercial. El ejecutable directo requiere WebView2, ya instalado en esta computadora; no es un instalador.

## Flujos implementados

- Cuatro tickets guardados inmediatamente en SQLite y recuperados al reiniciar.
- F1 buscar, F2 cobrar, F3 efectivo, F5–F8 cambiar ticket, F10 fiado. +/− ajustan la línea seleccionada fuera de campos de texto.
- Escáner HID con terminador Enter: código exacto desde el buscador; captura de ráfagas fuera de campos de edición. Umbral por carácter 50 ms, configurable en App.tsx. No es una garantía de rendimiento medida.
- Venta por pieza, por kilogramos o por monto convertido al gramo más cercano. El importe final puede variar por redondeo.
- Cobro atómico: verifica existencias, descuenta stock, carga crédito si procede, guarda recibo, vacía ticket y encola evento en la misma transacción. UUID por solicitud para evitar duplicación al reintentar el mismo cobro.
- Fiado con límites de crédito, historial de cargos y abonos en efectivo.
- Apertura de turno, movimientos justificados, arqueo con conteo ingresado antes de revelar el esperado y corte Z inmutable desde la interfaz.
- Alta y edición de productos y precios, y entradas de inventario. La edición se bloquea si el producto está en un ticket pendiente. No se permite vender con stock insuficiente.
- Recibos ESC/POS mediante puerto serial, corte y pulso de cajón al imprimir venta en efectivo. Las copias no disparan el cajón.
- Copias consistentes mediante la API de respaldo SQLite.

## Primer uso

1. Abrir un turno e ingresar el fondo real.
2. Usar el catálogo **de demostración** con códigos `DEMO001`–`DEMO008` y `LOCAL001`–`LOCAL004`. Son nombres y precios ilustrativos; no se presentan como EAN oficiales ni como catálogo autorizado de marcas.
3. Para mercancía real, dar de alta su código, precio y costo, luego registrar la entrada en Inventario. Los datos demo también afectan las ventas si se utilizan: emplear una instalación limpia y catálogo real antes de trabajar en producción.
4. Cobrar; la impresión es opcional y nunca revierte una venta guardada. Si falla, usar Historial para reintentar. Una escritura serial exitosa solo confirma envío, no que salió papel. Revisar el papel antes de repetir un envío incierto.
5. Contar físicamente el cajón, completar todos los tickets y hacer corte.

## Hardware y límites actuales

- **Impresora:** implementado transporte serial 8N1 configurable, sin handshake. No incluye spooler RAW de Windows ni USB directo. Impresoras USB que no expongan COM necesitan un adaptador distinto. Ancho de papel, codificación, comandos ESC/POS, corte y pulso deben adaptarse al modelo. Texto ASCII con transliteración básica.
- **Báscula:** devuelve una trama cruda del puerto en modo lectura continua; requiere ingresar el peso manualmente. Falta parser específico del modelo, validación de estabilidad/unidad y protocolo de solicitud si aplica. Nunca se toma una trama desconocida como peso confirmado.
- **Seguridad:** modo propietario único, sin PIN ni roles de empleados. El arqueo no constituye una barrera de autorización. Falta control de acceso antes de delegar la caja a personal.
- **Grid MX:** outbox local de ventas, sin transportador, endpoint, credenciales ni confirmaciones del servidor. No hay sincronización ni dashboard móvil ni WhatsApp automático.
- **Pendiente:** devoluciones/cancelaciones compensatorias, configuración fiscal/CFDI, importación del catálogo verificado, restauración asistida de respaldos, autoinicio y actualizaciones firmadas. No hay promesas de latencia o tamaño del instalador.
- **Datos:** archivo `mario.sqlite` dentro del directorio de datos de Tauri para `mx.grid.mario-pos`. Respaldos en su subdirectorio `respaldos`. La interfaz muestra la ruta completa al crearlos. La desinstalación/limpieza manual del sistema sigue requiriendo cuidado; copiar respaldos fuera del disco.
- **Instalación offline:** el instalador está configurado para incluir WebView2 offline; aumenta considerablemente el tamaño y exige conexión durante su construcción. La caja instalada no necesita internet para sus operaciones locales.

## Estructura

`src/App.tsx`: caja, módulos, atajos y diálogos. `src/model.ts`: contratos y aritmética de entrada. `src/style.css`: diseño local sin fuentes remotas. `src-tauri/src/main.rs`: comandos, operaciones atómicas y hardware. `src-tauri/src/schema.sql`: esquema inicial v1, WAL, claves foráneas y restricciones.

Referencias de implementación: [comunicación de Tauri](https://v2.tauri.app/concept/inter-process-communication/) y [instalador Windows / WebView2 offline](https://v2.tauri.app/distribute/windows-installer/).


