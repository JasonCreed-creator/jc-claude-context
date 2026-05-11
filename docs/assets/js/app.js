/**
 * App — 메인 컨트롤러. 상태 관리, 이벤트 바인딩, 폴링 시작.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY_THEME = 'jc-meeting-dashboard:theme';

  var state = {
    config: null,
    rows: [],
    filter: { week: 'all', project: 'all', keyword: '' },
    selectedKey: null,
    stopPolling: null
  };

  function $(id) { return document.getElementById(id); }

  function toast(message, durationMs) {
    var t = $('toast');
    t.textContent = message;
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.hidden = true; }, durationMs || 2500);
  }

  function applyTheme(theme) {
    document.body.dataset.theme = theme;
    var btn = $('theme-toggle');
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? '라이트모드 토글' : '다크모드 토글');
  }

  function loadTheme() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY_THEME); } catch (e) { /* ignore */ }
    if (saved === 'dark' || saved === 'light') return saved;
    var prefersDark = global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  function saveTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch (e) { /* ignore */ }
  }

  function renderAll() {
    var rows = state.rows;
    var filtered = MeetingFilter.apply(rows, state.filter);

    var currentWeek = state.filter.week === 'all' ? MeetingFilter.currentWeekISO() : state.filter.week;
    MeetingRender.kpis(rows, currentWeek);
    MeetingRender.projectChips(state.config, rows, state.filter.project, function (project) {
      state.filter.project = project;
      renderAll();
    });
    MeetingRender.list(filtered, state.selectedKey, function (row) {
      state.selectedKey = MeetingRender.rowKey(row);
      MeetingRender.detail(row);
      // 모바일에서 상세 표시
      if (global.innerWidth <= 960) {
        document.querySelector('.list-panel').classList.add('is-hidden');
        document.querySelector('.detail-panel').classList.add('is-visible');
      }
      renderListSelection();
    });

    var selectedRow = filtered.find(function (r) { return MeetingRender.rowKey(r) === state.selectedKey; });
    if (selectedRow) MeetingRender.detail(selectedRow);
    else if (!state.selectedKey && filtered.length > 0 && global.innerWidth > 960) {
      // 데스크톱: 첫 항목 자동 선택
      state.selectedKey = MeetingRender.rowKey(filtered[0]);
      MeetingRender.detail(filtered[0]);
      renderListSelection();
    }
  }

  function renderListSelection() {
    var items = document.querySelectorAll('.meeting-item');
    items.forEach(function (it) {
      it.setAttribute('aria-selected', String(it.dataset.key === state.selectedKey));
    });
  }

  function populateWeekSelect() {
    var sel = $('week-select');
    var weeks = MeetingFilter.collectWeeks(state.rows);
    var current = state.filter.week;
    sel.innerHTML = '<option value="all">전체 주차</option>' +
      weeks.map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join('');
    sel.value = current;
  }

  function updateLastUpdated(source, errorMsg) {
    var label = $('last-updated');
    var src = $('data-source');
    var now = new Date();
    var hh = ('0' + now.getHours()).slice(-2);
    var mm = ('0' + now.getMinutes()).slice(-2);
    label.textContent = '마지막 갱신 ' + hh + ':' + mm;

    var srcLabel = {
      'sheet': '구글시트',
      'sample': '샘플 데이터',
      'sample-fallback': '샘플(시트 연결 실패)'
    }[source] || source;
    src.textContent = '데이터 소스: ' + srcLabel + (errorMsg ? ' · ' + errorMsg : '');
  }

  function onDataUpdate(result) {
    state.rows = result.rows || [];
    populateWeekSelect();
    renderAll();
    updateLastUpdated(result.source, result.error);
    if (result.source === 'sample-fallback') {
      toast('시트 연결 실패 — 샘플 데이터로 표시 중', 3500);
    }
  }

  function onDataError(err) {
    console.error('[App] 데이터 로드 오류:', err);
    toast('데이터 로드 오류: ' + err.message, 4000);
  }

  function bindEvents() {
    $('theme-toggle').addEventListener('click', function () {
      var next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      saveTheme(next);
    });

    $('week-select').addEventListener('change', function (e) {
      state.filter.week = e.target.value;
      state.selectedKey = null;
      renderAll();
    });

    var searchTimer = null;
    $('search-input').addEventListener('input', function (e) {
      var v = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        state.filter.keyword = v;
        state.selectedKey = null;
        renderAll();
      }, 180);
    });

    $('refresh-btn').addEventListener('click', function () {
      if (!state.config) return;
      SheetSource.fetchRows(state.config).then(onDataUpdate).catch(onDataError);
      toast('새로고침 중…', 1500);
    });

    // 모바일: 상세 → 리스트 복귀 (좌측 스와이프 대용 — 상세 외부 클릭)
    document.querySelector('.detail-panel').addEventListener('click', function (e) {
      if (global.innerWidth > 960) return;
      if (e.target.id === 'detail-empty' || e.target.classList.contains('detail-empty')) {
        document.querySelector('.list-panel').classList.remove('is-hidden');
        document.querySelector('.detail-panel').classList.remove('is-visible');
      }
    });
  }

  function applyConfigLinks(config) {
    var form = $('form-link');
    var edit = $('edit-link');
    if (config.links && config.links.form_url) {
      form.href = config.links.form_url;
    } else {
      form.classList.add('btn--ghost');
      form.classList.remove('btn--primary');
      form.title = 'config.json의 links.form_url을 설정하세요';
    }
    if (config.links && config.links.edit_url) {
      edit.href = config.links.edit_url;
    } else if (config.sheet && config.sheet.id) {
      edit.href = 'https://docs.google.com/spreadsheets/d/' + config.sheet.id + '/edit';
    } else {
      edit.title = 'config.json의 links.edit_url 또는 sheet.id를 설정하세요';
    }
  }

  function init() {
    applyTheme(loadTheme());
    bindEvents();

    SheetSource.loadConfig()
      .then(function (config) {
        state.config = config;
        document.title = config.app.title || document.title;
        applyConfigLinks(config);
        state.stopPolling = SheetSource.startPolling(config, onDataUpdate, onDataError);
      })
      .catch(function (err) {
        console.error('[App] config 로드 실패:', err);
        toast('config.json 로드 실패 — 콘솔을 확인하세요', 5000);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
