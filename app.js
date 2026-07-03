/* ================= navegación de tabs ================= */
const cargado = new Set();

function ir(id, btn){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  document.getElementById('s-'+id).classList.add('on');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  if(btn) btn.classList.add('on');
  document.querySelector('main').scrollTop=0;
  cargarSiHaceFalta(id);
}

function cargarSiHaceFalta(id){
  if(id==='repo') return; // navegación explícita, siempre refresca
  if(cargado.has(id)) return;
  cargado.add(id);
  if(id==='hoy') cargarHoy();
  else if(id==='baul') cargarBaul();
  else if(id==='prod') cargarProd();
  else if(id==='negocio') cargarNegocio();
}

/* ================= overlays (setup / ajustes / doc) ================= */
function abrirOverlay(id){ document.getElementById(id).classList.add('on'); }
function cerrarOverlay(id){ document.getElementById(id).classList.remove('on'); }

function mostrarSetupSiHaceFalta(){
  if(!GH.configured()) abrirOverlay('overlay-setup');
  else cargarSiHaceFalta('hoy');
}

function guardarSetup(){
  const token = document.getElementById('in-token').value.trim();
  const owner = document.getElementById('in-owner').value.trim() || 'ZiR-KRIS';
  const repo = document.getElementById('in-repo').value.trim() || 'zr-code';
  const branch = document.getElementById('in-branch').value.trim() || 'master';
  const errEl = document.getElementById('setup-error');
  if(!token){ errEl.textContent = 'Falta el token.'; return; }
  localStorage.setItem(CONFIG_KEYS.token, token);
  localStorage.setItem(CONFIG_KEYS.owner, owner);
  localStorage.setItem(CONFIG_KEYS.repo, repo);
  localStorage.setItem(CONFIG_KEYS.branch, branch);
  errEl.textContent = '';
  cerrarOverlay('overlay-setup');
  cargarSiHaceFalta('hoy');
}

function abrirAjustes(){
  const {token, owner, repo, branch} = GH.cfg();
  document.getElementById('token-mask').textContent = token ? `••••••••${token.slice(-4)}` : '(sin token)';
  document.getElementById('aj-owner').value = owner;
  document.getElementById('aj-repo').value = repo;
  document.getElementById('aj-branch').value = branch;
  abrirOverlay('overlay-ajustes');
}

function guardarAjustes(){
  localStorage.setItem(CONFIG_KEYS.owner, document.getElementById('aj-owner').value.trim() || 'ZiR-KRIS');
  localStorage.setItem(CONFIG_KEYS.repo, document.getElementById('aj-repo').value.trim() || 'zr-code');
  localStorage.setItem(CONFIG_KEYS.branch, document.getElementById('aj-branch').value.trim() || 'master');
  cerrarOverlay('overlay-ajustes');
  cargado.clear();
  cargarSiHaceFalta('hoy');
}

function borrarToken(){
  localStorage.removeItem(CONFIG_KEYS.token);
  cargado.clear();
  cerrarOverlay('overlay-ajustes');
  abrirOverlay('overlay-setup');
}

/* ================= utilidades de markdown ================= */

// Extrae el cuerpo bajo un heading (por prefijo, ej '## MODO ACTUAL') hasta el próximo
// heading o un '---' de nivel sección.
function extraerSeccion(md, headingPrefix){
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.trim().startsWith(headingPrefix));
  if(start === -1) return null;
  let end = lines.length;
  for(let i=start+1; i<lines.length; i++){
    const l = lines[i].trim();
    if(/^#{1,6}\s/.test(l) || l === '---'){ end = i; break; }
  }
  return lines.slice(start+1, end).join('\n').trim();
}

function bulletsDeSeccion(md){
  return md.split('\n').filter(l => l.trim().startsWith('- ')).map(l => l.trim().replace(/^- /, ''));
}

