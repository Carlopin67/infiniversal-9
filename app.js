/**
 * ════════════════════════════════════════
 * INFINIVERSAL · app.js
 * PWA offline para poetas y compositores
 * ════════════════════════════════════════
 */
'use strict';

/* ════════════════════════════════════════
   MÓDULO: STORAGE
════════════════════════════════════════ */
const Storage = (() => {
  const NOTES_KEY    = 'infiniversal_notes';
  const SETTINGS_KEY = 'infiniversal_settings';
  const FIRST_KEY    = 'infiniversal_first';
  const defaults     = { theme:'dark', zoom:1, richText:false, metric:false };

  const getAllNotes   = () => { try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch { return []; } };
  const saveNotes    = n  => localStorage.setItem(NOTES_KEY, JSON.stringify(n));
  const getSettings  = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; } catch { return {...defaults}; } };
  const saveSettings = s  => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  const isFirstRun   = () => localStorage.getItem(FIRST_KEY) !== 'done';
  const markFirstRun = () => localStorage.setItem(FIRST_KEY, 'done');

  return { getAllNotes, saveNotes, getSettings, saveSettings, isFirstRun, markFirstRun };
})();


/* ════════════════════════════════════════
   MÓDULO: SYLLABLES
   Contador de sílabas en español
════════════════════════════════════════ */
const Syllables = (() => {
  const VOWELS = 'aeiouáéíóúüAEIOUÁÉÍÓÚÜ';
  const DIPHTHONGS = new Set([
    'ai','au','ei','eu','oi','ou','ia','ie','io','iu','ua','ue','ui','uo',
    'ái','áu','éi','éu','ói','íu','úi','iá','ié','ió','iú','uá','ué','uó','üe','üi'
  ]);
  const isVowel = c => VOWELS.includes(c);

  function countWord(word) {
    if (!word) return 0;
    word = word.toLowerCase().normalize('NFC');
    let count = 0, i = 0;
    while (i < word.length) {
      if (isVowel(word[i])) {
        count++;
        if (i + 1 < word.length && isVowel(word[i+1]) && DIPHTHONGS.has(word[i]+word[i+1])) i++;
      }
      i++;
    }
    return Math.max(1, count);
  }

  function countText(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).reduce((sum, w) => {
      const clean = w.replace(/[^a-záéíóúüñA-ZÁÉÍÓÚÜÑ]/g, '');
      return sum + (clean ? countWord(clean) : 0);
    }, 0);
  }

  function verseName(n) {
    const names = {
      1:'Monosílabo',2:'Bisílabo',3:'Trisílabo',4:'Tetrasílabo',
      5:'Pentasílabo',6:'Hexasílabo',7:'Heptasílabo',8:'Octosílabo',
      9:'Eneasílabo',10:'Decasílabo',11:'Endecasílabo',12:'Dodecasílabo',
      13:'Tridecasílabo',14:'Alejandrino'
    };
    return names[n] || `${n} sílabas`;
  }

  function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  return { countText, verseName, countWords };
})();


/* ════════════════════════════════════════
   MÓDULO: EDITOR HISTORY
════════════════════════════════════════ */
const EditorHistory = (() => {
  let stack = [], index = -1, timer = null;

  function save(text) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stack = stack.slice(0, index + 1);
      stack.push(text);
      if (stack.length > 100) stack.shift();
      index = stack.length - 1;
    }, 300);
  }

  const undo  = () => index > 0                ? stack[--index] : null;
  const redo  = () => index < stack.length - 1 ? stack[++index] : null;
  const reset = t => { stack = [t]; index = 0; clearTimeout(timer); };

  return { save, undo, redo, reset };
})();


