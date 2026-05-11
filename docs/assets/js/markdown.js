/**
 * MiniMarkdown — 의존성 0, 회의록용 최소 마크다운 → HTML 변환기.
 * 지원: H1-H3, **굵게**, *이탤릭*, `코드`, [링크](url), 인용 >,
 *       리스트 -/*, 체크박스 - [ ] / - [x], 코드블록 ```, 단락.
 * 보안: 입력 HTML을 먼저 escape 한 뒤에만 안전한 태그를 주입.
 *
 * 외부 노출:
 *   - window.MiniMarkdown.render(mdString) → htmlString
 *   - window.MiniMarkdown.countTasks(mdString) → { total, done }
 */
(function (global) {
  'use strict';

  function escapeHtml(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(url) {
    var clean = String(url || '').trim();
    // allow http(s)://, mailto:, relative or anchor — block javascript: etc.
    if (!/^(https?:\/\/|mailto:|\/|#|\.\/|\.\.\/)/i.test(clean)) return '#';
    return escapeHtml(clean);
  }

  function inline(text) {
    // text is already HTML-escaped here.
    return text
      .replace(/`([^`]+?)`/g, '<code>$1</code>')
      .replace(/\*\*([^\*]+?)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^\*])\*([^\*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
        return '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + label + '</a>';
      });
  }

  function render(md) {
    if (!md) return '';
    var src = String(md).replace(/\r\n?/g, '\n');
    var lines = src.split('\n');
    var out = [];
    var i = 0;

    function flushParagraph(buf) {
      if (!buf.length) return;
      var joined = buf.join(' ').trim();
      if (joined) out.push('<p>' + inline(escapeHtml(joined)) + '</p>');
      buf.length = 0;
    }

    var para = [];
    var listType = null;       // 'ul' | 'ol' | 'task'
    var listBuf = [];

    function flushList() {
      if (!listType) return;
      if (listType === 'task') {
        out.push('<ul class="task-list">' + listBuf.join('') + '</ul>');
      } else {
        out.push('<' + listType + '>' + listBuf.join('') + '</' + listType + '>');
      }
      listType = null;
      listBuf = [];
    }

    while (i < lines.length) {
      var line = lines[i];

      // fenced code block
      if (/^```/.test(line)) {
        flushParagraph(para);
        flushList();
        var code = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) {
          code.push(lines[i]);
          i++;
        }
        out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
        i++;
        continue;
      }

      // blank line
      if (/^\s*$/.test(line)) {
        flushParagraph(para);
        flushList();
        i++;
        continue;
      }

      // headers
      var hMatch = line.match(/^(#{1,3})\s+(.*)$/);
      if (hMatch) {
        flushParagraph(para);
        flushList();
        var level = hMatch[1].length;
        out.push('<h' + level + '>' + inline(escapeHtml(hMatch[2].trim())) + '</h' + level + '>');
        i++;
        continue;
      }

      // blockquote
      if (/^>\s?/.test(line)) {
        flushParagraph(para);
        flushList();
        var quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + inline(escapeHtml(quoteLines.join(' '))) + '</blockquote>');
        continue;
      }

      // task list  - [ ] / - [x]
      var taskMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
      if (taskMatch) {
        flushParagraph(para);
        if (listType && listType !== 'task') flushList();
        listType = 'task';
        var done = /[xX]/.test(taskMatch[1]);
        var boxCls = done ? 'task-checkbox task-checkbox--done' : 'task-checkbox';
        var boxContent = done ? '✓' : '';
        listBuf.push(
          '<li><span class="' + boxCls + '" aria-hidden="true">' + boxContent + '</span>' +
          '<span class="task-text">' + inline(escapeHtml(taskMatch[2])) + '</span></li>'
        );
        i++;
        continue;
      }

      // unordered list
      var ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
      if (ulMatch) {
        flushParagraph(para);
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listBuf.push('<li>' + inline(escapeHtml(ulMatch[1])) + '</li>');
        i++;
        continue;
      }

      // ordered list
      var olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
      if (olMatch) {
        flushParagraph(para);
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listBuf.push('<li>' + inline(escapeHtml(olMatch[1])) + '</li>');
        i++;
        continue;
      }

      // paragraph accumulator
      flushList();
      para.push(line);
      i++;
    }

    flushParagraph(para);
    flushList();

    return out.join('\n');
  }

  function countTasks(md) {
    if (!md) return { total: 0, done: 0 };
    var src = String(md);
    var total = (src.match(/^\s*[-*]\s+\[[ xX]\]/gm) || []).length;
    var done = (src.match(/^\s*[-*]\s+\[[xX]\]/gm) || []).length;
    return { total: total, done: done };
  }

  global.MiniMarkdown = { render: render, countTasks: countTasks, escapeHtml: escapeHtml };
})(window);
