// Pure helpers (no page or network code), so they can be tested on their own.
(function (root) {
  'use strict';

  // Parses CSV text (also accepts tab-separated). Handles quotes, CRLF and a leading BOM.
  function parseCSV(text) {
    text = String(text || '').replace(/^﻿/, '');
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    const delim = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
    const rows = [];
    let row = [], cur = '', inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
        } else cur += c;
      } else if (c === '"') inQuotes = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  }

  // First row = headers. Returns { headers, data: [ {header: value} ] }. Values are trimmed.
  function toObjects(rows) {
    if (!rows.length) return { headers: [], data: [] };
    const headers = rows[0].map(function (h) { return String(h).trim(); });
    const data = rows.slice(1).map(function (r) {
      const o = {};
      headers.forEach(function (h, i) { o[h] = String(r[i] === undefined ? '' : r[i]).trim(); });
      return o;
    });
    return { headers: headers, data: data };
  }

  // Reads the first matching column (case-insensitive, otherwise exact: "Matric No." is not "Matric No").
  function pick(o, names) {
    const keys = Object.keys(o);
    for (let n = 0; n < names.length; n++) {
      const want = names[n].toLowerCase();
      for (let k = 0; k < keys.length; k++) {
        if (keys[k].toLowerCase() === want) return o[keys[k]];
      }
    }
    return '';
  }

  function splitEmails(s) {
    return String(s || '').split(/[,;\s]+/).map(function (e) { return e.trim().toLowerCase(); })
      .filter(function (e) { return e.indexOf('@') > 0; });
  }

  function normStatus(s) {
    const v = String(s || '').trim().toLowerCase();
    if (v === 'loa') return 'LOA';
    if (v === 'graduated') return 'Graduated';
    if (v === 'dropped out') return 'Dropped Out';
    return 'Active';
  }

  // Academic years start in July: Jul 2026 to Jun 2027 has base year 2026.
  function defaultBaseYear(d) {
    d = d || new Date();
    return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  }

  // "AY26/27" from a base year
  function ayLabel(baseYear) {
    const a = String(baseYear).slice(-2);
    const b = String(baseYear + 1).slice(-2);
    return 'AY' + a + '/' + b;
  }

  // Email groups for one academic year.
  // bodies: [{id, name, level, status, parent_committee, contact_email}]
  // people: roster rows [{body_id, body, matric, full_name, role_tier, is_top}]
  // emailByMatric: { matric: email }
  function buildGroups(bodies, people, emailByMatric) {
    const groups = {};
    const missing = [];
    function add(name, list) {
      if (!groups[name]) groups[name] = new Set();
      list.forEach(function (e) { groups[name].add(e); });
    }
    const byBody = {};
    people.forEach(function (p) { (byBody[p.body_id] = byBody[p.body_id] || []).push(p); });

    bodies.forEach(function (b) {
      if (b.status === 'Inactive') return;
      const lvl = String(b.level || '').toLowerCase();
      const contacts = splitEmails(b.contact_email);
      const leaders = [], others = [];
      (byBody[b.id] || []).forEach(function (p) {
        const em = String(emailByMatric[p.matric] || '').trim().toLowerCase();
        if (em.indexOf('@') < 0) {
          missing.push({ matric: p.matric, name: p.full_name, body: b.name, role: p.role_tier });
          return;
        }
        (p.is_top ? leaders : others).push(em);
      });
      const parent = String(b.parent_committee || '').trim() || 'Independent CCAs';
      if (lvl === 'exco') {
        add('ExCo', contacts.concat(leaders, others));
      } else if (lvl.indexOf('committee') >= 0) {
        add('Committee Heads', contacts.concat(leaders));
        add('Committee Members', others);
      } else if (lvl.indexOf('cca') >= 0 || lvl.indexOf('project') >= 0) {
        add('CCA Heads (' + parent + ')', contacts.concat(leaders));
        add('CCA Members (' + parent + ')', others);
      } else if (lvl === 'year') {
        add('Year Reps', contacts.concat(leaders));
        add('Stream Reps', others);
      } else if (lvl === 'house') {
        add('House Reps', contacts.concat(leaders, others));
      }
    });

    const list = Object.keys(groups).sort().map(function (name) {
      return { name: name, emails: Array.from(groups[name]) };
    }).filter(function (g) { return g.emails.length > 0; });
    return { groups: list, missing: missing };
  }

  const api = { parseCSV: parseCSV, toObjects: toObjects, pick: pick, splitEmails: splitEmails,
                normStatus: normStatus, defaultBaseYear: defaultBaseYear, ayLabel: ayLabel, buildGroups: buildGroups };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RecordsLib = api;
})(typeof window !== 'undefined' ? window : globalThis);
