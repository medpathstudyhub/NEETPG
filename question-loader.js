/* MEDPATH STUDY HUB shared question loader. Load all subject files before this file. */
(function(){
  'use strict';
  var parts = window.MEDPATH_QUESTION_PARTS || {};
  var order = ["anatomy", "physiology", "biochemistry", "microbiology", "pathology", "pharmacology", "forensic-medicine", "community-medicine", "ophthalmology", "ent", "general-medicine", "general-surgery", "obstetrics-gynaecology", "paediatrics", "anaesthesiology", "dermatology", "psychiatry", "orthopaedics", "radiology"];
  var combined = [];
  order.forEach(function(slug){
    var rows = parts[slug];
    if (!Array.isArray(rows)) {
      console.error('MEDPATH question file did not load: questions/' + slug + '.js');
      return;
    }
    combined = combined.concat(rows);
  });
  var seen = new Set();
  var duplicates = [];
  combined.forEach(function(q){ if(q && q.id){ if(seen.has(String(q.id))) duplicates.push(String(q.id)); seen.add(String(q.id)); } });
  window.QUESTION_BANK = combined;
  window.MEDPATH_QUESTION_LOAD_STATUS = { expectedSubjects: order.length, loadedSubjects: order.filter(function(s){return Array.isArray(parts[s]);}).length, questionCount: combined.length, duplicateIds: duplicates };
  if (duplicates.length) console.error('MEDPATH duplicate question IDs detected:', duplicates);
})();
