/* MEDPATH STUDY HUB — display-only subject emoji map. Do not change canonical subject keys. */
window.MEDPATH_SUBJECT_EMOJIS = {
  "Anatomy":"💀", "Physiology":"🫀", "Biochemistry":"🧬",
  "Pathology":"🔬", "Microbiology":"🧫", "Pharmacology":"💊",
  "Forensic Medicine":"🔍", "Community Medicine":"🛡️",
  "General Medicine":"🩺", "General Surgery":"🩻",
  "Obstetrics & Gynaecology":"🤰", "Paediatrics":"🧸",
  "Ophthalmology":"👁️", "ENT":"👂", "Orthopaedics":"🦴",
  "Psychiatry":"🧠", "Dermatology":"🧴", "Radiology":"☢️",
  "Anaesthesiology":"💉"
};
window.medpathSubjectEmoji = function(subject) {
  var s=String(subject||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'');
  var aliases={medicine:'General Medicine',generalsurgery:'General Surgery',surgery:'General Surgery',
    spm:'Community Medicine',preventivemedicine:'Community Medicine',socialpreventivemedicine:'Community Medicine',
    obg:'Obstetrics & Gynaecology',obgyn:'Obstetrics & Gynaecology',
    pediatrics:'Paediatrics',paediatric:'Paediatrics',anesthesia:'Anaesthesiology',anesthesiology:'Anaesthesiology',
    radiodiagnosis:'Radiology',otorhinolaryngology:'ENT'};
  var canonical=aliases[s]||Object.keys(window.MEDPATH_SUBJECT_EMOJIS).find(function(k){return k.toLowerCase().replace(/[^a-z0-9]+/g,'')===s;});
  return (canonical&&window.MEDPATH_SUBJECT_EMOJIS[canonical])||'🩺';
};
