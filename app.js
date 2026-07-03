function ir(id, btn){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('on'));
  document.getElementById('s-'+id).classList.add('on');
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  if(btn) btn.classList.add('on');
  document.querySelector('main').scrollTop=0;
}

function capturar(){
  const t=document.getElementById('idea-txt');
  if(!t.value.trim()) return;
  document.getElementById('toast').style.display='block';
  t.value='';
  setTimeout(()=>document.getElementById('toast').style.display='none',3500);
}

function copiarTexto(btn){
  const p = btn.previousElementSibling;
  const texto = p ? p.textContent.trim() : '';
  if(navigator.clipboard && texto){
    navigator.clipboard.writeText(texto);
    const original = btn.textContent;
    btn.textContent = 'copiado ✓';
    setTimeout(()=>btn.textContent = original, 1500);
  }
}

function fechaHeader(){
  const dias = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  const meses = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const d = new Date();
  const el = document.getElementById('fecha-header');
  if(el) el.textContent = `${dias[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}
fechaHeader();
