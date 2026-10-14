// Source-level inventory; this is not a certification or runtime validation.
export const eleventaCoverage = [
 {feature:'Producto común · botón y Ctrl+P',status:'implemented',limits:'Sin inventario; costo opcional, permisos individuales, persistencia por ticket. No emite CFDI.',source:'https://eleventa.com/aprender/productos-comunes'},
 {feature:'Caja, códigos, granel, multiticket y descuentos',status:'implemented'},
 {feature:'Efectivo, tarjeta, transferencia, cheque, vale, fiado y dólares',status:'implemented',limits:'Pagos externos registrados manualmente; dólares sin mezcla con otros medios.'},
 {feature:'Clientes, límites, abonos y asignación de ventas',status:'partial',limits:'Falta expediente fiscal y estado de cuenta histórico completo.'},
 {feature:'Proveedores y órdenes de compra',status:'partial',limits:'Recepción completa; faltan recepción parcial, modificación y envío de orden.'},
 {feature:'Inventario, mínimos, mayoreo, combos, merma, lotes y promociones',status:'implemented'},
 {feature:'Devoluciones',status:'partial',limits:'Solo devolución completa; falta devolución parcial por producto.'},
 {feature:'Verificador de precios',status:'partial',limits:'La búsqueda de Caja muestra precios; falta una pantalla exclusiva para consulta del cliente.',source:'https://eleventa.com/aprender/ventas'},
 {feature:'Catálogo e importación Excel',status:'implemented',limits:'Excel/CSV/TSV de hasta 10,000 productos con plantilla, vista previa, actualización masiva y exportación XLSX. Conserva existencias; no importa movimientos de inventario.'},
 {feature:'Cortes, reportes, permisos y respaldos',status:'implemented'},
 {feature:'Impresión y dispositivos',status:'partial',limits:'Impresión serial de comprobantes; falta diseñador 58/80 mm, etiquetas de báscula y compatibilidad verificada con cada equipo.',source:'https://eleventa.com/aprender/configuracion'},
 {feature:'CFDI · Facturama sandbox',status:'beta',limits:'Implementación de pruebas: factura individual PUE, IVA o no objeto, consulta, XML/PDF y cancelación 02/03. Requiere cuenta API Web sandbox. No habilita producción, globales, PPD, IEPS ni retenciones.'},
 {feature:'Multicaja en red local',status:'implemented',limits:'Principal por HTTPS, vinculación por equipo, cinco tickets y turno por caja, inventario central. Pruebas locales TLS y transacciones; falta validar dos PCs físicas y hardware remoto. Servidor de inicio manual; sin cobro desconectado.'},
 {feature:'Recargas, servicios, tarjetas virtuales y terminal integrada',status:'beta',limits:'Conexiones pospuestas por el usuario.'},
 {feature:'Nube y dashboard móvil',status:'beta',limits:'Sin sincronización externa operativa.'},
] as const;
export const comparisonSource = 'https://eleventa.com/aprender';

// Checked against official manual sections on 2026-10-13. An implemented status is not full competitor parity.
export const comparisonSources = [comparisonSource,
 'https://eleventa.com/aprender/ventas',
 'https://eleventa.com/aprender/productos',
 'https://eleventa.com/aprender/modulo-compras-y-proveedores',
 'https://eleventa.com/aprender/configuracion',
] as const;