/* ════════════════════════════════════════
   MÓDULO: POEM STRUCTURES
════════════════════════════════════════ */
const PoemStructures = {
  soneto: {
    name:'Soneto', tag:'Clásico · 14 versos',
    desc:'La cima de la lírica occidental. Dos cuartetos ABBA seguidos de dos tercetos. Endecasílabos (11 sílabas).',
    stanzas:[
      {label:'1.er Cuarteto',verses:4,hint:'ABBA · endecasílabos (11 síl.)'},
      {label:'2.º Cuarteto', verses:4,hint:'ABBA · endecasílabos (11 síl.)'},
      {label:'1.er Terceto', verses:3,hint:'CDC · endecasílabos'},
      {label:'2.º Terceto',  verses:3,hint:'DCD · endecasílabos'}
    ],
    bars:[
      {w:80,t:'accent'},{w:60,t:'accent'},{w:60,t:'accent'},{w:80,t:'accent'},
      {w:0,t:'divider'},
      {w:80,t:'accent'},{w:60,t:'accent'},{w:60,t:'accent'},{w:80,t:'accent'},
      {w:0,t:'divider'},
      {w:70,t:'accent2'},{w:50,t:'accent2'},{w:70,t:'accent2'},
      {w:0,t:'divider'},
      {w:50,t:'accent2'},{w:70,t:'accent2'},{w:50,t:'accent2'}
    ]
  },
  cuarteto: {
    name:'Cuarteto', tag:'ABBA · 4 versos',
    desc:'Cuatro versos endecasílabos con rima abrazada ABBA. La estrofa más noble de la métrica española.',
    stanzas:[{label:'Cuarteto',verses:4,hint:'ABBA · endecasílabos (11 síl.)'}],
    bars:[{w:80,t:'accent'},{w:55,t:'accent'},{w:55,t:'accent'},{w:80,t:'accent'}]
  },
  terceto: {
    name:'Terceto', tag:'ABA · 3 versos',
    desc:'Tres versos endecasílabos con rima ABA. Base de la terza rima italiana y de los tercetos del soneto.',
    stanzas:[{label:'Terceto',verses:3,hint:'ABA · endecasílabos (11 síl.)'}],
    bars:[{w:70,t:'accent'},{w:45,t:'accent2'},{w:70,t:'accent'}]
  },
  lira: {
    name:'Lira', tag:'7-11-7-7-11 sílabas',
    desc:'Cinco versos alternando heptasílabos (7) y endecasílabos (11) con rima aBabB. Popularizada por Garcilaso.',
    stanzas:[{label:'Lira',verses:5,hint:'7-11-7-7-11 síl. · rima aBabB'}],
    bars:[{w:45,t:'accent'},{w:75,t:'accent2'},{w:45,t:'accent'},{w:45,t:'accent'},{w:75,t:'accent2'}]
  },
  haiku: {
    name:'Haiku', tag:'5 · 7 · 5 sílabas',
    desc:'Tres versos que capturan un instante. Origen japonés. Sin rima. Solo imagen y silencio.',
    stanzas:[{label:'Haiku',verses:3,hint:'5 síl. · 7 síl. · 5 síl. · sin rima'}],
    bars:[{w:42,t:'accent'},{w:60,t:'accent2'},{w:42,t:'accent'}]
  },
  silva: {
    name:'Silva', tag:'Heptasílabos y endecasílabos',
    desc:'Combinación libre de versos de 7 y 11 sílabas, con rima a elección del poeta.',
    stanzas:[{label:'Silva',verses:0,hint:'Heptasílabos (7) y endecasílabos (11) · rima libre'}],
    bars:[{w:75,t:'accent'},{w:45,t:'accent'},{w:75,t:'accent'},{w:55,t:'accent2'},{w:75,t:'accent'},{w:45,t:'accent2'}]
  },
  decima: {
    name:'Décima', tag:'Espinela · 10 versos',
    desc:'Diez versos octosílabos con rima abbaaccddc. Base del verso popular latinoamericano y del repentismo.',
    stanzas:[{label:'Décima (Espinela)',verses:10,hint:'abbaaccddc · octosílabos (8 síl.)'}],
    bars:[
      {w:55,t:'accent'},{w:55,t:'accent2'},{w:55,t:'accent2'},{w:55,t:'accent'},
      {w:55,t:'accent'},{w:55,t:'accent'},{w:55,t:'accent2'},{w:55,t:'accent2'},
      {w:55,t:'accent'},{w:55,t:'accent'}
    ]
  },
  oda: {
    name:'Oda', tag:'Lírica · estrofas libres',
    desc:'Composición lírica de tono elevado dividida en estrofas simétricas. Permite exaltar personas o sentimientos.',
    stanzas:[
      {label:'Estrofa 1',verses:4,hint:'Versos libres · rima a elección'},
      {label:'Estrofa 2',verses:4,hint:'Misma estructura que la 1.ª'},
      {label:'Estrofa 3',verses:4,hint:'Cierre o conclusión lírica'}
    ],
    bars:[
      {w:65,t:'accent'},{w:50,t:'accent'},{w:65,t:'accent'},{w:50,t:'accent'},
      {w:0,t:'divider'},
      {w:65,t:'accent2'},{w:50,t:'accent2'},{w:65,t:'accent2'},{w:50,t:'accent2'},
      {w:0,t:'divider'},
      {w:65,t:'accent'},{w:50,t:'accent'},{w:65,t:'accent'},{w:50,t:'accent'}
    ]
  },
  libre: {
    name:'Verso libre', tag:'Sin estructura · libertad total',
    desc:'Sin métrica fija, sin rima obligatoria. El ritmo lo decides tú con el corte de verso y el silencio.',
    stanzas:[{label:'',verses:0,hint:'Sin estructura fija · tu ritmo, tus reglas.'}],
    bars:[{w:90,t:'accent'},{w:30,t:'accent2'},{w:70,t:'accent'},{w:50,t:'accent2'},{w:80,t:'accent'},{w:20,t:'accent2'}]
  }
};


/* ════════════════════════════════════════
   MÓDULO: TUTORIAL
════════════════════════════════════════ */
const Tutorial = (() => {
  let step = 1;
  const TOTAL = 4;
  const overlay = document.getElementById('tutorial-overlay');
  const btnNext = document.getElementById('tutorial-next');
  const btnPrev = document.getElementById('tutorial-prev');
  const btnSkip = document.getElementById('tutorial-skip');

  function show() { overlay.classList.remove('hidden'); updateUI(); }

  function hide() {
    overlay.classList.add('hidden');
    Storage.markFirstRun();
  }

  function updateUI() {
    document.querySelectorAll('.tutorial-step').forEach(el =>
      el.classList.toggle('active', parseInt(el.dataset.step) === step));
    document.querySelectorAll('.dot').forEach(el =>
      el.classList.toggle('active', parseInt(el.dataset.dot) === step));
    btnPrev.classList.toggle('hidden', step === 1);
    btnNext.textContent = step === TOTAL ? 'Comenzar' : 'Siguiente';
  }

  btnNext.addEventListener('click', () => step < TOTAL ? (step++, updateUI()) : hide());
  btnPrev.addEventListener('click', () => step > 1 && (step--, updateUI()));
  btnSkip.addEventListener('click', hide);
  document.querySelectorAll('.dot').forEach(el =>
    el.addEventListener('click', () => { step = parseInt(el.dataset.dot); updateUI(); }));

  return { show };
})();


