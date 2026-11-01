export function extractFftRows(items,page,division){
 const chunks=items.map(x=>String(typeof x==='string'?x:x.str||'').trim().replace(/\s+/g,' ')).filter(Boolean);
 const rows=[];
 for(let i=0;i<chunks.length;i++){
  if(!/^\d+$/.test(chunks[i]))continue;
  let j=i+1;if(/^\d+[.,]\d+$/.test(chunks[j]||''))j++;
  const [last,first,licence,club]=chunks.slice(j,j+4);
  if(!last||!first||/^\d+$/.test(last)||/^\d+$/.test(first)||!/^\d{1,7}[A-Za-z]?$/.test(licence||'')||!/^\d{2}\s+\w{2}\s+\d{4}$/.test(club||''))continue;
  const rank=Number(chunks[i]);if(!Number.isInteger(rank)||rank<1)continue;
  rows.push({division,last_name:last,first_name:first,licence:String(Number(licence.replace(/[A-Za-z]$/,''))),rank,page});
 }
 return rows;
}
export async function readRankingPdf(file,division,month,onProgress=()=>{}){
 if(!file||!file.name.toLowerCase().endsWith('.pdf')||file.size>20*1024*1024)throw Error('Choisissez un PDF de moins de 20 Mo.');
 if(!/^\d{4}-\d{2}$/.test(month))throw Error('Choisissez le mois du classement.');
 const name=file.name.toLowerCase();if(division==='DD'&&/messieurs|hommes/.test(name)||division==='DM'&&/dames|femmes/.test(name))throw Error('Ce fichier semble correspondre à l’autre tableau.');
 const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('Le fichier choisi n’est pas un PDF.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs';
 const doc=await pdfjs.getDocument({data:bytes,isEvalSupported:false}).promise;
 try{
 if(doc.numPages>100)throw Error('Ce PDF dépasse 100 pages.');
 const rows=[];let header=false;
 for(let p=1;p<=doc.numPages;p++){onProgress(p,doc.numPages);const content=await(await doc.getPage(p)).getTextContent();const text=content.items.map(x=>x.str||'').join(' ');header=header||/Rang/i.test(text)&&/licence/i.test(text)&&/Nom/i.test(text);rows.push(...extractFftRows(content.items,p,division));}
 if(!header||rows.length<100)throw Error('Classement FFT complet non reconnu. Aucun remplacement effectué.');
 if(new Set(rows.map(r=>r.licence)).size!==rows.length)throw Error('Licences en double dans ce PDF. Aucun remplacement effectué.');
 return {division,name:file.name,month:month+'-01',sha256:hash,pages:doc.numPages,rows};
 }finally{await doc.destroy();}
}