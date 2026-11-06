// Cloudflare Worker: stores uploads in a GitHub repository.
// Configure Worker secrets/variables: GITHUB_TOKEN (secret), GITHUB_OWNER, GITHUB_REPO,
// GITHUB_BRANCH (optional, defaults to main), ALLOWED_ORIGIN (your GitHub Pages URL).
const json = (data, status=200, origin="*") => new Response(JSON.stringify(data), {
  status, headers: {
    "Content-Type":"application/json",
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type"
  }
});
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const corsOrigin = allowed === "*" || origin === allowed ? (allowed === "*" ? "*" : origin) : "null";
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:{
      "Access-Control-Allow-Origin":corsOrigin,"Access-Control-Allow-Methods":"GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":"Content-Type","Access-Control-Max-Age":"86400"
    }});
    if (corsOrigin === "null") return json({error:"Origin not allowed"},403,"null");
    if (!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) return json({error:"Worker is missing GitHub configuration"},500,corsOrigin);

    const headers = {Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json",
      "X-GitHub-Api-Version":"2022-11-28","User-Agent":"GitHub-Cloud-Storage"};
    const branch = env.GITHUB_BRANCH || "main";
    const api = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
    const url = new URL(request.url);

    if (request.method==="GET" && url.pathname==="/files") {
      const r=await fetch(`${api}/contents/uploads?ref=${encodeURIComponent(branch)}`,{headers});
      if(r.status===404) return json({files:[]},200,corsOrigin);
      const data=await r.json();
      if(!r.ok) return json({error:data.message||"GitHub API error"},r.status,corsOrigin);
      const files=Array.isArray(data)?data.filter(x=>x.type==="file").map(x=>({
        name:x.name,path:x.path,size:x.size,
        download_url:`${url.origin}/download?path=${encodeURIComponent(x.path)}`
      })):[];
      return json({files},200,corsOrigin);
    }

    if (request.method==="GET" && url.pathname==="/download") {
      const path=url.searchParams.get("path") || "";
      if(!path.startsWith("uploads/") || path.includes("..") || path.includes("\\\\")) return json({error:"Invalid path"},400,corsOrigin);
      const raw=`https://raw.githubusercontent.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/${encodeURIComponent(branch)}/${path.split("/").map(encodeURIComponent).join("/")}`;
      const r=await fetch(raw,{headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`}});
      if(!r.ok) return json({error:"Unable to download file"},r.status,corsOrigin);
      const filename=path.split("/").pop().replace(/["\\\\]/g,"_");
      const headersOut=new Headers({
        "Access-Control-Allow-Origin":corsOrigin,
        "Content-Type":r.headers.get("Content-Type") || "application/octet-stream",
        "Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control":"private, max-age=60"
      });
      return new Response(r.body,{status:200,headers:headersOut});
    }

    if (request.method==="POST" && url.pathname==="/upload") {
      let body;
      try { body=await request.json(); } catch { return json({error:"Invalid JSON"},400,corsOrigin); }
      if(typeof body.name!=="string" || typeof body.content!=="string") return json({error:"Missing file name or content"},400,corsOrigin);
      const name=body.name.split(/[\\/]/).pop().replace(/[^\p{L}\p{N}._() -]/gu,"_").trim();
      if(!name || name==="." || name==="..") return json({error:"Invalid file name"},400,corsOrigin);
      if(body.content.length > 36*1024*1024) return json({error:"File too large for this upload endpoint"},413,corsOrigin);
      const path=`uploads/${Date.now()}-${name}`;
      const r=await fetch(`${api}/contents/${path.split("/").map(encodeURIComponent).join("/")}`,{
        method:"PUT",headers:{...headers,"Content-Type":"application/json"},
        body:JSON.stringify({message:`Upload ${name}`,content:body.content,branch})
      });
      const data=await r.json();
      if(!r.ok) return json({error:data.message||"GitHub upload failed"},r.status,corsOrigin);
      return json({ok:true,path,html_url:data.content?.html_url},201,corsOrigin);
    }
    return json({error:"Not found"},404,corsOrigin);
  }
};