/* ════════════════════════════════════════
   MÓDULO: SETTINGS
════════════════════════════════════════ */
const Settings = (() => {
  let s = Storage.getSettings();
  const overlay      = document.getElementById('settings-modal');
  const btnOpen      = document.getElementById('btn-settings');
  const btnClose     = document.getElementById('settings-close');
  const zoomIn       = document.getElementById('zoom-in');
  const zoomOut      = document.getElementById('zoom-out');
  const zoomLabel    = document.getElementById('zoom-label');
  const toggleRich   = document.getElementById('toggle-rich');
  const toggleMetric = document.getElementById('toggle-metric');

  function open() {
    document.querySelectorAll('.theme-opt').forEach(el =>
      el.classList.toggle('active', el.dataset.theme === s.theme));
    toggleRich.checked   = s.richText;
    toggleMetric.checked = s.metric;
    zoomLabel.textContent = Math.round(s.zoom * 100) + '%';
    overlay.classList.remove('hidden');
  }

  function close() { overlay.classList.add('hidden'); }

  const applyTheme = () => {
    document.body.classList.toggle('theme-dark',  s.theme === 'dark');
    document.body.classList.toggle('theme-light', s.theme === 'light');
    document.querySelector('meta[name="theme-color"]')
      .setAttribute('content', s.theme === 'dark' ? '#0e0e14' : '#f5f3f0');
  };
  const applyZoom = () => {
    document.documentElement.style.setProperty('--text-zoom', s.zoom);
    zoomLabel.textContent = Math.round(s.zoom * 100) + '%';
  };
  const applyRich   = () => {
    document.getElementById('rich-toolbar').classList.toggle('hidden', !s.richText);
    document.getElementById('plain-undo-bar').classList.toggle('hidden', s.richText);
  };
  const applyMetric = () =>
    document.getElementById('metric-toolbar').classList.toggle('hidden', !s.metric);

  btnOpen.addEventListener('click', open);
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.querySelectorAll('.theme-opt').forEach(btn =>
    btn.addEventListener('click', () => {
      s.theme = btn.dataset.theme; Storage.saveSettings(s); applyTheme();
      document.querySelectorAll('.theme-opt').forEach(b =>
        b.classList.toggle('active', b.dataset.theme === s.theme));
    })
  );

  zoomIn.addEventListener('click',  () => { if (s.zoom < 2)   { s.zoom = Math.round((s.zoom+0.1)*10)/10; Storage.saveSettings(s); applyZoom(); } });
  zoomOut.addEventListener('click', () => { if (s.zoom > 0.6) { s.zoom = Math.round((s.zoom-0.1)*10)/10; Storage.saveSettings(s); applyZoom(); } });
  toggleRich.addEventListener('change',   () => { s.richText = toggleRich.checked;   Storage.saveSettings(s); applyRich(); });
  toggleMetric.addEventListener('change', () => { s.metric   = toggleMetric.checked; Storage.saveSettings(s); applyMetric(); });

  function init() { applyTheme(); applyZoom(); applyRich(); applyMetric(); }
  return { init };
})();


