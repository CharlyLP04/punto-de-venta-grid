import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function setupMockApp(page: Page, options: { theme?: string; mode?: string } = {}) {
  const { theme = 'light', mode = 'pc' } = options;

  await page.addInitScript(({ theme, mode }) => {
    const w = window as any;
    w.isTauri = true;
    w.auditCalls = [];

    const user = {
      id: 1,
      name: 'Administrador',
      username: 'admin',
      role: 'owner',
      permissions: [],
    };

    const mockProducts = [
      { id: 1, name: 'Coca-Cola 600ml', code: '7501055300075', category: 'Bebidas', icon: 'brand:cola', price: 1800, cost: 1200, cost_known: 1, unit: 'pieza', stock: 24000, physical_stock: 24000, expired_stock: 0, minimum: 5000, target: 30000, wholesale_quantity: 12000, wholesale_price: 1600, favorite: 1, promotion_price: null },
      { id: 2, name: 'Sabritas Sal 45g', code: '7501011115484', category: 'Botanas', icon: 'brand:sabritas', price: 2000, cost: 1450, cost_known: 1, unit: 'pieza', stock: 15000, physical_stock: 15000, expired_stock: 0, minimum: 4000, target: 20000, wholesale_quantity: 0, wholesale_price: 0, favorite: 1, promotion_price: null },
      { id: 3, name: 'Leche Entera Lala 1L', code: '7501020512345', category: 'Lácteos', icon: 'brand:lala', price: 2800, cost: 2200, cost_known: 1, unit: 'pieza', stock: 10000, physical_stock: 10000, expired_stock: 0, minimum: 3000, target: 15000, wholesale_quantity: 0, wholesale_price: 0, favorite: 0, promotion_price: 2500 },
      { id: 4, name: 'Huevo Blanco San Juan', code: 'HUEVO01', category: 'Granel', icon: 'auto', price: 4800, cost: 3800, cost_known: 1, unit: 'kg', stock: 12500, physical_stock: 12500, expired_stock: 0, minimum: 5000, target: 20000, wholesale_quantity: 0, wholesale_price: 0, favorite: 0, promotion_price: null },
      { id: 5, name: 'Pan Bimbo Blanco Grande', code: '7501000111222', category: 'Panadería', icon: 'brand:bimbo', price: 4600, cost: 3600, cost_known: 1, unit: 'pieza', stock: 8000, physical_stock: 8000, expired_stock: 0, minimum: 2000, target: 10000, wholesale_quantity: 0, wholesale_price: 0, favorite: 0, promotion_price: null },
      { id: 6, name: 'Frijol Negro', code: 'FRIJOL01', category: 'Abarrotes', icon: 'auto', price: 3400, cost: 2400, cost_known: 1, unit: 'kg', stock: 0, physical_stock: 0, expired_stock: 0, minimum: 5000, target: 15000, wholesale_quantity: 0, wholesale_price: 0, favorite: 0, promotion_price: null },
    ];

    let mockLines: any[] = [];
    w.__TAURI_INTERNALS__ = {
      invoke: async (command: string, args: any) => {
        if (command === 'connection_call') {
          command = args.command;
          args = args.args;
        }
        w.auditCalls.push({ command, args });

        if (command === 'mutate') {
          const a = args.action;
          if (a?.type === 'cart') {
            mockLines = [...mockLines, { ticket: a.ticket, product: a.product, quantity: a.delta, override_price: null, reason: null }];
          }
          return {};
        }

        if (command === 'connection_status') {
          return { remote: false, name: 'Caja principal', url: 'http://192.168.1.10:8080', serving: true };
        }
        if (command === 'auth_status') {
          return { setup: false, profiles: [{ ...user, username: 'admin' }] };
        }
        if (command === 'login') {
          return { token: 'token-admin', user, idleMinutes: 30 };
        }
        if (command === 'snapshot') {
          return {
            products: mockProducts,
            common_products: [],
            lines: [...mockLines],
            customers: [
              { id: 1, name: 'Doña Mary', phone: '5512345678', email: 'mary@example.com', address: 'Calle 10 #23', balance: 14500, credit_limit: 50000, credit_enabled: 1 },
              { id: 2, name: 'Don Pepe', phone: '5587654321', email: '', address: 'Av Central 4', balance: 0, credit_limit: 30000, credit_enabled: 1 },
            ],
            sales: [
              { id: 'sale-001', total: 6500, payment: 'cash', created: '2026-10-14T10:30:00Z', print_status: 'ok', cashier: 'Administrador', refunded: false },
              { id: 'sale-002', total: 12000, payment: 'card', created: '2026-10-14T11:15:00Z', print_status: 'ok', cashier: 'Administrador', refunded: false },
            ],
            frequencies: [{ product: 1, count: 12 }, { product: 2, count: 9 }],
            aliases: [{ code: '7501055300075', product: 1 }],
            repayments: [{ id: 1, customer: 1, amount: 5000, balance: 9500, previous_balance: 14500, created: '2026-10-14T09:00:00Z' }],
            movements: [
              { id: 1, amount: 20000, note: 'Fondo de apertura', created: '2026-10-14T08:00:00Z', user_id: 1 },
              { id: 2, amount: -3500, note: 'Pago de hielo', created: '2026-10-14T10:00:00Z', user_id: 1 },
            ],
            ledger: [{ id: 1, customer: 1, amount: 14500, note: 'Compra fiada ticket 101', created: '2026-10-13T18:00:00Z' }],
            shift: [{ id: 1, created: '2026-10-14T08:00:00Z', user_id: 1, cashier: 'Administrador' }],
            cuts: [{ id: 1, created: '2026-10-13T08:00:00Z', closed: '2026-10-13T20:00:00Z', user_id: 1, cashier: 'Administrador', expected: 154000, counted: 154000 }],
            settings: [
              { key: 'store_name', value: 'Abarrotes Don Charly' },
              { key: 'store_address', value: 'Av. Siempre Viva 123' },
              { key: 'store_phone', value: '5512345678' },
              { key: 'receipt_footer', value: '¡Gracias por su compra!' },
              { key: 'accent', value: 'gold' },
              { key: 'density', value: 'comfortable' },
              { key: 'sound', value: '1' },
              { key: 'printer', value: 'COM3' },
              { key: 'baud', value: '9600' },
              { key: 'scale', value: 'COM4' },
              { key: 'scale_baud', value: '9600' },
            ],
            stats: [{ today: 18500, tickets: 2 }],
            pending: [{ count: 0 }],
            expiry_alerts: [{ count: 2 }],
          };
        }
        if (command === 'management') {
          if (args.section === 'inventory') {
            return {
              aliases: [{ code: '7501055300075', product: 1 }],
              combos: [],
              orders: [{ id: 1, name: 'Coca-Cola 600ml', stock: 24000, suggested: 6000 }],
              purchases: [{ id: 'pur-1', supplier: 'Coca-Cola Femsa', folio: 'F-8821', total: 45000, created: '2026-10-14T07:30:00Z' }],
            };
          }
          if (args.section === 'reports') {
            return {
              summary: [{ revenue: 18500, cost: 11000, losses: 500, missing_cost: 0 }],
              stars: [{ name: 'Coca-Cola 600ml', margin: 4500 }],
              ghosts: [{ id: 6, name: 'Frijol Negro', stock: 0 }],
              hours: [{ hour: '09', tickets: 1, total: 6500 }, { hour: '11', tickets: 1, total: 12000 }],
            };
          }
          if (args.section === 'audit') {
            return {
              events: [
                { id: 1, event: 'Apertura de turno', created: '2026-10-14T08:00:00Z', user: 'Administrador' },
                { id: 2, event: 'Cobro de venta #1', created: '2026-10-14T10:30:00Z', user: 'Administrador' },
              ],
            };
          }
          if (args.section === 'cut_x') {
            return {
              shift: 1,
              expected: 18500,
              payments: [{ method: 'Efectivo', amount: 6500 }, { method: 'Tarjeta', amount: 12000 }],
              movements: [{ note: 'Fondo inicial', amount: 20000 }],
            };
          }
        }
        if (command === 'procurement_list') {
          return {
            suppliers: [
              { id: 1, name: 'Bimbo', phone: '5511223344', email: 'pedidos@bimbo.com', notes: 'Visita los martes', enabled: 1, pending: 1 },
              { id: 2, name: 'Coca-Cola', phone: '5599887766', email: 'ventas@coca.com', notes: 'Visita los jueves', enabled: 1, pending: 0 },
            ],
            orders: [
              {
                id: 'ord-12345678',
                supplier: 1,
                supplier_name: 'Bimbo',
                status: 'draft',
                body: JSON.stringify({
                  lines: [{ product: 5, quantity: 10000, cost: 3600 }],
                  note: 'Entregar antes de las 10am',
                  total: 36000,
                }),
                created: '2026-10-14',
              },
            ],
          };
        }
        if (command === 'advanced_list') {
          if (args.section === 'lots') {
            return {
              rows: [
                { id: 1, product: 3, name: 'Leche Entera Lala 1L', code: 'LOT-A1', expires: '2026-10-20', quantity: 10000, unit: 'pieza', days: 6 },
                { id: 2, product: 2, name: 'Sabritas Sal 45g', code: 'LOT-B2', expires: '2026-10-10', quantity: 3000, unit: 'pieza', days: -4 },
              ],
            };
          }
          if (args.section === 'promotions') {
            return {
              rows: [
                { id: 1, name: 'Especial Leche', product: 3, product_name: 'Leche Entera Lala 1L', percent: 1071, starts: '2026-10-01', ends: '2026-10-31', enabled: 1, status: 'Activa' },
              ],
            };
          }
        }
        if (command === 'sale_history') {
          return {
            entries: [
              {
                id: 'sale-001',
                total: 6500,
                created: '2026-10-14T10:30:00Z',
                cashier: 'Administrador',
                customer: '',
                payment: 'cash',
                print_status: 'ok',
                refunded: false,
                receipt: {
                  store: 'Abarrotes Don Charly',
                  cashier: 'Administrador',
                  items: [{ name: 'Coca-Cola 600ml', quantity: 1000, unit: 'pieza', price: 1800, subtotal: 1800 }],
                  total: 6500,
                  payment: 'cash',
                  change: 3500,
                },
              },
            ],
            total: 1,
            page: 0,
            cashiers: [{ id: 1, name: 'Administrador' }],
          };
        }
        if (command === 'filtered_report') {
          return {
            top: [{ name: 'Coca-Cola 600ml', unit: 'pieza', quantity: 2000, total: 3600 }],
            revenue: 18500,
            cost: 11000,
            losses: 0,
            missing: 0,
            sales: 2,
            refunds: 0,
            entries: [{ id: 'sale-001', created: '2026-10-14T10:30:00Z', cashier: 'Administrador', refund: false, total: 6500 }],
            cashiers: [{ id: 1, name: 'Administrador' }],
            hours: [{ hour: '10', tickets: 1 }, { hour: '11', tickets: 1 }],
            methods: [{ name: 'Efectivo', tickets: 1, received: 6500 }, { name: 'Tarjeta', tickets: 1, received: 12000 }],
          };
        }
        if (command === 'users_list') {
          return {
            users: [
              { id: 1, username: 'admin', name: 'Administrador', role: 'owner', permissions: '[]', enabled: 1, discount_limit: 10000 },
              { id: 2, username: 'cajero1', name: 'Juan Pérez', role: 'cashier', permissions: '["sales.common","sales.create","credit.use","credit.repay","shifts.open","shifts.close","hardware.use","receipt.print"]', enabled: 1, discount_limit: 500 },
            ],
          };
        }
        if (command === 'backup_center') {
          return {
            files: [{ name: 'grid-pos-2026-10-14-manual.db', bytes: 1450000, modified: 1791980000000 }],
            directory: 'C:\\Users\\col28\\.gemini\\antigravity\\backups',
            hours: '4',
            keep: '7',
            last: '2026-10-14 10:00:00',
            error: '',
          };
        }
        if (command === 'serial_ports') {
          return ['COM1', 'COM3 (Impresora)', 'COM4 (Báscula)'];
        }
        if (command === 'network_registers') {
          return [{ id: 1, name: 'Caja principal', enabled: 1 }, { id: 2, name: 'Caja 2 (Pasillo)', enabled: 1 }];
        }
        if (command === 'fiscal') {
          return { ready: false, sales: [{ id: 'sale-001', total: 6500, created: '2026-10-14' }], documents: [] };
        }
        return [];
      },
    };

    localStorage.setItem('grid_kiosk_theme', theme);
    localStorage.setItem('grid_input_mode_v1', mode);
  }, { theme, mode });

  await page.goto('/');
  await page.getByRole('button', { name: /Administrador/ }).click();
  await page.locator('input[name=password]').fill('admin-password');
  await page.getByRole('button', { name: 'Entrar', exact: false }).click();
  await expect(page.getByRole('button', { name: /^Filtros/ })).toBeVisible();
}

