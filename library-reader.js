(()=>{'use strict';
const cfg=window.MEDPATH_LIBRARY_CONFIG||{};
if(!window.supabase?.createClient||!window.pdfjsLib)return;
window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const db=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
let doc=null,pageNo=1,autoRead=false,paused=false,voices=[],queue=[],queueIndex=0,delayTimer=null,currentMode=false;
function status(message){$('readerStatus').textContent=message}
function stop(){autoRead=false;paused=false;queue=[];queueIndex=0;if(delayTimer){clearTimeout(delayTimer);delayTimer=null}window.speechSynthesis?.cancel();updateSpeechButtons()}
function updateSpeechButtons(){
 $('readerPause').disabled=!autoRead||paused;
 $('readerResume').disabled=!paused;
 $('readerStop').disabled=!autoRead&&!paused&&!window.speechSynthesis?.speaking;
}
function selectedVoice(){
 const value=$('readerVoice').value;
 if(value==='auto'||!value)return voices.find(v=>/^en-IN$/i.test(v.lang))||voices.find(v=>/indian|india/i.test(v.name)&&/^en/i.test(v.lang))||voices.find(v=>/^en-GB$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;
 return voices.find(v=>v.voiceURI===value)||null;
}
function loadVoices(){
 const select=$('readerVoice'),previous=select.value;
 voices=window.speechSynthesis?.getVoices?.()||[];
 select.replaceChildren();
 const auto=document.createElement('option');auto.value='auto';auto.textContent='Auto — prefer Indian English';select.append(auto);
 voices.filter(v=>/^en/i.test(v.lang)).sort((a,b)=>{
  const rank=v=>/^en-IN$/i.test(v.lang)?0:/indian|india/i.test(v.name)?1:/^en-GB$/i.test(v.lang)?2:3;
  return rank(a)-rank(b)||a.name.localeCompare(b.name);
 }).forEach(v=>{const o=document.createElement('option');o.value=v.voiceURI;o.textContent=v.name+' ('+v.lang+')';select.append(o)});
 if(previous&&[...select.options].some(o=>o.value===previous))select.value=previous;
 else select.value='auto';
 const hasIndian=voices.some(v=>/^en-IN$/i.test(v.lang)||(/indian|india/i.test(v.name)&&/^en/i.test(v.lang)));
 $('readerVoiceNote').textContent=hasIndian?'Indian English voice available on this device.':'No Indian English system voice found. Auto will use the closest available English voice; install an English (India) voice in device settings for a better match.';
}
function speechText(text){
 return text
  .replace(/\be\.g\.?/gi,'for example')
  .replace(/\bi\.e\.?/gi,'that is')
  .replace(/\bDNA\b/g,'D N A').replace(/\bRNA\b/g,'R N A')
  .replace(/\bECG\b/g,'E C G').replace(/\bEEG\b/g,'E E G')
  .replace(/\bMRI\b/g,'M R I').replace(/\bHIV\b/g,'H I V')
  .replace(/\bIVF\b/g,'I V F').replace(/\bICU\b/g,'I C U')
  .replace(/\bATP\b/g,'A T P').replace(/\bADH\b/g,'A D H')
  .replace(/\s+/g,' ').trim();
}
function makeChunks(text){
 const paragraphs=text.split(/\n+/).map(x=>x.trim()).filter(Boolean),out=[];
 for(const paragraph of paragraphs){
  const sentences=paragraph.match(/[^.!?]+[.!?]+[”’"')\]]*|[^.!?]+$/g)||[paragraph];
  for(const sentence of sentences){
   let part=sentence.trim();
   while(part.length>260){
    let cut=part.lastIndexOf(' ',260);if(cut<120)cut=260;
    out.push({text:part.slice(0,cut).trim(),delay:180});part=part.slice(cut).trim();
   }
   if(part)out.push({text:part,delay:180});
  }
  if(out.length)out[out.length-1].delay=420;
 }
 return out;
}
function speakNext(){
 if(!autoRead||paused)return;
 if(queueIndex>=queue.length){
  if(currentMode&&doc&&pageNo<doc.numPages){pageNo++;render().then(()=>startReading(true))}
  else{autoRead=false;status('Narration finished.');updateSpeechButtons()}
  return;
 }
 const item=queue[queueIndex];
 delayTimer=setTimeout(()=>{
  delayTimer=null;if(!autoRead||paused)return;
  const u=new SpeechSynthesisUtterance(item.text),voice=selectedVoice();
  if(voice)u.voice=voice;
  u.rate=Number($('readerSpeed').value)||1;
  u.pitch=Number($('readerPitch').value)||1;
  u.onend=()=>{queueIndex++;speakNext()};
  u.onerror=e=>{if(e.error!=='canceled'&&e.error!=='interrupted')status('Voice playback issue: '+e.error);autoRead=false;paused=false;updateSpeechButtons()};
  window.speechSynthesis.speak(u);updateSpeechButtons();
 },item.delay);
}
function startReading(all){
 if(!window.speechSynthesis){alert('Text-to-speech is not supported in this browser. Please try Chrome or Edge.');return}
 const raw=$('readerText').textContent;
 if(!raw||raw.startsWith('No selectable text'))return;
 stop();currentMode=all;autoRead=true;
 queue=makeChunks(speechText(raw));queueIndex=0;
 status('Reading page '+pageNo+(all?' · continuous reading':'')+'…');speakNext();updateSpeechButtons();
}
function restartReading(){if(autoRead||paused){const all=currentMode;startReading(all)}}
async function open(bucket,path,title){
 stop();$('readerModal').classList.remove('hidden');$('readerTitle').textContent=title;status('Opening secure PDF…');
 try{const r=await db.storage.from(bucket).createSignedUrl(path,600);if(r.error)throw r.error;doc=await window.pdfjsLib.getDocument({url:r.data.signedUrl}).promise;pageNo=1;status(doc.numPages+' pages');await render()}
 catch(e){status('Unable to open PDF: '+e.message)}
}
async function render(){
 if(!doc)return;
 const page=await doc.getPage(pageNo),v0=page.getViewport({scale:1}),scale=Math.min(1.5,Math.max(.75,(window.innerWidth-400)/v0.width)),viewport=page.getViewport({scale});
 const canvas=$('readerCanvas'),ctx=canvas.getContext('2d');canvas.width=viewport.width;canvas.height=viewport.height;await page.render({canvasContext:ctx,viewport}).promise;
 const content=await page.getTextContent(),txt=content.items.map(x=>x.str+(x.hasEOL?'\n':' ')).join('').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
 $('readerText').textContent=txt||'No selectable text on this page. This may be a scanned page; OCR is needed before narration.';
 $('readerPageLabel').textContent='Page '+pageNo+' of '+doc.numPages;$('readerPrev').disabled=pageNo<=1;$('readerNext').disabled=pageNo>=doc.numPages;
 $('readerListen').disabled=!txt;$('readerListenAll').disabled=!txt;status('Page '+pageNo+' of '+doc.numPages+' · '+(txt?txt.length+' characters':'No selectable text'));
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
$('readerListen').addEventListener('click',()=>startReading(false));
$('readerListenAll').addEventListener('click',()=>startReading(true));
$('readerStop').addEventListener('click',stop);
$('readerPause').addEventListener('click',()=>{if(!autoRead)return;paused=true;if(delayTimer){clearTimeout(delayTimer);delayTimer=null}window.speechSynthesis.pause();status('Narration paused.');updateSpeechButtons()});
$('readerResume').addEventListener('click',()=>{if(!paused)return;paused=false;if(window.speechSynthesis.paused)window.speechSynthesis.resume();else speakNext();status('Narration resumed…');updateSpeechButtons()});
$('readerSpeed').addEventListener('change',restartReading);
$('readerPitch').addEventListener('change',restartReading);
$('readerVoice').addEventListener('change',restartReading);
if(window.speechSynthesis){loadVoices();window.speechSynthesis.addEventListener?.('voiceschanged',loadVoices);window.speechSynthesis.onvoiceschanged=loadVoices}
updateSpeechButtons();
})();