/* ════════════════════════════════════════
   MÓDULO: NOTES MANAGER
════════════════════════════════════════ */
const NotesManager = (() => {
  function create(type, structure) {
    return {
      id:        Date.now().toString(36) + Math.random().toString(36).slice(2),
      type,      structure: structure || null,
      title:     '', content: '', tags: [], favorite: false,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function save(note) {
    const notes = Storage.getAllNotes();
    const idx   = notes.findIndex(n => n.id === note.id);
    note.updatedAt = Date.now();
    if (idx >= 0) notes[idx] = note; else notes.unshift(note);
    Storage.saveNotes(notes);
  }

  const remove     = id  => Storage.saveNotes(Storage.getAllNotes().filter(n => n.id !== id));
  const getAll     = ()  => Storage.getAllNotes().sort((a,b) => b.updatedAt - a.updatedAt);
  const getById    = id  => Storage.getAllNotes().find(n => n.id === id) || null;
  const getAllTags  = ()  => [...new Set(getAll().flatMap(n => n.tags || []))];

  return { create, save, remove, getAll, getById, getAllTags };
})();


/* ════════════════════════════════════════
   MÓDULO: LIST VIEW
════════════════════════════════════════ */
const ListView = (() => {
  const listEl        = document.getElementById('notes-list');
  const emptyEl       = document.getElementById('empty-state');
  const filterBtns    = document.querySelectorAll('.filter-btn:not(#filter-tags-btn)');
  const filterTagBtn  = document.getElementById('filter-tags-btn');
  const activeTagsBar = document.getElementById('active-tags-bar');
  const selectHintEl  = document.getElementById('select-hint');

  let currentFilter = 'all';
  let activeTags    = [];

  const formatDate = ts => {
    const d = (Date.now() - ts) / 1000;
    if (d < 60)     return 'Ahora';
    if (d < 3600)   return `${Math.floor(d/60)}m`;
    if (d < 86400)  return `${Math.floor(d/3600)}h`;
    if (d < 604800) return `${Math.floor(d/86400)}d`;
    return new Date(ts).toLocaleDateString('es-ES',{day:'numeric',month:'short'});
  };

  function applyFilters(notes) {
    let r = notes;
    if (currentFilter === 'poem') r = r.filter(n => n.type === 'poem');
    if (currentFilter === 'song') r = r.filter(n => n.type === 'song');
    if (currentFilter === 'fav')  r = r.filter(n => n.favorite);
    if (activeTags.length > 0)    r = r.filter(n => activeTags.every(t => (n.tags||[]).includes(t)));
    return r;
  }

  function render() {
    listEl.querySelectorAll('.note-card').forEach(el => el.remove());
    const filtered = applyFilters(NotesManager.getAll());
    emptyEl.style.display = filtered.length === 0 ? 'flex' : 'none';
    filtered.forEach(note => listEl.appendChild(createCard(note)));
    if (selectHintEl) {
      if (filtered.length >= 2) {
        selectHintEl.textContent = 'Mantén pulsada una nota para seleccionar varias';
        selectHintEl.classList.add('visible');
      } else {
        selectHintEl.classList.remove('visible');
      }
    }
  }

  function createCard(note) {
    const card = document.createElement('div');
    card.className  = 'note-card';
    card.dataset.id = note.id;

    const preview = note.content.replace(/<[^>]+>/g,'').replace(/\[.*?\]/g,'').trim().slice(0,120);
    const tags    = (note.tags||[]).slice(0,3).map(t =>
      `<span class="tag-chip" data-tag="${t}">${t}</span>`).join('');

    card.innerHTML = `
      <div class="note-card-checkbox">✓</div>
      <div class="note-card-header">
        <div class="note-card-title">${note.title || 'Sin título'}</div>
        <button class="note-card-fav ${note.favorite?'active':''}" data-id="${note.id}">${note.favorite?'★':'☆'}</button>
      </div>
      ${preview ? `<div class="note-card-preview">${preview}</div>` : ''}
      <div class="note-card-footer">
        <div class="note-card-meta">
          <span class="type-badge-card ${note.type}">${note.type==='poem'?'Poesía':'Canción'}</span>
          ${note.structure ? ' · '+note.structure : ''} &nbsp;·&nbsp; ${formatDate(note.updatedAt)}
        </div>
        <div class="note-card-tags">${tags}</div>
      </div>`;

    // Long press para selección múltiple
    let pressTimer = null;
    const startPress = () => {
      pressTimer = setTimeout(() => {
        if (!BulkSelect.isActive()) BulkSelect.enter();
        toggleCardSelect(card, note.id);
      }, 500);
    };
    const cancelPress = () => clearTimeout(pressTimer);

    card.addEventListener('touchstart',  startPress,  { passive: true });
    card.addEventListener('touchend',    cancelPress);
    card.addEventListener('touchmove',   cancelPress);
    card.addEventListener('mousedown',   startPress);
    card.addEventListener('mouseup',     cancelPress);
    card.addEventListener('mouseleave',  cancelPress);

    card.addEventListener('click', e => {
      if (e.target.classList.contains('note-card-fav')) return;
      if (e.target.classList.contains('tag-chip')) { toggleActiveTag(e.target.dataset.tag); return; }
      if (BulkSelect.isActive()) { toggleCardSelect(card, note.id); return; }
      EditorView.open(note.id);
    });

    card.querySelector('.note-card-fav').addEventListener('click', e => {
      if (BulkSelect.isActive()) return;
      e.stopPropagation();
      const n = NotesManager.getById(note.id);
      if (n) { n.favorite = !n.favorite; NotesManager.save(n); render(); }
    });

    return card;
  }

  function toggleCardSelect(card, id) {
    BulkSelect.toggle(id);
    const ids = BulkSelect.getSelected();
    card.classList.toggle('selected', ids.includes(id));
  }

  function enterSelectMode() {
    listEl.querySelectorAll('.note-card').forEach(card => {
      card.classList.add('selectable');
      card.classList.remove('selected');
    });
  }

  function exitSelectMode() {
    listEl.querySelectorAll('.note-card').forEach(card =>
      card.classList.remove('selectable', 'selected'));
  }

  function updateCardSelected(id, isSelected) {
    const card = listEl.querySelector(`.note-card[data-id="${id}"]`);
    if (card) card.classList.toggle('selected', isSelected);
  }

  function toggleActiveTag(tag) {
    activeTags = activeTags.includes(tag) ? activeTags.filter(t=>t!==tag) : [...activeTags, tag];
    renderActiveTagsBar();
    render();
  }

  function renderActiveTagsBar() {
    if (activeTags.length === 0) {
      activeTagsBar.classList.add('hidden');
      activeTagsBar.innerHTML = '';
      return;
    }
    activeTagsBar.classList.remove('hidden');
    activeTagsBar.innerHTML = activeTags.map(t =>
      `<span class="tag-chip removable" data-tag="${t}">${t}</span>`).join('');
    activeTagsBar.querySelectorAll('.tag-chip').forEach(el =>
      el.addEventListener('click', () => toggleActiveTag(el.dataset.tag)));
  }

  filterBtns.forEach(btn => btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    activeTags = [];
    renderActiveTagsBar();
    render();
  }));

  filterTagBtn.addEventListener('click', () => {
    const allTags = NotesManager.getAllTags();
    if (allTags.length === 0) return;
    activeTagsBar.classList.remove('hidden');
    activeTagsBar.innerHTML =
      '<span style="color:var(--text-muted);font-size:0.76rem;margin-right:4px">Tags:</span>' +
      allTags.map(t => `<span class="tag-chip" data-tag="${t}">${t}</span>`).join('');
    activeTagsBar.querySelectorAll('.tag-chip').forEach(el =>
      el.addEventListener('click', () => toggleActiveTag(el.dataset.tag)));
  });

  return { render, enterSelectMode, exitSelectMode, updateCardSelected };
})();


