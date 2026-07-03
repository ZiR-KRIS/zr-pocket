const CONFIG_KEYS = { token:'zrp_token', owner:'zrp_owner', repo:'zrp_repo', branch:'zrp_branch' };

const GH = {
  cfg(){
    return {
      token: localStorage.getItem(CONFIG_KEYS.token) || '',
      owner: localStorage.getItem(CONFIG_KEYS.owner) || 'ZiR-KRIS',
      repo: localStorage.getItem(CONFIG_KEYS.repo) || 'zr-code',
      branch: localStorage.getItem(CONFIG_KEYS.branch) || 'master',
    };
  },

  configured(){ return !!this.cfg().token; },

  async raw(path){
    const {token, owner, repo, branch} = this.cfg();
    const base = `https://api.github.com/repos/${owner}/${repo}/contents`;
    const url = path
      ? `${base}/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`
      : `${base}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
      headers:{
        'Authorization': `Bearer ${token}`,
        'Accept':'application/vnd.github+json'
      }
    });
    if(!res.ok){
      const err = new Error(`GitHub API ${res.status} en ${path || 'raíz'}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  },

  // Los archivos del repo tienen tildes/ñ: decodificar el base64 como UTF-8 real, no con atob() a secas.
  b64ToUtf8(b64){
    const limpio = b64.replace(/\s/g,'');
    const bin = atob(limpio);
    const bytes = Uint8Array.from(bin, c=>c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  },

  async getFile(path){
    const data = await this.raw(path);
    if(Array.isArray(data) || !data.content) throw new Error(`${path} no es un archivo`);
    return { content: this.b64ToUtf8(data.content), sha: data.sha };
  },

  // Para binarios (imágenes): mismo base64 que da la API, sin decodificar a texto.
  async getFileRaw(path){
    const data = await this.raw(path);
    if(Array.isArray(data) || !data.content) throw new Error(`${path} no es un archivo`);
    return { content: data.content.replace(/\s/g,''), sha: data.sha };
  },

  async listDir(path){
    const data = await this.raw(path);
    return Array.isArray(data) ? data : [];
  },

  utf8ToB64(str){
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => bin += String.fromCharCode(b));
    return btoa(bin);
  },

  async putFile(path, contentUtf8, message, sha){
    const {token, owner, repo, branch} = this.cfg();
    const body = { message, content: this.utf8ToB64(contentUtf8), branch };
    if(sha) body.sha = sha;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      headers:{
        'Authorization': `Bearer ${token}`,
        'Accept':'application/vnd.github+json',
        'Content-Type':'application/json'
      },
      body: JSON.stringify(body)
    });
    if(!res.ok){
      const err = new Error(`GitHub API ${res.status} escribiendo ${path}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
};
