import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../assets/js/club-reception.js',import.meta.url),'utf8');
const pure=source.slice(source.indexOf('const fold='),source.indexOf('export function createReception'));
const {receptionRows}=await import('data:text/javascript;base64,'+Buffer.from(pure).toString('base64'));
const sample=[
 {first_name:'Zoé',last_name:'Martin',licence:'1234567A',team_name:'Zoé / Alice'},
 {first_name:'Alice',last_name:'Durand',licence:'2345678B'},
 {first_name:'Élodie',last_name:'Sire',licence:'3456789C'}
];
assert.deepEqual(receptionRows(sample).map(p=>p.first_name),['Alice','Élodie','Zoé']);
assert.equal(receptionRows(sample,'zoe martin')[0].licence,'1234567A');
assert.equal(receptionRows(sample,'2345678')[0].first_name,'Alice');
assert.equal(receptionRows(sample,'inconnu').length,0);
console.log('PASS: first-name sort, accent-insensitive search, licence search and no results');