/* ════════════════════════════════════════
   MÓDULO: EDITOR VIEW
════════════════════════════════════════ */
const EditorView = (() => {
  let currentNote = null;
  let saveTimer   = null;

  const viewList    = document.getElementById('view-list');
  const viewEditor  = document.getElementById('view-editor');
  const btnBack     = document.getElementById('btn-back');
  const btnFav      = document.getElementById('btn-fav');
  const btnTags     = document.getElementById('btn-tags');
  const btnShare    = document.getElementById('btn-share');
  const btnDelete   = document.getElementById('btn-delete');
  const titleInput  = document.getElementById('note-title');
  const editor      = document.getElementById('note-editor');
  const songToolbar = document.getElementById('song-toolbar');
  const poemGuide   = document.getElementById('poem-guide');
  const typeBadge   = document.getElementById('editor-type-badge');
  const noteTagsBar = document.getElementById('note-tags-bar');
  const statWords   = document.getElementById('stat-words');
  const statSyl     = document.getElementById('stat-syllables');
  const statChars   = document.getElementById('stat-chars');
  const metricSyl   = document.getElementById('metric-syllables');
  const metricType  = document.getElementById('metric-type');

  function open(noteId) {
    currentNote = NotesManager.getById(noteId);
    if (!currentNote) return;

    viewList.classList.add('hidden');
    viewEditor.classList.remove('hidden');
    viewEditor.classList.add('entering');
    setTimeout(() => viewEditor.classList.remove('entering'), 300);

    titleInput.value  = currentNote.title;
    editor.innerHTML  = currentNote.content;

    updateFavBtn();
    updateTypeBadge();
    renderNoteTagsBar();
    updateStats();

    if (currentNote.type === 'song') {
      songToolbar.classList.remove('hidden');
      poemGuide.classList.add('hidden');
    } else {
      songToolbar.classList.add('hidden');
      renderPoemGuide();
    }

    EditorHistory.reset(editor.innerHTML);
    editor.focus();
  }

  function openNew(note) { currentNote = note; open(note.id); }

  function close() {
    saveNow();
    viewEditor.classList.add('hidden');
    viewList.classList.remove('hidden');
    ListView.render();
  }

  function saveNow() {
    if (!currentNote) return;
    currentNote.title   = titleInput.value.trim();
    currentNote.content = editor.innerHTML;
    NotesManager.save(currentNote);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  }

  function updateFavBtn() {
    btnFav.textContent = currentNote.favorite ? '★' : '☆';
    btnFav.classList.toggle('active', currentNote.favorite);
  }

  function updateTypeBadge() {
    typeBadge.textContent = currentNote.type === 'poem' ? 'Poesía' : 'Canción';
    typeBadge.className   = `type-badge ${currentNote.type}`;
  }

  function renderNoteTagsBar() {
    noteTagsBar.innerHTML = '';
    (currentNote.tags || []).forEach(tag => {
      const chip = document.createElement('span');
      chip.className   = 'tag-chip removable';
      chip.textContent = tag;
      chip.addEventListener('click', () => {
        currentNote.tags = currentNote.tags.filter(t => t !== tag);
        NotesManager.save(currentNote);
        renderNoteTagsBar();
      });
      noteTagsBar.appendChild(chip);
    });
  }

  function renderPoemGuide() {
    const struct = PoemStructures[currentNote.structure] || null;
    poemGuide.innerHTML = '';
    if (!struct) { poemGuide.classList.add('hidden'); return; }
    if (struct.stanzas[0].verses === 0) {
      poemGuide.classList.remove('hidden');
      poemGuide.innerHTML = `<div class="poem-verse-hint">${struct.name}: ${struct.stanzas[0].hint}</div>`;
      return;
    }
    poemGuide.classList.remove('hidden');
    poemGuide.innerHTML = struct.stanzas.map(st => `
      <div class="poem-stanza">
        <div class="poem-stanza-label">${st.label} (${st.verses} versos)</div>
        <div class="poem-verse-hint">${st.hint}</div>
      </div>`).join('');
  }

  function updateStats() {
    const text = editor.innerText || '';
    statWords.textContent = `${Syllables.countWords(text)} palabras`;
    statSyl.textContent   = `${Syllables.countText(text)} síl.`;
    statChars.textContent = `${text.length} car.`;
  }

  function updateMetric() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const line = (sel.getRangeAt(0).startContainer.textContent || '').split('\n')[0];
    const syls = Syllables.countText(line.trim());
    metricSyl.textContent  = `${syls} síl.`;
    metricType.textContent = syls > 0 ? Syllables.verseName(syls) : '—';
  }

  titleInput.addEventListener('input', scheduleSave);

  editor.addEventListener('input', () => {
    updateStats(); updateMetric();
    EditorHistory.save(editor.innerHTML);
    scheduleSave();
  });

  editor.addEventListener('keyup',  updateMetric);
  editor.addEventListener('click',  updateMetric);

  document.addEventListener('selectionchange', () => {
    if (viewEditor.classList.contains('hidden')) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim()) {
      const syls = Syllables.countText(sel.toString());
      metricSyl.textContent  = `${syls} síl.`;
      metricType.textContent = syls > 0 ? Syllables.verseName(syls) : '—';
    }
  });

  btnBack.addEventListener('click', close);

  btnFav.addEventListener('click', () => {
    if (!currentNote) return;
    currentNote.favorite = !currentNote.favorite;
    updateFavBtn();
    NotesManager.save(currentNote);
  });

  btnTags.addEventListener('click', () =>
    TagsModal.open(currentNote, () => { renderNoteTagsBar(); NotesManager.save(currentNote); }));

  btnShare.addEventListener('click', () => { saveNow(); ShareModal.open(currentNote); });
  btnDelete.addEventListener('click', () => DeleteModal.open(currentNote));

  songToolbar.querySelectorAll('.section-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      editor.focus();
      const range = window.getSelection().getRangeAt(0);
      range.collapse(false);
      const div = document.createElement('div');
      div.innerHTML = `<span class="song-section-marker">[ ${btn.dataset.section} ]</span><br>`;
      range.insertNode(div);
      updateStats(); scheduleSave();
    })
  );

  document.getElementById('rich-toolbar').querySelectorAll('.fmt-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'undo')      { const t = EditorHistory.undo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();} }
      else if (cmd === 'redo') { const t = EditorHistory.redo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();} }
      else { document.execCommand(cmd, false, null); editor.focus(); }
    })
  );

  document.getElementById('btn-undo').addEventListener('click', () => {
    const t = EditorHistory.undo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();}
  });
  document.getElementById('btn-redo').addEventListener('click', () => {
    const t = EditorHistory.redo(); if (t!==null){editor.innerHTML=t;updateStats();scheduleSave();}
  });

  return { open, openNew, close };
})();


