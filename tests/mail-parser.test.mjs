import assert from 'node:assert/strict';
import {parseOrder,authenticatedSumup} from '../supabase/functions/suzini-e3-mail-sync/parser.js';
const product='BT - Americano inscription';
const headers=[{key:'authentication-results',value:'mx.infomaniak.ch; dkim=pass header.d=notification.sumup.com'},{key:'received',value:'by mx.infomaniak.ch'}];
const make=(quantity=1,name='Dupont Jean',other='')=>({from:{address:'no-reply@notification.sumup.com'},subject:'Nouvelle commande #123',headers,date:'2026-11-01T10:00:00Z',text:`Coordonnées du client\n${name}\ncontact@example.com\nDétail commande\n${product}\n${quantity}x 10,00 €\n${quantity*10},00 €\n${other}\nSous-total\n${quantity*10},00 €\nPayé par carte`,html:'<a href="https://me.sumup.com/online-selling/orders/11111111-2222-4333-8444-555555555555">Voir</a>'});
const date='2026-11-01T10:01:00.000Z';
const one=parseOrder(make(),date,product);assert.equal(one.amount_cents,1000);assert.equal(one.buyer_name,'Dupont Jean');assert.equal(one.eligible,true);assert.equal(one.verified,true);assert.equal(one.order_key,'sumup:11111111-2222-4333-8444-555555555555');
assert.equal(parseOrder(make(2),date,product).eligible,false);
assert.equal(parseOrder(make(2),date,product).amount_cents,2000);
assert.equal(parseOrder({...make(),from:{address:'fake@example.com'}},date,product),null);
assert.equal(parseOrder({...make(),headers:[]},date,product).verified,false);
assert.equal(parseOrder({...make(),text:make().text.replace('Payé par carte','En attente')},date,product).eligible,false);
assert.equal(parseOrder(make(),date,'Autre tournoi'),null);
assert.equal(parseOrder({...make(),text:make().text.replace('10,00 €','25,00 €')},date,product).amount_cents,null);
assert.equal(authenticatedSumup([{key:'received',value:'attacker'},{key:'authentication-results',value:'mx.infomaniak.ch; dkim=pass header.d=notification.sumup.com'}]),false);
console.log('Mail parser: sender, article, amount, grouped payment, authentication and reference checks passed');

assert.equal(authenticatedSumup([{key:'authentication-results',value:'mx.infomaniak.ch; dkim=pass header.d=other.com; dkim=fail header.d=notification.sumup.com'},headers[1]]),false);