test('revisar todas las pantallas de navegación sin errores visuales ni desbordamiento', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await setupMockApp(page, { theme: 'light', mode: 'pc' });

  const screens = [
    { group: 'Caja', tab: 'Caja', headingText: 'Nueva venta' },
    { group: 'Productos', tab: 'Inventario', headingText: 'Productos' },
    { group: 'Productos', tab: 'Pedidos', headingText: 'Preparar pedido' },
    { group: 'Productos', tab: 'Surtido', headingText: 'Pedido sugerido' },
    { group: 'Productos', tab: 'Lotes', headingText: 'Primero lo que vence primero' },
    { group: 'Productos', tab: 'Promociones', headingText: 'Ofertas con fecha' },
    { group: 'Clientes', tab: 'Fiado', headingText: 'Fiado y abonos' },
    { group: 'Ventas', tab: 'Historial', headingText: 'Tickets de venta' },
    { group: 'Ventas', tab: 'Reportes', headingText: 'Resumen de ventas' },
    { group: 'Ventas', tab: 'Movimientos', headingText: 'Entradas y salidas de efectivo' },
    { group: 'Ventas', tab: 'CFDI', headingText: 'CFDI 4.0' },
    { group: 'Administración', tab: 'Personalizar', headingText: 'Tu tienda y tus tickets' },
    { group: 'Administración', tab: 'Usuarios', headingText: 'Equipo de la tienda' },
    { group: 'Administración', tab: 'Ajustes', headingText: 'Modo de uso' },
    { group: 'Administración', tab: 'Respaldos', headingText: 'Copias de seguridad' },
    { group: 'Administración', tab: 'Bitácora', headingText: 'Qué pasó en tu tienda' },
    { group: 'Administración', tab: 'Multicaja', headingText: 'Multicaja' },
    { group: 'Administración', tab: 'Servicios', headingText: 'Servicios y conexiones' },
  ];

  for (const screen of screens) {
    // Navigate via sidebar group
    const groupButton = page.getByRole('navigation', { name: 'Áreas principales' }).getByRole('button', { name: new RegExp(screen.group, 'i') });
    await groupButton.click();

    // If there are secondary tabs in header, click the specific tab
    const tabButton = page.locator('.workspace-tabs').locator(`button[data-section="${screen.tab}"]`);
    if (await tabButton.count() > 0) {
      await tabButton.click();
    }

    // Verify main workspace heading is visible
    const heading = page.locator('#main-workspace').getByRole('heading', { name: new RegExp(screen.headingText, 'i') }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Verify viewport bounds: no horizontal document overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1050);

    // Verify no broken images or missing essential assets
    const images = await page.locator('#main-workspace img').all();
    for (const img of images) {
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  }

  expect(pageErrors).toEqual([]);
});