function parseChecklist(md){
  return md.split('\n')
    .map(l => l.match(/^- \[( |x|X)\]\s*(.+)$/))
    .filter(Boolean)
    .map(m => ({ done: m[1].toLowerCase()==='x', text: m[2].trim() }));
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Muestra un párrafo largo truncado con botón que alterna "seguir leyendo" / "leer menos".
function renderParrafoExpandible(contenedor, texto, limite = 260){
  const div = document.createElement('div');
  contenedor.appendChild(div);
  if(texto.length <= limite){
    div.innerHTML = marked.parse(texto);
    return;
  }
  let corte = texto.lastIndexOf(' ', limite);
  if(corte <= 0) corte = limite;
  const truncado = texto.slice(0, corte).trim() + '…';
  let expandido = false;
  div.innerHTML = marked.parse(truncado);
  const btn = document.createElement('button');
  btn.className = 'copiar';
  btn.style.marginTop = '6px';
  btn.textContent = 'seguir leyendo ▾';
  btn.addEventListener('click', () => {
    expandido = !expandido;
    div.innerHTML = marked.parse(expandido ? texto : truncado);
    btn.textContent = expandido ? 'leer menos ▴' : 'seguir leyendo ▾';
  });
  contenedor.appendChild(btn);
}

/* ================= HOY ================= */
async function cargarHoy(){
  const modoEl = document.getElementById('modo-actual');
  const tareasEl = document.getElementById('tareas-lista');
  modoEl.innerHTML = '<p>Cargando…</p>';
  tareasEl.innerHTML = '<p style="padding:12px;color:var(--dim)">Cargando…</p>';

  try{
    const {content} = await GH.getFile('ESTADO_ACTUAL.md');
    const seccion = extraerSeccion(content, '## MODO ACTUAL');
    if(!seccion){
      modoEl.innerHTML = '<p class="error-msg">No se encontró el bloque MODO ACTUAL.</p>';
    }else{
      const parrafos = seccion.split(/\n\s*\n/).filter(p => p.trim());
      modoEl.innerHTML = '';
      renderParrafoExpandible(modoEl, parrafos[0] || '');
      if(parrafos.length > 1){
        const det = document.createElement('details');
        det.style.marginTop = '10px';
        const sum = document.createElement('summary');
        sum.style.cursor = 'pointer'; sum.style.color = 'var(--dim)'; sum.style.fontSize = '.78rem';
        sum.textContent = 'Contexto anterior';
        const cuerpo = document.createElement('div');
        cuerpo.style.marginTop = '8px';
        cuerpo.innerHTML = marked.parse(parrafos.slice(1).join('\n\n'));
        det.appendChild(sum); det.appendChild(cuerpo);
        modoEl.appendChild(det);
      }
    }
  }catch(e){
    modoEl.innerHTML = `<p class="error-msg">Error leyendo ESTADO_ACTUAL.md: ${e.message}</p>`;
  }

  try{
    const {content} = await GH.getFile('_SISTEMA/ZR_POCKET/TAREAS.md');
    const items = parseChecklist(content);
    tareasEl.innerHTML = '';
    if(items.length === 0){
      tareasEl.innerHTML = '<p style="padding:12px;color:var(--dim)">Sin tareas.</p>';
    }
    items.forEach((it, i) => {
      const div = document.createElement('div'); div.className = 'task';
      const n = document.createElement('div'); n.className = 'n'; n.textContent = i+1;
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = it.done; chk.disabled = true;
      chk.title = 'Editable desde F3';
      const t = document.createElement('div'); t.className = 't';
      const m = it.text.match(/^(.*?)\s*\((.+)\)\s*$/);
      if(m){ t.innerHTML = `${escapeHtml(m[1])}<small>${escapeHtml(m[2])}</small>`; }
      else { t.textContent = it.text; }
      div.appendChild(n); div.appendChild(chk); div.appendChild(t);
      tareasEl.appendChild(div);
    });
  }catch(e){
    tareasEl.innerHTML = `<p class="error-msg">Error leyendo TAREAS.md: ${e.message}</p>`;
  }
}

/* ================= BAÚL ================= */
async function cargarBaul(){
  const cont = document.getElementById('baul-lista');
  cont.innerHTML = '<div class="card">Cargando…</div>';
  try{
    const items = await GH.listDir('IDEAS');
    const mdFiles = items.filter(it => it.type === 'file' && /\.md$/i.test(it.name));
    cont.innerHTML = '';
    if(mdFiles.length === 0){
      cont.innerHTML = '<div class="card"><p>El baúl está vacío.</p></div>';
      return;
    }
    mdFiles.forEach(f => {
      const card = document.createElement('div'); card.className = 'card idea';
      card.style.cursor = 'pointer';
      const h3 = document.createElement('h3'); h3.textContent = f.name.replace(/\.md$/,'');
      card.appendChild(h3);
      card.addEventListener('click', () => abrirDoc(f.path));
      cont.appendChild(card);

      GH.getFile(f.path).then(({content}) => {
        const headingMatch = content.match(/^#\s+(.+)$/m);
        const fechaMatch = f.name.match(/(\d{4}-\d{2}-\d{2})/);
        if(headingMatch) h3.textContent = headingMatch[1].trim();
        const meta = document.createElement('div'); meta.className = 'meta';
        meta.textContent = (fechaMatch ? fechaMatch[1] + ' · ' : '') + f.name;
        card.appendChild(meta);
      }).catch(()=>{ /* deja el fallback (nombre de archivo) como título */ });
    });
  }catch(e){
    cont.innerHTML = `<div class="card"><p class="error-msg">Error leyendo IDEAS/: ${e.message}</p></div>`;
  }
}

/* ================= PROD ================= */
async function cargarProd(){
  const cont = document.getElementById('prod-lista');
  cont.innerHTML = '<div class="card">Cargando…</div>';
  try{
    const {content} = await GH.getFile('ESTADO_ACTUAL.md');
    const seccion = extraerSeccion(content, '### Proyectos');
    const bullets = seccion ? bulletsDeSeccion(seccion) : [];
    cont.innerHTML = '';
    if(bullets.length === 0){
      cont.innerHTML = '<div class="card"><p>No se encontró la sección de proyectos.</p></div>';
    }
    bullets.forEach(b => {
      const card = document.createElement('div'); card.className = 'card';
      card.innerHTML = marked.parseInline(b);
      cont.appendChild(card);
    });
  }catch(e){
    cont.innerHTML = `<div class="card"><p class="error-msg">Error leyendo ESTADO_ACTUAL.md: ${e.message}</p></div>`;
  }

  const accesos = document.getElementById('prod-accesos');
  accesos.innerHTML = '';
  const links = [
    ['CLIENTES/Audiovisual/FRANK_SIN_PATRIA', 'Frank Sin Patria'],
    ['CLIENTES', 'Clientes'],
    ['AUTOR', 'Autor'],
  ];
  links.forEach(([path, label]) => accesos.appendChild(itemAcceso('→ ' + label, () => abrirRepo(path))));

  try{
    const frankFiles = await GH.listDir('CLIENTES/Audiovisual/FRANK_SIN_PATRIA');
    frankFiles
      .filter(f => f.type === 'file' && /shot_table/i.test(f.name))
      .forEach(f => accesos.appendChild(itemAcceso('→ ' + f.name, () => abrirDoc(f.path))));
  }catch(e){ /* accesos base ya quedaron listados */ }
}

function itemAcceso(label, onClick){
  const div = document.createElement('div'); div.className = 'task'; div.style.cursor = 'pointer';
  const t = document.createElement('div'); t.className = 't'; t.textContent = label;
  div.appendChild(t);
  div.addEventListener('click', onClick);
  return div;
}

/* ================= NEGOCIO ================= */
async function cargarNegocio(){
  const mapa = [
    ['_EMPRESA/Branding/one_liner.md', 'neg-pitch'],
    ['_EMPRESA/Branding/descripcion_servicios.md', 'neg-servicios'],
    ['_EMPRESA/Precios/precios_zir_2026.md', 'neg-precios'],
    ['_EMPRESA/Bio_Presentacion/bio_instagram.md', 'neg-bio-corta'],
    ['_EMPRESA/Branding/bio_larga.md', 'neg-bio-larga'],
    ['_EMPRESA/Branding/firma_email.md', 'neg-firma'],
  ];
  for(const [path, id] of mapa){
    const el = document.getElementById(id);
    if(!el) continue;
    try{
      const {content} = await GH.getFile(path);
      el.innerHTML = marked.parse(content);
    }catch(e){
      el.innerHTML = `<p class="error-msg">Error leyendo ${path}: ${e.message}</p>`;
    }
  }
}

function copiarBloque(btn){
  const contenedor = btn.closest('.card');
  const contenido = contenedor ? contenedor.querySelector('.doc-content') : null;
  const texto = contenido ? contenido.innerText.trim() : '';
  if(!texto || !navigator.clipboard) return;
  navigator.clipboard.writeText(texto).then(() => {
    const original = btn.textContent;
    btn.textContent = 'copiado ✓';
    setTimeout(() => btn.textContent = original, 1500);
  });
}

/* ================= navegador de repo ================= */
let repoPath = '';

function abrirRepoRaiz(){ ir('repo'); cargarRepoPath(''); }
function abrirRepo(path){ ir('repo'); cargarRepoPath(path); }

async function cargarRepoPath(path){
  repoPath = path;
  renderBreadcrumbRepo();
  const cont = document.getElementById('repo-list');
  cont.innerHTML = '<div class="card">Cargando…</div>';
  try{
    const items = await GH.listDir(path);
    const excluidos = new Set(['.git', 'node_modules', '_TEMP']);
    const filtrados = items
      .filter(it => !excluidos.has(it.name))
      .filter(it => it.type === 'dir' || /\.(md|png|jpe?g)$/i.test(it.name))
      .sort((a,b) => (a.type === b.type) ? a.name.localeCompare(b.name) : (a.type === 'dir' ? -1 : 1));
    cont.innerHTML = '';
    if(filtrados.length === 0){
      cont.innerHTML = '<div class="card"><p>Carpeta vacía.</p></div>';
      return;
    }
    filtrados.forEach(it => {
      const div = document.createElement('div'); div.className = 'repo-item';
      const ico = document.createElement('span'); ico.className = 'ico';
      ico.textContent = it.type === 'dir' ? '📁' : (/\.(png|jpe?g)$/i.test(it.name) ? '🖼️' : '📄');
      div.appendChild(ico);
      div.appendChild(document.createTextNode(it.name));
      div.addEventListener('click', () => {
        if(it.type === 'dir') cargarRepoPath(it.path);
        else if(/\.md$/i.test(it.name)) abrirDoc(it.path);
        else abrirImagen(it.path);
      });
      cont.appendChild(div);
    });
  }catch(e){
    cont.innerHTML = `<div class="card"><p class="error-msg">No se pudo cargar: ${e.message}</p></div>`;
  }
}

function renderBreadcrumbRepo(){
  const el = document.getElementById('repo-breadcrumb');
  el.innerHTML = '';
  const root = document.createElement('span'); root.textContent = 'raíz';
  root.addEventListener('click', () => cargarRepoPath(''));
  el.appendChild(root);
  if(repoPath){
    let acumulado = '';
    repoPath.split('/').forEach(p => {
      acumulado = acumulado ? acumulado + '/' + p : p;
      el.appendChild(document.createTextNode(' / '));
      const seg = document.createElement('span'); seg.textContent = p;
      const rutaFinal = acumulado;
      seg.addEventListener('click', () => cargarRepoPath(rutaFinal));
      el.appendChild(seg);
    });
  }
}

async function abrirDoc(path){
  document.getElementById('doc-breadcrumb').textContent = path;
  const body = document.getElementById('doc-body');
  body.innerHTML = '<div class="card">Cargando…</div>';
  abrirOverlay('overlay-doc');
  try{
    const {content} = await GH.getFile(path);
    body.innerHTML = marked.parse(content);
    interceptarLinksInternos(body, path);
  }catch(e){
    body.innerHTML = `<div class="card"><p class="error-msg">No se pudo abrir: ${e.message}</p></div>`;
  }
}

async function abrirImagen(path){
  document.getElementById('doc-breadcrumb').textContent = path;
  const body = document.getElementById('doc-body');
  body.innerHTML = '<div class="card">Cargando…</div>';
  abrirOverlay('overlay-doc');
  try{
    const {content} = await GH.getFileRaw(path);
    const ext = path.split('.').pop().toLowerCase();
    const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
    body.innerHTML = '';
    const img = document.createElement('img');
    img.src = `data:${mime};base64,${content}`;
    img.style.maxWidth = '100%'; img.style.borderRadius = '8px';
    body.appendChild(img);
  }catch(e){
    body.innerHTML = `<p class="error-msg">No se pudo abrir la imagen: ${e.message}</p>`;
  }
}

function interceptarLinksInternos(container, basePath){
  container.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href');
    if(!href || /^https?:\/\//i.test(href) || href.startsWith('#')) return;
    a.addEventListener('click', ev => {
      ev.preventDefault();
      const resuelto = resolverRutaRelativa(basePath, href);
      if(/\.md$/i.test(resuelto)) abrirDoc(resuelto);
      else if(/\.(png|jpe?g)$/i.test(resuelto)) abrirImagen(resuelto);
    });
  });
}

function resolverRutaRelativa(basePath, href){
  const pila = basePath.split('/').slice(0, -1);
  href.split('/').forEach(p => {
    if(p === '' || p === '.') return;
    if(p === '..') pila.pop();
    else pila.push(p);
  });
  return pila.join('/');
}

/* ================= BAÚL: captura (simulada — escritura real en F3) ================= */
function capturar(){
  const t = document.getElementById('idea-txt');
  if(!t.value.trim()) return;
  document.getElementById('toast').style.display = 'block';
  t.value = '';
  setTimeout(() => document.getElementById('toast').style.display = 'none', 3500);
}

/* ================= header ================= */
function fechaHeader(){
  const dias = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const d = new Date();
  const el = document.getElementById('fecha-header');
  if(el) el.textContent = `${dias[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

document.addEventListener('DOMContentLoaded', () => {
  fechaHeader();
  mostrarSetupSiHaceFalta();
});
