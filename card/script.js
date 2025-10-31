  // check login immediately on page load
  (function () {
    try {
      if (localStorage.getItem('isLoggedIn') !== 'true') {
        // not logged in -> go back to keypad
        window.location.href = 'login.html'; // replace with your actual keypad filename/case
      }
    } catch (err) {
      console.error('Login check failed:', err);
      // fallback — redirect to login
      window.location.href = 'login.html';
    }
  })();






// audio UI enhancer — transforms <audio> tags inside #music into styled tracks
(() => {
  const container = document.getElementById('music');
  if (!container) return;

  // mark container visually
  container.classList.add('audio-list');

  const audios = Array.from(container.querySelectorAll('audio'));

  // helper: format seconds to m:ss
  const fmt = s => {
    if (isNaN(s) || s === Infinity) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // Pause all except one
  function pauseAllExcept(exceptAudio) {
    audios.forEach(a => {
      if (a !== exceptAudio) {
        a.pause();
        const otherBtn = a._ui?.btn;
        if (otherBtn) otherBtn.classList.remove('playing');
      }
    });
  }

  audios.forEach((audioEl, idx) => {
    // remove native controls
    audioEl.controls = false;

    // build track wrapper
    const track = document.createElement('div');
    track.className = 'audio-track';

    // infer title from filename
    const src = audioEl.getAttribute('src') || '';
    const fileName = src.split('/').pop() || `Track ${idx+1}`;
    const prettyTitle = decodeURIComponent(fileName).replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ').trim();

    track.innerHTML = `
      <div class="track-info">
        <div class="track-title">${prettyTitle}</div>
        <div class="track-meta">${src}</div>
      </div>
      <div class="track-controls">
        <button class="btn-play" aria-label="Play ${prettyTitle}">▶</button>
        <div class="progress-wrap" role="progressbar" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar"><div class="progress-fill"></div><div class="progress-thumb"></div></div>
        </div>
        <div class="time">0:00 / 0:00</div>
        <input class="vol" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume">
      </div>
    `;

    // insert track before the original audio element, then move audio inside track (hidden)
    container.insertBefore(track, audioEl);
    track.appendChild(audioEl);

    // grab UI nodes
    const btn = track.querySelector('.btn-play');
    const progressWrap = track.querySelector('.progress-wrap');
    const progressBar = track.querySelector('.progress-bar');
    const progressFill = track.querySelector('.progress-fill');
    const progressThumb = track.querySelector('.progress-thumb');
    const timeLabel = track.querySelector('.time');
    const vol = track.querySelector('.vol');

    // store UI ref on audio for cross-control
    audioEl._ui = { btn, progressFill, progressThumb, timeLabel, progressBar };

    // init duration display when metadata loads
    audioEl.addEventListener('loadedmetadata', () => {
      timeLabel.textContent = `0:00 / ${fmt(audioEl.duration)}`;
    });

    // update progress
    audioEl.addEventListener('timeupdate', () => {
      const pct = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
      progressFill.style.width = pct + '%';
      progressThumb.style.right = `calc(${100 - pct}% - 6px)`; // keep thumb in sync
      timeLabel.textContent = `${fmt(audioEl.currentTime)} / ${fmt(audioEl.duration)}`;
    });

    audioEl.addEventListener('ended', () => {
      btn.classList.remove('playing');
      audioEl.currentTime = 0;
      progressFill.style.width = '0%';
      progressThumb.style.right = 'calc(100% - 6px)';
    });

    // play/pause button
    btn.addEventListener('click', () => {
      if (audioEl.paused) {
        pauseAllExcept(audioEl);
        audioEl.play().catch(e => { console.warn('Play blocked:', e); });
        btn.classList.add('playing');
      } else {
        audioEl.pause();
        btn.classList.remove('playing');
      }
    });

    // clicking progress bar seeks
    progressWrap.addEventListener('click', (ev) => {
      const rect = progressBar.getBoundingClientRect();
      const x = Math.max(0, Math.min(ev.clientX - rect.left, rect.width));
      const pct = x / rect.width;
      if (!isNaN(audioEl.duration)) {
        audioEl.currentTime = pct * audioEl.duration;
      }
    });

    // volume control
    vol.addEventListener('input', () => audioEl.volume = parseFloat(vol.value));

    // reflect play/pause if external control pauses it
    audioEl.addEventListener('play', () => {
      pauseAllExcept(audioEl);
      document.querySelectorAll('.btn-play').forEach(b => b.classList.remove('playing'));
      btn.classList.add('playing');
    });
    audioEl.addEventListener('pause', () => btn.classList.remove('playing'));

    // set initial UI state
    progressFill.style.width = '0%';
    progressThumb.style.right = 'calc(100% - 6px)';
    audioEl.volume = parseFloat(vol.value);
  });

  // pause all when leaving page
  window.addEventListener('beforeunload', () => audios.forEach(a => a.pause()));
})();






// simple tab-like navigation system
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll("nav a");
  const sections = document.querySelectorAll(".message, .music, .gallery, .notes");

  function showSection(id) {
    sections.forEach(sec => {
      sec.classList.toggle("active-section", sec.id === id);
    });
    navLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.target === id);
    });
  }

  navLinks.forEach(link => {
    link.addEventListener("click", e => {
      e.preventDefault();
      const target = link.dataset.target;
      showSection(target);
    });
  });

  // show the first section (message) by default
  showSection("message");
});



