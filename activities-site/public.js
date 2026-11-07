// Student-facing screens: event list, event page (RSVP, add to calendar), check-in, my events.
(function () {
  'use strict';
  var P = window.P, h = P.h, L = P.L;

  function spotsPill(ev) {
    if (!ev.rsvp_open) return null;
    if (ev.spots_left === null || ev.spots_left === undefined) return P.pill('RSVP open', 'ok');
    if (ev.spots_left === 0) return P.pill('Full: waitlist open', 'warn');
    return P.pill(ev.spots_left + ' spot' + (ev.spots_left === 1 ? '' : 's') + ' left', 'ok');
  }
  function eventCard(ev) {
    return h('a', { class: 'item', href: '#/e/' + ev.id },
      h('div', { class: 't' }, ev.title),
      h('div', { class: 's' }, L.whenText(ev) + (ev.venue ? ' · ' + ev.venue : '')),
      h('div', { class: 'meta' },
        h('span', { class: 'sub' }, ev.body || ''),
        spotsPill(ev),
        ev.visibility === 'Members' ? P.pill('NTU students') : null,
        ev.my_rsvp ? P.pill('You: ' + ev.my_rsvp.status, ev.my_rsvp.status === 'Going' ? 'dark' : 'warn') : null));
  }

  // ---------- upcoming events ----------
  async function eventsList() {
    P.loading();
    var rows = P.must(await P.act.rpc('upcoming_events'));
    var intro = P.me ? null : h('div', { class: 'card' },
      h('div', null, 'Sign in with your NTU email to see events for NTU students and to RSVP in one tap.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { P.askSignIn(); } }, 'Sign in')));
    P.show(h('div', null, h('h2', null, 'Upcoming events'), intro,
      rows.length ? h('div', { class: 'list' }, rows.map(eventCard)) : h('p', { class: 'muted' }, 'No upcoming events are open right now. Check back soon.')));
  }

  // ---------- one event ----------
  var NOTICE = 'We use your name and email only to run this event: registration, attendance and safety. ' +
    'Guest details are deleted after the event. By ticking this box you agree.';

  function calendarButtons(ev) {
    var url = P.eventUrl(ev.id);
    if (!ev.start_date) return null;
    return h('div', { class: 'row' },
      h('a', { class: 'ghost btn-link', href: L.googleCalUrl(ev, url), target: '_blank', rel: 'noopener' }, 'Google Calendar'),
      h('button', { class: 'ghost', onclick: function () {
        P.download(ev.title.replace(/[^\w]+/g, '-').toLowerCase() + '.ics', L.eventICS(ev, url), 'text/calendar');
      } }, 'Apple / Outlook (.ics)'),
      h('button', { class: 'ghost', onclick: function () { P.copy(url); } }, 'Copy link'));
  }

  function ticket(ev, status, code, name, onCancel) {
    var waiting = status === 'Waitlist';
    return h('div', { class: 'card stack', 'data-testid': 'ticket' },
      h('div', null, P.pill(waiting ? 'On the waitlist' : 'You are going', waiting ? 'warn' : 'dark')),
      name ? h('div', null, name) : null,
      waiting ? h('p', { class: 'muted' }, 'We will move you up automatically if a place opens, and you can still check in on the day.')
              : h('p', { class: 'muted' }, 'Show this code at the door, or scan the event screen when you arrive.'),
      P.qr(code), h('div', { class: 'sub' }, 'Your code: ' + code),
      h('div', { class: 'row' }, h('button', { class: 'danger', onclick: onCancel }, 'Cancel my place')));
  }

  function checkinBox(ev, rerun) {
    if (!ev.checkin_open) return null;
    var code = h('input', { id: 'f-eventcode', inputmode: 'numeric', maxlength: 6, placeholder: '6-digit code', class: 'grow' });
    var result = h('div', null);
    return h('div', { class: 'card stack' },
      h('h3', { style: 'margin-top:0' }, 'Here at the event?'),
      h('div', { class: 'muted' }, 'Scan the QR code on the organisers\' screen with your camera, or type the 6-digit code shown there.'),
      h('div', { class: 'row' }, code, h('button', { class: 'btn', onclick: function () {
        var c = code.value.trim();
        if (c.length < 6) { P.toast('Enter the 6-digit code', true); return; }
        location.hash = '#/checkin/' + ev.id + '/' + c;
      } }, 'Check in')),
      result);
  }

  async function eventPage(p) {
    P.loading();
    var ev = P.must(await P.act.rpc('public_event', { aid: p.id }));
    if (!ev) {
      P.show(h('div', { class: 'card stack' }, h('h2', null, 'Event not found'),
        h('p', { class: 'muted' }, P.me ? 'This event is not open, or the link is wrong.' : 'This event may be for NTU students only. Sign in with your NTU email to see it.'),
        P.me ? null : h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { P.askSignIn(); } }, 'Sign in')),
        h('div', { class: 'row' }, P.link('#/events', 'All events'))));
      return;
    }
    var saved = P.prefs.get('guest_' + ev.id), guest = null;
    if (!ev.my_rsvp && saved && !P.me) {
      var gs = P.must(await P.act.rpc('guest_rsvp_status', { aid: ev.id, p_code: saved }));
      if (gs && gs.status !== 'Cancelled') guest = { status: gs.status, name: gs.name, code: saved };
      else P.prefs.del('guest_' + ev.id);
    }
    var again = function () { eventPage(p); };
    var panel;
    if (ev.my_rsvp) {
      panel = ticket(ev, ev.my_rsvp.status, ev.my_rsvp.code, P.me && P.me.name, async function () {
        if (!confirm('Cancel your place?')) return;
        if (await P.run(async function () { P.must(await P.act.rpc('cancel_rsvp', { aid: ev.id })); }, 'Cancelled')) again();
      });
    } else if (guest) {
      panel = ticket(ev, guest.status, guest.code, guest.name, async function () {
        if (!confirm('Cancel your registration?')) return;
        if (await P.run(async function () { P.must(await P.act.rpc('guest_cancel_rsvp', { aid: ev.id, p_code: guest.code })); }, 'Cancelled')) { P.prefs.del('guest_' + ev.id); again(); }
      });
    } else if (!ev.rsvp_open) {
      panel = h('div', { class: 'card' }, h('div', null, ev.status === 'Completed' ? 'This event has finished.' : 'RSVP is closed for this event.'));
    } else {
      panel = h('div', { class: 'stack' });
      var name = h('input', { id: 'f-name', placeholder: 'Your name', class: 'grow' });
      var nameRow = h('div', { class: 'row', hidden: true }, name);
      if (P.me) {
        var go = h('button', { class: 'btn', id: 'rsvp-btn', onclick: async function () {
          go.disabled = true;
          var r = await P.run(async function () { return P.must(await P.act.rpc('rsvp', { aid: ev.id, p_name: P.blank(name.value) })); });
          go.disabled = false;
          if (r && r.status) { P.toast(r.status === 'Going' ? 'You are going' : 'Added to the waitlist'); again(); }
          else if (!nameRow.dataset.shown) { nameRow.hidden = false; nameRow.dataset.shown = '1'; }
        } }, ev.spots_left === 0 ? 'Join the waitlist' : 'RSVP');
        panel.appendChild(h('div', { class: 'card stack' }, h('div', null, spotsPill(ev)), nameRow, h('div', { class: 'row' }, go)));
      } else {
        panel.appendChild(h('div', { class: 'card stack' },
          h('div', null, spotsPill(ev)),
          h('div', null, 'NTU student or staff? Sign in to RSVP in one tap.'),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { P.askSignIn(); } }, 'Sign in to RSVP'))));
        if (ev.guest_rsvp_open) {
          var gname = h('input', { id: 'g-name', placeholder: 'Full name', class: 'grow', autocomplete: 'name' });
          var gemail = h('input', { id: 'g-email', type: 'email', placeholder: 'Email', class: 'grow', autocomplete: 'email' });
          var gconsent = h('input', { id: 'g-consent', type: 'checkbox' });
          var gbtn = h('button', { class: 'btn', id: 'guest-btn', onclick: async function () {
            gbtn.disabled = true;
            var r = await P.run(async function () {
              return P.must(await P.act.rpc('guest_rsvp', { aid: ev.id, p_name: gname.value, p_email: gemail.value, p_consent: gconsent.checked }));
            });
            gbtn.disabled = false;
            if (r && r.code) { P.prefs.set('guest_' + ev.id, r.code); again(); }
          } }, 'Register as a guest');
          panel.appendChild(h('div', { class: 'card stack' },
            h('h3', { style: 'margin-top:0' }, 'Not from NTU? Register as a guest'),
            h('div', { class: 'row' }, gname), h('div', { class: 'row' }, gemail),
            h('label', { class: 'chk' }, gconsent, h('span', null, NOTICE + (P.cfg.CONTACT_EMAIL ? ' Questions: ' + P.cfg.CONTACT_EMAIL + '.' : ''))),
            h('div', { class: 'row' }, gbtn)));
        }
      }
    }

    var done = ev.status === 'Completed';
    P.show(h('div', { class: 'stack' },
      h('div', { class: 'hero' },
        h('div', { class: 'muted' }, ev.body || ''),
        h('h1', null, ev.title),
        h('div', null, L.whenText(ev)),
        ev.venue ? h('div', { class: 'muted' }, ev.venue) : null,
        ev.visibility === 'Members' ? h('div', { style: 'margin-top:8px' }, P.pill('For NTU students')) : null),
      ev.summary ? h('p', { style: 'white-space:pre-wrap' }, ev.summary) : null,
      /^https?:\/\//i.test(ev.photos_url || '') ? h('div', { class: 'row' }, h('a', { class: 'btn', id: 'photos-btn', href: ev.photos_url, target: '_blank', rel: 'noopener' }, 'See the photos')) : null,
      done ? null : calendarButtons(ev),
      panel,
      done ? null : checkinBox(ev, again),
      h('div', { class: 'row' }, P.link('#/events', 'All events'), P.me ? P.link('#/mine', 'My events') : null)));
  }

  // ---------- check-in (opened by scanning the organisers' screen) ----------
  async function checkinPage(p) {
    P.loading();
    var ev = P.must(await P.act.rpc('public_event', { aid: p.id }));
    var back = h('div', { class: 'row' }, P.link('#/e/' + p.id, 'Back to the event'));
    function tick(title, lines) {
      P.show(h('div', { class: 'card stack', 'data-testid': 'checkin-result' },
        h('div', { class: 'total' }, '✓'), h('h2', null, title), lines, back));
    }
    function fail(msg, extra) {
      P.show(h('div', { class: 'card stack', 'data-testid': 'checkin-result' }, h('h2', null, 'Not checked in'),
        h('p', { class: 'pill bad' }, msg), extra, back));
    }
    if (!ev) {
      fail(P.me ? 'This event is not open.' : 'Sign in with your NTU email to check in. Guests: open the event page you registered on.',
        P.me ? null : h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { P.askSignIn(); } }, 'Sign in')));
      return;
    }
    if (P.me) {
      var name = h('input', { id: 'f-name', placeholder: 'Your name', class: 'grow' });
      async function go() {
        var r;
        try { r = P.must(await P.act.rpc('check_in_with_code', { aid: p.id, p_code: p.code, p_name: P.blank(name.value) })); }
        catch (e) {
          var msg = P.friendly(e);
          if (/Add your name/i.test(msg)) {
            P.show(h('div', { class: 'card stack' }, h('h2', null, ev.title), h('p', null, 'We could not find your name on the roster. Add it to check in.'),
              h('div', { class: 'row' }, name), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: go }, 'Check in'))));
            return;
          }
          fail(msg); return;
        }
        if (r.status === 'already') tick('Already checked in', h('p', { class: 'muted' }, ev.title));
        else tick('You are checked in', [h('p', null, r.name), h('p', { class: 'muted' }, ev.title + (r.walk_in ? ' · no RSVP found, added as a walk-in' : ''))]);
      }
      await go();
      return;
    }
    // a guest: use the saved registration code, or ask for it
    async function guestGo(code) {
      try {
        var r = P.must(await P.act.rpc('guest_check_in', { aid: p.id, p_event_code: p.code, p_guest_code: code }));
        P.prefs.set('guest_' + p.id, code);
        tick(r.status === 'already' ? 'Already checked in' : 'You are checked in', [h('p', null, r.name), h('p', { class: 'muted' }, ev.title)]);
      } catch (e) { askCode(P.friendly(e)); }
    }
    function askCode(msg) {
      var code = h('input', { id: 'f-guestcode', placeholder: 'Your registration code', class: 'grow' });
      P.show(h('div', { class: 'card stack' }, h('h2', null, ev.title),
        msg ? h('p', { class: 'pill bad' }, msg) : null,
        h('p', null, 'Guests: enter the code from your registration.'),
        h('div', { class: 'row' }, code), h('div', { class: 'row' }, h('button', { class: 'btn', onclick: function () { guestGo(code.value.trim()); } }, 'Check in')),
        h('p', { class: 'muted' }, 'NTU student?'), h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: function () { P.askSignIn(); } }, 'Sign in instead'))));
    }
    var saved = P.prefs.get('guest_' + p.id);
    if (saved) await guestGo(saved); else askCode();
  }

  // ---------- my events ----------
  async function myEvents() {
    P.loading();
    var rows = P.must(await P.act.rpc('my_events'));
    P.show(h('div', null, h('h2', null, 'My events'),
      rows.length ? h('div', { class: 'list' }, rows.map(function (ev) {
        return h('a', { class: 'item', href: '#/e/' + ev.id },
          h('div', { class: 't' }, ev.title), h('div', { class: 's' }, L.whenText(ev) + (ev.venue ? ' · ' + ev.venue : '')),
          h('div', { class: 'meta' }, P.pill(ev.checked_in ? 'Checked in' : ev.rsvp_status, ev.checked_in || ev.rsvp_status === 'Going' ? 'dark' : 'warn'), ev.photos_url ? P.pill('Photos available', 'ok') : null));
      })) : h('p', { class: 'muted' }, 'You have not RSVPed to anything yet.'),
      h('div', { class: 'row' }, P.link('#/events', 'Browse events'))));
  }

  P.route('/events', { public: true, nav: 'events', fn: eventsList });
  P.route('/e/:id', { public: true, nav: 'events', fn: eventPage });
  P.route('/checkin/:id/:code', { public: true, nav: 'events', fn: checkinPage });
  P.route('/mine', { public: false, nav: 'mine', fn: myEvents });
})();
