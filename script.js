(() => {
  'use strict';

  // Tempel URL Web App deployment Apps Script di antara tanda petik.
  const API_URL = 'https://script.google.com/macros/s/AKfycbw4MJSreur798HEPHFqY8jgUVLYC1b_Fs_UsGwAq0uXZqBboszAyhPKZNCTQqaWm4hZNQ/exec';
  const MANAGER_CACHE_KEY = 'song-manager:saved-songs:v1';
  const MANAGER_DELETED_IDS_KEY = 'song-manager:deleted-song-ids:v1';
  const CATEGORY_LABELS = { PS: 'Psallo', NR: 'Nyanyian Rohani', SP: 'Tambahan', ZR: 'Zangkoor', KMR: 'Kaum Muda', SM: 'Sekolah Minggu', OTH: 'Other' };
  const CATEGORIES = [{ code: 'ALL', label: 'Semua' }, ...Object.entries(CATEGORY_LABELS).map(([code, label]) => ({ code, label }))];
  const form = document.getElementById('song-form');
  const instrumentList = document.getElementById('instrument-list');
  const template = document.getElementById('instrument-template');
  const status = document.getElementById('form-status');
  const submitButton = document.getElementById('submit-button');
  const songInput = document.getElementById('song-content-input');
  const highlightLayer = document.getElementById('highlight-layer');
  const managerSongList = document.getElementById('manager-song-list');
  const managerListStatus = document.getElementById('manager-list-status');
  const managerLastUpdated = document.getElementById('manager-last-updated');
  const managerSearch = document.getElementById('manager-song-search');
  const managerCategoryFilters = document.getElementById('manager-category-filters');
  const managerUpdateProgress = document.getElementById('manager-update-progress');
  const managerProgressTrack = document.getElementById('manager-progress-track');
  const managerProgressLabel = document.getElementById('manager-progress-label');
  const cancelEditButton = document.getElementById('cancel-edit-button');
  const pageHeader = document.querySelector('.page-header');
  const pageHeaderToggle = document.getElementById('toggle-page-header');
  const previewDialog = document.getElementById('manager-preview-dialog');
  const previewContent = document.getElementById('manager-preview-content');
  const previewScores = document.getElementById('manager-preview-scores');
  const previewInstruments = document.getElementById('manager-preview-instruments');
  const previewPages = document.getElementById('manager-preview-pages');
  const managerScoreCarousel = document.getElementById('manager-score-carousel');
  const managerScoreImageDialog = document.getElementById('manager-score-image-dialog');
  const managerScoreImageFull = document.getElementById('manager-score-image-full');
  const managerDeleteDialog = document.getElementById('manager-delete-dialog');
  const managerDeleteMessage = document.getElementById('manager-delete-message');
  const confirmManagerDeleteButton = document.getElementById('confirm-manager-delete');
  let previewScoreSong = null;
  let previewScoreInstrument = '';
  let previewZoom = 1;
  let previewPinchStart = null;
  let savedSongs = [];
  let activeManagerCategory = 'ALL';
  let pendingDeleteSong = null;
  let pendingDeleteButton = null;
  let managerDeleteSuccessMode = false;
  const recentlyDeletedSongIds = new Set();
  try {
    const deletedIds = JSON.parse(localStorage.getItem(MANAGER_DELETED_IDS_KEY) || '[]');
    if (Array.isArray(deletedIds)) deletedIds.forEach((id) => recentlyDeletedSongIds.add(String(id)));
  } catch (error) {}
  let pendingNewSongHighlight = null;
  let newSongHighlightTimer = 0;
  let editingSongId = '';
  let pendingImages = {};
  let listCallbackCounter = 0;
  let isLoadingSavedSongs = false;
  const placeholderExample = '[Intro]\nG   D   Em\n(musik)\n\n[Bait 1]\nG       C\nKasih-Mu nyata\n\n[Reff]\nC   D   G\nKu memuji';

  const knownSectionPattern = /^(?:(?:\d+[.)]?\s*)?)(intro|opening|bait|verse|stanza|reff|refrain|chorus|pre[ -]?(?:reff|chorus)|post[ -]?(?:reff|chorus)|bridge|intermezzo|itermezzo|interlude|instrumental|music|musik|solo|coda|outro|ending|tag|vamp|reprise)(?:\s+(?:ke[- ]?)?\d+)?$/i;

  function setStatus(message, kind = '') {
    status.textContent = message;
    status.className = `form-status${kind ? ` ${kind}` : ''}`;
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    status.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  }

  function formatTempo(value) {
    const tempo = String(value == null ? '' : value).trim().replace(/\s*BPM\s*$/i, '').trim();
    if (!tempo) return '';
    return /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(tempo) ? `${tempo} BPM` : tempo;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function getSectionLabel(line) {
    const trimmed = line.trim();
    const bracketed = trimmed.match(/^\[([^\]\n]{1,60})\]\s*:?[ \t]*$/) || trimmed.match(/^\{([^}\n]{1,60})\}\s*:?[ \t]*$/);
    if (bracketed) return bracketed[1].trim();
    const unwrapped = trimmed.replace(/:$/, '').trim();
    return knownSectionPattern.test(unwrapped) ? unwrapped.replace(/^\d+[.)]?\s*/, '') : '';
  }

  function updateHighlight() {
    const value = songInput.value || placeholderExample;
    highlightLayer.classList.toggle('is-placeholder', !songInput.value);
    highlightLayer.innerHTML = value.split('\n').map((line) => {
      const label = getSectionLabel(line);
      return label ? `<span class="section-marker">${escapeHtml(line)}</span>` : escapeHtml(line);
    }).join('\n') + '\n';
    songInput.style.height = 'auto';
    const maxHeight = Math.max(180, Math.floor(window.innerHeight * 0.62));
    songInput.style.height = `${Math.min(Math.max(songInput.scrollHeight, 340), maxHeight)}px`;
    highlightLayer.style.height = songInput.style.height;
    songInput.parentElement.style.height = songInput.style.height;
    syncHighlightScroll();
  }

  function syncHighlightScroll() {
    highlightLayer.style.transform = `translate(${-songInput.scrollLeft}px, ${-songInput.scrollTop}px)`;
  }

  songInput.addEventListener('input', updateHighlight);
  songInput.addEventListener('scroll', syncHighlightScroll, { passive: true });
  window.addEventListener('resize', updateHighlight);
  updateHighlight();

  function addInstrument(name = 'Partitur', existingFiles = [], shouldFocus = true) {
    const row = template.content.firstElementChild.cloneNode(true);
    const nameSelect = row.querySelector('.instrument-name-select');
    const nameInput = row.querySelector('.instrument-name');
    const presetExists = [...nameSelect.options].some((option) => option.value === name && option.value !== 'Others');
    nameSelect.value = presetExists ? name : 'Others';
    nameInput.value = presetExists ? '' : name;
    nameInput.hidden = presetExists;
    nameInput.required = !presetExists;
    row.dataset.originalInstrument = existingFiles && existingFiles.length ? name : '';
    nameSelect.addEventListener('change', () => {
      const isOther = nameSelect.value === 'Others';
      nameInput.hidden = !isOther;
      nameInput.required = isOther;
      if (isOther) nameInput.focus();
    });
    row.dataset.existingFiles = JSON.stringify(existingFiles || []);
    renderInstrumentFiles(row, []);
    row.querySelector('.remove-instrument').addEventListener('click', () => {
      row.remove();
      if (!instrumentList.children.length) addInstrument();
    });
    row.querySelector('.instrument-files').addEventListener('change', (event) => {
      renderInstrumentFiles(row, [...event.target.files]);
    });
    instrumentList.append(row);
    if (shouldFocus) nameSelect.focus();
  }

  function renderInstrumentFiles(row, newFiles) {
    const list = row.querySelector('.file-list');
    list.replaceChildren();
    const existing = JSON.parse(row.dataset.existingFiles || '[]');
    [...existing.map((file) => ({ name: file.name || 'Gambar tersimpan', existing: true })), ...newFiles.map((file) => ({ name: file.name, existing: false }))].forEach((file) => {
      const chip = document.createElement('span');
      chip.className = `file-chip${file.existing ? ' existing-file' : ''}`;
      chip.textContent = `${file.existing ? 'Tersimpan: ' : ''}${file.name}`;
      list.append(chip);
    });
  }

  document.getElementById('add-instrument').addEventListener('click', () => addInstrument());
  addInstrument('Partitur');

  function getContentHtml() {
    const sections = [];
    let current = null;
    songInput.value.split('\n').forEach((line) => {
      const label = getSectionLabel(line);
      if (label) {
        current = { label, lines: [] };
        sections.push(current);
      } else {
        if (!current) {
          current = { label: 'Lagu', lines: [] };
          sections.push(current);
        }
        current.lines.push(line);
      }
    });
    const sectionHtml = sections.map(({ label, lines }) => {
      const safeLabel = escapeHtml(label);
      const body = escapeHtml(lines.join('\n'));
      return `<section class="song-section" data-section="${safeLabel}"><h3 class="song-section-title">${safeLabel}</h3><div class="song-section-body">${body}</div></section>`;
    }).join('');
    return `<div class="song-content">${sectionHtml}</div>`;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64: String(reader.result).split(',')[1]
      });
      reader.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  function postToAppsScript(payload) {
    return new Promise((resolve, reject) => {
      if (!API_URL.startsWith('https://script.google.com/macros/s/')) {
        reject(new Error('Masukkan URL Web App Apps Script pada konstanta API_URL di script.js.'));
        return;
      }
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const frameName = `song-manager-${nonce.replace(/[^a-z0-9]/gi, '')}`;
      const iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.title = 'Pengiriman data Song Manager';
      iframe.hidden = true;
      const postForm = document.createElement('form');
      postForm.method = 'POST';
      postForm.action = API_URL;
      postForm.target = frameName;
      postForm.hidden = true;
      const payloadInput = document.createElement('input');
      payloadInput.type = 'hidden';
      payloadInput.name = 'payload';
      payloadInput.value = JSON.stringify({ ...payload, requestNonce: nonce });
      postForm.append(payloadInput);

      const timer = window.setTimeout(() => finish(new Error('Apps Script tidak mengirim balasan. Pastikan URL berakhiran /exec, deployment memakai versi terbaru dengan doPost, dan akses deployment mengizinkan akun ini.')), 120000);
      function finish(error, result) {
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        postForm.remove();
        iframe.remove();
        if (error) reject(error);
        else resolve(result);
      }
      function onMessage(event) {
        const reply = event.data;
        // HtmlService may send the reply from a nested sandbox frame, so match
        // the unpredictable request nonce instead of requiring the outer iframe.
        if (!reply || reply.app !== 'song-manager' || reply.nonce !== nonce) return;
        if (reply.ok) finish(null, reply.result);
        else finish(new Error(reply.error || 'Apps Script gagal menyimpan lagu.'));
      }

      window.addEventListener('message', onMessage);
      document.body.append(iframe, postForm);
      postForm.submit();
    });
  }

  async function collectPayload() {
    const instruments = {};
    const instrumentNames = [];
    const instrumentRenames = [];
    const seenInstrumentNames = new Set();
    for (const row of instrumentList.querySelectorAll('.instrument-row')) {
      const files = [...row.querySelector('.instrument-files').files];
      const nameSelect = row.querySelector('.instrument-name-select');
      const name = (nameSelect.value === 'Others' ? row.querySelector('.instrument-name').value : nameSelect.value).trim();
      if (!name && files.length) throw new Error('Isi nama instrumen untuk gambar yang dipilih.');
      if (!name) continue;
      const key = name.toLowerCase();
      if (seenInstrumentNames.has(key)) throw new Error(`Nama instrumen “${name}” muncul lebih dari satu kali.`);
      seenInstrumentNames.add(key);
      instrumentNames.push(name);
      const originalName = row.dataset.originalInstrument || '';
      if (originalName && originalName !== name) instrumentRenames.push({ from: originalName, to: name });
      if (files.length) instruments[name] = await Promise.all(files.map(readFile));
    }

    return {
      category: document.getElementById('category').value,
      number: document.getElementById('number').value.trim(),
      title: document.getElementById('title').value.trim(),
      key: document.getElementById('key').value.trim(),
      genre: document.getElementById('genre').value.trim(),
      songCreator: document.getElementById('song-creator').value.trim(),
      dateCreate: document.getElementById('date-create').value.trim(),
      tempo: document.getElementById('tempo').value.trim(),
      contentHtml: getContentHtml(),
      id: editingSongId,
      action: editingSongId ? 'update' : 'create',
      instrumentNames,
      instrumentRenames,
      instruments
    };
  }

  function loadSavedSongs(forceFresh = false) {
    if (isLoadingSavedSongs) return;
    isLoadingSavedSongs = true;
    managerListStatus.textContent = 'Memuat daftar lagu dari database…';
    setUpdateProgress('loading', 'Mengambil data dari database…');
    const refreshButton = document.getElementById('refresh-songs');
    refreshButton.disabled = true;
    const callbackName = `cb_${Date.now()}_${++listCallbackCounter}`;
    const script = document.createElement('script');
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error('Waktu memuat daftar lagu habis.')), 20000);
    function finish(error, result) {
      if (settled) return;
      settled = true;
      isLoadingSavedSongs = false;
      window.clearTimeout(timeout);
      refreshButton.disabled = false;
      delete window.SongBookCallbacks[callbackName];
      script.remove();
      if (error || !result || !result.ok) {
        const message = (error && error.message) || (result && result.error) || 'Periksa URL API dan akses deployment.';
        managerListStatus.textContent = `Daftar lagu gagal dimuat: ${message}`;
        setUpdateProgress('error', 'Pembaruan gagal. Cache sebelumnya tetap tersedia.');
        return;
      }
      savedSongs = (Array.isArray(result.songs) ? result.songs : []).filter((song) => !recentlyDeletedSongIds.has(String(song.id)));
      const updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(MANAGER_CACHE_KEY, JSON.stringify({ updatedAt, songs: savedSongs }));
        setLastUpdated(updatedAt);
        managerListStatus.textContent = `${savedSongs.length} lagu ditemukan.`;
      } catch (storageError) {
        managerListStatus.textContent = `${savedSongs.length} lagu ditemukan di database.`;
      }
      renderSavedSongs();
      if (pendingNewSongHighlight) highlightNewlySavedSong(pendingNewSongHighlight);
      setUpdateProgress('complete', `Selesai diperbarui · ${savedSongs.length} lagu.`);
    }
    window.SongBookCallbacks = window.SongBookCallbacks || {};
    window.SongBookCallbacks[callbackName] = (result) => finish(null, result);
    script.onerror = () => finish(new Error('Tidak dapat mengakses API Apps Script.'));
    const url = new URL(API_URL);
    url.searchParams.set('action', 'songs');
    if (forceFresh) url.searchParams.set('fresh', '1');
    url.searchParams.set('callback', `SongBookCallbacks.${callbackName}`);
    script.src = url.toString();
    document.head.append(script);
  }

  function setUpdateProgress(state, message) {
    managerUpdateProgress.hidden = false;
    managerUpdateProgress.className = `manager-update-progress is-${state}`;
    managerProgressLabel.textContent = message;
    managerProgressTrack.setAttribute('aria-valuetext', message);
    if (state === 'complete') managerProgressTrack.setAttribute('aria-valuenow', '100');
    else managerProgressTrack.removeAttribute('aria-valuenow');
  }

  function setLastUpdated(value) {
    const updated = value ? new Date(value) : null;
    const label = updated && !Number.isNaN(updated.getTime())
      ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(updated)
      : 'Waktu pembaruan belum tersedia';
    managerLastUpdated.textContent = `Terakhir diperbarui: ${label}`;
    managerLastUpdated.hidden = false;
  }

  function loadCachedSongs() {
    try {
      const cached = JSON.parse(localStorage.getItem(MANAGER_CACHE_KEY) || 'null');
      if (!cached || !Array.isArray(cached.songs)) return false;
      savedSongs = cached.songs.filter((song) => !recentlyDeletedSongIds.has(String(song.id)));
      if (savedSongs.length !== cached.songs.length) {
        localStorage.setItem(MANAGER_CACHE_KEY, JSON.stringify({ ...cached, songs: savedSongs }));
      }
      const updated = cached.updatedAt ? new Date(cached.updatedAt) : null;
      setLastUpdated(updated && !Number.isNaN(updated.getTime()) ? updated : null);
      const updatedLabel = updated && !Number.isNaN(updated.getTime())
        ? ` · cache ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(updated)}`
        : '';
      managerListStatus.textContent = `${savedSongs.length} lagu di cache lokal${updatedLabel}. Tekan “Perbarui daftar” untuk mengambil perubahan database.`;
      renderSavedSongs();
      return true;
    } catch (error) {
      return false;
    }
  }

  function renderManagerCategoryFilters() {
    managerCategoryFilters.replaceChildren();
    CATEGORIES.forEach(({ code, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'manager-category-chip';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(activeManagerCategory === code));
      button.addEventListener('click', () => {
        activeManagerCategory = code;
        renderManagerCategoryFilters();
        renderSavedSongs();
      });
      managerCategoryFilters.append(button);
    });
  }

  function renderSavedSongs() {
    const query = managerSearch.value.trim().toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const visible = savedSongs.filter((song) => {
      if (activeManagerCategory !== 'ALL' && song.category !== activeManagerCategory) return false;
      const searchable = `${song.category} ${song.number} ${song.title} ${song.key || ''} ${song.genre || ''} ${song.songCreator || ''} ${song.dateCreate || ''} ${song.tempo || ''}`.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return searchable.includes(query);
    });
    managerSongList.replaceChildren();
    managerSongList.style.maxHeight = '';
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'manager-empty';
      empty.textContent = savedSongs.length ? 'Tidak ada lagu yang cocok.' : 'Belum ada cache lagu. Tekan “Perbarui daftar” untuk mengambilnya dari database.';
      managerSongList.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    visible.forEach((song) => {
      const row = document.createElement('article');
      row.className = 'manager-song-row';
      row.dataset.songId = song.id;
      const info = document.createElement('button');
      info.type = 'button';
      info.className = 'manager-song-info manager-song-preview-button';
      info.dataset.action = 'preview';
      info.dataset.songId = song.id;
      info.setAttribute('aria-label', `Lihat lirik dan chord ${song.category} ${song.number} ${song.title}`);
      const title = document.createElement('p');
      title.className = 'manager-song-title';
      title.textContent = `${song.category || ''} ${song.number || ''} · ${song.title || ''}`;
      const meta = document.createElement('p');
      meta.className = 'manager-song-meta';
      meta.textContent = [song.key, song.genre, song.songCreator, song.dateCreate, formatTempo(song.tempo)].filter(Boolean).join(' · ');
      info.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'manager-song-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'manager-edit-button';
      edit.dataset.action = 'edit';
      edit.dataset.songId = song.id;
      edit.textContent = 'Edit';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'manager-delete-button';
      remove.dataset.action = 'delete';
      remove.dataset.songId = song.id;
      remove.textContent = 'Hapus';
      actions.append(edit, remove);
      row.append(info, actions);
      fragment.append(row);
    });
    managerSongList.append(fragment);
    if (visible.length > 5) {
      const listTop = managerSongList.getBoundingClientRect().top;
      const fifthRowBottom = managerSongList.children[4].getBoundingClientRect().bottom;
      managerSongList.style.maxHeight = `${Math.ceil(fifthRowBottom - listTop)}px`;
    }
  }

  function highlightNewlySavedSong(songData) {
    const song = savedSongs.find((item) => songData.id && String(item.id) === String(songData.id))
      || [...savedSongs].reverse().find((item) => item.category === songData.category && String(item.number) === String(songData.number) && item.title === songData.title);
    pendingNewSongHighlight = null;
    if (!song) return;
    const row = [...managerSongList.querySelectorAll('.manager-song-row')].find((item) => item.dataset.songId === String(song.id));
    if (!row) return;
    window.clearTimeout(newSongHighlightTimer);
    managerSongList.querySelectorAll('.manager-song-just-added').forEach((item) => {
      item.classList.remove('manager-song-just-added');
      item.querySelector('.manager-new-song-badge')?.remove();
    });
    row.classList.add('manager-song-just-added');
    const badge = document.createElement('span');
    badge.className = 'manager-new-song-badge';
    badge.textContent = songData.badgeText || 'Lagu baru';
    row.querySelector('.manager-song-title')?.append(' ', badge);
    managerListStatus.textContent = songData.statusText || `${song.title} berhasil ditambahkan.`;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    newSongHighlightTimer = window.setTimeout(() => {
      row.classList.remove('manager-song-just-added');
      badge.remove();
    }, 7000);
  }

  function htmlToInput(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const sections = [...parsed.querySelectorAll('.song-section')];
    if (!sections.length) return parsed.body.textContent || '';
    return sections.map((section) => {
      const label = section.dataset.section || section.querySelector('.song-section-title')?.textContent || '';
      const body = section.querySelector('.song-section-body') || section;
      return `${label ? `[${label}]\n` : ''}${body.textContent || ''}`.trimEnd();
    }).join('\n\n');
  }

  function safePreviewFragment(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const allowedTags = new Set(['DIV', 'SECTION', 'H3', 'PRE', 'BR', 'P', 'SPAN', 'STRONG', 'EM']);
    const allowedClasses = new Set(['song-content', 'song-section', 'song-section-title', 'song-section-body', 'chord', 'lyric', 'song-line']);
    function copyNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
      if (node.nodeType !== Node.ELEMENT_NODE || !allowedTags.has(node.tagName)) return document.createTextNode(node.textContent || '');
      const clone = document.createElement(node.tagName.toLowerCase());
      const classes = [...node.classList].filter((className) => allowedClasses.has(className));
      if (classes.length) clone.className = classes.join(' ');
      if (node.tagName === 'SECTION' && node.dataset.section) clone.dataset.section = node.dataset.section.slice(0, 80);
      [...node.childNodes].forEach((child) => clone.append(copyNode(child)));
      return clone;
    }
    const fragment = document.createDocumentFragment();
    [...parsed.body.childNodes].forEach((node) => fragment.append(copyNode(node)));
    return fragment;
  }

  function openSavedSongPreview(song) {
    previewScoreSong = song;
    previewZoom = 1;
    const categoryCode = String(song.category || '').toUpperCase();
    document.getElementById('manager-preview-category').textContent = categoryCode
      ? `${categoryCode} · ${CATEGORY_LABELS[categoryCode] || categoryCode}`
      : '';
    document.getElementById('manager-preview-title').textContent = `${song.number ? `${song.number}. ` : ''}${song.title || ''}`;
    document.getElementById('manager-preview-meta').textContent = [song.key ? `Nada dasar: ${song.key}` : '', song.genre || '', song.tempo ? `Tempo: ${formatTempo(song.tempo)}` : ''].filter(Boolean).join(' | ');
    const credits = [];
    if (song.songCreator) credits.push(`Pencipta: ${song.songCreator}`);
    if (song.dateCreate) credits.push(`Tahun: ${song.dateCreate}`);
    const creditsElement = document.getElementById('manager-preview-credits');
    creditsElement.textContent = credits.join(' · ');
    creditsElement.hidden = credits.length === 0;
    previewContent.replaceChildren();
    const fragment = safePreviewFragment(song.contentHtml);
    if (fragment.childNodes.length) previewContent.append(fragment);
    else {
      const empty = document.createElement('p');
      empty.className = 'manager-preview-empty';
      empty.textContent = 'Lirik dan chord belum tersedia untuk lagu ini.';
      previewContent.append(empty);
    }
    const songContent = previewContent.querySelector('.song-content');
    if (songContent) songContent.style.zoom = String(previewZoom);
    previewContent.scrollTop = 0;
    renderPreviewScoreButtons(song.images);
    previewDialog.showModal();
    document.body.classList.add('manager-preview-open');
    scheduleManagerPreviewFit();
    document.getElementById('close-manager-preview').focus();
  }

  function fitManagerPreview() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    previewContent.querySelectorAll('.song-section-body, .song-content pre').forEach((body) => {
      body.style.fontSize = '';
      const width = body.parentElement.clientWidth;
      if (!width || !context) return;
      const style = getComputedStyle(body);
      const baseSize = parseFloat(style.fontSize) || 14;
      const lines = (body.innerText || body.textContent).split(/\r?\n/);
      context.font = `${style.fontWeight} ${baseSize}px ${style.fontFamily}`;
      const longestWidth = Math.max(0, ...lines.map((line) => context.measureText(line.replace(/\t/g, '    ')).width));
      if (longestWidth > width) body.style.fontSize = `${baseSize * width / longestWidth * 0.97}px`;
    });
  }

  let managerPreviewFitFrame = 0;
  function scheduleManagerPreviewFit() {
    cancelAnimationFrame(managerPreviewFitFrame);
    managerPreviewFitFrame = requestAnimationFrame(() => {
      managerPreviewFitFrame = requestAnimationFrame(fitManagerPreview);
    });
  }

  const managerPreviewFitObserver = new ResizeObserver(scheduleManagerPreviewFit);
  managerPreviewFitObserver.observe(previewContent);
  window.addEventListener('resize', scheduleManagerPreviewFit, { passive: true });

  function previewTouchDistance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
  }

  previewContent.addEventListener('touchstart', (event) => {
    if (event.touches.length === 2) previewPinchStart = { distance: previewTouchDistance(event.touches), zoom: previewZoom };
  }, { passive: true });

  previewContent.addEventListener('touchmove', (event) => {
    if (!previewPinchStart || event.touches.length !== 2) return;
    event.preventDefault();
    const nextZoom = Math.max(0.7, Math.min(2.5, previewPinchStart.zoom * previewTouchDistance(event.touches) / previewPinchStart.distance));
    if (!Number.isFinite(nextZoom)) return;
    const rect = previewContent.getBoundingClientRect();
    const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
    const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
    const ratio = nextZoom / previewZoom;
    previewContent.scrollLeft = (previewContent.scrollLeft + centerX) * ratio - centerX;
    previewContent.scrollTop = (previewContent.scrollTop + centerY) * ratio - centerY;
    previewZoom = nextZoom;
    const songContent = previewContent.querySelector('.song-content');
    if (songContent) songContent.style.zoom = String(previewZoom);
  }, { passive: false });

  previewContent.addEventListener('touchend', (event) => {
    if (event.touches.length < 2) previewPinchStart = null;
  }, { passive: true });
  previewContent.addEventListener('touchcancel', () => { previewPinchStart = null; }, { passive: true });

  function renderPreviewScoreButtons(images) {
    previewInstruments.replaceChildren();
    previewPages.replaceChildren();
    previewScores.hidden = true;
    managerScoreCarousel.hidden = true;
    const entries = images && typeof images === 'object'
      ? Object.entries(images).filter(([, files]) => Array.isArray(files) && files.length)
      : [];
    previewScores.hidden = entries.length === 0;
    entries.forEach(([instrument, files]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'manager-preview-instrument-button';
      button.dataset.instrument = instrument;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = `${instrument} (${files.length})`;
      previewInstruments.append(button);
    });
  }

  function getPreviewImageUrl(file) {
    if (typeof file === 'string') return file;
    if (!file || typeof file !== 'object') return '';
    const id = String(file.id || file.url?.match(/[?&]id=([^&]+)/)?.[1] || '');
    return id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w2000` : String(file.url || '');
  }

  function getPreviewImageCandidates(file) {
    const source = typeof file === 'string' ? file : String((file && file.url) || '');
    const id = file && typeof file === 'object' && file.id ? String(file.id) : source.match(/[?&]id=([^&]+)/)?.[1] || '';
    if (!id) return source ? [source] : [];
    const encodedId = encodeURIComponent(id);
    return [...new Set([`https://drive.google.com/thumbnail?id=${encodedId}&sz=w2000`, `https://lh3.googleusercontent.com/d/${encodedId}=w2000`, `https://drive.google.com/uc?export=view&id=${encodedId}`, source].filter(Boolean))];
  }

  function renderPreviewInstrument(instrument) {
    const files = previewScoreSong?.images?.[instrument];
    if (!Array.isArray(files)) return;
    previewScoreInstrument = instrument;
    previewInstruments.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.instrument === instrument));
    });
    previewPages.replaceChildren();
    files.forEach((file, index) => {
      const urls = getPreviewImageCandidates(file);
      const imageUrl = urls[0] || getPreviewImageUrl(file);
      if (!imageUrl) return;
      const figure = document.createElement('figure');
      figure.className = 'manager-preview-page';
      const image = document.createElement('img');
      image.src = imageUrl;
      image.alt = `Partitur ${instrument}, halaman ${index + 1}`;
      image.loading = 'lazy';
      image.addEventListener('error', () => {
        const next = Number(image.dataset.attempt || 0) + 1;
        image.dataset.attempt = String(next);
        if (next < urls.length) image.src = urls[next];
      });
      image.addEventListener('click', () => {
        managerScoreImageFull.src = image.currentSrc || image.src;
        managerScoreImageFull.alt = image.alt;
        managerScoreImageDialog.showModal();
      });
      const caption = document.createElement('figcaption');
      caption.textContent = file && typeof file === 'object' && file.name ? file.name : `${instrument} · ${index + 1}`;
      figure.append(image, caption);
      previewPages.append(figure);
    });
    previewPages.scrollLeft = 0;
    previewPages.hidden = false;
    managerScoreCarousel.hidden = previewPages.children.length < 2;
    updatePreviewScorePosition();
  }

  function updatePreviewScorePosition() {
    const pages = previewPages.children;
    if (!pages.length) return;
    const index = Math.min(pages.length - 1, Math.round(previewPages.scrollLeft / Math.max(1, previewPages.clientWidth)));
    document.getElementById('manager-score-position').textContent = `${index + 1} / ${pages.length}`;
    document.getElementById('manager-score-previous').disabled = index === 0;
    document.getElementById('manager-score-next').disabled = index === pages.length - 1;
  }

  function togglePreviewInstrument(instrument) {
    const button = [...previewInstruments.querySelectorAll('button')].find((item) => item.dataset.instrument === instrument);
    if (previewScoreInstrument === instrument && !previewPages.hidden) {
      previewPages.hidden = true;
      managerScoreCarousel.hidden = true;
      button?.setAttribute('aria-pressed', 'false');
      previewScoreInstrument = '';
      return;
    }
    renderPreviewInstrument(instrument);
  }

  function movePreviewScore(direction) {
    previewPages.scrollBy({ left: direction * previewPages.clientWidth, behavior: 'smooth' });
  }

  function beginEdit(song) {
    editingSongId = song.id;
    document.getElementById('category').value = song.category || '';
    document.getElementById('number').value = song.number || '';
    document.getElementById('title').value = song.title || '';
    document.getElementById('key').value = song.key || '';
    document.getElementById('genre').value = song.genre || '';
    document.getElementById('song-creator').value = song.songCreator || '';
    document.getElementById('date-create').value = song.dateCreate || '';
    document.getElementById('tempo').value = String(song.tempo || '');
    songInput.value = htmlToInput(song.contentHtml);
    instrumentList.replaceChildren();
    pendingImages = song.images && typeof song.images === 'object' ? song.images : {};
    const entries = Object.entries(pendingImages);
    if (entries.length) entries.forEach(([name, files]) => addInstrument(name, Array.isArray(files) ? files : [], false));
    else addInstrument('Partitur', [], false);
    document.getElementById('song-detail-heading').textContent = 'Edit detail lagu';
    submitButton.querySelector('span').textContent = 'Simpan perubahan';
    cancelEditButton.hidden = false;
    updateHighlight();
    setStatus(`Mengedit ${song.category} ${song.number} · ${song.title}. Gambar yang sudah tersimpan tetap dipakai; unggahan baru mengganti gambar instrumen terkait.`, 'loading');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function resetEditor() {
    editingSongId = '';
    pendingImages = {};
    form.reset();
    instrumentList.replaceChildren();
    addInstrument('Partitur', [], false);
    document.getElementById('song-detail-heading').textContent = 'Detail lagu baru';
    submitButton.querySelector('span').textContent = 'Simpan lagu';
    cancelEditButton.hidden = true;
    updateHighlight();
    setStatus('Semua field bertanda * wajib diisi.');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    const wasEditing = Boolean(editingSongId);
    setStatus(wasEditing ? 'Menyimpan perubahan lagu…' : 'Menyimpan lagu…', 'loading');
    try {
      const payload = await collectPayload();
      if (!songInput.value.trim()) throw new Error('Isi lirik dan chord sebelum menyimpan.');
      const fileCount = Object.values(payload.instruments || {}).reduce((sum, files) => sum + files.length, 0);
      if (fileCount) setStatus('Upload gambar…', 'loading');
      const saveResult = await postToAppsScript(payload);
      resetEditor();
      setStatus(wasEditing ? `Perubahan lagu tersimpan.${fileCount ? ' Upload gambar selesai.' : ''}` : (fileCount ? 'Lagu tersimpan. Upload gambar selesai.' : 'Lagu tersimpan tanpa gambar partitur.'), 'success');
      submitButton.disabled = false;
      pendingNewSongHighlight = {
        id: saveResult && saveResult.id,
        category: payload.category,
        number: payload.number,
        title: payload.title,
        badgeText: wasEditing ? 'Baru saja diperbarui' : 'Lagu baru',
        statusText: wasEditing ? `${payload.title} baru saja diperbarui.` : `${payload.title} berhasil ditambahkan.`
      };
      activeManagerCategory = 'ALL';
      managerSearch.value = '';
      renderManagerCategoryFilters();
      loadSavedSongs(true);
    } catch (error) {
      console.error('[Song Manager] Penyimpanan gagal:', error);
      setStatus(`Gagal menyimpan lagu: ${error.message || 'Terjadi kesalahan yang tidak diketahui.'}`, 'error');
      submitButton.disabled = false;
    }
  });

  managerSongList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    const row = event.target.closest('.manager-song-row');
    const songId = button ? button.dataset.songId : row && row.dataset.songId;
    if (!songId) return;
    const song = savedSongs.find((item) => item.id === songId);
    if (!song) return;
    if (!button || button.dataset.action === 'preview') {
      openSavedSongPreview(song);
      return;
    }
    if (button.dataset.action === 'edit') {
      beginEdit(song);
      return;
    }
    if (button.dataset.action !== 'delete') return;
    pendingDeleteSong = song;
    pendingDeleteButton = button;
    managerDeleteSuccessMode = false;
    managerDeleteDialog.classList.remove('is-success');
    document.getElementById('manager-delete-title').textContent = 'Hapus lagu?';
    document.getElementById('cancel-manager-delete').hidden = false;
    managerDeleteMessage.textContent = `Hapus lagu ${song.category} ${song.number} · ${song.title} dari database?`;
    confirmManagerDeleteButton.disabled = false;
    confirmManagerDeleteButton.textContent = 'Hapus lagu';
    managerDeleteDialog.showModal();
  });

  function cancelManagerDelete() {
    if (managerDeleteDialog.open) managerDeleteDialog.close();
    pendingDeleteSong = null;
    pendingDeleteButton = null;
    managerDeleteSuccessMode = false;
    managerDeleteDialog.classList.remove('is-success');
    document.getElementById('manager-delete-title').textContent = 'Hapus lagu?';
    document.getElementById('cancel-manager-delete').hidden = false;
    confirmManagerDeleteButton.textContent = 'Hapus lagu';
  }

  document.getElementById('close-manager-delete').addEventListener('click', cancelManagerDelete);
  document.getElementById('cancel-manager-delete').addEventListener('click', cancelManagerDelete);
  managerDeleteDialog.addEventListener('cancel', (event) => event.preventDefault());
  confirmManagerDeleteButton.addEventListener('click', async () => {
    const song = pendingDeleteSong;
    const button = pendingDeleteButton;
    if (!song || !button) {
      if (managerDeleteSuccessMode) cancelManagerDelete();
      return;
    }
    button.disabled = true;
    confirmManagerDeleteButton.disabled = true;
    confirmManagerDeleteButton.textContent = 'Menghapus…';
    managerListStatus.textContent = `Menghapus ${song.title}…`;
    let deleted = false;
    try {
      await postToAppsScript({ action: 'delete', id: song.id });
      deleted = true;
      if (editingSongId === song.id) resetEditor();
      recentlyDeletedSongIds.add(String(song.id));
      try { localStorage.setItem(MANAGER_DELETED_IDS_KEY, JSON.stringify([...recentlyDeletedSongIds])); } catch (storageError) {}
      savedSongs = savedSongs.filter((item) => String(item.id) !== String(song.id));
      try {
        const updatedAt = new Date().toISOString();
        localStorage.setItem(MANAGER_CACHE_KEY, JSON.stringify({ updatedAt, songs: savedSongs }));
        setLastUpdated(updatedAt);
      } catch (storageError) {}
      renderSavedSongs();
      const deletedSongLabel = `${song.category} ${song.number} ${song.title}`.trim();
      managerListStatus.textContent = `Lagu ${deletedSongLabel} berhasil dihapus.`;
      document.getElementById('manager-delete-title').textContent = 'Penghapusan berhasil';
      managerDeleteMessage.textContent = `Lagu ${deletedSongLabel} berhasil dihapus.`;
      document.getElementById('cancel-manager-delete').hidden = true;
      managerDeleteSuccessMode = true;
      managerDeleteDialog.classList.add('is-success');
      pendingDeleteSong = null;
      pendingDeleteButton = null;
      loadSavedSongs(true);
    } catch (error) {
      managerListStatus.textContent = `Gagal menghapus lagu: ${error.message || 'Terjadi kesalahan.'}`;
      button.disabled = false;
      managerDeleteDialog.close();
      pendingDeleteSong = null;
      pendingDeleteButton = null;
    } finally {
      confirmManagerDeleteButton.disabled = false;
      confirmManagerDeleteButton.textContent = deleted ? 'Tutup' : 'Hapus lagu';
    }
  });

  document.getElementById('refresh-songs').addEventListener('click', loadSavedSongs);
  pageHeaderToggle.addEventListener('click', () => {
    const collapsed = pageHeader.classList.toggle('is-collapsed');
    pageHeaderToggle.setAttribute('aria-expanded', String(!collapsed));
    pageHeaderToggle.setAttribute('aria-label', collapsed ? 'Buka header' : 'Ciutkan header');
    pageHeaderToggle.querySelector('.header-toggle-label').textContent = collapsed ? 'Buka header' : 'Ciutkan header';
    pageHeaderToggle.querySelector('[aria-hidden="true"]').textContent = collapsed ? 'v' : '^';
  });
  document.getElementById('close-manager-preview').addEventListener('click', () => previewDialog.close());
  previewDialog.addEventListener('close', () => document.body.classList.remove('manager-preview-open'));
  previewDialog.addEventListener('click', (event) => { if (event.target === previewDialog) previewDialog.close(); });
  previewInstruments.addEventListener('click', (event) => {
    const button = event.target.closest('.manager-preview-instrument-button');
    if (button) togglePreviewInstrument(button.dataset.instrument);
  });
  previewPages.addEventListener('scroll', updatePreviewScorePosition, { passive: true });
  document.getElementById('manager-score-previous').addEventListener('click', () => movePreviewScore(-1));
  document.getElementById('manager-score-next').addEventListener('click', () => movePreviewScore(1));
  document.getElementById('close-manager-score-image').addEventListener('click', () => managerScoreImageDialog.close());
  managerScoreImageDialog.addEventListener('click', (event) => { if (event.target === managerScoreImageDialog) managerScoreImageDialog.close(); });
  managerSearch.addEventListener('input', renderSavedSongs);
  renderManagerCategoryFilters();
  cancelEditButton.addEventListener('click', resetEditor);
  if (!loadCachedSongs()) {
    managerListStatus.textContent = 'Tekan “Perbarui daftar” untuk mengambil lagu dari database.';
    renderSavedSongs();
  }
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    managerSearch.focus({ preventScroll: true });
  });
})();
