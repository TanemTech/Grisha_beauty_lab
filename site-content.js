/* Shared gallery ordering; team data is left unchanged. */
(function(global){
  'use strict';
  const data=global.TANEM_SITE_DATA;
  if(!data)return;
  const gallery=Object.entries(data.media.gallery||{}).filter(([,items])=>items.length);
  gallery.sort(([a],[b])=>Number(b.trim().toLowerCase()==='салон')-Number(a.trim().toLowerCase()==='салон'));
  data.media.gallery=Object.fromEntries(gallery);
  const galleryDefault=gallery.find(([category])=>category.trim().toLowerCase()!=='салон')?.[0]||gallery[0]?.[0]||'';
  global.TANEM_CONTENT={galleryDefault};
})(window);