/* ════════════════════════════════════════
   MÓDULO: DELETE MODAL
════════════════════════════════════════ */
const DeleteModal = (() => {
  const overlay    = document.getElementById('delete-modal');
  const btnConfirm = document.getElementById('delete-confirm');
  const btnCancel  = document.getElementById('delete-cancel');
  let noteToDelete = null;

  function open(note) { noteToDelete = note; overlay.classList.remove('hidden'); }
  function close()    { overlay.classList.add('hidden'); noteToDelete = null; }

  btnConfirm.addEventListener('click', () => {
    if (!noteToDelete) return;
    NotesManager.remove(noteToDelete.id);
    close();
    EditorView.close();
  });
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  return { open };
})();


/* ════════════════════════════════════════
   MÓDULO: TAGS MODAL
════════════════════════════════════════ */
const TagsModal = (() => {
  const overlay  = document.getElementById('tag-modal');
  const btnClose = document.getElementById('tag-close');
  const tagInput = document.getElementById('tag-input');
  const btnAdd   = document.getElementById('tag-add');
  const tagList  = document.getElementById('tag-list');
  let note = null, onUpdate = null;

  function open(n, cb) { note = n; onUpdate = cb; tagInput.value = ''; render(); overlay.classList.remove('hidden'); }
  function close() { overlay.classList.add('hidden'); }

  function render() {
    tagList.innerHTML = '';
    const allTags = NotesManager.getAllTags();
    if (allTags.length === 0) {
      tagList.innerHTML = '<span style="color:var(--text-muted);font-size:0.8rem">Aún no hay tags.</span>';
      return;
    }
    allTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className   = 'tag-chip';
      chip.textContent = tag;
      chip.style.cursor = 'pointer';
      if (note && note.tags.includes(tag)) chip.style.outline = '2px solid var(--accent)';
      chip.addEventListener('click', () => {
        if (!note) return;
        note.tags = note.tags.includes(tag) ? note.tags.filter(t=>t!==tag) : [...note.tags, tag];
        if (onUpdate) onUpdate();
        render();
      });
      tagList.appendChild(chip);
    });
  }

  btnAdd.addEventListener('click', () => {
    const val = tagInput.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!val || !note) return;
    if (!note.tags.includes(val)) note.tags.push(val);
    tagInput.value = '';
    if (onUpdate) onUpdate();
    render();
  });

  tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnAdd.click(); });
  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  return { open };
})();


