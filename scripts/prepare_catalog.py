import csv, re, sqlite3

def clean_text(s):
    if not s:
        return ""
    # fix common encoding anomalies if any
    s = s.strip()
    replacements = {
        'Lcteos y Refrigerados': 'Lácteos y Refrigerados',
        'Lacteos y Refrigerad': 'Lácteos y Refrigerados',
        'Papelera': 'Papelería',
        'Peafiel': 'Peñafiel',
        'Ta Rosa': 'Tía Rosa',
        'PeAfiel': 'Peñafiel',
        'PeÑafiel': 'Peñafiel',
        'Garapiado': 'Garapiñado',
        'Costenio': 'Costeño',
        'Jalapenio': 'Jalapeño',
        'pinia': 'piña',
        'Pinia': 'Piña',
        'Pia': 'Piña',
        'banio': 'baño',
        'Banio': 'Baño',
        'panial': 'pañal',
        'Panial': 'Pañal',
        'pequenio': 'pequeño',
        'Pequenio': 'Pequeño',
        'monio': 'moño',
        'Monio': 'Moño',
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s

def normalize_dept(dept):
    dept = clean_text(dept)
    if not dept or dept == '- Sin Departamento -':
        return 'Abarrotes'
    if 'Lacteos' in dept or 'Lácteos' in dept:
        return 'Lácteos y Refrigerados'
    if 'Papeler' in dept:
        return 'Papelería'
    if 'Peñafiel' in dept or 'Peafiel' in dept:
        return 'Peñafiel'
    if 'Tía Rosa' in dept or 'Tia Rosa' in dept:
        return 'Tía Rosa'
    return dept

def detect_unit(code, name, dept, inv_str):
    name_l = name.lower()
    dept_l = dept.lower()

    # Never kg for beverages, tobacco, household, cleaning, pharmacy, stationery
    non_kg_depts = [
        'cervezas', 'vinos y licores', 'coca cola', 'pepsi', 'skarch', 'boing', 'jumex',
        'jarritos', 'peñafiel', 'red cola', 'electrolit', 'suerox', 'otras bebidas',
        'tabaco', 'farmacia', 'cuidado personal', 'limpieza', 'papelería',
        'hogar y desechables', 'tang'
    ]
    for d in non_kg_depts:
        if d in dept_l:
            return 'pieza'

    # Packaged indicators
    if re.search(r'\b\d+(\.\d+)?\s*(ml|l|lt|pz|pza|pzas|tabs|capsulas|sobres?)\b', name_l):
        return 'pieza'
    if re.search(r'\b(lata|botella|tetra|tubo|paquete|caja|bolsa|frasco)\b', name_l):
        return 'pieza'
    if re.search(r'\b\d+\s*g\b', name_l) and not ('suelto' in name_l or 'granel' in name_l):
        return 'pieza'

    # Definite bulk departments
    if any(k in dept_l for k in ['frutas y verduras', 'botanas a granel', 'pan y galletas a granel']):
        return 'kg'

    # Explicit bulk phrases
    if any(k in name_l for k in ['granel', 'suelto', 'suelta', 'x kilo', 'por kilo']):
        return 'kg'

    # Traditional Mexican grocery items sold by weight at the counter
    exact_bulk = [
        'quesillo', 'queso de aro', 'carne enchilada', 'chorizo',
        'bicarbonato', 'chile ancho', 'chile chipotle', 'chile costeño',
        'chile de arbol', 'chile de árbol', 'chile guajillo', 'chile puya', 'chile serranito',
        'chile verde', 'maiz entero', 'maíz entero', 'maiz quebrado',
        'maíz quebrado', 'frijol michigan', 'jamaica', 'la fina sal natural yodada',
        'harina de todo uso', 'beriscan adulto', 'beriscan cachorro', 'chapete adulto',
        'gatina', 'huevo kolibri'
    ]
    for eb in exact_bulk:
        if eb in name_l:
            return 'kg'

    if re.search(r'\bazucar\b', name_l) and not re.search(r'\b(bolsa|kilo|1kg)\b', name_l):
        return 'kg'

    # Standalone specific items
    if name_l.strip() in ['jamon', 'aguacate', 'ajo', 'cebolla', 'calabaza', 'jitomate', 'limon', 'papa', 'pepino', 'platano', 'tomate', 'tomatillo', 'zanahoria']:
        return 'kg'

    return 'pieza'

def choose_icon(name, dept):
    name_l = name.lower()
    dept_l = dept.lower()

    # Dairy / Cremería
    if any(k in name_l for k in ['quesillo', 'queso']): return '🧀'
    if any(k in name_l for k in ['jamon', 'jamón', 'salchicha', 'carne', 'chorizo']): return '🥩'
    if 'huevo' in name_l: return '🥚'
    if any(k in name_l for k in ['yogurt', 'yogur', 'danone', 'danonino', 'dan-up', 'yomi']): return '🧋'
    if any(k in name_l for k in ['leche', 'alpura', 'lala']): return '🥛'
    if any(k in name_l for k in ['mantequilla', 'crema']): return '🧈'

    # Drinks & Sodas
    if any(k in dept_l for k in ['coca cola', 'pepsi', 'red cola', 'jarritos', 'peñafiel']) or any(k in name_l for k in ['coca', 'pepsi', 'fanta', 'sprite', 'fresca', 'sidral', 'mundet', 'refresco', 'topochico']): return '🥤'
    if 'agua' in name_l or 'skarch' in dept_l: return '💧'
    if any(k in dept_l for k in ['boing', 'jumex']) or any(k in name_l for k in ['jugo', 'del valle', 'pulp', 'bida', 'nectar']): return '🧃'
    if any(k in dept_l for k in ['electrolit', 'suerox']) or any(k in name_l for k in ['electrolit', 'suerox', 'power ade', 'volt', 'monster', 'predator']): return '⚡'

    # Beers & Alcohol
    if 'cervezas' in dept_l or any(k in name_l for k in ['corona', 'victoria', 'indio', 'tecate', 'carta blanca', 'modelo', 'xx', 'lager', 'sol', 'heineken', 'miller', 'vicky']): return '🍺'
    if 'vinos' in dept_l or any(k in name_l for k in ['bacardi', 'caribe cooler', 'tequila', 'vodka', 'whisky', 'torres', 'licor', 'mezcal']): return '🍷'

    # Bakery & Cookies
    if any(k in name_l for k in ['concha', 'dona', 'mantecada', 'rol', 'cuernito', 'pan blanco', 'pan integral', 'panque', 'bolillo', 'croissant', 'colchones', 'bimbunuelos', 'medias noches']): return '🍞'
    if any(k in dept_l for k in ['bimbo', 'tía rosa']): return '🍞'
    if any(k in dept_l for k in ['gamesa', 'oreo']) or any(k in name_l for k in ['galleta', 'marias', 'marías', 'chokis', 'emperador', 'canelitas', 'crackets', 'saladitas', 'triki', 'suavicrema', 'sponch', 'principe', 'príncipe', 'florentinas', 'delicias']): return '🍪'

    # Snacks & Chips
    if any(k in dept_l for k in ['sabritas', 'barcel', 'leo', 'chidas', 'otras botanas']) or any(k in name_l for k in ['papas', 'chips', 'ruffles', 'rufles', 'cheetos', 'doritos', 'takis', 'fritos', 'rancheritos', 'crujitos', 'paketaxo', 'churrumais', 'runners', 'big mix', 'tostitos', 'totopos']): return '🥔'
    if 'granel' in dept_l or any(k in name_l for k in ['cacahuate', 'semilla', 'haba', 'garbanzo']): return '🥜'

    # Candies & Chocolates
    if 'dulces' in dept_l or any(k in name_l for k in ['chicle', 'bubbaloo', 'clorets', 'halls', 'trident', 'orbit', 'panditas', 'paleta', 'mazapan', 'mazapán', 'chocolate', 'gansito', 'bubulubu', 'nucita', 'duvalin', 'pelon', 'lucas', 'kranky', 'chocoretas', 'chocoroles', 'pinguinos', 'submarinos', 'rocko', 'mamut']): return '🍬'

    # Cleaning & Laundry
    if 'limpieza' in dept_l or any(k in name_l for k in ['cloro', 'cloralex', 'clarasol', 'pinol', 'fabuloso', 'flash', 'ariel', 'zote', 'roma', 'foca', 'salvo', 'blanca nieves', 'downy', 'suavitel', 'ensueño', 'espumil', 'carisma', 'escoba', 'mechudo', 'trapeador', 'jalador', 'fibra', 'esponja', 'jerga', 'franela', 'raid', 'h24', 'baygon', 'acido']): return '🧼'

    # Personal Care
    if 'cuidado' in dept_l or any(k in name_l for k in ['colgate', 'cepillo', 'shampoo', 'sedal', 'savile', 'savilé', 'head', 'caprice', 'pantene', 'jabon', 'jabón', 'escudo', 'zest', 'palmolive', 'toalla', 'saba', 'naturella', 'pañal', 'panial', 'rastrillo', 'gillette', 'rexona', 'desodorante', 'algodon', 'cotonetes', 'nivea', 'hinds']): return '🪥'

    # Pharmacy
    if 'farmacia' in dept_l or any(k in name_l for k in ['aspirina', 'alkaseltzer', 'tempra', 'flanax', 'alliviax', 'buscapina', 'sedalmerck', 'next', 'tabcin', 'desenfriol', 'xl3', 'peptobismol', 'sal de uvas', 'terramicina', 'alcohol', 'agua oxigenada', 'gasa']): return '💊'

    # Produce
    if 'frutas' in dept_l or any(k in name_l for k in ['aguacate', 'jitomate', 'tomate', 'tomatillo', 'cebolla', 'ajo', 'limon', 'limón', 'papa', 'platano', 'plátano', 'zanahoria', 'pepino', 'calabaza']): return '🥑'

    # Pets
    if 'mascotas' in dept_l or any(k in name_l for k in ['pedigree', 'whiskas', 'beriscan', 'chapete', 'cat chow', 'felix', 'gatina']): return '🐶'

    # Tobacco
    if 'tabaco' in dept_l or any(k in name_l for k in ['marlboro', 'malboro', 'pall mall', 'time', 'link', 'cigarro', 'cajetilla']): return '🚬'

    # Disposables & Home
    if 'hogar' in dept_l or any(k in name_l for k in ['vaso', 'plato', 'cuchara', 'tenedor', 'cerillo', 'veladora', 'vela', 'foco', 'pila', 'aluminio', 'servilleta', 'servitoalla', 'regio', 'vogue']): return '🍽️'

    # Stationery
    if 'papel' in dept_l or any(k in name_l for k in ['lapicero', 'lapiz', 'lápiz', 'bic', 'goma', 'sacapuntas', 'corrector']): return '✏️'

    # Default Grocery (Abarrotes)
    if any(k in name_l for k in ['atun', 'atún', 'sardina']): return '🐟'
    if any(k in name_l for k in ['cafe', 'café', 'nescafe']): return '☕'
    if any(k in name_l for k in ['arroz', 'frijol', 'lenteja', 'avena']): return '🍚'
    if any(k in name_l for k in ['chile', 'salsa', 'valentina', 'tajin', 'tajín']): return '🌶️'
    if any(k in name_l for k in ['sopa', 'maruchan', 'pasta', 'spaghetti', 'fideo']): return '🍜'
    if any(k in name_l for k in ['aceite', 'nutrioli', 'patrona']): return '🫒'

    return '📦'

def parse_money_to_cents(s):
    if not s:
        return 0
    clean = s.replace('$', '').replace(',', '').strip()
    try:
        val = float(clean)
        return int(round(val * 100))
    except:
        return 0

def parse_stock_to_milli(inv_str, unit):
    clean = inv_str.replace(',', '').strip()
    try:
        val = float(clean)
    except:
        val = 0.0
    val = max(0.0, val)
    # in Grid POS, both pieces and kg are stored in milli-units (e.g. 1 pza = 1000, 1 kg = 1000)
    return int(round(val * 1000))

print("Parser module ready")

