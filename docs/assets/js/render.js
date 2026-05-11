/**
 * Render — KPI 카드, 회의록 리스트, 상세 패널 렌더러.
 *
 * window.MeetingRender = {
 *   kpis(rows, currentWeek),
 *   list(rows, selectedKey, onSelect),
 *   detail(row),
 *   projectChips(config, rows, currentProject, onPick)
 * }
 */
(function (global) {
  'use strict';

  var MD = global.MiniMarkdown;
  var FILTER = global.MeetingFilter;

  function el(id) { return document.getElementById(id); }

  function rowKey(row) {
    return (row.meeting_date || '') + '|' + (row.title || '') + '|' + (row.author || '');
  }

  function formatDate(str) {
    var d = FILTER.parseDate(str);
    if (!d) return str || '';
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var dd = d.getDate();
    var w = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
    return y + '. ' + m + '. ' + dd + '. (' + w + ')';
  }

  function kpis(rows, currentWeek) {
    var weekRows = rows.filter(function (r) { return FILTER.rowWeek(r) === currentWeek; });
    var totals = { total: 0, done: 0 };
    rows.forEach(function (r) {
      var c = MD.countTasks(r.actions_md);
      totals.total += c.total;
      totals.done += c.done;
    });
    var open = totals.total - totals.done;
    var rate = totals.total === 0 ? 0 : Math.round((totals.done / totals.total) * 100);

    el('kpi-meetings').textContent = weekRows.length;
    el('kpi-actions').textContent = totals.total;
    el('kpi-completion').textContent = rate;
    el('kpi-open').textContent = open;
    var bar = el('kpi-completion-bar');
    if (bar) bar.style.width = rate + '%';
  }

  function dayDiff(a, b) {
    var ms = 24 * 60 * 60 * 1000;
    var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((da - db) / ms);
  }

  function recencyClass(row) {
    var d = FILTER.parseDate(row.meeting_date);
    if (!d) return { cls: '', tag: '' };
    var diff = dayDiff(d, new Date());
    if (diff === 0) return { cls: 'meeting-item--today', tag: '오늘' };
    if (FILTER.rowWeek(row) === FILTER.currentWeekISO()) {
      return { cls: 'meeting-item--this-week', tag: '이번주' };
    }
    return { cls: '', tag: '' };
  }

  function projectChips(config, rows, currentProject, onPick) {
    var container = el('project-chips');
    var counts = { all: rows.length };
    (config.projects || []).forEach(function (p) { counts[p] = 0; });
    rows.forEach(function (r) {
      var p = r.project_tag || '기타';
      counts[p] = (counts[p] || 0) + 1;
    });

    var entries = [['all', '전체']].concat((config.projects || []).map(function (p) { return [p, p]; }));
    container.innerHTML = '';
    entries.forEach(function (e) {
      var key = e[0];
      var label = e[1];
      var btn = document.createElement('button');
      btn.className = 'chip';
      btn.setAttribute('aria-pressed', String(key === currentProject));
      btn.dataset.project = key;
      btn.innerHTML = MD.escapeHtml(label) +
        ' <span class="chip__count">' + (counts[key] || 0) + '</span>';
      btn.addEventListener('click', function () { onPick(key); });
      container.appendChild(btn);
    });
  }

  function list(rows, selectedKey, onSelect) {
    var listEl = el('meeting-list');
    var empty = el('empty-state');
    var count = el('list-count');

    listEl.innerHTML = '';
    count.textContent = rows.length + '건';

    if (rows.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    rows.forEach(function (row) {
      var li = document.createElement('li');
      var key = rowKey(row);
      var recency = recencyClass(row);
      li.className = 'meeting-item' + (recency.cls ? ' ' + recency.cls : '');
      li.setAttribute('aria-selected', String(key === selectedKey));
      li.dataset.key = key;

      var tasks = MD.countTasks(row.actions_md);
      var taskBadge = tasks.total > 0
        ? '<span class="tag">액션 ' + tasks.done + '/' + tasks.total + '</span>'
        : '';
      var recencyBadge = recency.tag
        ? '<span class="tag ' + (recency.tag === '오늘' ? 'tag--today' : 'tag--week') + '">' + recency.tag + '</span>'
        : '';

      li.innerHTML =
        '<div class="meeting-item__row">' +
          '<span class="meeting-item__title">' + MD.escapeHtml(row.title || '(제목없음)') + '</span>' +
          '<span class="meeting-item__date">' + MD.escapeHtml(row.meeting_date || '') + '</span>' +
        '</div>' +
        '<div class="meeting-item__meta">' +
          recencyBadge +
          '<span class="tag tag--project">' + MD.escapeHtml(row.project_tag || '기타') + '</span>' +
          '<span class="tag tag--author">' + MD.escapeHtml(row.author || '') + '</span>' +
          taskBadge +
        '</div>';

      li.addEventListener('click', function () { onSelect(row); });
      listEl.appendChild(li);
    });
  }

  function section(label, mdBody) {
    if (!mdBody || !mdBody.trim()) return '';
    return '<div class="detail__section">' +
      '<h2>' + MD.escapeHtml(label) + '</h2>' +
      '<div class="detail__body">' + MD.render(mdBody) + '</div>' +
    '</div>';
  }

  function detail(row) {
    var panel = el('detail');
    var emptyState = el('detail-empty');

    if (!row) {
      panel.hidden = true;
      panel.innerHTML = '';
      emptyState.style.display = '';
      return;
    }

    emptyState.style.display = 'none';
    panel.hidden = false;

    var tasks = MD.countTasks(row.actions_md);
    var rate = tasks.total === 0 ? 0 : Math.round((tasks.done / tasks.total) * 100);

    panel.innerHTML =
      '<header class="detail__head">' +
        '<h1 class="detail__title">' + MD.escapeHtml(row.title || '(제목없음)') + '</h1>' +
        '<div class="detail__meta">' +
          '<span>📅 ' + MD.escapeHtml(formatDate(row.meeting_date)) + '</span>' +
          '<span>🗂 ' + MD.escapeHtml(row.project_tag || '기타') + '</span>' +
          '<span>✍️ ' + MD.escapeHtml(row.author || '') + '</span>' +
          '<span>👥 ' + MD.escapeHtml(row.attendees || '') + '</span>' +
          (tasks.total > 0 ? '<span>✅ ' + tasks.done + '/' + tasks.total + ' (' + rate + '%)</span>' : '') +
        '</div>' +
      '</header>' +
      section('안건', row.agenda_md) +
      section('결정사항', row.decisions_md) +
      section('액션아이템', row.actions_md) +
      (row.next_meeting ? section('다음 회의', '다음 회의: ' + row.next_meeting) : '') +
      section('비고', row.note_md);
  }

  global.MeetingRender = {
    kpis: kpis,
    list: list,
    detail: detail,
    projectChips: projectChips,
    rowKey: rowKey
  };
})(window);
