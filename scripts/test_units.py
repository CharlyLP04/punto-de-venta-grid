import csv, re

with open('scripts/mario_inventory_raw.tsv', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    rows = list(reader)

def is_kg(code, name, dept, inv_str):
    name_l = name.lower()
    dept_l = dept.lower()

    # Never kg for beverages, tobacco, household, cleaning, pharmacy, stationery
    non_kg_depts = [
        'cervezas', 'vinos y licores', 'coca cola', 'pepsi', 'skarch', 'boing', 'jumex',
        'jarritos', 'peñafiel', 'peafiel', 'red cola', 'electrolit', 'suerox', 'otras bebidas',
        'tabaco', 'farmacia', 'cuidado personal', 'limpieza', 'papelería', 'papelera',
        'hogar y desechables', 'tang'
    ]
    for d in non_kg_depts:
        if d in dept_l:
            return False

    # Packaged indicators
    if re.search(r'\b\d+(\.\d+)?\s*(ml|l|lt|pz|pza|pzas|tabs|capsulas|sobres?)\b', name_l):
        return False
    if re.search(r'\b(lata|botella|tetra|tubo|paquete|caja|bolsa|frasco)\b', name_l):
        return False
    if re.search(r'\b\d+\s*g\b', name_l) and not ('suelto' in name_l or 'granel' in name_l):
        return False

    # Definite bulk departments
    if any(k in dept_l for k in ['frutas y verduras', 'botanas a granel', 'pan y galletas a granel']):
        return True

    # Explicit bulk phrases
    if any(k in name_l for k in ['granel', 'suelto', 'suelta', 'x kilo', 'por kilo']):
        return True

    # Traditional Mexican grocery items sold by weight at the counter
    exact_bulk = [
        'quesillo', 'queso de aro', 'carne enchilada', 'chorizo',
        'azucar', 'bicarbonato', 'chile ancho', 'chile chipotle', 'chile costenio',
        'chile de arbol', 'chile de árbol', 'chile guajillo', 'chile puya', 'chile serranito',
        'chile verde', 'maiz entero', 'maiz quebrado', 'frijol michigan',
        'jamaica', 'la fina sal natural yodada', 'harina de todo uso',
        'beriscan adulto', 'beriscan cachorro', 'chapete adulto', 'gatina',
        'huevo kolibri'  # often sold by weight/kilo in Mexico (or piece, Mario's price is $40/kg)
    ]
    for eb in exact_bulk:
        if eb in name_l:
            return True

    # Standalone specific items
    if name_l.strip() in ['jamon', 'aguacate', 'ajo', 'cebolla', 'calabaza', 'jitomate', 'limon', 'papa', 'pepino', 'platano', 'tomate', 'tomatillo', 'zanahoria']:
        return True

    return False

kg_items = []
piece_items = []
for r in rows:
    code = r[0].strip()
    name = r[1].strip()
    price = r[3].strip()
    inv = r[5].strip()
    dept = r[7].strip()
    if is_kg(code, name, dept, inv):
        kg_items.append((code, name, dept, inv, price))
    else:
        piece_items.append((code, name, dept, inv, price))

print(f"Total KG items: {len(kg_items)}")
print(f"Total PIECE items: {len(piece_items)}")
print("\nAll KG items:")
for idx, it in enumerate(kg_items):
    print(f"  {idx+1}. [{it[0]}] {it[1]} | {it[2]} | Stock: {it[3]} kg | Precio: {it[4]}")
