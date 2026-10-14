<div align="center">

<img src="src/assets/logo.png" alt="Grid POS Logo" width="128" height="128" style="border-radius: 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.3);" />

# Grid POS · Punto de Venta Profesional

**Sistema de Punto de Venta para Comercio y Retail · 100% Autónomo, Offline-First y de Alto Rendimiento**

[![Tauri 2](https://img.shields.io/badge/Tauri-v2.0-blue.svg?logo=tauri)](https://tauri.app/)
[![React 19](https://img.shields.io/badge/React-v19.0-61dafb.svg?logo=react)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange.svg?logo=rust)](https://www.rust-lang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_ACID-003B57.svg?logo=sqlite)](https://www.sqlite.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows_x64-brightgreen.svg?logo=windows)](https://microsoft.com)

</div>

---

## ⚡ Descripción General

**Grid POS** es una solución integral de punto de venta de escritorio desarrollada con **Tauri 2**, **React 19**, **Rust** y **SQLite nativo**. 

Diseñada para abarrotes, tiendas de conveniencia, papelerías, carnicerías y comercios minoristas, su arquitectura garantiza una **operación continua sin conexión a internet**, con una interfaz ultra-rápida, soporte para lectores de códigos de barra, básculas seriales e impresoras térmicas ESC/POS.

---

## 🌟 Características Principales

### 🛒 Mostrador y Cobro Rápido
- **Multi-Ticket simultáneo:** Atiende hasta 5 clientes en paralelo (F5–F9) sin perder los artículos del carrito.
- **Transacciones ACID atómicas:** Cada cobro descuenta existencias, registra el pago, genera el folio y persiste el ticket en SQLite en milisegundos.
- **Soporte de Escáneres de Códigos de Barra:** Detección de ráfagas HID a alta velocidad con terminador Enter y compatibilidad con códigos alternos/alias.
- **Venta por Pieza y a Granel:** Cálculo automático en kilogramos o venta fraccionada por importe exacto (ej. "$20 pesos de queso").
- **Múltiples Formas de Pago:** Efectivo, tarjetas bancarias, transferencias, vales, dólares con tipo de cambio en pesos y pagos mixtos.

### 👥 Clientes y Libreta de Confianza (Fiado)
- **Límites de crédito personalizados:** Control estricto de endeudamiento por cliente.
- **Registro de abonos y comprobantes:** Generación e impresión de recibos de abono.
- **Integración con WhatsApp:** Envío de estados de cuenta claros y directos al cliente en un clic.

### 📦 Gestión de Inventario y Catálogo
- **Control de existencias y alertas de agotamiento:** Indicadores visuales en tiempo real.
- **Lotes y fechas de caducidad:** Módulo de seguimiento para prevenir mermas.
- **Combos y productos compuestos:** Descuento automático de existencias de insumos por cada combo vendido.
- **Precios de mayoreo y promociones:** Reglas automáticas basadas en cantidad y vigencia.
- **Importador de catálogos masivos:** Soporte para archivos Excel (.xlsx) y CSV.

### 🛡️ Seguridad y Control de Turnos
- **Cuentas de usuario y roles granulares:** Propietario, Encargado, Cajero, Inventario y permisos personalizados.
- **Arqueo ciego de caja:** El cajero cuenta el dinero físico antes de revelar el balance esperado del sistema.
- **Cortes de turno (Corte Z):** Inmutables y auditables con cálculo de diferencias.
- **Bitácora de auditoría:** Registro detallado de cancelaciones, descuentos manuales, movimientos de efectivo y cambios de configuración.

### 🖨️ Hardware Comercial
- **Impresoras térmicas de tickets:** Soporte para puertos COM y comandos ESC/POS estándar (corte de papel y apertura automática de cajón de dinero).
- **Básculas electrónicas:** Lectura de peso en tiempo real vía puerto serial (RS-232).
- **Modo Táctil / Modo PC:** Optimización de la interfaz para pantallas táctiles de kiosco o teclado físico.

---

## ⌨️ Atajos de Teclado del Mostrador

| Atajo | Acción |
| :--- | :--- |
| <kbd>F1</kbd> | Enfocar buscador / escanear código |
| <kbd>F2</kbd> | Abrir pantalla de cobro del ticket actual |
| <kbd>F3</kbd> | Registrar entrada / salida de efectivo |
| <kbd>F4</kbd> | Modificar precio o descuento especial |
| <kbd>F5</kbd> – <kbd>F9</kbd> | Cambiar entre Tickets 1 al 5 |
| <kbd>F10</kbd> | Asignar a la libreta de fiado |
| <kbd>+</kbd> / <kbd>-</kbd> | Aumentar / disminuir cantidad de la línea seleccionada |
| <kbd>Supr</kbd> | Eliminar producto del ticket |
| <kbd>Esc</kbd> | Cancelar modal o bloquear sesión |

---

## 🏗️ Requisitos del Sistema

- **Sistema Operativo:** Windows 10 / 11 (64-bit)
- **Runtime:** Microsoft Edge WebView2 (incluido de fábrica en Windows 10/11)
- **Node.js:** v20.x o superior
- **Rust Toolchain:** Stable (MSVC 2021 edition)
- **Herramientas de Compilación:** Visual Studio C++ Build Tools & Windows SDK

---

## 🚀 Instalación y Desarrollo

### 1. Clonar el repositorio
```bash
git clone https://github.com/CharlyLP04/punto-de-venta-grid.git
cd punto-de-venta-grid
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar en modo desarrollo
```bash
npm run desktop
```

### 4. Compilar ejecutable de producción
```bash
npm run tauri -- build --no-bundle
```
El archivo ejecutable `Grid POS.exe` se generará en:
```
src-tauri/target/release/Grid POS.exe
```

---

## 🗄️ Arquitectura de Archivos

```
punto-de-venta-grid/
├── src/                          # Interfaz React 19 + TypeScript
│   ├── assets/                   # Logotipo oficial e iconos de marca
│   ├── management/               # Módulos de administración, catálogo y reportes
│   ├── security/                 # Autenticación, perfiles y control de sesiones
│   ├── ui/                       # Componentes de diseño, modales y mostrador
│   ├── api.ts                    # Puente IPC con Tauri
│   ├── App.tsx                   # Controlador principal del punto de venta
│   └── model.ts                  # Tipos de datos y aritmética financiera
├── src-tauri/                    # Núcleo nativo en Rust
│   ├── src/
│   │   ├── main.rs               # Entrada de la app, ventana nativa y single-instance
│   │   ├── business.rs           # Motor de transacciones y cálculo de tickets
│   │   ├── receipts.rs           # Control de impresión serial ESC/POS
│   │   ├── backups.rs            # Respaldos y restauración SQLite WAL
│   │   ├── security.rs           # Hashing Argon2 y permisos de usuarios
│   │   └── schema.sql            # Estructura de base de datos relacional
│   ├── icons/                    # Iconos empaquetados para Windows y desktop
│   ├── Cargo.toml                # Dependencias nativas de Rust
│   └── tauri.conf.json           # Configuración de Tauri 2 y ventanas
└── package.json                  # Scripts y dependencias del frontend
```

---

## 🔒 Privacidad y Respaldo de Datos

- Todos los datos comerciales residen en la base de datos local `grid.sqlite` dentro de `%APPDATA%/mx.grid.pos`.
- Se realizan respaldos automáticos rotativos en la subcarpeta `respaldos/`.
- La información de tu negocio nunca sale de tu computadora sin tu autorización explícita.

---

## 📄 Licencia

Desarrollado con dedicación por **Grid MX**. Todos los derechos reservados.
