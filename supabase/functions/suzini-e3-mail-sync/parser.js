// Deliberately strict: unsupported layouts become review items, never paid flags.
export function normalize(value){return String(value??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/[^a-z0-9]/g,'');}
export function htmlText(html){return String(html||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|div|tr|td|th|h[1-6])>|<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'").replace(/&euro;/gi,'€').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));}
export function authenticatedSumup(headers){
 // Trust only receiver-generated authentication results placed above the first Received
 // hop. Older/forwarded Authentication-Results inside the message are not evidence.
 const received=headers.findIndex(h=>h.key.toLowerCase()==='received'&&!/from\s+[^\s]*infomaniak\.(?:ch|com)\b/i.test(h.value));
 const top=headers.slice(0,received<0?headers.length:received+1);
 return top.some(h=>h.key.toLowerCase()==='authentication-results'&&/^[^;]*infomaniak\.(?:ch|com)\s*;/i.test(h.value)&&h.value.replace(/\\[trn]/g,' ').replace(/\([^)]*\)/g,'').split(';').some(clause=>/\bdkim=pass\b/i.test(clause)&&/header\.(?:d|i)=(?:@)?(?:[a-z0-9-]+\.)*sumup\.com(?:\s|$)/i.test(clause)));
}
export function parseOrder(mail,receivedAt,product){
 if(mail.from?.address?.toLowerCase()!=='no-reply@notification.sumup.com'||!/^Nouvelle commande\s*#\d+/i.test(mail.subject||''))return null;
 const html=htmlText(mail.html);const text=((/Détail commande|Récapitulatif de la commande/i.test(html)?html:mail.text)||html).replace(/\r/g,'');
 const lines=text.split('\n').map(l=>l.trim().replace(/[\u00a0\u202f]/g,' ')).filter(Boolean);
 const number=(mail.subject.match(/#(\d+)/)||[])[1];
 const orderUuid=(String(mail.html||'')+' '+text).match(/online-selling\/orders\/([0-9a-f]{8}-[0-9a-f-]{27,})/i)?.[1];
 const date=mail.date?new Date(mail.date):null;
 const year=date&&!Number.isNaN(date.getTime())?date.getUTCFullYear():new Date(receivedAt).getUTCFullYear();
 const customer=lines.findIndex(l=>normalize(l)==='coordonneesduclient');
 const buyer=customer>=0?lines[customer+1]||'':'';
 const detail=lines.findIndex(l=>normalize(l)==='detailcommande'||normalize(l)==='recapitulatifdelacommande');
 const total=lines.findIndex((l,i)=>i>detail&&/^(Sous-total|Coût Total|Total)\b/i.test(l));
 const orderLines=detail>=0?lines.slice(detail+1,total>detail?total:undefined):[];
 if(product&&!normalize(text).includes(normalize(product)))return null;
 const productIndex=orderLines.findIndex(l=>normalize(l)===normalize(product));
 // Include only the configured article, never the total of a mixed basket.
 const qline=productIndex>=0?orderLines.slice(productIndex+1,productIndex+4).join(' '):'';
 const quantity=qline.match(/^(\d+)\s*[x×]\s*(\d[\d ]*[,.]\d{2})\s*(?:€|EUR)/i);
 let cents=null,qty=0;
 if(quantity){qty=Number(quantity[1]);const unit=Math.round(Number(quantity[2].replace(/ /g,'').replace(',','.'))*100);if(unit===1000&&qty>0&&qty<=2)cents=unit*qty;}
 const paid=/Payé par carte/i.test(text),verified=authenticatedSumup(mail.headers||[]);
 const productCount=orderLines.filter(l=>normalize(l)===normalize(product)).length;
 const eligible=paid&&productIndex>=0&&productCount===1&&qty===1&&cents===1000;
 let reason=!verified?'Authenticité du mail à vérifier':!paid?'Paiement non confirmé par carte':productIndex<0?'Article différent ou libellé non reconnu':cents===null?'Montant ou quantité à vérifier':qty===2?'Paiement de deux joueurs : attribuer l’équipe dans le Club':'Recherche du joueur inscrit';
 return {order_key:orderUuid?'sumup:'+orderUuid.toLowerCase():`sumup:${year}:${number}`,order_number:number,message_id:mail.messageId||null,received_at:receivedAt,buyer_name:buyer,amount_cents:cents,product_name:productIndex>=0?product:orderLines[0]||'',verified,eligible,reason,details:text.slice(0,10000)};
}
