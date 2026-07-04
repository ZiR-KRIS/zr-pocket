/* ================= navegación de tabs ================= */
const cargado = new Set();

function irHome(){
  ir('hoy', document.querySelector('nav .tab'));
}

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
  else if(id==='cal') cargarCal();
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

// El SW marca las respuestas servidas desde caché (sin red) — reflejarlo en un aviso fijo.
function actualizarBannerOffline(){
  const banner = document.getElementById('offline-banner');
  if(GH.ultimaEsDeCache){
    const fecha = GH.ultimaFechaCache ? new Date(GH.ultimaFechaCache).toLocaleString('es-CL') : 'desconocida';
    banner.textContent = `Sin conexión — datos de ${fecha}`;
    banner.style.display = 'block';
  }else{
    banner.style.display = 'none';
  }
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

/* ================= MODO ACTUAL: tarjetas + chips ================= */

// Root-level: línea "- texto" o "N. texto" (el MODO ACTUAL real hoy usa lista numerada).
function esBulletRaizModo(linea){
  return /^(-\s|\d+\.\s)/.test(linea);
}

function detectarChipModo(textoPlano){
  const grupos = [
    { cls: 'ok', palabras: ['TERMINADO','CERRADO','LISTO','RESUELTO','OK'] },
    { cls: 'wait', palabras: ['EN CURSO','EN PROGRESO','HOY','SIGUIENTE'] },
    { cls: 'pause', palabras: ['PAUSA','BLOQUEADO','ESPERANDO','PENDIENTE'] },
  ];
  let mejor = null;
  for(const g of grupos){
    for(const palabra of g.palabras){
      const re = new RegExp(`\\b${palabra.replace(' ', '\\s+')}\\b`, 'i');
      const m = textoPlano.match(re);
      if(m && (mejor === null || m.index < mejor.index)) mejor = { index: m.index, cls: g.cls, palabra: m[0] };
    }
  }
  return mejor;
}

function renderTarjetaModo(bloqueMd, contenedor){
  const sinMarcador = bloqueMd.replace(/^(-\s|\d+\.\s)/, '');
  const plano = sinMarcador.replace(/\*\*/g, '');

  const card = document.createElement('div');
  card.className = 'card';
  card.style.padding = '10px 12px';
  card.style.marginBottom = '8px';

  const chip = detectarChipModo(plano);
  if(chip){
    const chipEl = document.createElement('span');
    chipEl.className = `chip ${chip.cls}`;
    chipEl.textContent = chip.palabra;
    card.appendChild(chipEl);
  }

  const emojiMatch = plano.match(/^(\p{Extended_Pictographic}️?)\s*/u);
  let cuerpoMd = sinMarcador;
  if(emojiMatch) cuerpoMd = cuerpoMd.replace(emojiMatch[0], '');

  const row = document.createElement('div');
  row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems = 'flex-start';
  if(emojiMatch){
    const icoEl = document.createElement('span');
    icoEl.style.fontSize = '1.05rem';
    icoEl.textContent = emojiMatch[1];
    row.appendChild(icoEl);
  }

  const cuerpoWrap = document.createElement('div');
  cuerpoWrap.style.flex = '1';
  const boldMatch = cuerpoMd.match(/^\*\*(.+?)\*\*:?\s*/);
  if(boldMatch){
    const h3 = document.createElement('h3');
    h3.textContent = boldMatch[1].replace(/:$/, '');
    cuerpoWrap.appendChild(h3);
    const cuerpoDiv = document.createElement('div');
    cuerpoDiv.style.color = 'var(--dim)'; cuerpoDiv.style.fontSize = '.84rem';
    cuerpoDiv.innerHTML = marked.parse(cuerpoMd.slice(boldMatch[0].length));
    cuerpoWrap.appendChild(cuerpoDiv);
  }else{
    const cuerpoDiv = document.createElement('div');
    cuerpoDiv.style.color = 'var(--dim)'; cuerpoDiv.style.fontSize = '.84rem';
    cuerpoDiv.innerHTML = marked.parse(cuerpoMd);
    cuerpoWrap.appendChild(cuerpoDiv);
  }
  row.appendChild(cuerpoWrap);
  card.appendChild(row);
  contenedor.appendChild(card);
}

function renderModoActualVisual(seccion, contenedor){
  contenedor.innerHTML = '';
  const lineas = seccion.split('\n');
  const idx = lineas.findIndex(esBulletRaizModo);
  const introTxt = (idx === -1 ? lineas : lineas.slice(0, idx)).join('\n').trim();
  if(introTxt) renderParrafoExpandible(contenedor, introTxt);

  if(idx !== -1){
    const bloques = [];
    for(let i=idx; i<lineas.length; i++){
      if(esBulletRaizModo(lineas[i])) bloques.push([lineas[i]]);
      else if(bloques.length) bloques[bloques.length-1].push(lineas[i]);
    }
    bloques.forEach(ls => renderTarjetaModo(ls.join('\n').trim(), contenedor));
  }

  const btn = document.createElement('button');
  btn.className = 'copiar';
  btn.textContent = 'ver texto completo ▸';
  btn.addEventListener('click', () => {
    document.getElementById('doc-breadcrumb').textContent = 'ESTADO_ACTUAL.md · MODO ACTUAL';
    document.getElementById('doc-body').innerHTML = marked.parse(seccion);
    abrirOverlay('overlay-doc');
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
      renderModoActualVisual(seccion, modoEl);
    }
  }catch(e){
    modoEl.innerHTML = `<p class="error-msg">Error leyendo ESTADO_ACTUAL.md: ${e.message}</p>`;
  }

  try{
    const {content, sha} = await GH.getFile('_SISTEMA/ZR_POCKET/TAREAS.md');
    tareasRaw = content;
    tareasSha = sha;
    const items = parseChecklist(content);
    tareasEl.innerHTML = '';
    if(items.length === 0){
      tareasEl.innerHTML = '<p style="padding:12px;color:var(--dim)">Sin tareas.</p>';
    }
    items.forEach((it, i) => {
      const div = document.createElement('div'); div.className = 'task';
      const n = document.createElement('div'); n.className = 'n'; n.textContent = i+1;
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = it.done;
      chk.addEventListener('change', () => toggleTarea(i, it.text, chk));
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
  actualizarBannerOffline();
}

let tareasRaw = '';
let tareasSha = null;

async function toggleTarea(indice, texto, checkboxEl){
  checkboxEl.disabled = true;
  const lineas = tareasRaw.split('\n');
  let contador = -1, lineaIdx = -1;
  for(let i=0; i<lineas.length; i++){
    if(/^- \[( |x|X)\]\s*.+/.test(lineas[i])){
      contador++;
      if(contador === indice){ lineaIdx = i; break; }
    }
  }
  if(lineaIdx === -1){ checkboxEl.disabled = false; return; }
  const estabaMarcada = /\[x\]/i.test(lineas[lineaIdx]);
  lineas[lineaIdx] = lineas[lineaIdx].replace(/^- \[( |x|X)\]/, `- [${estabaMarcada ? ' ' : 'x'}]`);
  const nuevoContenido = lineas.join('\n');
  try{
    const accion = estabaMarcada ? 'desmarcada' : 'marcada';
    const resp = await GH.putFile('_SISTEMA/ZR_POCKET/TAREAS.md', nuevoContenido, `ZR APP: tarea ${accion} — ${texto}`, tareasSha);
    tareasRaw = nuevoContenido;
    tareasSha = resp.content.sha;
  }catch(e){
    checkboxEl.checked = estabaMarcada;
    alert(`No se pudo guardar el cambio: ${e.message}`);
  }finally{
    checkboxEl.disabled = false;
  }
}

// Agrega una tarea al final de la última checklist de TAREAS.md.
async function appendTarea(texto, mensajeCommit){
  const {content, sha} = await GH.getFile('_SISTEMA/ZR_POCKET/TAREAS.md');
  const lineas = content.split('\n');
  let ultimoIdx = -1;
  for(let i=0; i<lineas.length; i++){
    if(/^- \[( |x|X)\]/.test(lineas[i])) ultimoIdx = i;
  }
  if(ultimoIdx === -1) ultimoIdx = lineas.length - 1;
  lineas.splice(ultimoIdx + 1, 0, `- [ ] ${texto}`);
  await GH.putFile('_SISTEMA/ZR_POCKET/TAREAS.md', lineas.join('\n'), mensajeCommit, sha);
  cargado.delete('hoy');
}

async function agregarTareaHoy(){
  const input = document.getElementById('tarea-txt');
  const toast = document.getElementById('toast-hoy');
  const texto = input.value.trim();
  if(!texto) return;
  input.disabled = true;
  try{
    await appendTarea(texto, `ZR APP: tarea nueva — ${texto}`);
    input.value = '';
    toast.textContent = '✓ tarea agregada';
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 2000);
    cargarHoy();
  }catch(e){
    toast.textContent = `Error: ${e.message}`;
    toast.style.display = 'block';
  }finally{
    input.disabled = false;
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
      actualizarBannerOffline();
      return;
    }
    mdFiles.forEach(f => {
      const card = document.createElement('div'); card.className = 'card idea';
      card.style.cursor = 'pointer';
      const h3 = document.createElement('h3'); h3.textContent = f.name.replace(/\.md$/,'');
      card.appendChild(h3);
      card.addEventListener('click', () => abrirDoc(f.path));

      const btnTarea = document.createElement('button');
      btnTarea.className = 'copiar';
      btnTarea.textContent = '→ a tareas';
      btnTarea.addEventListener('click', async (event) => {
        event.stopPropagation();
        const titulo = h3.textContent;
        btnTarea.disabled = true;
        try{
          await appendTarea(`${titulo} (del baúl)`, `ZR APP: tarea desde baúl — ${titulo}`);
          btnTarea.textContent = '✓ en tareas';
        }catch(e){
          btnTarea.disabled = false;
          alert(`No se pudo agregar: ${e.message}`);
        }
      });
      card.appendChild(btnTarea);

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
  actualizarBannerOffline();
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
  actualizarBannerOffline();
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
  actualizarBannerOffline();
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

/* ================= CAL ================= */
async function cargarCal(){
  const cont = document.getElementById('cal-lista');
  cont.innerHTML = '<p>Cargando…</p>';
  try{
    const {content} = await GH.getFile('_SISTEMA/ZR_POCKET/AGENDA.md');
    const seccion = extraerSeccion(content, '## Próximos') || '';
    const hoyISO = fechaISO();
    const eventos = seccion.split('\n')
      .map(l => l.match(/^- (\d{4}-\d{2}-\d{2})( \d{2}:\d{2})? — \[(trabajo|personal)\] (.+)$/))
      .filter(Boolean)
      .map(m => ({ fecha: m[1], hora: m[2] ? m[2].trim() : '', tipo: m[3], titulo: m[4] }))
      .filter(ev => ev.fecha >= hoyISO)
      .sort((a,b) => (a.fecha + (a.hora || '99:99')).localeCompare(b.fecha + (b.hora || '99:99')));
    cont.innerHTML = '';
    if(eventos.length === 0){
      cont.innerHTML = '<p>Nada agendado.</p>';
    }else{
      eventos.forEach(ev => {
        const div = document.createElement('div'); div.className = 'dia';
        const h = document.createElement('div'); h.className = 'h';
        const [, mo, d] = ev.fecha.split('-');
        h.textContent = `${d}-${mo}` + (ev.hora ? ` ${ev.hora}` : '');
        const t = document.createElement('div'); t.style.flex = '1';
        t.innerHTML = marked.parseInline(ev.titulo);
        const chip = document.createElement('span');
        chip.className = `chip ${ev.tipo === 'trabajo' ? 'ok' : 'pause'}`;
        chip.textContent = ev.tipo;
        div.appendChild(h); div.appendChild(t); div.appendChild(chip);
        cont.appendChild(div);
      });
    }
  }catch(e){
    cont.innerHTML = e.status === 404 ? '<p>Nada agendado.</p>' : `<p class="error-msg">Error leyendo AGENDA.md: ${e.message}</p>`;
  }
  actualizarBannerOffline();
}

function sumarDiasISO(fechaISO, dias){
  const [y, m, d] = fechaISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + dias);
  return dt.toISOString().slice(0, 10).replace(/-/g, '');
}

function construirUrlGCal(titulo, fecha, hora, tipo){
  const inicioDigitos = fecha.replace(/-/g, '');
  let dates;
  if(hora){
    const [hh, mm] = hora.split(':').map(Number);
    const inicio = `${inicioDigitos}T${String(hh).padStart(2,'0')}${String(mm).padStart(2,'0')}00`;
    const hh2 = hh + 1;
    const finDigitos = hh2 >= 24 ? sumarDiasISO(fecha, 1) : inicioDigitos;
    const fin = `${finDigitos}T${String(hh2 % 24).padStart(2,'0')}${String(mm).padStart(2,'0')}00`;
    dates = `${inicio}/${fin}`;
  }else{
    dates = `${inicioDigitos}/${sumarDiasISO(fecha, 1)}`;
  }
  const details = encodeURIComponent(`[${tipo}] agendado desde ZR App`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${dates}&details=${details}`;
}

function mostrarLinkGCal(titulo, fecha, hora, tipo){
  const cont = document.getElementById('gcal-temp');
  cont.innerHTML = '';
  const a = document.createElement('a');
  a.className = 'gcal'; a.target = '_blank'; a.rel = 'noopener';
  a.href = construirUrlGCal(titulo, fecha, hora, tipo);
  a.textContent = 'Agregarlo a Google Calendar →';
  cont.appendChild(a);
}

async function agendarEvento(){
  const titulo = document.getElementById('ev-titulo').value.trim();
  const fecha = document.getElementById('ev-fecha').value;
  const hora = document.getElementById('ev-hora').value;
  const tipo = document.getElementById('ev-tipo').value;
  const toast = document.getElementById('toast-cal');
  if(!titulo || !fecha){
    toast.textContent = 'Falta título o fecha.';
    toast.style.display = 'block';
    return;
  }
  try{
    const {content, sha} = await GH.getFile('_SISTEMA/ZR_POCKET/AGENDA.md');
    const lineas = content.split('\n');
    const idxProximos = lineas.findIndex(l => l.trim() === '## Próximos');
    const idxPasados = lineas.findIndex((l, i) => i > idxProximos && l.trim() === '## Pasados');
    let destino = idxPasados !== -1 ? idxPasados : lineas.length;
    while(destino > 0 && lineas[destino - 1].trim() === '') destino--;
    lineas.splice(destino, 0, `- ${fecha}${hora ? ' ' + hora : ''} — [${tipo}] ${titulo}`);
    await GH.putFile('_SISTEMA/ZR_POCKET/AGENDA.md', lineas.join('\n'), `ZR APP: evento — ${titulo}`, sha);

    document.getElementById('ev-titulo').value = '';
    document.getElementById('ev-fecha').value = '';
    document.getElementById('ev-hora').value = '';
    toast.textContent = '✓ agendado';
    toast.style.display = 'block';
    cargarCal();
    mostrarLinkGCal(titulo, fecha, hora, tipo);
  }catch(e){
    toast.textContent = `Error: ${e.message}`;
    toast.style.display = 'block';
  }
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
      actualizarBannerOffline();
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
  actualizarBannerOffline();
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

/* ================= BAÚL: captura real (commit a IDEAS/) ================= */
function mostrarToast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3500);
}

function slugify3(texto){
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('-') || 'idea';
}

function fechaISO(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;
}

function fechaHoraLocal(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth()+1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function capturar(){
  const t = document.getElementById('idea-txt');
  const texto = t.value.trim();
  if(!texto) return;
  t.value = '';

  const primeraLinea = texto.split('\n')[0].trim();
  const slug = slugify3(primeraLinea);
  const nombre = `zrapp_${fechaISO()}_${slug}.md`;
  const path = `IDEAS/${nombre}`;
  const contenido = `# ${primeraLinea}\n\n${texto}\n\n*Capturada desde ZR App, ${fechaHoraLocal()}.*\n`;
  const mensaje = `ZR APP: idea capturada — ${slug}`;

  mostrarToast('Subiendo…');
  try{
    await GH.putFile(path, contenido, mensaje);
    mostrarToast(`✓ commiteada a IDEAS/${nombre}`);
    cargarBaul();
  }catch(e){
    guardarIdeaPendiente(path, contenido, mensaje);
    mostrarToast('Sin conexión — guardada en el dispositivo, se sube sola al volver la red');
    actualizarChipPendientes();
  }
}

/* ---- cola offline para ideas que no se pudieron commitear al toque ---- */
function obtenerPendientes(){
  try{ return JSON.parse(localStorage.getItem('zrp_pending_ideas') || '[]'); }
  catch(e){ return []; }
}

function guardarIdeaPendiente(path, contenido, mensaje){
  const arr = obtenerPendientes();
  arr.push({path, contenido, mensaje});
  localStorage.setItem('zrp_pending_ideas', JSON.stringify(arr));
}

async function intentarSubirPendientes(){
  const arr = obtenerPendientes();
  if(arr.length === 0){ actualizarChipPendientes(); return; }
  const restantes = [];
  let subieron = 0;
  for(const item of arr){
    try{
      await GH.putFile(item.path, item.contenido, item.mensaje);
      subieron++;
    }catch(e){
      restantes.push(item);
    }
  }
  localStorage.setItem('zrp_pending_ideas', JSON.stringify(restantes));
  actualizarChipPendientes();
  if(subieron > 0 && document.getElementById('s-baul').classList.contains('on')) cargarBaul();
}

function actualizarChipPendientes(){
  const n = obtenerPendientes().length;
  let chip = document.getElementById('chip-pendientes');
  if(n === 0){
    if(chip) chip.remove();
    return;
  }
  if(!chip){
    chip = document.createElement('div');
    chip.id = 'chip-pendientes';
    chip.className = 'chip wait';
    chip.style.display = 'block';
    chip.style.marginBottom = '10px';
    const captura = document.querySelector('.captura');
    captura.insertAdjacentElement('afterend', chip);
  }
  chip.textContent = `${n} idea${n > 1 ? 's' : ''} pendiente${n > 1 ? 's' : ''} de subir`;
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
  if(GH.configured()){
    actualizarChipPendientes();
    intentarSubirPendientes();
  }
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

window.addEventListener('online', () => {
  if(GH.configured()) intentarSubirPendientes();
});
