import csv, re

with open('scripts/mario_inventory_raw.tsv', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    next(reader)
    names = [r[1].strip() for r in reader]

current_badges = [
  re.compile(r'coca-cola', re.I),
  re.compile(r'sabritas', re.I),
  re.compile(r'barcel|takis', re.I),
  re.compile(r'bimbo', re.I),
  re.compile(r'gamesa|mar[ií]as|emperador|chokis', re.I),
  re.compile(r'lala', re.I),
  re.compile(r'alpura', re.I),
  re.compile(r'marinela|gansito', re.I),
  re.compile(r'fud|chimex|san rafael', re.I),
  re.compile(r'jarritos', re.I),
  re.compile(r'pe[ñn]afiel|mundet', re.I),
  re.compile(r'verde valle', re.I),
  re.compile(r'la coste[ñn]a|herdez', re.I),
  re.compile(r'doritos', re.I),
  re.compile(r'nutrioli|1-2-3', re.I),
  re.compile(r'mccormick', re.I),
  re.compile(r'la moderna', re.I),
  re.compile(r'cloralex|pinol', re.I),
  re.compile(r'zote|fabuloso|roma', re.I),
  re.compile(r'del valle|boing|jumex', re.I),
  re.compile(r'corona|modelo|victoria', re.I),
  re.compile(r'p[eé]talo|s[uú]avel|regio', re.I),
]

current_matches = 0
for n in names:
    if any(b.search(n) for b in current_badges):
        current_matches += 1

print(f"Current badges match: {current_matches} of {len(names)} ({current_matches/len(names)*100:.1f}%)")

# Now let's test enhanced badges:
enhanced_badges = [
  ('coca-cola', re.compile(r'coca[-\s]?cola|cocacola|ciel|fanta|sprite|fresca|sidral|mundet|del valle|topochico|meyal', re.I)),
  ('sabritas', re.compile(r'sabritas|doritos|cheetos|ruffles|rufles|toñitas|tostitos|churrumais|rancheritos|crujitos|paketaxo|fritos|kacang|sabritones|bolzaza|bolzasa', re.I)),
  ('takis', re.compile(r'barcel|takis|chips|runners|big mix|kiyakis|golden nuts|pop carameladas', re.I)),
  ('bimbo', re.compile(r'bimbo|bimbunuelos|pan blanco|pan integral|mantecadas|medias noches|colchones|pan tostado|panque|panqué|croissant|crossantines|branfrut', re.I)),
  ('gamesa', re.compile(r'gamesa|mar[ií]as|marias|emperador|chokis|crackets|saladitas|arcoiris|cremax|florentinas|ricanelas|pastisetas|delicias', re.I)),
  ('marinela', re.compile(r'marinela|gansito|barritas|chocoroles|pinguinos|submarinos|sponch|polvorones|canelitas|triki trakes|trikitrakes|suavicremas|principe|príncipe|rocko|dalmata|doraditas|napolitano', re.I)),
  ('tiarosa', re.compile(r't[ií]a rosa|tia rosa|tortillinas|tartinas|bigotes|cuernitos', re.I)),
  ('lala', re.compile(r'lala|nutri leche|nutrileche|yomi', re.I)),
  ('alpura', re.compile(r'alpura', re.I)),
  ('danone', re.compile(r'danone|danonino|dan-up|dnnup', re.I)),
  ('fud', re.compile(r'fud|chimex|san rafael|kir', re.I)),
  ('jarritos', re.compile(r'jarritos', re.I)),
  ('penafiel', re.compile(r'pe[ñn]afiel|peafiel|peñafiel', re.I)),
  ('skarch', re.compile(r'skarch', re.I)),
  ('arizona', re.compile(r'arizona', re.I)),
  ('boing', re.compile(r'boing', re.I)),
  ('jumex', re.compile(r'jumex|bida', re.I)),
  ('electrolit', re.compile(r'electrolit', re.I)),
  ('suerox', re.compile(r'suerox', re.I)),
  ('pepsi', re.compile(r'pepsi', re.I)),
  ('redcola', re.compile(r'red cola|redcola', re.I)),
  ('corona', re.compile(r'corona|modelo|victoria|carta blanca|indio|tecate|sol|xx lager|heineken|miller|vicky', re.I)),
  ('cloralex', re.compile(r'cloralex|pinol|clarasol', re.I)),
  ('zote', re.compile(r'zote|fabuloso|roma|foca|blanca nieves|ariel|salvo|downy|suavitel|ensueño|ensueno|espumil|carisma|flash', re.I)),
  ('costena', re.compile(r'coste[ñn]a|la morena|herdez|san marcos|clemente|del monte', re.I)),
  ('mccormick', re.compile(r'mccormick|valentina|botanera|taj[ií]n|tajin', re.I)),
  ('nutrioli', re.compile(r'nutrioli|1-2-3|patrona|sarita|imperial', re.I)),
  ('nestle', re.compile(r'nescafe|nescafé|nesquik|lechera|carnation|choco milk|chocomilk|carlos v|abuelita', re.I)),
  ('leo', re.compile(r'\bleo\b|chidas|encanto|ke chidos|kechidos|papirringas|rugelio|totos', re.I)),
  ('dulces', re.compile(r'bubbaloo|clorets|halls|trident|orbit|panditas|paleta payaso|mazapan|mazapán|ricolino|de la rosa|pelon|lucas|chocoretas|bubulubu', re.I)),
  ('higiene', re.compile(r'colgate|palmolive|sedal|savil[eé]|head & shoulders|head y shoulders|caprice|pantene|zest|escudo|saba|naturella|gillette|prestobarba|rexona|old spice', re.I)),
  ('farmacia', re.compile(r'aspirina|alkaseltzer|tempra|flanax|alliviax|buscapina|sedalmerck|next|tabcin|desenfriol|xl3|peptobismol|sal de uvas|terramicina', re.I)),
  ('tabaco', re.compile(r'marlboro|malboro|pall mall|time|link', re.I)),
  ('papel', re.compile(r'p[eé]talo|s[uú]avel|regio|vogue', re.I)),
]

enhanced_matches = 0
matched_names = set()
for n in names:
    for tone, b in enhanced_badges:
        if b.search(n):
            enhanced_matches += 1
            matched_names.add(n)
            break

print(f"Enhanced badges match: {enhanced_matches} of {len(names)} ({enhanced_matches/len(names)*100:.1f}%)")
print(f"Remaining {len(names) - enhanced_matches} will render with rich Category Emoji (🥑, 🧀, 🥩, 🥚, 🍚, 🌶️, 🍞, etc.)!")