test('revisar tema oscuro y contraste en todas las pantallas', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await setupMockApp(page, { theme: 'dark', mode: 'pc' });

  // Verify dark theme is active
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const sampleScreens = [
    { group: 'Caja', tab: 'Caja', headingText: 'Nueva venta' },
    { group: 'Productos', tab: 'Inventario', headingText: 'Productos' },
    { group: 'Clientes', tab: 'Fiado', headingText: 'Fiado y abonos' },
    { group: 'Ventas', tab: 'Reportes', headingText: 'Resumen de ventas' },
    { group: 'Administración', tab: 'Personalizar', headingText: 'Tu tienda y tus tickets' },
    { group: 'Administración', tab: 'Usuarios', headingText: 'Equipo de la tienda' },
  ];

  for (const screen of sampleScreens) {
    const groupButton = page.getByRole('navigation', { name: 'Áreas principales' }).getByRole('button', { name: new RegExp(screen.group, 'i') });
    await groupButton.click();
    const tabButton = page.locator('.workspace-tabs').locator(`button[data-section="${screen.tab}"]`);
    if (await tabButton.count() > 0) {
      await tabButton.click();
    }

    const heading = page.locator('#main-workspace').getByRole('heading', { name: new RegExp(screen.headingText, 'i') }).first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Check WCAG accessibility on key screens
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  }

  expect(pageErrors).toEqual([]);
});

