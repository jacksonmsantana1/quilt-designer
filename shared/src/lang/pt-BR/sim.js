// Portuguese (Brazil): see ../pt-BR.js.
export default {
  // beds, tables and couches
  'Full / Double': 'Full / Casal',
  'Square table, 4 seats': 'Mesa quadrada, 4 lugares',
  'Rectangular table, 4 seats': 'Mesa retangular, 4 lugares',
  'Rectangular table, 6 seats': 'Mesa retangular, 6 lugares',
  'Rectangular table, 8 seats': 'Mesa retangular, 8 lugares',
  'Coffee table': 'Mesa de centro',
  Armchair: 'Poltrona',
  'Loveseat, 2 seats': 'Sofá, 2 lugares',
  'Sofa, 3 seats': 'Sofá, 3 lugares',
  'Brazilian {size} bed': 'cama {size} brasileira',
  'US {size} bed': 'cama {size} americana',
  'custom table': 'mesa sob medida',
  'custom couch': 'sofá sob medida',
  'custom bed': 'cama sob medida',
  Brazil: 'Brasil',
  'United States': 'Estados Unidos',
  Tables: 'Mesas',
  Couches: 'Sofás',
  'Beds · {group}': 'Camas · {group}',
  '{label} · {size} · {h} high': '{label} · {size} · {h} de altura',
  'Custom bed size…': 'Cama sob medida…',
  'Custom table…': 'Mesa sob medida…',
  'Custom couch…': 'Sofá sob medida…',

  // how the quilt sits on the bed
  'A {size} quilt meeting a {bed} ({top} top, {h} high).':
    'Um quilt de {size} sobre uma {bed} (tampo de {top}, {h} de altura).',
  'A {size} quilt meeting a {bed} ({w} wide, {l} deep).':
    'Um quilt de {size} sobre este assento: {bed} ({w} de largura, {l} de profundidade).',
  'A {size} quilt meeting a {bed} ({top} mattress).': 'Um quilt de {size} sobre uma {bed} (colchão de {top}).',
  'Every motion comes from the physics: gravity, fabric elasticity and bending, air drag, and Coulomb friction, in SI units.':
    'Todo movimento vem da física: gravidade, elasticidade e flexão do tecido, arrasto do ar e atrito de Coulomb, em unidades do SI.',
  '{len} short': '{len} a menos',
  'Quilt {size} over a couch {w} wide and {l} deep.':
    'Quilt de {size} sobre um sofá de {w} de largura e {l} de profundidade.',
  'Quilt {size} on a {top} table, {h} high: hangs {side} over each side and {foot} over each end.':
    'Quilt de {size} em uma mesa de {top}, com {h} de altura: cai {side} em cada lado e {foot} em cada ponta.',
  'Quilt {size} on a {top} mattress: hangs {side} over each side and {foot} past the foot.':
    'Quilt de {size} em um colchão de {top}: cai {side} em cada lado e {foot} além do pé.',
  'In the simulation now: {text}': 'Na simulação agora: {text}',
  'Target quilt: {target} (mattress {top} + {drop} drop each side and at the foot + {tuck} pillow tuck).':
    'Quilt ideal: {target} (colchão de {top} + {drop} de caimento em cada lado e no pé + {tuck} para dobrar sob os travesseiros).',
  'Target quilt: {target} (mattress {top} + {drop} drop each side and at the foot).':
    'Quilt ideal: {target} (colchão de {top} + {drop} de caimento em cada lado e no pé).',
  '{c} × {r} blocks of {size}': '{c} × {r} blocos de {size}',
  'your block size': 'seu tamanho de bloco',
  'resized blocks': 'blocos redimensionados',
  '{size} · drop {side} at the sides, {foot} at the foot': '{size} · caimento de {side} nos lados, {foot} no pé',
  'In use': 'Em uso',
  Use: 'Usar',

  // fabric physics
  'Areal density ρA': 'Densidade superficial ρA',
  'Tensile stiffness E': 'Rigidez à tração E',
  'Shear stiffness G': 'Rigidez ao cisalhamento G',
  'Bending rigidity B': 'Rigidez à flexão B',
  'Static friction μs': 'Atrito estático μs',
  'Kinetic friction μk': 'Atrito cinético μk',
  'Capped at μs inside the solver.': 'Limitado a μs dentro do simulador.',
  'Drag coefficient Cd': 'Coeficiente de arrasto Cd',
  'Internal damping ratio ζ': 'Razão de amortecimento interno ζ',
  Thickness: 'Espessura',

  // what the simulation is doing
  Falling: 'Caindo',
  Paused: 'Pausado',
  'Held by hands': 'Segurado pelas mãos',
  'At rest · {s} s': 'Em repouso · {s} s',
  Settling: 'Assentando',
  'running at {v}× speed': 'rodando a {v}× da velocidade',
  held: 'segurado',
  'none (no air)': 'nenhuma (sem ar)',

  // analysis
  'Membrane strain': 'Deformação de membrana',
  'Stretch of the fabric relative to its flat, unloaded size.':
    'Estiramento do tecido em relação ao seu tamanho plano, sem carga.',
  'Curvature κ': 'Curvatura κ',
  'κ = 1/R. Red marks folds and the tightest bends.': 'κ = 1/R. O vermelho marca as dobras e as curvas mais fechadas.',
  'Gap to bed or floor': 'Folga até a cama ou o chão',
  'Blue is touching (≤ 1 mm). Red is hanging free.': 'Azul está encostado (≤ 1 mm). Vermelho está solto no ar.',
  'Height above floor': 'Altura acima do chão',
  'Mattress top is at 0.62 m.': 'O topo do colchão fica a 0,62 m.',
  'on the floor': 'no chão',
  '{a} % · max {b} %': '{a} % · máx. {b} %',
  flat: 'plano',

  // controls
  '{n} substeps · Δt = {ms} ms': '{n} subpassos · Δt = {ms} ms',
  Pause: 'Pausar',
  Resume: 'Continuar',
  'Quilt turned 90° · click to drop it straight again': 'Quilt girado 90° · clique para soltá-lo reto de novo',
  'Turn the quilt 90° and drop it again': 'Girar o quilt 90° e soltá-lo de novo',
  centre: 'centro',
  '{len} toward the right': '{len} para a direita',
  '{len} toward the left': '{len} para a esquerda',
  '{len} toward the near end': '{len} para a ponta mais próxima',
  '{len} toward the far end': '{len} para a ponta mais distante',
  '{len} toward the foot': '{len} para o pé da cama',
  '{len} toward the head': '{len} para a cabeceira',
  '{place} (usual spot)': '{place} (posição de costume)',
  'Drag the quilt to pull it · drag empty space to orbit':
    'Arraste o quilt para puxá-lo · arraste o espaço vazio para orbitar',
  'Drag to orbit · scroll to zoom': 'Arraste para orbitar · role para aproximar',

  // built-in fabrics
  'Cream cotton': 'Algodão creme',
  'Indigo cotton': 'Algodão índigo',
  'Woven paisley': 'Paisley',
  'Mustard cotton': 'Algodão mostarda',
  'Red linen': 'Linho vermelho',
  'Sage cotton': 'Algodão sálvia',
  'Chenille stripe': 'Listrado chenille',
  Damask: 'Adamascado',
  'Rose cotton': 'Algodão rosa',
  'Mint cotton': 'Algodão menta',
  'Chocolate cotton': 'Algodão chocolate',
  'White cotton': 'Algodão branco',
  'Floral print': 'Estampa floral',
  'Mocha cotton': 'Algodão moca',
  'Teal cotton': 'Algodão verde-azulado',

  // photo render
  'the quilt came out black, so the graphics driver is mis-running the path tracer':
    'o quilt saiu preto, então o driver gráfico está executando mal o path tracer',
  'Render done · {goal} frames · {secs} s · fast raster':
    'Render pronto · {goal} quadros · {secs} s · rasterização rápida',
  'Rendering · {n} / {goal} frames · {secs} s · fast raster':
    'Renderizando · {n} / {goal} quadros · {secs} s · rasterização rápida',
  'this browser’s graphics don’t support floating-point render targets':
    'os gráficos deste navegador não aceitam alvos de render em ponto flutuante',
  'the path tracer could not start ({error})': 'o path tracer não conseguiu iniciar ({error})',
  'Path tracing didn’t work on this GPU ({gpu}): {reason}. Switched to the fast raster renderer, which works on any GPU.':
    'O path tracing não funcionou nesta GPU ({gpu}): {reason}. Mudamos para o render rápido por rasterização, que funciona em qualquer GPU.',
  'unknown GPU': 'GPU desconhecida',
  'the scene could not be prepared ({error})': 'não foi possível preparar a cena ({error})',
  // the realistic picture
  'Realistic picture': 'Foto realista',
  Stop: 'Parar',
  'Save picture': 'Salvar foto',
  'Make a realistic picture of this quilt': 'Fazer uma foto realista desta colcha',
  'See the realistic picture of this quilt': 'Ver a foto realista desta colcha',
  'The realistic picture of this quilt is being made': 'A foto realista desta colcha está sendo feita',
  'Laying the quilt on the bed…': 'Estendendo a colcha na cama…',
  'Setting up the room…': 'Preparando o quarto…',
  'Warming up the graphics card… The page may pause for a moment, the first time only.':
    'Aquecendo a placa de vídeo… A página pode travar por um instante, só na primeira vez.',
  'Rendering: {pct}%': 'Renderizando: {pct}%',
  'It’s on its way: keep working, and it will tell you when it’s ready.':
    'Já está a caminho: continue trabalhando, e avisaremos quando ficar pronta.',
  'A picture of another version of a quilt is being made. Wait for it, or stop it first.':
    'Uma foto de outra versão de uma colcha está sendo feita. Espere terminar ou interrompa antes.',
  'Making the picture. Keep working: it will tell you when it’s ready.':
    'Fazendo a foto. Continue trabalhando: avisaremos quando ficar pronta.',
  'Your realistic picture is ready.': 'Sua foto realista está pronta.',
  'Couldn’t make the picture: {why}': 'Não foi possível fazer a foto: {why}',
  ' Its realistic picture is shared too.': ' A foto realista dela também é compartilhada.',
  ' Its realistic picture is being made, and is added when it’s ready.':
    ' A foto realista dela está sendo feita e será adicionada quando ficar pronta.',
  ' A realistic picture of it is made on this computer and added when it’s ready.':
    ' Uma foto realista dela é feita neste computador e adicionada quando ficar pronta.',
  'The quilt is shared, but its realistic picture couldn’t be sent: {why}':
    'A colcha foi compartilhada, mas não foi possível enviar a foto realista: {why}',
  '“{name}” on a bed': '“{name}” sobre uma cama',
  'Compiling the path tracer for your GPU… {secs} s (first time only)':
    'Compilando o path tracer para a sua GPU… {secs} s (só na primeira vez)',
  'Render done · {goal} samples · {secs} s · path traced': 'Render pronto · {goal} amostras · {secs} s · path tracing',
  'Rendering · {n} / {goal} samples · {secs} s · path traced':
    'Renderizando · {n} / {goal} amostras · {secs} s · path tracing',
  'the path tracer took over 2½ minutes to compile': 'o path tracer levou mais de 2½ minutos para compilar',
  'the path-tracing shader failed to compile': 'o shader de path tracing não compilou',
  'The graphics card reset the 3D view. Reload the page; photo renders will use the fast raster renderer on this GPU.':
    'A placa de vídeo reiniciou a vista 3D. Recarregue a página; os renders fotográficos usarão o render rápido por rasterização nesta GPU.',

  // saving a picture
  'The image could not be captured.': 'Não foi possível capturar a imagem.',
  'Picture sent': 'Imagem enviada',
  'Picture saved': 'Imagem salva',
  'Not saved': 'Não salva',
  'A save dialog is already open': 'Já há uma janela de salvar aberta',
  'Saving isn’t available in this view': 'Salvar não está disponível nesta visualização',
  'The image could not be saved': 'Não foi possível salvar a imagem',

  // panels and start-up
  'Updating the simulation…': 'Atualizando a simulação…',
  'Simulation updated · quilt dropped again at the new size':
    'Simulação atualizada · quilt solto de novo no novo tamanho',
  'Simulation up to date': 'Simulação em dia',
  'Hide controls': 'Ocultar controles',
  'Show controls': 'Mostrar controles',
  'Fewer options': 'Menos opções',
  'More options': 'Mais opções',
  'Hide advanced settings': 'Ocultar ajustes avançados',
  'Show advanced settings': 'Mostrar ajustes avançados',
  'Photo render, measurements, final-state analysis and fabric physics':
    'Render fotográfico, medidas, análise do estado final e física do tecido',
  'Some photos or lighting could not load. Showing a plain preview.':
    'Algumas fotos ou a iluminação não carregaram. Mostrando uma prévia simples.',
  'Click to open or close': 'Clique para abrir ou fechar',
};
