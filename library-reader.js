(()=>{'use strict';
const cfg=window.MEDPATH_LIBRARY_CONFIG||{};
if(!window.supabase?.createClient||!window.pdfjsLib)return;
window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
let doc=null,pageNo=1,autoRead=false;
function stop(){autoRead=false;window.speechSynthesis?.cancel()}
async function open(bucket,path,title){
 stop();$('readerModal').classList.remove('hidden');$('readerTitle').textContent=title;$('readerStatus').textContent='Opening secure PDF…';
 try{const r=await db.storage.from(bucket).createSignedUrl(path,600);if(r.error)throw r.error;doc=await window.pdfjsLib.getDocument({url:r.data.signedUrl}).promise;pageNo=1;$('readerStatus').textContent=doc.numPages+' pages';await render()}
 catch(e){$('readerStatus').textContent='Unable to open PDF: '+e.message}
}
async function render(){
 if(!doc)return;
 const page=await doc.getPage(pageNo),v0=page.getViewport({scale:1}),scale=Math.min(1.5,Math.max(.75,(window.innerWidth-400)/v0.width)),viewport=page.getViewport({scale});
 const canvas=$('readerCanvas'),ctx=canvas.getContext('2d');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:ctx,viewport}).promise;
 const content=await page.getTextContent(),txt=content.items.map(x=>x.str).join(' ').replace(/\s+/g,' ').trim();
 $('readerText').textContent=txt||'No selectable text on this page. This may be a scanned page; OCR is needed before narration.';
 $('readerPageLabel').textContent='Page '+pageNo+' of '+doc.numPages;$('readerPrev').disabled=pageNo<=1;$('readerNext').disabled=pageNo>=doc.numPages;
 $('readerListen').disabled=!txt;$('readerListenAll').disabled=!txt;$('readerStatus').textContent='Page '+pageNo+' of '+doc.numPages+' · '+(txt?txt.length+' characters':'No selectable text');
}
function speak(all){
 if(!window.speechSynthesis){alert('Text-to-speech is not supported in this browser. Please try Chrome or Edge.');return}
 const t=$('readerText').textContent;if(!t||t.startsWith('No selectable text'))return;stop();autoRead=all;
 const u=new SpeechSynthesisUtterance(t);u.rate=Number($('readerSpeed').value)||1;
 u.onend=async()=>{if(autoRead&&doc&&pageNo<doc.numPages){pageNo++;await render();speak(true)}else autoRead=false};u.onerror=()=>autoRead=false;window.speechSynthesis.speak(u);
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-open],[data-personal-open]');if(!b)return;
 e.preventDefault();e.stopImmediatePropagation();
 try{
  if(b.hasAttribute('data-open')){const id=b.getAttribute('data-open'),r=await db.from('books').select('title,storage_path').eq('id',id).single();if(r.error)throw r.error;await open('medpath-books',r.data.storage_path,r.data.title)}
  else{const id=b.getAttribute('data-personal-open'),r=await db.from('student_uploads').select('title,storage_path').eq('id',id).single();if(r.error)throw r.error;await open('student-private',r.data.storage_path,r.data.title)}
 }catch(err){alert('Could not open PDF: '+err.message)}
},true);
$('readerClose').addEventListener('click',()=>{$('readerModal').classList.add('hidden');stop();doc=null});
$('readerPrev').addEventListener('click',async()=>{stop();if(pageNo>1){pageNo--;await render()}});
$('readerNext').addEventListener('click',async()=>{stop();if(doc&&pageNo<doc.numPages){pageNo++;await render()}});
$('readerListen').addEventListener('click',()=>speak(false));$('readerListenAll').addEventListener('click',()=>speak(true));$('readerStop').addEventListener('click',stop);
$('readerSpeed').addEventListener('change',()=>{if(window.speechSynthesis?.speaking){const all=autoRead;stop();speak(all)}});
})();