/* Notes system for your .notes area
   Works with:
   <textarea id="noteArea"> and <button id="saveNote" class="save-btn">Save Note</button>
   Adds UI for list, edit, delete, download, export/import, clear all.
*/
(function () {
  const STORAGE_KEY = 'allLove_notes_v1';

  // DOM refs
  const noteArea = document.getElementById('noteArea');
  const saveBtn = document.getElementById('saveNote');
  const notesSection = document.getElementById('notes');
  if (!noteArea || !saveBtn || !notesSection) return;

  // Create UI containers (if not already present)
  let uiWrap = notesSection.querySelector('.notes-ui');
  if (!uiWrap) {
    uiWrap = document.createElement('div');
    uiWrap.className = 'notes-ui';
    uiWrap.innerHTML = `
      <div class="notes-controls" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-clear-all" type="button">Clear All</button>
        <button class="btn-export" type="button">Export (.json)</button>
        <input class="btn-import-file" type="file" accept="application/json" style="display:none" />
        <button class="btn-import" type="button">Import (.json)</button>
      </div>
      <div class="notes-list" style="margin-top:12px;"></div>
    `;
    notesSection.appendChild(uiWrap);
  }

  const notesList = uiWrap.querySelector('.notes-list');
  const btnClearAll = uiWrap.querySelector('.btn-clear-all');
  const btnExport = uiWrap.querySelector('.btn-export');
  const btnImport = uiWrap.querySelector('.btn-import');
  const btnImportFile = uiWrap.querySelector('.btn-import-file');

  // Helpers
  const fmtDate = ts => {
    const d = new Date(ts);
    return d.toLocaleString();
  };
  const escapeHtml = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Storage helpers
  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Failed to load notes', e);
      return [];
    }
  }
  function saveNotes(notes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {
      console.error('Failed to save notes', e);
    }
  }

  // Render
  function renderNotes() {
    const notes = loadNotes().sort((a,b) => b.created - a.created);
    notesList.innerHTML = '';
    if (notes.length === 0) {
      notesList.innerHTML = `<div class="notes-empty" style="color:#666;padding:10px">No notes yet. Write something and click Save Note.</div>`;
      return;
    }

    notes.forEach(note => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.style = 'border:1px solid rgba(0,0,0,0.06);padding:10px;border-radius:8px;margin-bottom:10px;background:#fff;';

      card.innerHTML = `
        <div class="note-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div class="note-time" style="font-size:0.85rem;color:#666">${fmtDate(note.created)}</div>
          <div class="note-actions" style="display:flex;gap:6px">
            <button class="btn-edit" title="Edit">✏️</button>
            <button class="btn-download" title="Download">⬇️</button>
            <button class="btn-delete" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="note-body"><pre class="note-text" style="white-space:pre-wrap;margin:0;font-family:inherit">${escapeHtml(note.text)}</pre></div>
      `;

      // action listeners
      card.querySelector('.btn-edit').addEventListener('click', () => enterEditMode(note.id, card));
      card.querySelector('.btn-delete').addEventListener('click', () => {
        if (confirm('Delete this note?')) deleteNote(note.id);
      });
      card.querySelector('.btn-download').addEventListener('click', () => downloadNote(note));

      notesList.appendChild(card);
    });
  }

  // CRUD
  function addNote(text) {
    const t = String(text || '').trim();
    if (!t) return alert('Note is empty.');
    const notes = loadNotes();
    const note = {
      id: 'n_' + Date.now() + '_' + Math.floor(Math.random()*9999),
      text: t,
      created: Date.now()
    };
    notes.push(note);
    saveNotes(notes);
    renderNotes();
    noteArea.value = '';
  }

  function deleteNote(id) {
    const notes = loadNotes().filter(n => n.id !== id);
    saveNotes(notes);
    renderNotes();
  }

  function enterEditMode(id, cardEl) {
    const notes = loadNotes();
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const body = cardEl.querySelector('.note-body');
    body.innerHTML = '';

    const ta = document.createElement('textarea');
    ta.value = note.text;
    ta.style = 'width:100%;min-height:100px;padding:8px;border-radius:6px;border:1px solid rgba(0,0,0,0.08);font-family:inherit';
    body.appendChild(ta);

    const actions = document.createElement('div');
    actions.style = 'margin-top:8px';
    actions.innerHTML = `<button class="save-edit" style="margin-right:8px;padding:6px 10px">Save</button><button class="cancel-edit" style="padding:6px 10px">Cancel</button>`;
    body.appendChild(actions);

    actions.querySelector('.save-edit').addEventListener('click', () => {
      const newText = ta.value.trim();
      if (!newText) return alert('Note cannot be empty.');
      const updated = notes.map(n => n.id === id ? { ...n, text: newText } : n);
      saveNotes(updated);
      renderNotes();
    });
    actions.querySelector('.cancel-edit').addEventListener('click', renderNotes);
  }

  // Download a note as .txt
  function downloadNote(note) {
    const blob = new Blob([note.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.id}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Export all notes (.json)
  function exportAll() {
    const notes = loadNotes();
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allLove-notes.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Import notes from file (merge)
  function importFromFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!Array.isArray(imported)) throw new Error('Invalid format');
        const existing = loadNotes();
        const existingIds = new Set(existing.map(n => n.id));
        const merged = existing.concat(imported.filter(n => !existingIds.has(n.id)));
        saveNotes(merged);
        renderNotes();
        alert('Import complete.');
      } catch (err) {
        alert('Failed to import: invalid JSON.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  // Clear all
  function clearAll() {
    if (!confirm('Clear all notes? This cannot be undone.')) return;
    saveNotes([]);
    renderNotes();
  }

  // Hooks
  saveBtn.addEventListener('click', () => addNote(noteArea.value));
  btnClearAll.addEventListener('click', clearAll);
  btnExport.addEventListener('click', exportAll);
  btnImport.addEventListener('click', () => btnImportFile.click());
  btnImportFile.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) importFromFile(f);
    btnImportFile.value = '';
  });

  // Keyboard shortcut: Ctrl/Cmd + Enter to save
  noteArea.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      addNote(noteArea.value);
    }
  });

  // Init
  renderNotes();
})();
