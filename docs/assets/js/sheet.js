/**
 * Sheet — 구글시트 gviz/tq JSON 또는 sample-data.json을 정규화된 회의록 배열로 반환.
 *
 * 외부 노출: window.SheetSource = {
 *   loadConfig(),
 *   fetchRows(config),
 *   startPolling(config, onUpdate, onError) → stop()
 * }
 */
(function (global) {
  'use strict';

  function loadConfig() {
    return fetch('config.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('config.json 로드 실패 (' + r.status + ')');
        return r.json();
      });
  }

  function parseGvizResponse(text) {
    // gviz/tq returns: /*O_o*/\ngoogle.visualization.Query.setResponse({...});
    var first = text.indexOf('{');
    var last = text.lastIndexOf('}');
    if (first === -1 || last === -1) throw new Error('gviz 응답 형식 오류');
    return JSON.parse(text.slice(first, last + 1));
  }

  function normalizeGvizTable(table, columnMapping) {
    var labels = (table.cols || []).map(function (c) { return (c.label || c.id || '').trim(); });
    // 매핑: column_mapping의 값(시트 헤더 라벨) → 표준 키
    var reverse = {};
    Object.keys(columnMapping || {}).forEach(function (stdKey) {
      reverse[columnMapping[stdKey]] = stdKey;
    });
    var idx = {};
    labels.forEach(function (label, i) {
      var stdKey = reverse[label];
      if (stdKey) idx[stdKey] = i;
    });

    return (table.rows || []).map(function (row) {
      var cells = row.c || [];
      function cellAt(stdKey) {
        if (idx[stdKey] == null) return '';
        var cell = cells[idx[stdKey]];
        if (!cell) return '';
        if (cell.f != null && cell.f !== '') return String(cell.f);
        if (cell.v == null) return '';
        return String(cell.v);
      }
      return {
        timestamp: cellAt('timestamp'),
        meeting_date: cellAt('meeting_date'),
        week: cellAt('week'),
        title: cellAt('title'),
        project_tag: cellAt('project_tag'),
        author: cellAt('author'),
        attendees: cellAt('attendees'),
        agenda_md: cellAt('agenda_md'),
        decisions_md: cellAt('decisions_md'),
        actions_md: cellAt('actions_md'),
        next_meeting: cellAt('next_meeting'),
        note_md: cellAt('note_md')
      };
    });
  }

  function buildGvizUrl(sheetId, gid, sheetName) {
    var base = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) + '/gviz/tq';
    var params = 'tqx=out:json';
    if (sheetName) params += '&sheet=' + encodeURIComponent(sheetName);
    else if (gid) params += '&gid=' + encodeURIComponent(gid);
    // 캐시 회피
    params += '&_=' + Date.now();
    return base + '?' + params;
  }

  function fetchFromSheet(config) {
    var url = buildGvizUrl(config.sheet.id, config.sheet.gid, config.sheet.sheet_name);
    return fetch(url, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('시트 응답 오류 (' + r.status + ')');
        return r.text();
      })
      .then(function (text) {
        var parsed = parseGvizResponse(text);
        if (parsed.status === 'error') {
          var errMsg = (parsed.errors && parsed.errors[0] && parsed.errors[0].detailed_message) || '시트 오류';
          throw new Error(errMsg);
        }
        return {
          source: 'sheet',
          rows: normalizeGvizTable(parsed.table || {}, config.column_mapping)
        };
      });
  }

  function fetchFromSample() {
    return fetch('sample-data.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('샘플 데이터 로드 실패');
        return r.json();
      })
      .then(function (data) {
        return { source: 'sample', rows: data.rows || [] };
      });
  }

  function fetchRows(config) {
    if (config && config.sheet && config.sheet.id) {
      return fetchFromSheet(config).catch(function (err) {
        // 시트 실패 시 샘플로 fallback (개발 편의)
        console.warn('[Sheet] fetch 실패, 샘플로 폴백:', err.message);
        return fetchFromSample().then(function (result) {
          result.source = 'sample-fallback';
          result.error = err.message;
          return result;
        });
      });
    }
    return fetchFromSample();
  }

  function startPolling(config, onUpdate, onError) {
    var interval = (config.app && config.app.polling_interval_ms) || 30000;
    var stopped = false;
    var timer = null;

    function tick() {
      if (stopped) return;
      fetchRows(config)
        .then(function (result) { if (!stopped) onUpdate(result); })
        .catch(function (err) { if (!stopped && onError) onError(err); })
        .finally(function () {
          if (!stopped) timer = setTimeout(tick, interval);
        });
    }

    tick();
    return function stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  global.SheetSource = {
    loadConfig: loadConfig,
    fetchRows: fetchRows,
    startPolling: startPolling
  };
})(window);
