'use strict';
// Deterministic cleanup of known clipped exports. Original business.json stays untouched.
function cleanDescription(value){
  const original=String(value||'').trim();
  const changes=[];
  const result=original.split(/\n\s*\n/u).map(block=>{
    let text=block.trim();
    // 250-character excerpts can be prefixed by a variant label during grouping.
    const clipped=text.length>=240&&!/[.!?][»”"]?$/u.test(text);
    if(clipped){
      const matches=[...text.matchAll(/[.!?](?:[»”"])?(?=\s|$)/gu)];
      const last=matches.at(-1);
      if(!last){changes.push('hidden: no complete sentence');return '';}
      const cut=last.index+last[0].length,tail=text.slice(cut);
      // Never discard a price, exclusion, warning or treatment condition silently.
      if(/\d|цен[аыу]|стоим|доплат|не включ|без |противопоказ|нельзя|не являет|это не|курс|требуе/iu.test(tail)){
        changes.push('review: incomplete condition');return '';
      }
      text=text.slice(0,cut);changes.push('removed incomplete final sentence');
    }
    return text.replace(/([,;])(?=[А-Яа-яA-Za-z])/gu,'$1 ').trim();
  }).filter(Boolean).join('\n\n');
  return {text:result,changes};
}
module.exports={cleanDescription};
