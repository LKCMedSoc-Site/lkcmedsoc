// "To do": things waiting for the signed-in person to approve. The tab shows how many.
(function () {
  'use strict';
  var P = window.P, h = P.h;
  var STEP_LABEL = { COMMITTEE_HEAD: 'Committee head', EXCO_ATTACHE: 'ExCo attaché', SLS: 'SLS', SAO: 'SAO officer' };

  // Activities whose next approval step is mine, plus write-ups waiting for review.
  P.loadWaiting = async function () {
    var out = { acts: [], posts: 0 };
    var subs = P.must(await P.act.from('activity_list').select('id,title,body,status').eq('status', 'Submitted'));
    if (subs.length) {
      var steps = P.must(await P.act.from('approvals').select('activity_id,step,ord,status').in('activity_id', subs.map(function (s) { return s.id; })));
      for (var i = 0; i < subs.length; i++) {
        var mine = steps.filter(function (s) { return s.activity_id === subs[i].id; }).sort(function (x, y) { return x.ord - y.ord; });
        var next = mine.filter(function (s) { return s.status !== 'Approved'; })[0];
        if (!next || next.status !== 'Pending') continue;
        var ok = P.exco || (next.step === 'COMMITTEE_HEAD' && !!P.must(await P.act.rpc('can_decide_step', { aid: subs[i].id, p_step: next.step })));
        if (ok) out.acts.push({ id: subs[i].id, title: subs[i].title, body: subs[i].body, step: next.step });
      }
    }
    if (P.approver || P.exco) {
      try {
        var q = P.act.from('posts_flat').select('id,author_email').eq('status', 'Submitted');
        var rows = P.must(await q);
        out.posts = rows.filter(function (r) { return P.exco || r.author_email !== P.me.email; }).length;
      } catch (e) { /* write-up functions not installed */ }
    }
    return out;
  };

  P.route('/todo', { nav: 'todo', fn: async function () {
    P.loading();
    var w = await P.loadWaiting();
    P.badge = w.acts.length + w.posts;
    if (P.onRoute) P.onRoute({ nav: 'todo' });
    P.show(h('div', null, h('h2', null, 'To do'),
      !w.acts.length && !w.posts ? h('p', { class: 'muted' }, 'Nothing is waiting for you.') : null,
      w.acts.length ? h('div', { class: 'list' }, w.acts.map(function (a) {
        return h('a', { class: 'item', href: '#/a/' + a.id },
          h('div', { class: 't' }, a.title), h('div', { class: 's' }, (a.body || '') + ' · waiting for your approval'),
          h('div', { class: 'meta' }, P.pill(STEP_LABEL[a.step] || a.step, 'dark')));
      })) : null,
      w.posts ? h('div', { class: 'row' }, P.link('#/review', w.posts + ' write-up' + (w.posts === 1 ? '' : 's') + ' to review')) : null));
  } });
})();
