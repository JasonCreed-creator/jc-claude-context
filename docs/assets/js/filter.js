/**
 * Filter — 회의록 행 필터링 + 정렬 + 검색.
 *
 * window.MeetingFilter = {
 *   apply(rows, state) → filteredRows,
 *   collectWeeks(rows) → ["2026-W20", ...],
 *   currentWeekISO(date) → "YYYY-Wxx"
 * }
 */
(function (global) {
  'use strict';

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function isoWeek(date) {
    // ISO week: 목요일 기준
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + '-W' + pad2(weekNo);
  }

  function currentWeekISO(date) {
    return isoWeek(date || new Date());
  }

  function parseDate(str) {
    if (!str) return null;
    // 허용: 2026-05-11, 2026/05/11, 2026.05.11, gviz 'Date(2026,4,11)' 형식
    var gviz = String(str).match(/Date\((\d+),(\d+),(\d+)/);
    if (gviz) return new Date(parseInt(gviz[1]), parseInt(gviz[2]), parseInt(gviz[3]));
    var iso = String(str).replace(/[./]/g, '-');
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function rowWeek(row) {
    if (row.week && /^\d{4}-W\d{1,2}/.test(row.week)) {
      var m = row.week.match(/^(\d{4})-W(\d{1,2})/);
      return m[1] + '-W' + pad2(parseInt(m[2]));
    }
    var d = parseDate(row.meeting_date);
    return d ? isoWeek(d) : '';
  }

  function collectWeeks(rows) {
    var set = {};
    rows.forEach(function (r) { var w = rowWeek(r); if (w) set[w] = true; });
    return Object.keys(set).sort().reverse();
  }

  function matchesKeyword(row, keyword) {
    if (!keyword) return true;
    var hay = [
      row.title, row.author, row.attendees, row.project_tag,
      row.agenda_md, row.decisions_md, row.actions_md, row.note_md
    ].join(' ').toLowerCase();
    return hay.indexOf(keyword.toLowerCase()) !== -1;
  }

  function apply(rows, state) {
    state = state || {};
    var out = rows.slice();

    if (state.week && state.week !== 'all') {
      out = out.filter(function (r) { return rowWeek(r) === state.week; });
    }
    if (state.project && state.project !== 'all') {
      out = out.filter(function (r) { return (r.project_tag || '기타') === state.project; });
    }
    if (state.keyword) {
      out = out.filter(function (r) { return matchesKeyword(r, state.keyword); });
    }

    // 정렬: 회의일자 내림차순 (없으면 타임스탬프 기준)
    out.sort(function (a, b) {
      var da = parseDate(a.meeting_date) || parseDate(a.timestamp) || new Date(0);
      var db = parseDate(b.meeting_date) || parseDate(b.timestamp) || new Date(0);
      return db - da;
    });

    return out;
  }

  global.MeetingFilter = {
    apply: apply,
    collectWeeks: collectWeeks,
    currentWeekISO: currentWeekISO,
    rowWeek: rowWeek,
    parseDate: parseDate
  };
})(window);