test('revisar flujos interactivos y modales principales', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await setupMockApp(page, { theme: 'light', mode: 'pc' });

  // 1. Caja: agregar producto y abrir modal de cobro
  const productCard = page.locator('.sale-product-card').first();
  await expect(productCard).toBeVisible();
  await productCard.click();

  // Verify line appears in ticket
  await expect(page.locator('.ticket-lines')).toContainText('Coca-Cola 600ml');
  await expect(page.locator('.ticket-bottom .charge')).toBeEnabled();

  // Open Pay dialog
  await page.locator('.ticket-bottom .charge').click();
  const payDialog = page.getByRole('dialog', { name: 'Cobrar ticket' });
  await expect(payDialog).toBeVisible();
  await expect(payDialog.getByRole('button', { name: 'Confirmar cobro' })).toBeVisible();
  await expect(payDialog.getByRole('button', { name: 'Exacto' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(payDialog).not.toBeVisible();

  // 2. Movimiento de efectivo (F3)
  await page.keyboard.press('F3');
  const movementDialog = page.getByRole('dialog', { name: 'Movimiento de efectivo' });
  await expect(movementDialog).toBeVisible();
  await expect(movementDialog.getByLabel(/Salida \/ pago/i)).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(movementDialog).not.toBeVisible();

  // 3. Inventario: modal de nuevo producto
  await page.getByRole('navigation', { name: 'Áreas principales' }).getByRole('button', { name: 'Productos' }).click();
  const newProductBtn = page.getByRole('button', { name: 'Nuevo producto' });
  await expect(newProductBtn).toBeVisible();
  await newProductBtn.click();
  const productDialog = page.getByRole('dialog', { name: 'Nuevo producto' });
  await expect(productDialog).toBeVisible();
  await expect(productDialog.getByLabel(/Código de barras/i)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(productDialog).not.toBeVisible();

  // 4. Clientes: modal de nuevo cliente
  await page.getByRole('navigation', { name: 'Áreas principales' }).getByRole('button', { name: 'Clientes' }).click();
  const addCustomerBtn = page.getByRole('button', { name: 'Agregar cliente' });
  await expect(addCustomerBtn).toBeVisible();
  await addCustomerBtn.click();
  const customerDialog = page.getByRole('dialog', { name: 'Agregar cliente' });
  await expect(customerDialog).toBeVisible();
  await expect(customerDialog.getByLabel(/Nombre o apodo/i)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(customerDialog).not.toBeVisible();

  // 5. Turno y arqueo de caja
  const shiftBtn = page.locator('.topbar .shift-button');
  await expect(shiftBtn).toBeVisible();
  await shiftBtn.click();
  const closeShiftDialog = page.getByRole('dialog', { name: 'Arqueo y corte Z' });
  await expect(closeShiftDialog).toBeVisible();
  await expect(closeShiftDialog.getByRole('heading', { name: 'Arqueo y corte Z' })).toBeVisible();
  await expect(closeShiftDialog.getByRole('button', { name: 'Guardar conteo y cerrar turno' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(closeShiftDialog).not.toBeVisible();

  expect(pageErrors).toEqual([]);
});
