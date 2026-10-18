(() => {
  'use strict';

  // Gunakan URL deployment Web App yang sama dengan song-manager.
  const API_URL = 'https://script.google.com/macros/s/AKfycbw4MJSreur798HEPHFqY8jgUVLYC1b_Fs_UsGwAq0uXZqBboszAyhPKZNCTQqaWm4hZNQ/exec';
  const CACHE_KEY = 'song-book:songs:v1';
  const SCHEDULE_KEY = 'song-book:worship-schedules:v1';
  const SCHEDULE_INTRO_CACHE_KEY = 'song-book:schedule-intros:v1';
  const CATEGORIES = [
    { code: 'ALL', label: 'Semua' }, { code: 'PS', label: 'Psallo' },
    { code: 'NR', label: 'Nyanyian Rohani' }, { code: 'SP', label: 'Tambahan' },
    { code: 'ZR', label: 'Zangkoor' }, { code: 'KMR', label: 'Kaum Muda' },
    { code: 'SM', label: 'Sekolah Minggu' }, { code: 'OTH', label: 'Other' }
  ];
  const songList = document.getElementById('song-list');
  const status = document.getElementById('list-status');
  const count = document.getElementById('song-count');
  const syncStatus = document.getElementById('sync-status');
  const refreshButton = document.getElementById('refresh-button');
  const search = document.getElementById('search-input');
  const filters = document.getElementById('category-filters');
  const dialog = document.getElementById('song-dialog');
  const preview = document.getElementById('song-preview');
  const scheduleList = document.getElementById('schedule-list');
  const scheduleStatus = document.getElementById('schedule-status');
  const scheduleAddBar = document.getElementById('schedule-add-bar');
  const targetScheduleSelect = document.getElementById('target-schedule-select');
  const collectionResults = document.getElementById('collection-results');
  const collapseCollectionButton = document.getElementById('collapse-collection');
  const scheduleEditDialog = document.getElementById('schedule-edit-dialog');
  const scheduleEditForm = document.getElementById('schedule-edit-form');
  const scheduleContentInput = document.getElementById('schedule-content-input');
  const scheduleContentHighlight = document.getElementById('schedule-content-highlight');
  const scheduleViewDialog = document.getElementById('schedule-view-dialog');
  const scheduleViewList = document.getElementById('schedule-view-list');
  const scheduleIntroDialog = document.getElementById('schedule-intro-dialog');
  const scheduleIntroForm = document.getElementById('schedule-intro-form');
  const removeScheduleIntroDialog = document.getElementById('remove-schedule-intro-dialog');
  const removeScheduleIntroMessage = document.getElementById('remove-schedule-intro-message');
  const deleteScheduleDialog = document.getElementById('delete-schedule-dialog');
  const deleteScheduleMessage = document.getElementById('delete-schedule-message');
  const scheduleIntroNameButton = document.getElementById('schedule-intro-name-button');
  const removeScheduleIntroButton = document.getElementById('remove-schedule-intro');
  const scheduleIntroActionsGroup = document.getElementById('schedule-intro-actions-group');
  const chordModeSelect = document.getElementById('chord-mode');
  const transposeControls = document.getElementById('transpose-controls');
  const transposeKeySelect = document.getElementById('transpose-key');
  const scoreSection = document.getElementById('score-section');
  const closeScorePreviewButton = document.getElementById('close-score-preview');
  const scoreInstruments = document.getElementById('score-instruments');
  const scorePages = document.getElementById('score-pages');
  const scoreCarouselControls = document.getElementById('score-carousel-controls');
  const scoreImageDialog = document.getElementById('score-image-dialog');
  const fullScoreImage = document.getElementById('score-image-full');
  const scoreImagePrevious = document.getElementById('score-image-previous');
  const scoreImageNext = document.getElementById('score-image-next');
  const scoreImageInstruments = document.getElementById('score-image-instruments');
  const scoreImagePosition = document.getElementById('score-image-position');
  const scoreIntroBackButton = document.getElementById('score-intro-back-button');
  const scorePreviousGeneralSongButton = document.getElementById('score-previous-general-song-button');
  const scoreGeneralSongPosition = document.getElementById('score-general-song-position');
  const scoreNextGeneralSongButton = document.getElementById('score-next-general-song-button');
  const scoreNextGeneralSongLabel = document.getElementById('score-next-general-song-label');
  let songs = [];
  let activeCategory = 'ALL';
  let currentSongIndex = -1;
  let currentPreviewSongs = [];
  let currentPreviewSong = null;
  let previewZoom = 1;
  let pinchStart = null;
  let sourcePreviewKey = 'C';
  let selectedPreviewKey = 'C';
  let callbackCounter = 0;
  let cacheAvailable = false;
  let isLoadingSongs = false;
  let schedules = [];
  let activeScheduleId = '';
  let draggedRow = null;
  let dragPointerId = null;
  let isCollectionCollapsed = false;
  let editingEntry = null;
  let viewedScheduleId = '';
  let scheduleIntroRequestId = 0;
  let introGeneralNavigationActive = false;
  let introGeneralSongIndex = -1;
  let scheduleIntros = readScheduleIntroCache();
  const songSectionPattern = /^(?:(?:\d+[.)]?\s*)?)(intro|opening|bait|verse|stanza|reff|refrain|chorus|pre[ -]?(?:reff|chorus)|post[ -]?(?:reff|chorus)|bridge|intermezzo|itermezzo|interlude|instrumental|music|musik|solo|coda|outro|ending|tag|vamp|reprise)(?:\s+(?:ke[- ]?)?\d+)?$/i;
  let activeScoreFiles = [];
  let activeScoreInstrument = '';
  let activeScoreIndex = 0;
  let scoreImageMode = 'score';
  let activeScheduleIntro = null;
  let scoreImageReturnTarget = 'lyrics';
  let scoreControlsHideTimer = 0;
  let scoreSwipeStart = null;
  let resolveIntroRemovalConfirmation = null;
  let pendingScheduleDeletionId = '';
  const shareDialog = document.getElementById('schedule-share-dialog');
  const pullDialog = document.getElementById('schedule-pull-dialog');
  let shareTimer = 0;
  let shareExpiresAt = 0;

  function setStatus(message) { status.textContent = message; }
  function setSyncStatus(message) { syncStatus.textContent = message; }
  function formatTempo(value) {
    const tempo = String(value == null ? '' : value).trim().replace(/\s*BPM\s*$/i, '').trim();
    if (!tempo) return '';
    return /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(tempo) ? `${tempo} BPM` : tempo;
  }
  function normalize(value) { return String(value || '').toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function escapeText(value) {
    const span = document.createElement('span');
    span.textContent = String(value == null ? '' : value);
    return span.innerHTML;
  }

  function loadSongs() {
    if (isLoadingSongs) return;
    isLoadingSongs = true;
    setSyncStatus('Mengambil data terbaru dari database...');
    refreshButton.disabled = true;
    refreshButton.classList.add('is-loading');
    const callbackName = `cb_${Date.now()}_${++callbackCounter}`;
    const script = document.createElement('script');
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error('Waktu koneksi habis. Periksa URL API dan deployment Apps Script.')), 20000);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      isLoadingSongs = false;
      window.clearTimeout(timeout);
      refreshButton.disabled = false;
      refreshButton.classList.remove('is-loading');
      delete window.SongBookCallbacks[callbackName];
      script.remove();
      if (error) {
        setSyncStatus(cacheAvailable ? 'Tidak tersambung · menampilkan data lokal terakhir' : 'Gagal memperbarui data');
        if (!cacheAvailable) setStatus(error.message || 'Gagal memuat daftar lagu.');
        return;
      }
      if (!result || !result.ok) {
        setSyncStatus(cacheAvailable ? 'Pembaruan gagal · menampilkan data lokal terakhir' : 'Gagal memperbarui data');
        if (!cacheAvailable) setStatus((result && result.error) || 'Apps Script gagal mengirim daftar lagu.');
        return;
      }
      songs = Array.isArray(result.songs) ? result.songs : [];
      songs.sort(compareSongs);
      const updatedAt = new Date().toISOString();
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ updatedAt, songs }));
        cacheAvailable = true;
        setSyncStatus(`Update terakhir: ${formatUpdatedAt(updatedAt)}`);
      } catch (storageError) {
        setSyncStatus('Data terbaru dimuat · penyimpanan lokal tidak tersedia');
      }
      count.textContent = String(songs.length);
      buildFilters();
      renderList();
      renderSchedules();
    }

    window.SongBookCallbacks = window.SongBookCallbacks || {};
    window.SongBookCallbacks[callbackName] = (result) => finish(null, result);
    script.onerror = () => finish(new Error('Tidak dapat mengakses API Apps Script. Periksa akses deployment dan URL /exec.'));
    const url = new URL(API_URL);
    url.searchParams.set('action', 'songs');
    url.searchParams.set('callback', `SongBookCallbacks.${callbackName}`);
    script.src = url.toString();
    document.head.append(script);
  }

  function loadCachedSongs() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (!cached || !Array.isArray(cached.songs)) return;
      songs = cached.songs;
      songs.sort(compareSongs);
      cacheAvailable = true;
      count.textContent = String(songs.length);
      setSyncStatus(`Update terakhir: ${formatUpdatedAt(cached.updatedAt)}`);
      buildFilters();
      renderList();
      renderSchedules();
      return true;
    } catch (error) {
      cacheAvailable = false;
    }
    return false;
  }

  function formatUpdatedAt(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'waktu tidak diketahui';
    const parts = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).reduce((result, part) => { result[part.type] = part.value; return result; }, {});
    return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year} ${parts.hour}.${parts.minute}`;
  }

  function formatWorshipDate(value) {
    if (!value) return '';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    const parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
    }).formatToParts(date).reduce((result, part) => {
      result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
  }

  function readScheduleIntroCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(SCHEDULE_INTRO_CACHE_KEY) || '{}');
      return cached && typeof cached === 'object' && !Array.isArray(cached) ? cached : {};
    } catch (error) { return {}; }
  }

  function persistScheduleIntroCache() {
    try { localStorage.setItem(SCHEDULE_INTRO_CACHE_KEY, JSON.stringify(scheduleIntros)); }
    catch (error) { console.warn('Cache intro jadwal tidak dapat disimpan:', error); }
  }

  function loadSchedules() {
    try {
      const saved = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '[]');
      schedules = Array.isArray(saved) ? saved.filter((item) => item && typeof item.id === 'string').map((item) => ({
        id: item.id,
        title: String(item.title || 'Ibadah Baru'),
        date: String(item.date || ''),
        isOpen: Boolean(item.isOpen),
        sharedIntro: item.sharedIntro && typeof item.sharedIntro === 'object' ? item.sharedIntro : null,
        songs: Array.isArray(item.songs) ? item.songs.filter((song) => song && typeof song.id === 'string').map((song, index) => ({ ...song, entryId: String(song.entryId || `entry_legacy_${item.id}_${index}`), contentHtml: String(song.contentHtml || ''), overrides: song.overrides && typeof song.overrides === 'object' ? song.overrides : {} })) : []
      })) : [];
    } catch (error) {
      schedules = [];
    }
  }

  function saveSchedules() {
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedules));
      scheduleStatus.textContent = schedules.length ? `${schedules.length} jadwal tersimpan di perangkat ini.` : 'Jadwal tersimpan di perangkat ini.';
      return true;
    } catch (error) {
      scheduleStatus.textContent = 'Jadwal tidak dapat disimpan. Penyimpanan browser mungkin penuh atau dinonaktifkan.';
      return false;
    }
  }

  function todayString() {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function callScheduleApi(action, params) {
    return new Promise((resolve, reject) => {
      const callbackName = `cb_${Date.now()}_${++callbackCounter}`;
      const script = document.createElement('script');
      const timeout = window.setTimeout(() => finish(new Error('Koneksi ke server habis.')), 20000);
      let settled = false;
      function finish(error, result) {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        delete window.SongBookCallbacks[callbackName];
        script.remove();
        if (error) reject(error); else if (!result || !result.ok) reject(new Error((result && result.error) || 'Permintaan gagal.')); else resolve(result);
      }
      window.SongBookCallbacks = window.SongBookCallbacks || {};
      window.SongBookCallbacks[callbackName] = (result) => finish(null, result);
      script.onerror = () => finish(new Error('Tidak dapat mengakses API Apps Script.'));
      const url = new URL(API_URL);
      url.searchParams.set('action', action);
      url.searchParams.set('callback', `SongBookCallbacks.${callbackName}`);
      Object.entries(params || {}).forEach(([key, value]) => url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value)));
      script.src = url.toString();
      document.head.append(script);
    });
  }

  function postScheduleApi(action, data) {
    return new Promise((resolve, reject) => {
      const nonce = `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const frame = document.createElement('iframe');
      frame.name = `schedule_share_${nonce}`;
      frame.hidden = true;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = API_URL;
      form.target = frame.name;
      form.hidden = true;
      const input = document.createElement('input');
      input.name = 'payload';
      input.value = JSON.stringify({ action, requestNonce: nonce, ...data });
      form.append(input);
      const timeout = window.setTimeout(() => finish(new Error('Koneksi ke server habis.')), 25000);
      function onMessage(event) {
        const reply = event.data;
        if (!reply || reply.nonce !== nonce) return;
        window.removeEventListener('message', onMessage);
        finish(reply.ok ? null : new Error(reply.error || 'Permintaan gagal.'), reply.result);
      }
      function finish(error, result) {
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        form.remove();
        frame.remove();
        if (error) reject(error); else resolve(result);
      }
      window.addEventListener('message', onMessage);
      document.body.append(frame, form);
      form.submit();
    });
  }

  function fillShareSchedules() {
    const select = document.getElementById('share-schedule-select');
    const options = document.getElementById('share-schedule-options');
    const label = document.getElementById('share-schedule-picker-label');
    const previousId = select.value;
    select.replaceChildren();
    options.replaceChildren();
    schedules.forEach((schedule) => {
      const option = document.createElement('option');
      option.value = schedule.id;
      option.textContent = `${schedule.title || 'Jadwal ibadah'}${schedule.date ? ` · ${formatWorshipDate(schedule.date)}` : ''}`;
      select.append(option);
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'share-schedule-option';
      choice.setAttribute('role', 'option');
      choice.dataset.scheduleId = schedule.id;
      choice.textContent = option.textContent;
      options.append(choice);
    });
    if (schedules.length) {
      select.value = schedules.some((schedule) => schedule.id === previousId) ? previousId : schedules[0].id;
      const selected = schedules.find((schedule) => schedule.id === select.value);
      label.textContent = `${selected.title || 'Jadwal ibadah'}${selected.date ? ` · ${selected.date}` : ''}`;
      options.querySelector(`[data-schedule-id="${select.value}"]`)?.setAttribute('aria-selected', 'true');
    } else label.textContent = 'Belum ada jadwal';
    document.getElementById('share-schedule-submit').disabled = !schedules.length;
  }

  function updateShareCountdown() {
    const remaining = Math.max(0, Math.ceil((shareExpiresAt - Date.now()) / 1000));
    document.getElementById('share-countdown').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    if (!remaining) stopSharing(true);
  }

  async function stopSharing(expired) {
    window.clearInterval(shareTimer);
    shareTimer = 0;
    const code = document.getElementById('share-code').textContent;
    if (code) {
      try { await callScheduleApi('stopScheduleShare', { code }); } catch (error) { console.warn(error); }
    }
    document.getElementById('share-result').hidden = true;
    document.getElementById('share-status').textContent = expired ? 'Waktu berbagi habis. Data sementara telah dihapus.' : 'Berbagi dihentikan dan data sementara telah dihapus.';
  }

  async function shareSelectedSchedule() {
    const schedule = schedules.find((item) => item.id === document.getElementById('share-schedule-select').value);
    if (!schedule) return;
    const button = document.getElementById('share-schedule-submit');
    button.disabled = true;
    document.getElementById('share-status').textContent = 'Mengirim jadwal…';
    try {
      let intro = schedule.sharedIntro || (Object.prototype.hasOwnProperty.call(scheduleIntros, schedule.id) ? scheduleIntros[schedule.id] : undefined);
      if (intro === undefined) {
        const introResult = await callScheduleApi('getScheduleIntro', { scheduleId: schedule.id });
        intro = introResult.intro || null;
        scheduleIntros[schedule.id] = intro;
        persistScheduleIntroCache();
      }
      const result = await postScheduleApi('shareSchedule', { schedule: { ...schedule, intro: intro || null } });
      document.getElementById('share-code').textContent = result.code;
      document.getElementById('share-result').hidden = false;
      document.getElementById('share-status').textContent = 'Bagikan kode ini kepada penerima.';
      shareExpiresAt = Number(result.expiresAt);
      window.clearInterval(shareTimer);
      updateShareCountdown();
      shareTimer = window.setInterval(updateShareCountdown, 1000);
    } catch (error) {
      document.getElementById('share-status').textContent = error.message;
    } finally { button.disabled = false; }
  }

  async function pullSharedSchedule() {
    const code = document.getElementById('pull-schedule-code').value.trim().toUpperCase();
    const statusEl = document.getElementById('pull-status');
    if (!/^[A-Z0-9]{3}$/.test(code)) { statusEl.textContent = 'Masukkan kode 3 karakter yang valid.'; return; }
    const button = document.getElementById('pull-schedule-submit');
    button.disabled = true;
    statusEl.textContent = 'Mengambil jadwal…';
    try {
      const result = await callScheduleApi('pullSchedule', { code });
      const received = result.schedule;
      const imported = { ...received, id: `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, title: `${received.title || 'Jadwal ibadah'} (salinan)`, sharedIntro: received.intro && typeof received.intro === 'object' ? received.intro : null, songs: Array.isArray(received.songs) ? received.songs.map((song, index) => ({ ...song, entryId: `entry_${Date.now()}_${index}`, overrides: song.overrides && typeof song.overrides === 'object' ? song.overrides : {} })) : [] };
      schedules.unshift(imported);
      activeScheduleId = imported.id;
      saveSchedules();
      renderSchedules();
      renderList();
      document.getElementById('pull-schedule-code').value = '';
      pullDialog.close();
      highlightNewSchedule(imported.id);
    } catch (error) { statusEl.textContent = error.message; }
    finally { button.disabled = false; }
  }

  function renderSchedules() {
    renderScheduleTargets();
    scheduleList.replaceChildren();
    if (!schedules.length) {
      const empty = document.createElement('div');
      empty.className = 'schedule-empty';
      empty.textContent = 'Belum ada jadwal. Buat jadwal untuk mulai menyusun lagu ibadah.';
      scheduleList.append(empty);
      scheduleStatus.textContent = 'Jadwal disimpan hanya di browser/perangkat ini.';
      return;
    }

    const fragment = document.createDocumentFragment();
    schedules.forEach((schedule) => {
      const card = document.createElement('article');
      card.className = 'schedule-card';
      card.dataset.scheduleId = schedule.id;
      card.innerHTML = `
        <div class="schedule-card-header">
          <label class="schedule-field">NAMA JADWAL<input class="schedule-title-input" data-field="title" type="text" maxlength="80" value="${escapeText(schedule.title)}" placeholder="Contoh: Ibadah Minggu Pagi"></label>
          <label class="schedule-field">TANGGAL<span class="schedule-date-control"><span class="schedule-date-display">${escapeText(formatWorshipDate(schedule.date) || 'Pilih tanggal')}</span><input data-field="date" type="date" value="${escapeText(schedule.date)}" aria-label="Tanggal ibadah"></span></label>
          <button class="schedule-view-button" type="button" data-action="view-schedule">Lihat jadwal</button>
        </div>`;
      fragment.append(card);
    });
    scheduleList.append(fragment);
    scheduleStatus.textContent = `${schedules.length} jadwal tersimpan di perangkat ini.`;
  }

  function renderScheduleView(scheduleId) {
    const schedule = schedules.find((item) => item.id === scheduleId);
    if (!schedule) return;
    viewedScheduleId = schedule.id;
    document.getElementById('schedule-view-title').textContent = schedule.title || 'Jadwal ibadah';
    document.getElementById('schedule-view-date').textContent = schedule.date
      ? formatWorshipDate(schedule.date)
      : 'Tanggal belum ditentukan';
    document.getElementById('refresh-schedule-songs-status').textContent = '';
    loadScheduleIntro(schedule.id);
    const list = document.getElementById('schedule-view-list');
    const rows = schedule.songs.map((entry, index) => {
      const song = getEffectiveScheduledSong(entry);
      return `<li class="schedule-song-row${entry.preWorship ? ' is-pre-worship' : ''}" data-entry-id="${escapeText(entry.entryId)}">
        <button type="button" class="schedule-drag-handle" aria-label="Seret untuk mengurutkan lagu" title="Seret untuk mengatur urutan">&#8942;</button>
        <span class="schedule-song-order">${index + 1}</span>
        <button type="button" class="schedule-song-name" data-action="preview-song" title="Buka preview">${escapeText(song.category)} ${escapeText(song.number)} - ${escapeText(song.title)}</button>
        <span class="schedule-song-actions">
          <label class="pre-worship-toggle"><input type="checkbox" data-action="toggle-pre-worship" data-entry-id="${escapeText(entry.entryId)}" ${entry.preWorship ? 'checked' : ''}><span>Pra-ibadah</span></label>
          <button type="button" data-action="move-up" data-entry-id="${escapeText(entry.entryId)}" aria-label="Pindahkan lagu ke atas" ${index === 0 ? 'disabled' : ''}>&#8593;</button>
          <button type="button" data-action="move-down" data-entry-id="${escapeText(entry.entryId)}" aria-label="Pindahkan lagu ke bawah" ${index === schedule.songs.length - 1 ? 'disabled' : ''}>&#8595;</button>
          <button type="button" data-action="edit-song" data-entry-id="${escapeText(entry.entryId)}" aria-label="Edit lagu di jadwal">&#9998;</button>
          <button type="button" class="remove-scheduled-song" data-action="remove-song" data-entry-id="${escapeText(entry.entryId)}" aria-label="Hapus lagu dari jadwal">&#215;</button>
        </span>
      </li>`;
    }).join('');
    list.innerHTML = `<article class="schedule-card" data-schedule-id="${escapeText(schedule.id)}">${schedule.songs.length
      ? `<ol class="schedule-song-list">${rows}</ol>`
      : '<p class="schedule-no-songs">Belum ada lagu di jadwal ini. Tambahkan lagu dari koleksi menggunakan tombol +.</p>'}</article>`;
  }

  function refreshViewedScheduleSongsFromLibrary() {
    const schedule = schedules.find((item) => item.id === viewedScheduleId);
    const status = document.getElementById('refresh-schedule-songs-status');
    if (!schedule) return;
    let updatedCount = 0;
    let missingCount = 0;
    schedule.songs.forEach((entry) => {
      const latestSong = songs.find((song) => String(song.id) === String(entry.id));
      if (!latestSong) {
        missingCount += 1;
        return;
      }
      const entryId = entry.entryId;
      const preWorship = Boolean(entry.preWorship);
      Object.assign(entry, createScheduledEntry(latestSong), { entryId, preWorship, overrides: {} });
      updatedCount += 1;
    });
    if (!updatedCount) {
      status.textContent = missingCount ? 'Tidak ada lagu jadwal yang cocok dengan data lokal.' : 'Jadwal ini belum memiliki lagu.';
      return;
    }
    saveSchedules();
    renderSchedules();
    renderScheduleView(schedule.id);
    status.textContent = `${updatedCount} lagu diperbarui dari data lokal${missingCount ? ` · ${missingCount} lagu tidak ditemukan` : ''}.`;
  }

  async function loadScheduleIntro(scheduleId) {
    const requestId = ++scheduleIntroRequestId;
    const schedule = schedules.find((item) => item.id === scheduleId);
    if (schedule && schedule.sharedIntro) {
      scheduleIntros[scheduleId] = schedule.sharedIntro;
      showScheduleIntro(schedule.sharedIntro);
      return;
    }
    const hasCachedIntro = Object.prototype.hasOwnProperty.call(scheduleIntros, scheduleId);
    const cachedIntro = hasCachedIntro ? scheduleIntros[scheduleId] : null;
    showScheduleIntro(cachedIntro);
    try {
      const result = await callScheduleApi('getScheduleIntro', { scheduleId });
      if (requestId !== scheduleIntroRequestId || viewedScheduleId !== scheduleId) return;
      scheduleIntros[scheduleId] = result.intro || null;
      persistScheduleIntroCache();
      showScheduleIntro(result.intro || null);
    } catch (error) {
      console.warn('Intro jadwal tidak dapat dimuat:', error);
    }
  }

  function showScheduleIntro(intro) {
    if (!intro) {
      scheduleIntroActionsGroup.hidden = true;
      scheduleIntroNameButton.textContent = '';
      return;
    }
    scheduleIntroNameButton.textContent = intro.name || 'Intro';
    scheduleIntroNameButton.setAttribute('aria-label', `Buka gambar intro ${intro.name || ''}`);
    scheduleIntroActionsGroup.hidden = false;
  }

  function openScheduleIntroForm() {
    document.getElementById('schedule-intro-file').value = '';
    document.getElementById('schedule-intro-status').textContent = '';
    if (!scheduleIntroDialog.open) scheduleIntroDialog.showModal();
  }

  function openScheduleIntroImage(intro, fromActiveSong = false, scheduleContext = null) {
    if (!intro || !intro.url) return;
    if (scheduleContext) {
      const activeEntryId = currentPreviewSong && currentPreviewSong.entryId;
      currentPreviewSongs = scheduleContext.songs.map((item) => ({
        ...getEffectiveScheduledSong(item),
        preWorship: Boolean(item.preWorship),
        scheduleIntro: intro
      }));
      const activeIndex = activeEntryId
        ? currentPreviewSongs.findIndex((song) => song.entryId === activeEntryId && findDefaultScoreInstrument(song))
        : -1;
      const firstScoreIndex = currentPreviewSongs.findIndex((song) => findDefaultScoreInstrument(song));
      currentSongIndex = activeIndex >= 0
        ? activeIndex
        : firstScoreIndex >= 0 ? firstScoreIndex : (currentPreviewSongs.length ? 0 : -1);
      currentPreviewSong = currentPreviewSongs[currentSongIndex] || null;
      introGeneralSongIndex = currentSongIndex;
      introGeneralNavigationActive = Boolean(findDefaultScoreInstrument(currentPreviewSong));
      scoreImageReturnTarget = 'schedule';
    } else {
      if (fromActiveSong) {
        introGeneralSongIndex = currentSongIndex;
        introGeneralNavigationActive = Boolean(findDefaultScoreInstrument(currentPreviewSong));
      }
      scoreImageReturnTarget = fromActiveSong ? 'lyrics' : 'schedule';
    }
    showScheduleIntroInScoreViewer(intro);
  }

  function showScheduleIntroInScoreViewer(intro) {
    if (!intro || !intro.url) return;
    activeScheduleIntro = intro;
    scoreImageMode = 'intro';
    activeScoreInstrument = 'Intro';
    activeScoreFiles = [{ id: intro.fileId, url: intro.url }];
    activeScoreIndex = 0;
    scoreImageInstruments.hidden = true;
    const closeLabel = document.querySelector('#close-score-image span');
    const returnLabel = scoreImageReturnTarget === 'schedule' ? 'Kembali ke jadwal' : 'Kembali ke lirik';
    if (closeLabel) closeLabel.textContent = returnLabel;
    document.getElementById('close-score-image').setAttribute('aria-label', `Tutup gambar dan ${returnLabel.toLowerCase()}`);
    if (!scoreImageDialog.open) scoreImageDialog.showModal();
    renderFullScoreImage();
    showScoreImageControls();
  }

  async function saveScheduleIntro(event) {
    event.preventDefault();
    const schedule = schedules.find((item) => item.id === viewedScheduleId);
    const name = 'Intro';
    const file = document.getElementById('schedule-intro-file').files[0];
    const statusEl = document.getElementById('schedule-intro-status');
    if (!schedule || !file) { statusEl.textContent = 'Pilih gambar intro.'; return; }
    if (!file.type.startsWith('image/')) { statusEl.textContent = 'Pilih file gambar yang valid.'; return; }
    if (file.size > 8 * 1024 * 1024) { statusEl.textContent = 'Ukuran gambar maksimal 8 MB.'; return; }
    const submit = document.getElementById('save-schedule-intro');
    submit.disabled = true;
    statusEl.textContent = 'Upload gambar…';
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1] || '';
      const result = await postScheduleApi('saveScheduleIntro', { intro: {
        scheduleId: schedule.id, name,
        scheduleName: schedule.title || 'Jadwal ibadah', scheduleDate: schedule.date || 'Tanpa tanggal',
        image: { originalName: file.name, mimeType: file.type, base64 }
      } });
      scheduleIntros[schedule.id] = result;
      schedule.sharedIntro = null;
      persistScheduleIntroCache();
      saveSchedules();
      scheduleIntroDialog.close();
      await loadScheduleIntro(schedule.id);
    } catch (error) {
      statusEl.textContent = error.message || 'Intro gagal disimpan.';
    } finally { submit.disabled = false; }
  }

  async function removeScheduleIntro() {
    const scheduleId = viewedScheduleId;
    const intro = scheduleIntros[scheduleId];
    if (!scheduleId || !intro) return;
    const schedule = schedules.find((item) => item.id === scheduleId);
    const removesSharedCopy = Boolean(schedule && schedule.sharedIntro);
    removeScheduleIntroMessage.textContent = `Hapus semua data "${intro.name}"?`;
    const confirmed = await new Promise((resolve) => {
      resolveIntroRemovalConfirmation = resolve;
      removeScheduleIntroDialog.showModal();
    });
    if (!confirmed) return;
    removeScheduleIntroButton.disabled = true;
    try {
      if (removesSharedCopy) {
        schedule.sharedIntro = null;
        saveSchedules();
      } else {
        await postScheduleApi('deleteScheduleIntro', { scheduleId });
      }
      delete scheduleIntros[scheduleId];
      persistScheduleIntroCache();
      scheduleIntroActionsGroup.hidden = true;
      if (scoreImageDialog.open && scoreImageMode === 'intro') scoreImageDialog.close();
      scheduleStatus.textContent = 'Intro berhasil dihapus.';
    } catch (error) {
      scheduleStatus.textContent = error.message || 'Intro gagal dihapus.';
    } finally {
      removeScheduleIntroButton.disabled = false;
    }
  }

  function finishIntroRemovalConfirmation(confirmed) {
    const resolve = resolveIntroRemovalConfirmation;
    resolveIntroRemovalConfirmation = null;
    if (removeScheduleIntroDialog.open) removeScheduleIntroDialog.close();
    if (resolve) resolve(confirmed);
  }

  function confirmScheduleDeletion(schedule) {
    if (!schedule) return;
    const title = schedule.title || 'Jadwal ibadah';
    const date = schedule.date ? formatWorshipDate(schedule.date) : 'tanpa tanggal';
    pendingScheduleDeletionId = schedule.id;
    deleteScheduleMessage.textContent = `Hapus jadwal "${title}" tanggal ${date}?`;
    deleteScheduleDialog.showModal();
  }

  function finishScheduleDeletion(confirmed) {
    const scheduleId = pendingScheduleDeletionId;
    pendingScheduleDeletionId = '';
    if (deleteScheduleDialog.open) deleteScheduleDialog.close();
    if (!confirmed || !scheduleId) return;
    schedules = schedules.filter((schedule) => schedule.id !== scheduleId);
    saveSchedules();
    renderSchedules();
    renderList();
    if (viewedScheduleId === scheduleId && scheduleViewDialog.open) scheduleViewDialog.close();
  }

  function renderScheduleTargets() {
    scheduleAddBar.hidden = schedules.length === 0;
    const previousId = activeScheduleId;
    targetScheduleSelect.replaceChildren();
    schedules.forEach((schedule) => {
      const option = document.createElement('option');
      option.value = schedule.id;
      option.textContent = schedule.title || 'Jadwal tanpa nama';
      targetScheduleSelect.append(option);
    });
    if (!schedules.some((schedule) => schedule.id === previousId)) activeScheduleId = schedules[0] ? schedules[0].id : '';
    targetScheduleSelect.value = activeScheduleId;
  }

  function addSchedule() {
    const date = todayString();
    const schedule = { id: `schedule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, title: 'Ibadah Baru', date, songs: [] };
    schedules.unshift(schedule);
    activeScheduleId = schedule.id;
    saveSchedules();
    renderSchedules();
    renderList();
    highlightNewSchedule(schedule.id);
    const titleInput = scheduleList.querySelector('.schedule-card:first-child .schedule-title-input');
    if (titleInput) { titleInput.focus(); titleInput.select(); }
  }

  function highlightNewSchedule(scheduleId) {
    const card = scheduleList.querySelector(`[data-schedule-id="${scheduleId}"]`);
    if (!card) return;
    card.classList.add('schedule-just-imported');
    window.setTimeout(() => card.classList.remove('schedule-just-imported'), 7000);
  }

  function addSongToSchedule(songId) {
    const schedule = schedules.find((item) => item.id === activeScheduleId);
    const song = songs.find((item) => item.id === songId);
    if (!schedule || !song) return;
    schedule.songs.push(createScheduledEntry(song));
    schedule.isOpen = true;
    saveSchedules();
    renderSchedules();
    scheduleStatus.textContent = `${song.title} ditambahkan ke "${schedule.title || 'Jadwal tanpa nama'}".`;
  }

  function handleCollectionClick(event) {
    const addButton = event.target.closest('[data-add-song]');
    if (!addButton) return;
    event.preventDefault();
    event.stopPropagation();
    addSongToSchedule(addButton.dataset.addSong);
  }

  function createScheduledEntry(song) {
    return {
      entryId: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      id: song.id,
      category: song.category,
      number: song.number,
      title: song.title,
      key: song.key || '',
      genre: song.genre || '',
      songCreator: song.songCreator || '',
      dateCreate: song.dateCreate || '',
      tempo: song.tempo || '',
      contentHtml: song.contentHtml || '',
      images: song.images && typeof song.images === 'object' ? song.images : {},
      overrides: {}
    };
  }

  function getEffectiveScheduledSong(entry) {
    // Entries created before local snapshots only contain a spreadsheet song ID.
    // Use the cached library record as their base, then apply the schedule copy.
    const sourceSong = songs.find((song) => song.id === entry.id) || {};
    return { ...sourceSong, ...entry, ...(entry.overrides || {}) };
  }

  function handleScheduleClick(event) {
    const preWorshipCheckbox = event.target.closest('input[data-action="toggle-pre-worship"]');
    const button = event.target.closest('button[data-action]');
    const card = event.target.closest('.schedule-card');
    if (!card) return;
    const scheduleIndex = schedules.findIndex((item) => item.id === card.dataset.scheduleId);
    if (scheduleIndex < 0) return;
    const schedule = schedules[scheduleIndex];
    if (preWorshipCheckbox) {
      const entry = schedule.songs.find((item) => item.entryId === preWorshipCheckbox.dataset.entryId);
      if (!entry) return;
      entry.preWorship = preWorshipCheckbox.checked;
      preWorshipCheckbox.closest('.schedule-song-row')?.classList.toggle('is-pre-worship', entry.preWorship);
      saveSchedules();
      return;
    }
    const action = button ? button.dataset.action : '';

    if (action === 'view-schedule') {
      renderScheduleView(schedule.id);
      if (!scheduleViewDialog.open) {
        scheduleViewDialog.showModal();
        document.body.classList.add('schedule-view-open');
      }
      return;
    } else if (action === 'delete-schedule') {
      confirmScheduleDeletion(schedule);
      return;
    } else if (action === 'edit-song') {
      openScheduleSongEditor(schedule.id, button.dataset.entryId);
      return;
    } else if (action === 'preview-song') {
      const row = button.closest('.schedule-song-row');
      const entry = schedule.songs.find((item) => item.entryId === row.dataset.entryId);
      if (entry) openScheduledSong(schedule, entry);
      return;
    } else if (action === 'remove-song' || action === 'move-up' || action === 'move-down') {
      const index = schedule.songs.findIndex((item) => item.entryId === button.dataset.entryId);
      if (index < 0) return;
      if (action === 'remove-song') schedule.songs.splice(index, 1);
      if (action === 'move-up' && index > 0) [schedule.songs[index - 1], schedule.songs[index]] = [schedule.songs[index], schedule.songs[index - 1]];
      if (action === 'move-down' && index < schedule.songs.length - 1) [schedule.songs[index + 1], schedule.songs[index]] = [schedule.songs[index], schedule.songs[index + 1]];
    } else {
      return;
    }
    saveSchedules();
    renderSchedules();
    if (scheduleViewDialog.open) {
      if (schedules.some((item) => item.id === viewedScheduleId)) renderScheduleView(viewedScheduleId);
      else scheduleViewDialog.close();
    }
    renderList();
  }

  function handleScheduleRowClick(event) {
    if (event.target.closest('button, input, label')) return;
    const row = event.target.closest('.schedule-song-row');
    const card = row && row.closest('.schedule-card');
    if (!row || !card) return;
    const schedule = schedules.find((item) => item.id === card.dataset.scheduleId);
    const entry = schedule && schedule.songs.find((item) => item.entryId === row.dataset.entryId);
    if (entry) openScheduledSong(schedule, entry);
  }

  async function openScheduledSong(schedule, entry) {
    let intro = schedule.sharedIntro || (Object.prototype.hasOwnProperty.call(scheduleIntros, schedule.id) ? scheduleIntros[schedule.id] : undefined);
    if (intro === undefined) {
      try {
        const result = await callScheduleApi('getScheduleIntro', { scheduleId: schedule.id });
        intro = result.intro || null;
        scheduleIntros[schedule.id] = intro;
        persistScheduleIntroCache();
      } catch (error) { console.warn('Intro jadwal tidak dapat dimuat:', error); }
    }
    const queue = schedule.songs.map((item) => ({ ...getEffectiveScheduledSong(item), preWorship: Boolean(item.preWorship), scheduleIntro: intro }));
    const index = schedule.songs.findIndex((item) => item.entryId === entry.entryId);
    if (index >= 0) openSong(queue[index], queue, index);
  }

  function openScheduleSongEditor(scheduleId, entryId) {
    const schedule = schedules.find((item) => item.id === scheduleId);
    const entry = schedule && schedule.songs.find((item) => item.entryId === entryId);
    if (!entry) return;
    editingEntry = { scheduleId, entryId };
    const song = getEffectiveScheduledSong(entry);
    scheduleEditForm.elements.title.value = song.title || '';
    scheduleEditForm.elements.number.value = song.number || '';
    scheduleEditForm.elements.key.value = song.key || '';
    scheduleEditForm.elements.genre.value = song.genre || '';
    scheduleEditForm.elements.tempo.value = song.tempo || '';
    scheduleContentInput.value = htmlToEditableText(song.contentHtml || '');
    updateScheduleContentHighlight();
    scheduleEditDialog.showModal();
    scheduleEditForm.elements.title.focus();
  }

  function scheduleSectionLabel(line) {
    const trimmed = line.trim();
    const bracketed = trimmed.match(/^\[([^\]\n]{1,60})\]\s*:?[ \t]*$/) || trimmed.match(/^\{([^}\n]{1,60})\}\s*:?[ \t]*$/);
    if (bracketed) return bracketed[1].trim();
    const plain = trimmed.replace(/:$/, '').trim();
    return songSectionPattern.test(plain) ? plain.replace(/^\d+[.)]?\s*/, '') : '';
  }

  function updateScheduleContentHighlight() {
    const value = scheduleContentInput.value || '[Intro]\nG   D   Em\n\n[Bait 1]\nG       C\nLirik lagu\n\n[Reff]\nC   D   G';
    scheduleContentHighlight.classList.toggle('is-placeholder', !scheduleContentInput.value);
    scheduleContentHighlight.innerHTML = value.split('\n').map((line) => {
      return scheduleSectionLabel(line)
        ? `<span class="schedule-section-marker">${escapeText(line)}</span>`
        : escapeText(line);
    }).join('\n') + '\n';
    scheduleContentHighlight.style.transform = `translate(${-scheduleContentInput.scrollLeft}px, ${-scheduleContentInput.scrollTop}px)`;
  }

  function htmlToEditableText(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const sections = [...parsed.querySelectorAll('.song-section')];
    if (!sections.length) return parsed.body.textContent || '';
    return sections.map((section) => {
      const heading = section.dataset.section || section.querySelector('h3')?.textContent || '';
      const body = section.querySelector('.song-section-body') || section;
      return `${heading ? `[${heading}]\n` : ''}${textWithBreaks(body)}`.trimEnd();
    }).join('\n\n');
  }

  function textWithBreaks(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.tagName === 'BR') return '\n';
    return [...node.childNodes].map(textWithBreaks).join('');
  }

  function editableTextToHtml(text) {
    const sections = [];
    let current = { label: 'Lagu', lines: [] };
    String(text || '').split('\n').forEach((line) => {
      const sectionLabel = scheduleSectionLabel(line);
      if (sectionLabel) {
        if (current.lines.length || current.label !== 'Lagu' || sections.length) sections.push(current);
        current = { label: sectionLabel, lines: [] };
      } else {
        current.lines.push(line);
      }
    });
    if (current.lines.length || !sections.length) sections.push(current);
    return `<div class="song-content">${sections.map((section) => {
      const label = escapeText(section.label);
      const body = escapeText(section.lines.join('\n'));
      return `<section class="song-section" data-section="${label}"><h3 class="song-section-title">${label}</h3><div class="song-section-body">${body}</div></section>`;
    }).join('')}</div>`;
  }

  function saveScheduleSongEdit(event) {
    event.preventDefault();
    if (!scheduleEditForm.reportValidity() || !editingEntry) return;
    const schedule = schedules.find((item) => item.id === editingEntry.scheduleId);
    const entry = schedule && schedule.songs.find((item) => item.entryId === editingEntry.entryId);
    if (!entry) return;
    entry.overrides = {
      title: scheduleEditForm.elements.title.value.trim(),
      number: scheduleEditForm.elements.number.value.trim(),
      key: scheduleEditForm.elements.key.value.trim(),
      genre: scheduleEditForm.elements.genre.value.trim(),
      tempo: scheduleEditForm.elements.tempo.value.trim(),
      contentHtml: editableTextToHtml(scheduleContentInput.value)
    };
    saveSchedules();
    renderSchedules();
    if (scheduleViewDialog.open) renderScheduleView(editingEntry.scheduleId);
    scheduleEditDialog.close();
    editingEntry = null;
  }

  function handleScheduleDragStart(event) {
    const handle = event.target.closest('.schedule-drag-handle');
    if (!handle) return;
    const row = handle.closest('.schedule-song-row');
    if (!row) return;
    event.preventDefault();
    draggedRow = row;
    dragPointerId = event.pointerId;
    row.classList.add('is-dragging');
    try { handle.setPointerCapture(event.pointerId); } catch (ignored) {}
  }

  function handleScheduleDragMove(event) {
    if (!draggedRow || event.pointerId !== dragPointerId) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.schedule-song-row');
    if (!target || target === draggedRow || target.closest('.schedule-card') !== draggedRow.closest('.schedule-card')) return;
    const bounds = target.getBoundingClientRect();
    target.parentNode.insertBefore(draggedRow, event.clientY < bounds.top + bounds.height / 2 ? target : target.nextSibling);
  }

  function finishScheduleDrag(event) {
    if (!draggedRow || (event && event.pointerId !== dragPointerId)) return;
    const row = draggedRow;
    row.classList.remove('is-dragging');
    const card = row.closest('.schedule-card');
    const schedule = schedules.find((item) => item.id === card?.dataset.scheduleId);
    if (schedule) {
      const byId = new Map(schedule.songs.map((entry) => [entry.entryId, entry]));
      const ordered = [...card.querySelectorAll('.schedule-song-row')].map((item) => byId.get(item.dataset.entryId)).filter(Boolean);
      if (ordered.length === schedule.songs.length) schedule.songs = ordered;
      saveSchedules();
    }
    draggedRow = null;
    dragPointerId = null;
    renderSchedules();
    if (scheduleViewDialog.open) renderScheduleView(viewedScheduleId);
  }

  function setCollectionCollapsed(collapsed) {
    if (collapsed && search.value.trim()) return;
    isCollectionCollapsed = collapsed;
    collectionResults.hidden = collapsed;
    collapseCollectionButton.setAttribute('aria-expanded', String(!collapsed));
    collapseCollectionButton.title = collapsed ? 'Tampilkan koleksi' : 'Ciutkan koleksi';
    collapseCollectionButton.textContent = collapsed ? '\u2304' : '\u2303';
  }

  function handleSearchInput() {
    if (search.value.trim()) setCollectionCollapsed(false);
    renderList();
  }
  function handleScheduleInput(event) {
    const input = event.target.closest('input[data-field]');
    const card = event.target.closest('.schedule-card');
    if (!input || !card) return;
    const schedule = schedules.find((item) => item.id === card.dataset.scheduleId);
    if (!schedule) return;
    schedule[input.dataset.field] = input.value;
    if (input.dataset.field === 'date') {
      const display = input.closest('.schedule-date-control')?.querySelector('.schedule-date-display');
      if (display) display.textContent = formatWorshipDate(input.value) || 'Pilih tanggal';
    }
    saveSchedules();
    renderScheduleTargets();
  }

  function compareSongs(a, b) {
    const categoryOrder = CATEGORIES.findIndex((entry) => entry.code === a.category) - CATEGORIES.findIndex((entry) => entry.code === b.category);
    if (categoryOrder) return categoryOrder;
    const numberOrder = String(a.number || '').localeCompare(String(b.number || ''), 'id', { numeric: true, sensitivity: 'base' });
    return numberOrder || String(a.title || '').localeCompare(String(b.title || ''), 'id', { sensitivity: 'base' });
  }

  function buildFilters() {
    filters.replaceChildren();
    CATEGORIES.forEach(({ code, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-chip';
      button.textContent = label;
      button.setAttribute('aria-pressed', String(activeCategory === code));
      button.addEventListener('click', () => {
        activeCategory = code;
        buildFilters();
        renderList();
      });
      filters.append(button);
    });
  }

  function renderList() {
    const query = normalize(search.value.trim());
    const visible = songs.filter((song) => {
      if (activeCategory !== 'ALL' && song.category !== activeCategory) return false;
      if (!query) return true;
      return normalize([song.category, song.number, song.title, song.key, song.genre, song.songCreator, song.dateCreate, song.tempo, stripHtml(song.contentHtml)].join(' ')).includes(query);
    });
    songList.replaceChildren();
    if (!songs.length) {
      setStatus('Belum ada lagu di database. Tambahkan lagu melalui Song Manager.');
      return;
    }
    if (!visible.length) {
      setStatus('Tidak ada lagu yang cocok. Coba kata kunci atau kategori lain.');
      return;
    }
    setStatus('');
    const fragment = document.createDocumentFragment();
    visible.forEach((song) => {
      const card = document.createElement('article');
      card.className = 'song-card';
      const number = escapeText(song.number);
      const categoryLabel = CATEGORIES.find((entry) => entry.code === song.category);
      const extra = [song.genre, song.songCreator, song.dateCreate, formatTempo(song.tempo)].filter(Boolean).map(escapeText).join('<span aria-hidden="true">&#183;</span>');
      const openButton = document.createElement('button');
      openButton.type = 'button';
      openButton.className = 'song-card-main';
      openButton.setAttribute('aria-label', `Buka ${song.category} ${song.number}, ${song.title}`);
      openButton.innerHTML = `<span class="song-index">${number || '&#9835;'}</span><span class="song-details"><span class="song-title">${escapeText(song.title)}</span><span class="song-subtitle"><span class="song-category">${escapeText(song.category)} &#183; ${escapeText(categoryLabel ? categoryLabel.label : '')}</span>${song.key ? `<span class="song-key">${escapeText(song.key)}</span>` : ''}${extra}</span></span><span class="song-open" aria-hidden="true">&#8250;</span>`;
      openButton.addEventListener('click', () => openSong(song));
      card.append(openButton);
      if (schedules.length) {
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'add-to-schedule';
        addButton.dataset.addSong = song.id;
        addButton.setAttribute('aria-label', `Tambahkan ${song.title} ke jadwal terpilih`);
        addButton.title = 'Tambahkan ke jadwal terpilih';
        addButton.textContent = '+';
        card.append(addButton);
      }
      fragment.append(card);
    });
    songList.append(fragment);
  }

  function stripHtml(value) {
    const parsed = new DOMParser().parseFromString(String(value || ''), 'text/html');
    return parsed.body.textContent || '';
  }

  function safeSongFragment(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const allowed = new Set(['DIV', 'SECTION', 'H3', 'PRE', 'BR', 'P', 'SPAN', 'STRONG', 'EM']);
    const allowedClasses = new Set(['song-content', 'song-section', 'song-section-title', 'song-section-body', 'chord', 'lyric', 'song-line']);

    function copyNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue || '');
      if (node.nodeType !== Node.ELEMENT_NODE || !allowed.has(node.tagName)) return document.createTextNode(node.textContent || '');
      const clone = document.createElement(node.tagName.toLowerCase());
      const classNames = [...node.classList].filter((className) => allowedClasses.has(className));
      if (classNames.length) clone.className = classNames.join(' ');
      if (node.tagName === 'SECTION' && node.dataset.section) clone.dataset.section = node.dataset.section.slice(0, 80);
      [...node.childNodes].forEach((child) => clone.append(copyNode(child)));
      return clone;
    }

    const root = document.createDocumentFragment();
    [...parsed.body.childNodes].forEach((node) => root.append(copyNode(node)));
    return root;
  }

  function openSong(song, queue = songs, queueIndex, showPreview = true) {
    currentPreviewSongs = queue;
    currentSongIndex = Number.isInteger(queueIndex)
      ? queueIndex
      : queue.findIndex((item) => item === song || item.id === song.id);
    currentPreviewSong = song;
    const introButton = document.getElementById('schedule-intro-preview-button');
    const previewIntro = song.scheduleIntro || null;
    introButton.hidden = !previewIntro;
    introButton.textContent = previewIntro ? `Intro · ${previewIntro.name}` : 'Intro';
    if (previewIntro) introButton.setAttribute('aria-label', `Tampilkan intro ${previewIntro.name}`);
    preview.classList.toggle('is-pre-worship', Boolean(song.preWorship));
    previewZoom = 1;
    renderScoreInstruments(song.images);
    sourcePreviewKey = normalizeKey(song.key || 'C');
    selectedPreviewKey = sourcePreviewKey;
    populateTransposeKeys();
    transposeControls.hidden = chordModeSelect.value !== 'letters';
    document.getElementById('dialog-category').textContent = `${song.category} · ${(CATEGORIES.find((entry) => entry.code === song.category) || {}).label || ''}`;
    document.getElementById('dialog-title').textContent = `${song.number ? `${song.number}. ` : ''}${song.title}`;
    renderPreviewMetadata();
    renderSongContent();
    const readerPosition = document.getElementById('reader-position');
    const hasWorshipGrouping = queue.some((item) => typeof item.preWorship === 'boolean');
    if (hasWorshipGrouping) {
      const isPreWorship = Boolean(song.preWorship);
      const matchingIndexes = queue.reduce((indexes, item, index) => {
        if (Boolean(item.preWorship) === isPreWorship) indexes.push(index);
        return indexes;
      }, []);
      const position = matchingIndexes.indexOf(currentSongIndex) + 1;
      readerPosition.textContent = `${isPreWorship ? 'Pra ' : ''}${position}/${matchingIndexes.length}`;
    } else {
      readerPosition.textContent = `${String(currentSongIndex + 1).padStart(2, '0')} / ${String(queue.length).padStart(2, '0')}`;
    }
    document.getElementById('previous-song').disabled = currentSongIndex <= 0;
    document.getElementById('next-song').disabled = currentSongIndex < 0 || currentSongIndex >= queue.length - 1;
    if (showPreview && !dialog.open) dialog.showModal();
    if (dialog.open) document.body.classList.add('song-reader-open');
    scheduleSongFit();
    preview.scrollTop = 0;
    preview.scrollLeft = 0;
    if (dialog.open) document.getElementById('close-dialog').focus();
  }

  function renderPreviewMetadata() {
    const song = currentPreviewSong;
    const parts = [];
    if (song.key || chordModeSelect.value === 'letters') parts.push(`(${selectedPreviewKey}=1)`);
    if (song.genre) parts.push(song.genre);
    if (song.tempo) parts.push(`Tempo: ${formatTempo(song.tempo)}`);
    document.getElementById('dialog-meta').textContent = parts.join(' | ');
    const credits = [];
    if (song.songCreator) credits.push(`Pencipta: ${song.songCreator}`);
    if (song.dateCreate) credits.push(`Tahun: ${song.dateCreate}`);
    const creditsElement = document.getElementById('dialog-credits');
    creditsElement.textContent = credits.join(' · ');
    creditsElement.hidden = credits.length === 0;
  }

  function renderSongContent() {
    preview.replaceChildren();
    const content = safeSongFragment(currentPreviewSong.contentHtml);
    transformChordLines(content, chordModeSelect.value, sourcePreviewKey, selectedPreviewKey);
    if (content.childNodes.length) preview.append(content);
    else {
      const empty = document.createElement('p');
      empty.className = 'preview-note';
      empty.textContent = 'Lirik dan chord belum tersedia untuk lagu ini.';
      preview.append(empty);
    }
    const songContent = preview.querySelector('.song-content');
    if (songContent) songContent.style.zoom = String(previewZoom);
    scheduleSongFit();
  }

  // Keep each preformatted chord/lyric block on screen as one aligned unit.
  function fitSongSections() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    preview.querySelectorAll('.song-section-body, .song-content pre').forEach((body) => {
      body.style.fontSize = '';
      const available = body.parentElement.clientWidth || preview.clientWidth;
      if (!available || !context) return;
      const style = getComputedStyle(body);
      const baseSize = parseFloat(style.fontSize) || 14;
      const lines = (body.innerText || body.textContent).split(/\r?\n/);
      context.font = `${style.fontWeight} ${baseSize}px ${style.fontFamily}`;
      const longestWidth = Math.max(0, ...lines.map((line) => context.measureText(line.replace(/\t/g, '    ')).width));
      if (longestWidth > available) body.style.fontSize = `${baseSize * available / longestWidth * 0.97}px`;
    });
  }

  let fitResizeFrame = 0;
  function scheduleSongFit() {
    cancelAnimationFrame(fitResizeFrame);
    // A closed dialog has no layout width. Wait for showModal and its styles to settle.
    fitResizeFrame = requestAnimationFrame(() => {
      fitResizeFrame = requestAnimationFrame(fitSongSections);
    });
  }

  const songFitObserver = new ResizeObserver(scheduleSongFit);
  songFitObserver.observe(preview);

  window.addEventListener('resize', () => {
    scheduleSongFit();
  }, { passive: true });

  function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  preview.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 2) return;
    pinchStart = { distance: touchDistance(event.touches), zoom: previewZoom };
  }, { passive: true });

  preview.addEventListener('touchmove', (event) => {
    if (!pinchStart || event.touches.length !== 2) return;
    event.preventDefault();
    const nextZoom = Math.max(0.7, Math.min(2.5, pinchStart.zoom * touchDistance(event.touches) / pinchStart.distance));
    if (!Number.isFinite(nextZoom)) return;
    const rect = preview.getBoundingClientRect();
    const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
    const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
    const ratio = nextZoom / previewZoom;
    preview.scrollLeft = (preview.scrollLeft + centerX) * ratio - centerX;
    preview.scrollTop = (preview.scrollTop + centerY) * ratio - centerY;
    previewZoom = nextZoom;
    const songContent = preview.querySelector('.song-content');
    if (songContent) songContent.style.zoom = String(previewZoom);
  }, { passive: false });

  preview.addEventListener('touchend', (event) => {
    if (event.touches.length < 2) pinchStart = null;
  }, { passive: true });
  preview.addEventListener('touchcancel', () => { pinchStart = null; }, { passive: true });

  function renderScoreInstruments(images) {
    scoreInstruments.replaceChildren();
    scorePages.replaceChildren();
    scorePages.hidden = true;
    scoreCarouselControls.hidden = true;
    const entries = images && typeof images === 'object'
      ? Object.entries(images).filter(([, files]) => Array.isArray(files) && files.length)
      : [];
    // Keep the lyric preview unobstructed until an instrument is selected.
    scoreSection.hidden = true;
    closeScorePreviewButton.hidden = true;
    scoreInstruments.hidden = entries.length === 0;
    entries.forEach(([instrument, files]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'score-instrument-button';
      button.dataset.instrument = instrument;
      button.textContent = `${instrument} (${files.length})`;
      button.setAttribute('aria-pressed', 'false');
      scoreInstruments.append(button);
    });
  }

  function openScoreInstrument(instrument) {
    const files = currentPreviewSong?.images?.[instrument];
    if (!Array.isArray(files)) return;
    scoreSection.hidden = false;
    closeScorePreviewButton.hidden = false;
    activeScoreInstrument = instrument;
    activeScoreFiles = files;
    scoreInstruments.querySelectorAll('.score-instrument-button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.instrument === instrument));
    });
    scorePages.replaceChildren();
    files.forEach((file, index) => {
      const urls = scoreImageCandidates(file);
      if (!urls.length) return;
      const figure = document.createElement('figure');
      figure.className = 'score-page';
      const image = document.createElement('img');
      image.alt = `Partitur ${instrument}, halaman ${index + 1}`;
      image.loading = 'lazy';
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `Buka tampilan penuh partitur ${instrument}, halaman ${index + 1}`);
      const showFullImage = () => {
        introGeneralNavigationActive = Boolean(currentPreviewSong?.scheduleIntro);
        introGeneralSongIndex = introGeneralNavigationActive ? currentSongIndex : -1;
        openFullScoreImage(instrument, index);
      };
      image.addEventListener('click', showFullImage);
      image.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showFullImage();
        }
      });
      const caption = document.createElement('figcaption');
      caption.textContent = file && typeof file === 'object' && file.name ? file.name : `${instrument} · ${index + 1}`;
      let attempt = 0;
      image.addEventListener('error', () => {
        attempt += 1;
        if (attempt < urls.length) {
          image.src = urls[attempt];
          return;
        }
        image.remove();
        caption.textContent = 'Tidak dapat menampilkan gambar di halaman ini. ';
        const link = document.createElement('a');
        const fileId = scoreImageId(file);
        link.href = fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` : urls[0];
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Buka partitur di Google Drive';
        caption.append(link);
      });
      figure.append(image, caption);
      scorePages.append(figure);
      image.src = urls[0];
    });
    scorePages.scrollLeft = 0;
    scorePages.hidden = false;
    scoreCarouselControls.hidden = scorePages.children.length < 2;
    updateScoreCarouselControls();
  }

  function openFullScoreImage(instrument, index, showControlsInitially = false) {
    const files = currentPreviewSong?.images?.[instrument];
    if (!Array.isArray(files) || !files[index]) return;
    if (!scoreImageDialog.open) scoreImageReturnTarget = 'lyrics';
    scoreImageMode = 'score';
    activeScheduleIntro = currentPreviewSong?.scheduleIntro || null;
    const closeLabel = document.querySelector('#close-score-image span');
    const returnLabel = scoreImageReturnTarget === 'schedule' ? 'Kembali ke jadwal' : 'Kembali ke lirik';
    if (closeLabel) closeLabel.textContent = returnLabel;
    document.getElementById('close-score-image').setAttribute('aria-label', `Tutup gambar dan ${returnLabel.toLowerCase()}`);
    activeScoreInstrument = instrument;
    activeScoreFiles = files;
    activeScoreIndex = index;
    const hasOtherInstruments = renderScoreImageInstrumentButtons();
    renderFullScoreImage();
    if (!scoreImageDialog.open) scoreImageDialog.showModal();
    if (showControlsInitially) showScoreImageControls();
    else {
      setScoreImageControlsHidden(false);
      scoreImageDialog.classList.toggle('instrument-controls-hidden', !hasOtherInstruments);
      scheduleScoreControlsHide();
    }
  }

  function openGeneralSongScoreAt(index) {
    const song = currentPreviewSongs[index];
    const instrument = findDefaultScoreInstrument(song);
    if (!song || !instrument) return;
    openSong(song, currentPreviewSongs, index, dialog.open);
    introGeneralSongIndex = index;
    activeScheduleIntro = song.scheduleIntro || activeScheduleIntro;
    scoreImageMode = 'score';
    activeScoreInstrument = instrument;
    activeScoreFiles = song.images[instrument];
    activeScoreIndex = 0;
    renderScoreImageInstrumentButtons();
    renderFullScoreImage();
    showScoreImageControls();
  }

  function renderScoreImageInstrumentButtons() {
    const instruments = Object.entries(currentPreviewSong?.images || {})
      .filter(([, files]) => Array.isArray(files) && files.length);
    scoreImageInstruments.replaceChildren();
    if (instruments.length < 2) {
      scoreImageInstruments.hidden = true;
      scoreImageDialog.classList.add('instrument-controls-hidden');
      return false;
    }
    instruments.forEach(([name]) => {
      const button = document.createElement('button');
      button.className = 'score-image-instrument-button';
      button.type = 'button';
      button.dataset.instrument = name;
      button.textContent = name;
      button.setAttribute('aria-pressed', String(name === activeScoreInstrument));
      scoreImageInstruments.append(button);
    });
    scoreImageInstruments.hidden = false;
    return true;
  }

  function setScoreImageControlsHidden(hidden) {
    scoreImageDialog.classList.toggle('controls-hidden', Boolean(hidden));
    window.clearTimeout(scoreControlsHideTimer);
    scoreControlsHideTimer = 0;
  }

  function showScoreImageControls() {
    if (!scoreImageDialog.open) return;
    setScoreImageControlsHidden(false);
    scoreImageDialog.classList.remove('instrument-controls-hidden');
    scheduleScoreControlsHide();
  }

  function scheduleScoreControlsHide() {
    window.clearTimeout(scoreControlsHideTimer);
    scoreControlsHideTimer = window.setTimeout(() => {
      scoreImageDialog.classList.add('controls-hidden');
      scoreImageDialog.classList.add('instrument-controls-hidden');
      scoreControlsHideTimer = 0;
    }, 2800);
  }

  function renderFullScoreImage() {
    const file = activeScoreFiles[activeScoreIndex];
    const urls = scoreImageCandidates(file);
    if (!urls.length) return;
    fullScoreImage.dataset.candidates = JSON.stringify(urls);
    fullScoreImage.dataset.attempt = '0';
    fullScoreImage.src = urls[0];
    const showingIntro = scoreImageMode === 'intro';
    fullScoreImage.alt = showingIntro ? `Intro: ${activeScheduleIntro?.name || 'Intro'}` : `Partitur ${activeScoreInstrument}, halaman ${activeScoreIndex + 1}`;
    scoreImagePosition.textContent = `${activeScoreIndex + 1} / ${activeScoreFiles.length}`;
    const multiple = !showingIntro && activeScoreFiles.length > 1;
    scoreImagePrevious.hidden = !multiple || activeScoreIndex === 0;
    scoreImageNext.hidden = !multiple || activeScoreIndex === activeScoreFiles.length - 1;
    scoreImagePosition.hidden = !multiple;
    scoreImageInstruments.querySelectorAll('.score-image-instrument-button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.instrument === activeScoreInstrument));
    });
    const hasIntro = Boolean(activeScheduleIntro || currentPreviewSong?.scheduleIntro);
    const defaultInstrument = findDefaultScoreInstrument(currentPreviewSong);
    const activeSongLabel = formatScoreSongLabel(currentPreviewSong);
    scoreIntroBackButton.textContent = showingIntro
      ? (defaultInstrument ? activeSongLabel : 'Lirik & Chord')
      : 'Intro';
    scoreIntroBackButton.title = showingIntro
      ? (defaultInstrument ? activeSongLabel : 'Buka preview lirik dan chord')
      : 'Kembali ke Intro';
    scoreIntroBackButton.setAttribute('aria-label', showingIntro && defaultInstrument
      ? `Tampilkan partitur ${activeSongLabel}`
      : (showingIntro ? 'Buka preview lirik dan chord' : 'Kembali ke Intro'));
    scoreIntroBackButton.hidden = showingIntro
      ? !currentPreviewSong
      : !hasIntro;
    scoreImageInstruments.hidden = showingIntro || scoreImageInstruments.childElementCount < 2;
    const previousSongIndex = findPreviousGeneralSongIndex();
    const nextSongIndex = findNextGeneralSongIndex();
    scorePreviousGeneralSongButton.hidden = showingIntro || !introGeneralNavigationActive || previousSongIndex < 0;
    const previousSongLabel = formatScoreSongLabel(currentPreviewSongs[previousSongIndex]);
    scorePreviousGeneralSongButton.textContent = `< ${previousSongLabel || 'Sebelumnya'}`;
    scorePreviousGeneralSongButton.title = previousSongLabel ? `Sebelumnya: ${previousSongLabel}` : 'Partitur sebelumnya';
    scorePreviousGeneralSongButton.setAttribute('aria-label', scorePreviousGeneralSongButton.title);
    updateGeneralSongPosition();
    if (showingIntro) scoreGeneralSongPosition.hidden = true;
    scoreNextGeneralSongButton.hidden = showingIntro || !introGeneralNavigationActive || nextSongIndex < 0;
    const nextSongLabel = formatScoreSongLabel(currentPreviewSongs[nextSongIndex]);
    scoreNextGeneralSongLabel.textContent = nextSongLabel || 'Berikutnya';
    scoreNextGeneralSongButton.title = nextSongLabel ? `Berikutnya: ${nextSongLabel}` : 'Partitur berikutnya';
    scoreNextGeneralSongButton.setAttribute('aria-label', scoreNextGeneralSongButton.title);
    scoreImageDialog.scrollTop = 0;
    scoreImageDialog.scrollLeft = 0;
  }

  function moveFullScoreImage(direction) {
    const nextIndex = activeScoreIndex + direction;
    if (nextIndex < 0 || nextIndex >= activeScoreFiles.length) return;
    activeScoreIndex = nextIndex;
    renderFullScoreImage();
  }

  function findDefaultScoreInstrument(song) {
    const images = song && song.images && typeof song.images === 'object' ? song.images : {};
    const names = Object.keys(images).filter((name) => Array.isArray(images[name]) && images[name].length);
    return names.find((name) => name.trim().toLowerCase() === 'partitur')
      || names.find((name) => name.trim().toLowerCase() === 'general')
      || '';
  }

  function formatScoreSongLabel(song) {
    if (!song) return '';
    return [song.category, song.number, song.title]
      .map((part) => String(part || '').trim())
      .filter(Boolean)
      .join(' ');
  }

  function findNextGeneralSongIndex() {
    const startIndex = introGeneralSongIndex >= 0 ? introGeneralSongIndex : currentSongIndex;
    for (let index = startIndex + 1; index < currentPreviewSongs.length; index += 1) {
      if (findDefaultScoreInstrument(currentPreviewSongs[index])) return index;
    }
    return -1;
  }

  function findPreviousGeneralSongIndex() {
    const startIndex = introGeneralSongIndex >= 0 ? introGeneralSongIndex : currentSongIndex;
    for (let index = startIndex - 1; index >= 0; index -= 1) {
      if (findDefaultScoreInstrument(currentPreviewSongs[index])) return index;
    }
    return -1;
  }

  function updateGeneralSongPosition() {
    const songIndex = introGeneralSongIndex >= 0 ? introGeneralSongIndex : currentSongIndex;
    const song = currentPreviewSongs[songIndex] || currentPreviewSong;
    if (!introGeneralNavigationActive || !song) {
      scoreGeneralSongPosition.hidden = true;
      scoreGeneralSongPosition.textContent = '';
      return;
    }
    const isPreWorship = Boolean(song.preWorship);
    const matchingSongIndexes = currentPreviewSongs.reduce((indexes, item, index) => {
      if (Boolean(item.preWorship) === isPreWorship && findDefaultScoreInstrument(item)) indexes.push(index);
      return indexes;
    }, []);
    const position = matchingSongIndexes.indexOf(songIndex) + 1;
    if (!position || !matchingSongIndexes.length) {
      scoreGeneralSongPosition.hidden = true;
      scoreGeneralSongPosition.textContent = '';
      return;
    }
    scoreGeneralSongPosition.textContent = `${isPreWorship ? 'Pra ' : ''}${position}/${matchingSongIndexes.length}`;
    scoreGeneralSongPosition.hidden = false;
  }

  function openPreviousGeneralSong() {
    const previousIndex = findPreviousGeneralSongIndex();
    if (previousIndex < 0) return;
    introGeneralNavigationActive = true;
    openGeneralSongScoreAt(previousIndex);
  }

  function openNextGeneralSong() {
    const nextIndex = findNextGeneralSongIndex();
    if (nextIndex < 0) return;
    introGeneralNavigationActive = true;
    openGeneralSongScoreAt(nextIndex);
  }

  function closeScorePreview() {
    scoreSection.hidden = true;
    closeScorePreviewButton.hidden = true;
    scorePages.hidden = true;
    scoreInstruments.querySelectorAll('.score-instrument-button').forEach((button) => {
      button.setAttribute('aria-pressed', 'false');
    });
    chordModeSelect.value = 'numbers';
    transposeControls.hidden = true;
    renderPreviewMetadata();
    renderSongContent();
  }

  function updateScoreCarouselControls() {
    const pages = scorePages.children;
    if (!pages.length) return;
    const pageIndex = Math.min(pages.length - 1, Math.round(scorePages.scrollLeft / Math.max(1, scorePages.clientWidth)));
    document.getElementById('score-page-position').textContent = `${pageIndex + 1} / ${pages.length}`;
    document.getElementById('score-previous').disabled = pageIndex === 0;
    document.getElementById('score-next').disabled = pageIndex === pages.length - 1;
  }

  function moveScorePage(direction) {
    scorePages.scrollBy({ left: direction * scorePages.clientWidth, behavior: 'smooth' });
  }

  function scoreImageId(file) {
    if (file && typeof file === 'object' && file.id) return String(file.id);
    const url = typeof file === 'string' ? file : String((file && file.url) || '');
    return url.match(/[?&]id=([^&]+)/)?.[1] || url.match(/\/d\/([^/]+)/)?.[1] || '';
  }

  function scoreImageCandidates(file) {
    const source = typeof file === 'string' ? file : String((file && file.url) || '');
    const id = scoreImageId(file);
    if (!id) return source ? [source] : [];
    const encodedId = encodeURIComponent(id);
    const candidates = [
      `https://drive.google.com/thumbnail?id=${encodedId}&sz=w2000`,
      `https://lh3.googleusercontent.com/d/${encodedId}=w2000`,
      `https://drive.google.com/uc?export=view&id=${encodedId}`,
      source
    ];
    return [...new Set(candidates.filter(Boolean))];
  }

  function populateTransposeKeys() {
    const info = parseKey(selectedPreviewKey);
    const sharpKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatKeys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const useFlats = ['Db', 'Eb', 'Gb', 'Ab', 'Bb'].includes(info.root);
    const options = (useFlats ? flatKeys : sharpKeys).map((root) => `${root}${info.minor ? 'm' : ''}`);
    transposeKeySelect.replaceChildren(...options.map((key) => new Option(key, key)));
    transposeKeySelect.value = options[info.pitch] || options[0];
    selectedPreviewKey = transposeKeySelect.value;
  }

  function parseKey(key) {
    const value = String(key || 'C').replace(/\u266D/g, 'b').replace(/\u266F/g, '#').trim();
    const match = value.match(/^([A-Ga-g])([#b]?)(m)?/);
    if (!match) return { root: 'C', pitch: 0, minor: false };
    const root = `${match[1].toUpperCase()}${match[2]}`;
    const pitches = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    return { root, pitch: pitches[root] ?? 0, minor: Boolean(match[3]) };
  }

  function normalizeKey(key) {
    const parsed = parseKey(key);
    return `${parsed.root}${parsed.minor ? 'm' : ''}`;
  }

  function scaleFor(key) {
    const parsed = parseKey(key);
    const steps = parsed.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
    return steps.map((step) => (parsed.pitch + step) % 12);
  }

  function pitchName(pitch, key) {
    const parsed = parseKey(key);
    const names = ['C', 'C#', 'D', parsed.root.includes('b') ? 'Eb' : 'D#', 'E', 'F', parsed.root.includes('b') ? 'Gb' : 'F#', 'G', parsed.root.includes('b') ? 'Ab' : 'G#', 'A', parsed.root.includes('b') ? 'Bb' : 'A#', 'B'];
    return names[((pitch % 12) + 12) % 12];
  }

  function parseNumberChord(token) {
    const match = token.match(/^([b#]?)([1-7])([^/]*)(?:\/([b#]?[1-7]))?$/i);
    return match ? { accidental: match[1], degree: Number(match[2]), quality: match[3], bass: match[4] || '' } : null;
  }

  function parseLetterChord(token) {
    const match = token.match(/^([A-G])([#b]?)([^/]*)(?:\/([A-G][#b]?))?$/i);
    return match ? { root: `${match[1].toUpperCase()}${match[2]}`, quality: match[3], bass: match[4] || '' } : null;
  }

  function degreePitch(degree, key, accidental = '') {
    const scale = scaleFor(key);
    return ((scale[(degree - 1) % 7] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0)) % 12 + 12) % 12;
  }

  function numericToLetter(token, key) {
    const chord = parseNumberChord(token);
    if (!chord) return token;
    const scale = scaleFor(key);
    const minor = parseKey(key).minor;
    const defaultQualities = minor ? ['m', 'dim', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'dim'];
    const quality = chord.quality || defaultQualities[chord.degree - 1];
    const root = pitchName(degreePitch(chord.degree, key, chord.accidental), key);
    const bassMatch = chord.bass.match(/^([b#]?)([1-7])$/);
    const bass = bassMatch ? `/${pitchName(degreePitch(Number(bassMatch[2]), key, bassMatch[1]), key)}` : '';
    return `${root}${quality}${bass}`;
  }

  function letterToNumeric(token, key) {
    const chord = parseLetterChord(token);
    if (!chord) return token;
    const rootPitch = parseKey(chord.root).pitch;
    const scale = scaleFor(key);
    let degreeText = String((scale.indexOf(rootPitch) + 1) || 1);
    if (scale.includes(rootPitch)) degreeText = String(scale.indexOf(rootPitch) + 1);
    else {
      for (let index = 0; index < scale.length; index += 1) {
        if ((scale[index] + 1) % 12 === rootPitch) { degreeText = `#${index + 1}`; break; }
        if ((scale[index] + 11) % 12 === rootPitch) { degreeText = `b${index + 1}`; break; }
      }
    }
    const bass = chord.bass ? `/${letterToNumeric(chord.bass, key)}` : '';
    return `${degreeText}${chord.quality}${bass}`;
  }

  function transposeLetterChord(token, fromKey, toKey) {
    const chord = parseLetterChord(token);
    if (!chord) return token;
    const shift = parseKey(toKey).pitch - parseKey(fromKey).pitch;
    const root = pitchName(parseKey(chord.root).pitch + shift, toKey);
    const bass = chord.bass ? `/${pitchName(parseKey(chord.bass).pitch + shift, toKey)}` : '';
    return `${root}${chord.quality}${bass}`;
  }

  function mapChordToken(token, mode, fromKey, toKey) {
    if (mode === 'letters') return parseNumberChord(token) ? numericToLetter(token, toKey) : transposeLetterChord(token, fromKey, toKey);
    return parseLetterChord(token) ? letterToNumeric(token, toKey) : token;
  }

  function transformChordLines(fragment, mode, fromKey, toKey) {
    fragment.querySelectorAll('.song-section-body').forEach((body) => {
      const lines = body.textContent.split(/(\r?\n)/);
      body.textContent = lines.map((line) => {
        if (/^\r?\n$/.test(line) || !line.trim()) return line;
        const tokens = line.trim().split(/\s+/);
        const chordLine = tokens.length > 0 && tokens.every((token) => parseNumberChord(token) || parseLetterChord(token));
        return chordLine ? line.replace(/\S+/g, (token) => mapChordToken(token, mode, fromKey, toKey)) : line;
      }).join('');
    });
  }

  function stepTranspose(amount) {
    const current = parseKey(selectedPreviewKey);
    selectedPreviewKey = `${pitchName(current.pitch + amount, selectedPreviewKey)}${current.minor ? 'm' : ''}`;
    populateTransposeKeys();
    renderPreviewMetadata();
    renderSongContent();
  }

  function openPreviewAt(index) {
    if (index < 0 || index >= currentPreviewSongs.length) return;
    openSong(currentPreviewSongs[index], currentPreviewSongs, index);
  }

  document.getElementById('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('song-reader-open'));
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  document.getElementById('close-score-image').addEventListener('click', () => scoreImageDialog.close());
  scoreImageDialog.addEventListener('cancel', (event) => event.preventDefault());
  scoreImageDialog.addEventListener('close', () => {
    window.clearTimeout(scoreControlsHideTimer);
    scoreControlsHideTimer = 0;
    scoreImageDialog.classList.remove('controls-hidden');
    scoreImageDialog.classList.remove('instrument-controls-hidden');
    scoreImageInstruments.hidden = true;
    scoreImageMode = 'score';
    activeScheduleIntro = null;
    scoreImageReturnTarget = 'lyrics';
    introGeneralNavigationActive = false;
    introGeneralSongIndex = -1;
    scoreIntroBackButton.hidden = true;
    scorePreviousGeneralSongButton.hidden = true;
    scoreGeneralSongPosition.hidden = true;
    scoreNextGeneralSongButton.hidden = true;
    chordModeSelect.value = 'numbers';
    transposeControls.hidden = true;
    renderPreviewMetadata();
    renderSongContent();
  });
  scoreImagePrevious.addEventListener('click', () => moveFullScoreImage(-1));
  scoreImageNext.addEventListener('click', () => moveFullScoreImage(1));
  scoreImageInstruments.addEventListener('click', (event) => {
    const button = event.target.closest('.score-image-instrument-button');
    if (button) openFullScoreImage(button.dataset.instrument, 0, true);
  });
  scoreIntroBackButton.addEventListener('click', () => {
    if (scoreImageMode === 'score') {
      const intro = activeScheduleIntro || currentPreviewSong?.scheduleIntro;
      if (intro) showScheduleIntroInScoreViewer(intro);
      return;
    }
    const instrument = findDefaultScoreInstrument(currentPreviewSong);
    if (instrument) {
      introGeneralNavigationActive = true;
      introGeneralSongIndex = currentSongIndex;
      openFullScoreImage(instrument, 0, true);
      return;
    }
    if (currentPreviewSong) {
      const song = currentPreviewSong;
      const queue = currentPreviewSongs;
      const index = currentSongIndex;
      scoreImageDialog.close();
      openSong(song, queue, index);
    }
  });
  scoreNextGeneralSongButton.addEventListener('click', openNextGeneralSong);
  scorePreviousGeneralSongButton.addEventListener('click', openPreviousGeneralSong);
  fullScoreImage.addEventListener('error', () => {
    const urls = JSON.parse(fullScoreImage.dataset.candidates || '[]');
    const attempt = Number(fullScoreImage.dataset.attempt || 0) + 1;
    fullScoreImage.dataset.attempt = String(attempt);
    if (attempt < urls.length) fullScoreImage.src = urls[attempt];
  });
  fullScoreImage.addEventListener('click', showScoreImageControls);
  scoreImageDialog.addEventListener('touchstart', (event) => {
    showScoreImageControls();
    if (event.touches.length === 1) scoreSwipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  scoreImageDialog.addEventListener('click', showScoreImageControls);
  scoreImageDialog.addEventListener('touchend', (event) => {
    if (!scoreSwipeStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - scoreSwipeStart.x;
    const dy = event.changedTouches[0].clientY - scoreSwipeStart.y;
    scoreSwipeStart = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) moveFullScoreImage(dx < 0 ? 1 : -1);
  }, { passive: true });
  scoreImageDialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') showScoreImageControls();
    if (event.key === 'ArrowRight') moveFullScoreImage(1);
    if (event.key === 'ArrowLeft') moveFullScoreImage(-1);
  });
  document.getElementById('previous-song').addEventListener('click', () => openPreviewAt(currentSongIndex - 1));
  document.getElementById('next-song').addEventListener('click', () => openPreviewAt(currentSongIndex + 1));
  chordModeSelect.addEventListener('change', () => {
    transposeControls.hidden = chordModeSelect.value !== 'letters';
    renderPreviewMetadata();
    renderSongContent();
  });
  transposeKeySelect.addEventListener('change', () => {
    selectedPreviewKey = transposeKeySelect.value;
    renderPreviewMetadata();
    renderSongContent();
  });
  document.getElementById('transpose-down').addEventListener('click', () => stepTranspose(-1));
  document.getElementById('transpose-up').addEventListener('click', () => stepTranspose(1));
  scoreInstruments.addEventListener('click', (event) => {
    const button = event.target.closest('.score-instrument-button');
    if (!button) return;
    if (!scoreSection.hidden && button.getAttribute('aria-pressed') === 'true') closeScorePreview();
    else if (currentPreviewSong?.scheduleIntro) {
      introGeneralNavigationActive = true;
      introGeneralSongIndex = currentSongIndex;
      openFullScoreImage(button.dataset.instrument, 0, true);
    } else openScoreInstrument(button.dataset.instrument);
  });
  closeScorePreviewButton.addEventListener('click', closeScorePreview);
  scorePages.addEventListener('scroll', updateScoreCarouselControls, { passive: true });
  document.getElementById('score-previous').addEventListener('click', () => moveScorePage(-1));
  document.getElementById('score-next').addEventListener('click', () => moveScorePage(1));
  refreshButton.addEventListener('click', loadSongs);
  document.getElementById('create-schedule').addEventListener('click', addSchedule);
  document.getElementById('share-schedule-open').addEventListener('click', () => { fillShareSchedules(); document.getElementById('share-result').hidden = true; document.getElementById('share-status').textContent = ''; shareDialog.showModal(); });
  document.getElementById('pull-schedule-open').addEventListener('click', () => { document.getElementById('pull-status').textContent = ''; pullDialog.showModal(); });
  document.querySelector('[data-close-share]').addEventListener('click', () => shareDialog.close());
  document.querySelector('[data-close-pull]').addEventListener('click', () => pullDialog.close());
  document.getElementById('share-schedule-submit').addEventListener('click', shareSelectedSchedule);
  document.getElementById('share-schedule-options').addEventListener('click', (event) => {
    const choice = event.target.closest('[data-schedule-id]');
    if (!choice) return;
    const select = document.getElementById('share-schedule-select');
    select.value = choice.dataset.scheduleId;
    document.getElementById('share-schedule-picker-label').textContent = choice.textContent;
    document.querySelectorAll('.share-schedule-option').forEach((option) => option.setAttribute('aria-selected', String(option === choice)));
    document.getElementById('share-schedule-picker').open = false;
  });
  document.getElementById('share-schedule-picker').addEventListener('toggle', (event) => {
    const picker = event.currentTarget;
    if (!picker.open) {
      picker.classList.remove('opens-up');
      return;
    }
    const bounds = picker.getBoundingClientRect();
    const spaceBelow = window.innerHeight - bounds.bottom;
    const spaceAbove = bounds.top;
    picker.classList.toggle('opens-up', spaceBelow < Math.min(220, window.innerHeight * 0.35) && spaceAbove > spaceBelow);
  });
  document.getElementById('stop-sharing').addEventListener('click', () => stopSharing(false));
  document.getElementById('pull-schedule-submit').addEventListener('click', pullSharedSchedule);
  document.getElementById('pull-schedule-code').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3); });
  scheduleList.addEventListener('click', handleScheduleClick);
  scheduleList.addEventListener('input', handleScheduleInput);
  scheduleViewDialog.addEventListener('click', handleScheduleClick);
  scheduleViewList.addEventListener('click', handleScheduleRowClick);
  document.getElementById('close-schedule-view').addEventListener('click', () => scheduleViewDialog.close());
  document.getElementById('refresh-schedule-songs').addEventListener('click', refreshViewedScheduleSongsFromLibrary);
  scheduleViewDialog.addEventListener('close', () => document.body.classList.remove('schedule-view-open'));
  document.getElementById('add-schedule-intro').addEventListener('click', openScheduleIntroForm);
  removeScheduleIntroButton.addEventListener('click', removeScheduleIntro);
  scheduleIntroNameButton.addEventListener('click', () => {
    const schedule = schedules.find((item) => item.id === viewedScheduleId);
    openScheduleIntroImage(scheduleIntros[viewedScheduleId], false, schedule || null);
  });
  document.getElementById('schedule-intro-preview-button').addEventListener('click', () => {
    openScheduleIntroImage(currentPreviewSong && currentPreviewSong.scheduleIntro, true);
  });
  document.getElementById('close-schedule-intro').addEventListener('click', () => scheduleIntroDialog.close());
  scheduleIntroForm.addEventListener('submit', saveScheduleIntro);
  scheduleIntroDialog.addEventListener('click', (event) => { if (event.target === scheduleIntroDialog) scheduleIntroDialog.close(); });
  document.getElementById('confirm-remove-schedule-intro').addEventListener('click', () => finishIntroRemovalConfirmation(true));
  document.getElementById('cancel-remove-schedule-intro').addEventListener('click', () => finishIntroRemovalConfirmation(false));
  document.getElementById('close-remove-schedule-intro').addEventListener('click', () => finishIntroRemovalConfirmation(false));
  removeScheduleIntroDialog.addEventListener('close', () => {
    if (resolveIntroRemovalConfirmation) finishIntroRemovalConfirmation(false);
  });
  scheduleViewDialog.addEventListener('click', (event) => { if (event.target === scheduleViewDialog) scheduleViewDialog.close(); });
  document.getElementById('delete-viewed-schedule').addEventListener('click', () => {
    const schedule = schedules.find((item) => item.id === viewedScheduleId);
    confirmScheduleDeletion(schedule);
  });
  document.getElementById('confirm-delete-schedule').addEventListener('click', () => finishScheduleDeletion(true));
  document.getElementById('cancel-delete-schedule').addEventListener('click', () => finishScheduleDeletion(false));
  document.getElementById('close-delete-schedule').addEventListener('click', () => finishScheduleDeletion(false));
  deleteScheduleDialog.addEventListener('click', (event) => {
    if (event.target === deleteScheduleDialog) finishScheduleDeletion(false);
  });
  deleteScheduleDialog.addEventListener('close', () => { pendingScheduleDeletionId = ''; });
  songList.addEventListener('click', handleCollectionClick);
  targetScheduleSelect.addEventListener('change', () => { activeScheduleId = targetScheduleSelect.value; });
  search.addEventListener('input', handleSearchInput);
  collapseCollectionButton.addEventListener('click', () => setCollectionCollapsed(!isCollectionCollapsed));
  scheduleList.addEventListener('pointerdown', handleScheduleDragStart);
  scheduleList.addEventListener('pointermove', handleScheduleDragMove);
  scheduleList.addEventListener('pointerup', finishScheduleDrag);
  scheduleList.addEventListener('pointercancel', finishScheduleDrag);
  scheduleViewList.addEventListener('pointerdown', handleScheduleDragStart);
  scheduleViewList.addEventListener('pointermove', handleScheduleDragMove);
  scheduleViewList.addEventListener('pointerup', finishScheduleDrag);
  scheduleViewList.addEventListener('pointercancel', finishScheduleDrag);
  scheduleEditForm.addEventListener('submit', saveScheduleSongEdit);
  scheduleContentInput.addEventListener('input', updateScheduleContentHighlight);
  scheduleContentInput.addEventListener('scroll', updateScheduleContentHighlight, { passive: true });
  document.getElementById('cancel-schedule-edit').addEventListener('click', () => { scheduleEditDialog.close(); editingEntry = null; });
  scheduleEditDialog.addEventListener('cancel', (event) => event.preventDefault());
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    }
    if (dialog.open && !scoreImageDialog.open && event.key === 'ArrowRight') openPreviewAt(currentSongIndex + 1);
    if (dialog.open && !scoreImageDialog.open && event.key === 'ArrowLeft') openPreviewAt(currentSongIndex - 1);
  });
  filters.replaceChildren();
  loadSchedules();
  renderSchedules();
  const hasCache = loadCachedSongs();
  if (!hasCache) {
    count.textContent = '0';
    setStatus('Belum ada data lokal. Tekan "Perbarui data" untuk memuat lagu dari database.');
    setSyncStatus('Belum disinkronkan');
  }
})();