/* ════════════════════════════════════════
   MÓDULO: SHARE MODAL
════════════════════════════════════════ */
const ShareModal = (() => {
  const overlay  = document.getElementById('share-modal');
  const btnClose = document.getElementById('share-close');
  const btnClip  = document.getElementById('share-clipboard');
  const btnTxt   = document.getElementById('share-txt');
  const btnPdf   = document.getElementById('share-pdf');
  const toast    = document.getElementById('share-toast');
  let currentNote = null;

  function getPlainText(n) {
    const title   = n.title || 'Sin título';
    const content = (n.content||'').replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return `${title}\n${'─'.repeat(Math.min(title.length, 40))}\n\n${content}`;
  }

  function open(n) { currentNote = n; toast.classList.add('hidden'); overlay.classList.remove('hidden'); }
  function close() { overlay.classList.add('hidden'); }

  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  btnClip.addEventListener('click', async () => {
    if (!currentNote) return;
    const text = getPlainText(currentNote);
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
  });

  btnTxt.addEventListener('click', () => {
    if (!currentNote) return;
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([getPlainText(currentNote)], {type:'text/plain;charset=utf-8'})),
      download: `${currentNote.title || 'nota'}.txt`
    });
    a.click(); URL.revokeObjectURL(a.href); close();
  });

  btnPdf.addEventListener('click', () => {
    if (!currentNote) return;
    close();
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>${currentNote.title||'Nota'}</title>
      <style>body{font-family:Georgia,serif;max-width:600px;margin:40px auto;line-height:1.8;color:#111}
      h1{font-size:1.4rem;border-bottom:1px solid #ccc;padding-bottom:8px;margin-bottom:24px}
      .c{white-space:pre-wrap}</style></head><body>
      <h1>${currentNote.title||'Sin título'}</h1>
      <div class="c">${currentNote.content||''}</div></body></html>`);
    w.document.close(); w.print();
  });

  return { open };
})();


/* ════════════════════════════════════════
   MÓDULO: NUEVA NOTA
════════════════════════════════════════ */
const NewNoteFlow = (() => {
  const typeModal   = document.getElementById('type-modal');
  const structModal = document.getElementById('poem-structure-modal');
  const createBtn   = document.getElementById('struct-create-btn');
  const createName  = document.getElementById('struct-create-name');
  const previewName   = document.getElementById('preview-name');
  const previewVisual = document.getElementById('preview-visual');
  const previewMeta   = document.getElementById('preview-meta');
  const previewDesc   = document.getElementById('preview-desc');

  let selectedStructure = 'soneto';

  const closeType   = () => typeModal.classList.add('hidden');
  const closeStruct = () => structModal.classList.add('hidden');

  function renderPreview(key) {
    const s = PoemStructures[key];
    if (!s) return;
    previewName.textContent = s.name;
    previewMeta.textContent = s.tag;
    previewDesc.textContent = s.desc;
    previewVisual.innerHTML = '';
    (s.bars || []).forEach(bar => {
      const el = document.createElement('div');
      if (bar.t === 'divider') {
        el.className = 'struct-verse-bar divider';
      } else {
        el.className = `struct-verse-bar ${bar.t}`;
        el.style.width = bar.w + 'px';
      }
      previewVisual.appendChild(el);
    });
    createName.textContent = s.name;
    createBtn.style.background = key === 'libre' ? 'var(--accent-2)' : '';
  }

  structModal.querySelectorAll('.struct-card').forEach(btn => {
    btn.addEventListener('click', () => {
      structModal.querySelectorAll('.struct-card').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedStructure = btn.dataset.structure;
      renderPreview(selectedStructure);
    });
  });

  renderPreview('soneto');

  createBtn.addEventListener('click', () => {
    closeStruct();
    const note = NotesManager.create('poem', selectedStructure);
    NotesManager.save(note);
    EditorView.openNew(note);
  });

  typeModal.querySelectorAll('.type-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      closeType();
      if (btn.dataset.type === 'song') {
        const note = NotesManager.create('song', null);
        NotesManager.save(note);
        EditorView.openNew(note);
      } else {
        selectedStructure = 'soneto';
        structModal.querySelectorAll('.struct-card').forEach(b =>
          b.classList.toggle('active', b.dataset.structure === 'soneto'));
        renderPreview('soneto');
        structModal.classList.remove('hidden');
      }
    })
  );

  document.getElementById('type-cancel').addEventListener('click', closeType);
  document.getElementById('poem-structure-back').addEventListener('click', () => {
    closeStruct(); typeModal.classList.remove('hidden');
  });
  typeModal.addEventListener('click',   e => { if (e.target === typeModal)   closeType(); });
  structModal.addEventListener('click', e => { if (e.target === structModal) closeStruct(); });
  document.getElementById('btn-new').addEventListener('click', () =>
    typeModal.classList.remove('hidden'));
})();


/* ════════════════════════════════════════
   MÓDULO: AYUDA
════════════════════════════════════════ */
const Help = (() => {
  const overlay  = document.getElementById('help-modal');
  const btnOpen  = document.getElementById('btn-help');
  const btnClose = document.getElementById('help-close');
  btnOpen.addEventListener('click',  () => overlay.classList.remove('hidden'));
  btnClose.addEventListener('click', () => overlay.classList.add('hidden'));
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
})();


/* ════════════════════════════════════════
   MÓDULO: BULK SELECT
════════════════════════════════════════ */
const BulkSelect = (() => {
  let selectedIds = new Set();
  let active = false;

  const selectBar    = document.getElementById('select-bar');
  const selectCount  = document.getElementById('select-count');
  const selectCancel = document.getElementById('select-cancel');
  const selectShare  = document.getElementById('select-share');
  const selectDelete = document.getElementById('select-delete');
  const fab          = document.getElementById('btn-new');

  function enter() {
    active = true;
    selectedIds.clear();
    selectBar.classList.remove('hidden');
    fab.classList.add('select-mode');
    updateBar();
    ListView.enterSelectMode();
  }

  function exit() {
    active = false;
    selectedIds.clear();
    selectBar.classList.add('hidden');
    fab.classList.remove('select-mode');
    ListView.exitSelectMode();
  }

  function toggle(id) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    updateBar();
    ListView.updateCardSelected(id, selectedIds.has(id));
  }

  function updateBar() {
    const n = selectedIds.size;
    selectCount.textContent  = n === 1 ? '1 seleccionada' : `${n} seleccionadas`;
    selectShare.disabled  = n === 0;
    selectDelete.disabled = n === 0;
  }

  const isActive     = () => active;
  const getSelected  = () => [...selectedIds];

  selectCancel.addEventListener('click', exit);

  selectDelete.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    BulkDeleteModal.open([...selectedIds], () => exit());
  });

  selectShare.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    const notes = [...selectedIds].map(id => NotesManager.getById(id)).filter(Boolean);
    BulkShareModal.open(notes, () => exit());
  });

  return { enter, exit, toggle, isActive, getSelected };
})();


/* ════════════════════════════════════════
   MÓDULO: BULK DELETE MODAL
════════════════════════════════════════ */
const BulkDeleteModal = (() => {
  const overlay    = document.getElementById('bulk-delete-modal');
  const btnConfirm = document.getElementById('bulk-delete-confirm');
  const btnCancel  = document.getElementById('bulk-delete-cancel');
  const subtitle   = document.getElementById('bulk-delete-subtitle');
  let ids = [], onDone = null;

  function open(selectedIds, cb) {
    ids = selectedIds; onDone = cb;
    const n = ids.length;
    subtitle.textContent = n === 1
      ? '¿Seguro que quieres eliminar esta nota? No se puede deshacer.'
      : `¿Seguro que quieres eliminar ${n} notas? No se puede deshacer.`;
    overlay.classList.remove('hidden');
  }

  function close() { overlay.classList.add('hidden'); ids = []; }

  btnConfirm.addEventListener('click', () => {
    ids.forEach(id => NotesManager.remove(id));
    close(); if (onDone) onDone();
    ListView.render();
  });
  btnCancel.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  return { open };
})();


/* ════════════════════════════════════════
   MÓDULO: BULK SHARE MODAL
════════════════════════════════════════ */
const BulkShareModal = (() => {
  const overlay  = document.getElementById('bulk-share-modal');
  const btnClose = document.getElementById('bulk-share-close');
  const btnClip  = document.getElementById('bulk-share-clipboard');
  const btnTxt   = document.getElementById('bulk-share-txt');
  const subtitle = document.getElementById('bulk-share-subtitle');
  const toast    = document.getElementById('bulk-share-toast');
  let notes = [], onDone = null;

  function getPlainText(n) {
    const title   = n.title || 'Sin título';
    const content = (n.content||'').replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return `${title}\n${'─'.repeat(Math.min(title.length, 40))}\n\n${content}`;
  }

  function getAllText() {
    return notes.map(getPlainText).join('\n\n' + '═'.repeat(40) + '\n\n');
  }

  function open(selectedNotes, cb) {
    notes = selectedNotes; onDone = cb;
    subtitle.textContent = notes.length === 1 ? 'Compartir 1 nota' : `Compartir ${notes.length} notas`;
    toast.classList.add('hidden');
    overlay.classList.remove('hidden');
  }

  function close() { overlay.classList.add('hidden'); }

  btnClose.addEventListener('click', () => { close(); if (onDone) onDone(); });
  overlay.addEventListener('click', e => { if (e.target === overlay) { close(); if (onDone) onDone(); } });

  btnClip.addEventListener('click', async () => {
    const text = getAllText();
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); close(); if (onDone) onDone(); }, 2000);
  });

  btnTxt.addEventListener('click', () => {
    const filename = notes.length === 1
      ? `${notes[0].title || 'nota'}.txt`
      : `infiniversal-${notes.length}-notas.txt`;
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(new Blob([getAllText()], {type:'text/plain;charset=utf-8'})),
      download: filename
    });
    a.click(); URL.revokeObjectURL(a.href);
    close(); if (onDone) onDone();
  });

  return { open };
})();


/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
(function init() {
  Settings.init();
  ListView.render();
  if (Storage.isFirstRun()) Tutorial.show();
})();


/* ════════════════════════════════════════
   SERVICE WORKER
════════════════════════════════════════ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(r  => console.log('[SW] registrado:', r.scope))
      .catch(e => console.warn('[SW] error:', e));
  });
}
