/* ==========================================================================
   Interview Practice Tracker
   Vanilla JS, no build step. Structure:
     1. Constants + sample data
     2. Storage (LocalStorage, defensive)
     3. State + selectors (pure functions that derive numbers)
     4. Render functions (hero, stats, chips, list)
     5. Dialog + validation
     6. Events + boot
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- 1. Constants ---------- */
  const KEYS = {
    questions: 'ipt.questions.v1',
    machine: 'ipt.machine.v1',
    theme: 'ipt.theme.v1',
  };
  const CATEGORIES = ['DSA', 'Git', 'Technical'];
  const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
  const STATUSES = ['Pending', 'In Progress', 'Completed'];

  // The 15 questions from Sheet 01, so you can load them in one click.
  const SHEET_01 = [
    ['DSA', 'Two Sum (LC 1)', 'Easy'],
    ['DSA', 'Remove Duplicates from Sorted Array (LC 26)', 'Easy'],
    ['DSA', 'Move Zeroes (LC 283)', 'Easy'],
    ['DSA', 'Rotate Array (LC 189)', 'Medium'],
    ['DSA', '3Sum (LC 15)', 'Medium'],
    ['Git', 'Wrong branch, correct work', 'Medium'],
    ['Git', 'Merge conflict during PR', 'Medium'],
    ['Git', 'Secret accidentally committed', 'Medium'],
    ['Git', 'PR review with new changes', 'Easy'],
    ['Git', 'Recovering lost local work', 'Hard'],
    ['Technical', 'JavaScript: async flow and the event loop', 'Medium'],
    ['Technical', 'React: unnecessary re-renders', 'Medium'],
    ['Technical', 'REST API + Express: 401 request flow', 'Medium'],
    ['Technical', 'MongoDB + Mongoose: duplicate data', 'Medium'],
    ['Technical', 'Authentication, authorization and ImageKit', 'Hard'],
  ];

  /* ---------- Small helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
  const uid = () =>
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const clean = (s) => s.trim().replace(/\s+/g, ' ');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // Tiny element builder. Uses textContent only, so user input can never inject HTML.
  function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(props)) {
      if (val == null || val === false) continue;
      if (key === 'class') el.className = val;
      else if (key === 'text') el.textContent = val;
      else if (['checked', 'selected', 'disabled', 'hidden'].includes(key)) el[key] = val;
      else el.setAttribute(key, val === true ? '' : val);
    }
    kids.flat().forEach((kid) => {
      if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    });
    return el;
  }

  const ICONS = {
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/></svg>',
  };
  function iconButton(name, label, dataAttr, id, extraClass = '') {
    const btn = h('button', {
      type: 'button',
      class: `icon-btn ${extraClass}`.trim(),
      'aria-label': label,
      [dataAttr]: id,
    });
    btn.innerHTML = ICONS[name]; // static, trusted markup
    return btn;
  }

  /* ---------- 2. Storage ---------- */
  const store = {
    read(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        /* storage full or blocked: the app keeps working in memory */
      }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    },
  };

  // Never trust stored data blindly: drop anything malformed.
  function sanitize(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter(
        (q) =>
          q && typeof q.title === 'string' && q.title.trim() &&
          CATEGORIES.includes(q.category) &&
          DIFFICULTIES.includes(q.difficulty) &&
          STATUSES.includes(q.status)
      )
      .map((q) => ({
        id: String(q.id || uid()),
        title: clean(q.title).slice(0, 120),
        category: q.category,
        difficulty: q.difficulty,
        status: q.status,
      }));
  }

  /* ---------- 3. State + selectors ---------- */
  const state = {
    questions: sanitize(store.read(KEYS.questions, [])),
    machine: (() => {
      const saved = store.read(KEYS.machine, 'Pending');
      return STATUSES.includes(saved) ? saved : 'Pending';
    })(),
    filters: { query: '', category: 'All', status: 'All', difficulty: 'All' },
    editingId: null,
    lastDeleted: null,
  };

  const persist = () => store.write(KEYS.questions, state.questions);
  const findQuestion = (id) => state.questions.find((q) => q.id === id);

  function computeStats() {
    const qs = state.questions;
    const done = qs.filter((q) => q.status === 'Completed');
    const inProgress = qs.filter((q) => q.status === 'In Progress').length;
    const byCat = {};
    CATEGORIES.forEach((c) => {
      byCat[c] = {
        total: qs.filter((q) => q.category === c).length,
        done: done.filter((q) => q.category === c).length,
      };
    });
    return {
      total: qs.length,
      done: done.length,
      inProgress,
      pct: qs.length ? Math.round((done.length / qs.length) * 100) : 0,
      byCat,
      interviewDone: byCat.Git.done + byCat.Technical.done,
      interviewTotal: byCat.Git.total + byCat.Technical.total,
    };
  }

  function visibleQuestions() {
    const { query, category, status, difficulty } = state.filters;
    const needle = query.trim().toLowerCase();
    return state.questions.filter(
      (q) =>
        (!needle || q.title.toLowerCase().includes(needle)) &&
        (category === 'All' || q.category === category) &&
        (status === 'All' || q.status === status) &&
        (difficulty === 'All' || q.difficulty === difficulty)
    );
  }

  const filtersActive = () => {
    const f = state.filters;
    return Boolean(f.query.trim()) || f.category !== 'All' || f.status !== 'All' || f.difficulty !== 'All';
  };

  /* ---------- 4. Render ---------- */
  const els = {
    pctNum: $('#pctNum'),
    pctCaption: $('#pctCaption'),
    strip: $('#strip'),
    catBars: $('#catBars'),
    stats: $('#stats'),
    chips: $('#chips'),
    search: $('#search'),
    statusFilter: $('#statusFilter'),
    difficultyFilter: $('#difficultyFilter'),
    resultMeta: $('#resultMeta'),
    clearFilters: $('#clearFilters'),
    results: $('#results'),
    dlg: $('#dlg'),
    form: $('#form'),
    dlgTitle: $('#dlgTitle'),
    titleInput: $('#qTitle'),
    titleError: $('#titleError'),
    submitBtn: $('#submitBtn'),
    toast: $('#toast'),
    themeBtn: $('#themeBtn'),
    addBtn: $('#addBtn'),
    resetBtn: $('#resetBtn'),
  };

  function renderHero(stats) {
    els.pctNum.textContent = stats.pct;

    els.pctCaption.textContent = stats.total
      ? `${stats.done} of ${plural(stats.total, 'question')} completed` +
        (stats.inProgress ? `, ${stats.inProgress} in progress.` : '.')
      : 'Add your first question to start tracking your week.';

    // Progress strip: one block per stored question, coloured by status.
    els.strip.replaceChildren();
    if (stats.total) {
      state.questions.forEach((q) =>
        els.strip.append(h('span', { class: `block s-${slug(q.status)}`, title: `${q.title} (${q.status})` }))
      );
    } else {
      for (let i = 0; i < 15; i++) els.strip.append(h('span', { class: 'block ghost' }));
    }
    els.strip.setAttribute(
      'aria-label',
      stats.total
        ? `${stats.done} of ${stats.total} questions completed, ${stats.inProgress} in progress`
        : 'No questions yet'
    );

    // Per-category bars
    els.catBars.replaceChildren(
      ...CATEGORIES.map((c) => {
        const { done, total } = stats.byCat[c];
        const width = total ? Math.round((done / total) * 100) : 0;
        const fill = h('span', { class: 'cat-bar-fill' });
        fill.style.width = `${width}%`;
        return h(
          'li',
          { class: `cat-bar cat-${slug(c)}` },
          h('span', { class: 'cat-bar-name', text: c }),
          h('span', { class: 'cat-bar-count', text: `${done}/${total}` }),
          h('span', { class: 'cat-bar-track', 'aria-hidden': 'true' }, fill)
        );
      })
    );
  }

  function renderStats(stats) {
    const cell = (label, valueNode, note) =>
      h('div', { class: 'stat' },
        h('p', { class: 'stat-label', text: label }),
        valueNode,
        note ? h('p', { class: 'stat-note', text: note }) : null);

    const value = (n, of) =>
      h('p', { class: 'stat-value' }, String(n), of != null ? h('small', { text: `/${of}` }) : null);

    const machineSeg = h(
      'div',
      { class: 'mini-seg', role: 'group', 'aria-label': 'Machine coding status' },
      STATUSES.map((s) =>
        h('button', {
          type: 'button',
          'data-machine': s,
          'aria-pressed': String(state.machine === s),
          text: s,
        })
      )
    );

    els.stats.replaceChildren(
      cell('Total questions', value(stats.total), `${stats.done} completed`),
      cell('DSA completed', value(stats.byCat.DSA.done, stats.byCat.DSA.total), 'LeetCode problems'),
      cell('Interview questions completed', value(stats.interviewDone, stats.interviewTotal), 'Git and Technical'),
      cell('Machine coding', machineSeg)
    );
  }

  function renderChips() {
    const all = state.questions.length;
    const options = [['All', all], ...CATEGORIES.map((c) => [c, state.questions.filter((q) => q.category === c).length])];
    els.chips.replaceChildren(
      ...options.map(([name, count]) =>
        h(
          'button',
          { type: 'button', class: 'chip', 'data-chip': name, 'aria-pressed': String(state.filters.category === name) },
          name,
          h('span', { class: 'n', text: String(count) })
        )
      )
    );
  }

  function fillSelect(select, allLabel, values, current) {
    select.replaceChildren(
      h('option', { value: 'All', text: allLabel, selected: current === 'All' }),
      ...values.map((v) => h('option', { value: v, text: v, selected: current === v }))
    );
  }

  function renderFilterSelects() {
    fillSelect(els.statusFilter, 'All statuses', STATUSES, state.filters.status);
    fillSelect(els.difficultyFilter, 'All difficulties', DIFFICULTIES, state.filters.difficulty);
  }

  function rowEl(q) {
    const statusSelect = h(
      'select',
      {
        class: `status-select s-${slug(q.status)}`,
        'aria-label': `Status for ${q.title}`,
        'data-status-for': q.id,
      },
      STATUSES.map((s) => h('option', { value: s, text: s, selected: s === q.status }))
    );
    return h(
      'li',
      { class: `row s-${slug(q.status)}`, 'data-id': q.id },
      h('p', { class: 'row-title', text: q.title }),
      h(
        'div',
        { class: 'row-meta' },
        h('span', { class: `badge cat-${slug(q.category)}`, text: q.category }),
        h('span', { class: `diff diff-${slug(q.difficulty)}`, text: q.difficulty }),
        statusSelect
      ),
      h(
        'div',
        { class: 'row-actions' },
        iconButton('edit', `Edit ${q.title}`, 'data-edit', q.id),
        iconButton('trash', `Delete ${q.title}`, 'data-delete', q.id, 'danger')
      )
    );
  }

  function stateBlock(title, text, actions) {
    return h(
      'div',
      { class: 'state' },
      h('div', { class: 'state-art', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
      h('h2', { text: title }),
      h('p', { text }),
      actions.length ? h('div', { class: 'state-actions' }, actions) : null
    );
  }

  function renderList() {
    const visible = visibleQuestions();
    const total = state.questions.length;
    const active = filtersActive();

    els.clearFilters.hidden = !active;
    els.resultMeta.textContent = total
      ? `Showing ${visible.length} of ${plural(total, 'question')}`
      : '';

    if (!total) {
      els.results.replaceChildren(
        stateBlock(
          'Nothing tracked yet',
          'Add the questions you want to practise this week, or load the 15 questions from Sheet 01.',
          [
            h('button', { type: 'button', class: 'btn primary', 'data-action': 'add', text: 'Add question' }),
            h('button', { type: 'button', class: 'btn ghost', 'data-action': 'seed', text: 'Load Sheet 01 questions' }),
          ]
        )
      );
      return;
    }

    if (!visible.length) {
      const q = state.filters.query.trim();
      els.results.replaceChildren(
        stateBlock(
          q ? `No questions match "${q}"` : 'No questions match these filters',
          'Try a different word, or remove a filter to see more.',
          [h('button', { type: 'button', class: 'btn ghost', 'data-action': 'clear', text: 'Clear filters' })]
        )
      );
      return;
    }

    els.results.replaceChildren(h('ul', { class: 'rows' }, visible.map(rowEl)));
  }

  function renderAll() {
    const stats = computeStats();
    renderHero(stats);
    renderStats(stats);
    renderChips();
    renderFilterSelects();
    renderList();
  }

  /* ---------- 5. Dialog + validation ---------- */
  const GROUPS = { category: CATEGORIES, difficulty: DIFFICULTIES, status: STATUSES };

  function buildRadioGroups() {
    Object.entries(GROUPS).forEach(([name, values]) => {
      const host = $(`.seg[data-group="${name}"]`);
      host.replaceChildren(
        ...values.map((v) =>
          h('label', {},
            h('input', { type: 'radio', name, value: v }),
            h('span', { text: v }))
        )
      );
    });
  }

  const setRadio = (name, value) => {
    const input = els.form.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  };
  const getRadio = (name) => {
    const input = els.form.querySelector(`input[name="${name}"]:checked`);
    return input ? input.value : '';
  };

  function showTitleError(message) {
    els.titleError.textContent = message;
    els.titleError.hidden = !message;
    els.titleInput.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function validate(data) {
    const title = clean(data.title);
    if (!title) return 'Enter the question you want to practise.';
    if (title.length < 3) return 'Use at least 3 characters so you can recognise it later.';
    if (title.length > 120) return 'Keep it under 120 characters.';
    const twin = state.questions.find(
      (q) => q.id !== state.editingId && q.category === data.category && q.title.toLowerCase() === title.toLowerCase()
    );
    if (twin) return `You already track this question under ${data.category}.`;
    return '';
  }

  function openDialog(id) {
    state.editingId = id || null;
    const q = id ? findQuestion(id) : null;
    els.dlgTitle.textContent = q ? 'Edit question' : 'Add a question';
    els.submitBtn.textContent = q ? 'Save changes' : 'Add question';
    els.titleInput.value = q ? q.title : '';
    setRadio('category', q ? q.category : state.filters.category !== 'All' ? state.filters.category : 'DSA');
    setRadio('difficulty', q ? q.difficulty : 'Medium');
    setRadio('status', q ? q.status : 'Pending');
    showTitleError('');
    els.dlg.showModal();
    els.titleInput.focus();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const data = {
      title: els.titleInput.value,
      category: getRadio('category'),
      difficulty: getRadio('difficulty'),
      status: getRadio('status'),
    };
    const error = validate(data);
    if (error) {
      showTitleError(error);
      els.titleInput.focus();
      return;
    }
    data.title = clean(data.title);

    if (state.editingId) {
      Object.assign(findQuestion(state.editingId), data);
      toast('Changes saved');
    } else {
      state.questions.unshift({ id: uid(), ...data });
      toast('Question added');
    }
    persist();
    els.dlg.close();
    renderAll();
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(message, action) {
    clearTimeout(toastTimer);
    els.toast.replaceChildren(h('span', { text: message }));
    if (action) {
      els.toast.append(
        h('button', {
          type: 'button',
          text: action.label,
          onclick: () => { action.run(); hideToast(); },
        })
      );
    }
    els.toast.hidden = false;
    toastTimer = setTimeout(hideToast, action ? 6000 : 2600);
  }
  function hideToast() { els.toast.hidden = true; }

  /* ---------- Actions ---------- */
  function setStatus(id, status) {
    const q = findQuestion(id);
    if (!q || !STATUSES.includes(status)) return;
    q.status = status;
    persist();
    renderAll();
    const next = els.results.querySelector(`[data-status-for="${CSS.escape(id)}"]`);
    if (next) next.focus(); // keep keyboard position after the re-render
  }

  function deleteQuestion(id) {
    const index = state.questions.findIndex((q) => q.id === id);
    if (index === -1) return;
    const [removed] = state.questions.splice(index, 1);
    persist();
    renderAll();
    toast('Question deleted', {
      label: 'Undo',
      run: () => {
        state.questions.splice(Math.min(index, state.questions.length), 0, removed);
        persist();
        renderAll();
      },
    });
  }

  function seedSheet() {
    const existing = new Set(state.questions.map((q) => `${q.category}|${q.title.toLowerCase()}`));
    const fresh = SHEET_01
      .filter(([category, title]) => !existing.has(`${category}|${title.toLowerCase()}`))
      .map(([category, title, difficulty]) => ({ id: uid(), title, category, difficulty, status: 'Pending' }));
    state.questions = [...state.questions, ...fresh];
    persist();
    renderAll();
    toast(fresh.length ? `Added ${plural(fresh.length, 'question')} from Sheet 01` : 'Sheet 01 is already loaded');
  }

  function clearFilters() {
    state.filters = { query: '', category: 'All', status: 'All', difficulty: 'All' };
    els.search.value = '';
    renderChips();
    renderFilterSelects();
    renderList();
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    store.write(KEYS.theme, theme);
  }

  /* ---------- 6. Events + boot ---------- */
  function bindEvents() {
    els.addBtn.addEventListener('click', () => openDialog());
    els.form.addEventListener('submit', handleSubmit);
    els.titleInput.addEventListener('input', () => showTitleError(''));

    // Close on Cancel / X, and on backdrop click.
    els.dlg.addEventListener('click', (e) => {
      if (e.target === els.dlg || e.target.closest('[data-close]')) els.dlg.close();
    });

    // Dashboard: machine-coding status
    els.stats.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-machine]');
      if (!btn) return;
      state.machine = btn.dataset.machine;
      store.write(KEYS.machine, state.machine);
      renderStats(computeStats());
    });

    // Filters
    els.search.addEventListener('input', () => {
      state.filters.query = els.search.value;
      renderList();
    });
    els.chips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-chip]');
      if (!chip) return;
      state.filters.category = chip.dataset.chip;
      renderChips();
      renderList();
    });
    els.statusFilter.addEventListener('change', () => {
      state.filters.status = els.statusFilter.value;
      renderList();
    });
    els.difficultyFilter.addEventListener('change', () => {
      state.filters.difficulty = els.difficultyFilter.value;
      renderList();
    });
    els.clearFilters.addEventListener('click', clearFilters);

    // List + empty states (event delegation)
    els.results.addEventListener('click', (e) => {
      const edit = e.target.closest('[data-edit]');
      const del = e.target.closest('[data-delete]');
      const action = e.target.closest('[data-action]');
      if (edit) openDialog(edit.dataset.edit);
      else if (del) deleteQuestion(del.dataset.delete);
      else if (action) {
        const type = action.dataset.action;
        if (type === 'add') openDialog();
        if (type === 'seed') seedSheet();
        if (type === 'clear') clearFilters();
      }
    });
    els.results.addEventListener('change', (e) => {
      const select = e.target.closest('[data-status-for]');
      if (select) setStatus(select.dataset.statusFor, select.value);
    });

    els.themeBtn.addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    els.resetBtn.addEventListener('click', () => {
      if (!window.confirm('Delete all questions and reset machine-coding status? This cannot be undone.')) return;
      state.questions = [];
      state.machine = 'Pending';
      store.remove(KEYS.questions);
      store.remove(KEYS.machine);
      clearFilters();
      renderAll();
      toast('All data cleared');
    });
  }

  buildRadioGroups();
  bindEvents();
  renderAll();
})();
