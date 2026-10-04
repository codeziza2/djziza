/* DJ Ziza — site behavior. No dependencies. */
(function () {
  'use strict';

  // ===========================================================================
  // Settings
  // ===========================================================================
  // The forms' AWS Function URL (see GO-LIVE.md, part 3).
  // While it's empty, forms fall back to opening the visitor's email app.
  var FORM_ENDPOINT = 'https://pxrdo44d63zs32thmfgpx6doua0mbwsu.lambda-url.us-east-2.on.aws/';
  var FALLBACK_TO = 'djziza@denwize.com';

  // Event videos: CloudFront address in front of the ziza-moments S3 bucket (see ziza-moments.yaml).
  // Upload a video to the bucket's videos/ folder and it appears on the site. Give its thumbnail the
  // same name (party-2025.mp4 + party-2025.jpg). Leave empty to hide the section and its menu link.
  var MEDIA_URL = 'https://d1qkitd2sch2hj.cloudfront.net';
  var MEDIA_PREFIX = 'videos/';

  var MIXCLOUD_USER = 'djziza';
  var MIX_LIMIT = 13; // newest mixes to show

  // Shown when Mixcloud can't be reached. Same shape as Mixcloud's API.
  var FALLBACK_MIXES = [
    { key: '/djziza/summer-in-kigali/', url: 'https://www.mixcloud.com/djziza/summer-in-kigali/', name: 'Summer In Kigali', audio_length: 2035, tags: [{ name: 'Afrobeats' }] },
    { key: '/djziza/ziza-vibez-vol-2/', url: 'https://www.mixcloud.com/djziza/ziza-vibez-vol-2/', name: 'Ziza Vibez Vol. 2', audio_length: 1801, tags: [{ name: 'Zouk' }] },
    { key: '/djziza/dj-ziza-presents-ziza-vibez-vol-1/', url: 'https://www.mixcloud.com/djziza/dj-ziza-presents-ziza-vibez-vol-1/', name: 'Ziza Vibez Vol. 1', audio_length: 979, tags: [{ name: 'Afrobeat' }] }
  ];

  // ===========================================================================
  // Helpers
  // ===========================================================================
  var PAGE_LOADED_AT = Date.now();
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function val(el) { return el && typeof el.value === 'string' ? el.value.trim() : ''; }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  // Accepts YYYY-MM-DD (date pickers) or MM/DD/YYYY (typed). Returns YYYY-MM-DD or ''.
  function normalizeDate(s) {
    s = (s || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!m) {
      m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
      if (m) m = [m[0], m[3], m[1], m[2]];
    }
    if (!m) return '';
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
    return y + '-' + pad(mo) + '-' + pad(d);
  }
  function prettyDate(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Current year in footers
  document.querySelectorAll('.year').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // ===========================================================================
  // Mobile menu
  // ===========================================================================
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  if (toggle && nav) {
    var closeNav = function () { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); };
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('is-open') && !nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeNav(); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 900) closeNav(); });
  }

  // ===========================================================================
  // Package links preselect the package in the booking form
  // ===========================================================================
  var pkgSelect = document.getElementById('f-package');
  document.querySelectorAll('[data-package]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (!pkgSelect) return;
      pkgSelect.value = link.getAttribute('data-package');
      var first = document.getElementById('f-name');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, reduceMotion ? 0 : 450);
    });
  });

  // ===========================================================================
  // Mixes: pulled live from Mixcloud so new uploads appear automatically
  // ===========================================================================
  (function initMixes() {
    var featured = document.getElementById('mix-featured');
    if (!featured) return;
    var listEl = document.getElementById('mix-list');
    var moreEl = document.getElementById('mix-more');
    var statusEl = document.getElementById('mix-status');
    var part = function (role) { return featured.querySelector('[data-role="' + role + '"]'); };
    var mixes = [];

    function fmtLength(sec) {
      if (!sec) return '';
      var m = Math.round(sec / 60);
      return m >= 60 ? Math.floor(m / 60) + ' hr ' + (m % 60) + ' min' : m + ' min';
    }
    function fmtDate(iso) {
      if (!iso) return '';
      var d = new Date(iso);
      return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    function safeUrl(u, fallback) { return /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : fallback; }
    function normalize(m, i) {
      var pics = m.pictures || {};
      return {
        key: String(m.key || ''),
        url: safeUrl(m.url, 'https://www.mixcloud.com/' + MIXCLOUD_USER + '/'),
        name: String(m.name || 'Untitled mix'),
        date: fmtDate(m.created_time),
        length: fmtLength(m.audio_length),
        tags: (m.tags || []).slice(0, 3).map(function (t) { return String(t.name || ''); }).filter(Boolean),
        cover: safeUrl(pics['320wx320h'] || pics.large || pics.medium, ''),
        tile: i % 4
      };
    }
    function coverHtml(mix) {
      return mix.cover
        ? '<img src="' + esc(mix.cover) + '" alt="" loading="lazy" width="320" height="320">'
        : '<span class="mix-tile tile-' + mix.tile + '">' + esc(mix.name) + '</span>';
    }
    function announce(text) { if (statusEl) statusEl.textContent = text; }

    function play(key, name) {
      var player = part('player');
      player.innerHTML = '<iframe title="Mix player: ' + esc(name) + '" height="120" allow="autoplay; encrypted-media" src="https://www.mixcloud.com/widget/iframe/?hide_cover=1&amp;light=1&amp;autoplay=1&amp;feed=' + encodeURIComponent(key) + '"></iframe>';
      player.hidden = false;
      announce('Playing ' + name);
    }

    function show(index, autoplay) {
      var mix = mixes[index];
      part('cover').innerHTML = coverHtml(mix);
      part('label').textContent = index === 0 ? 'Latest mix' : 'Selected mix';
      part('name').textContent = mix.name;
      part('meta').textContent = [mix.date, mix.length, mix.tags.join(', ')].filter(Boolean).join('  /  ');
      part('play').setAttribute('data-key', mix.key);
      part('play').setAttribute('data-name', mix.name);
      part('link').href = mix.url;
      part('player').hidden = true;
      part('player').innerHTML = '';
      listEl.querySelectorAll('.mix-card').forEach(function (card) {
        card.setAttribute('aria-pressed', card.getAttribute('data-index') === String(index) ? 'true' : 'false');
      });
      if (autoplay) play(mix.key, mix.name);
    }

    part('play').addEventListener('click', function () {
      play(this.getAttribute('data-key'), this.getAttribute('data-name') || part('name').textContent);
    });

    listEl.addEventListener('click', function (e) {
      var card = e.target.closest('.mix-card');
      if (!card) return;
      show(Number(card.getAttribute('data-index')), true);
      featured.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    });

    function render(list) {
      mixes = (list || []).filter(function (m) { return m && m.key; }).slice(0, MIX_LIMIT).map(normalize);
      if (!mixes.length) return;
      listEl.innerHTML = mixes.map(function (mix, i) {
        return '<li><button type="button" class="mix-card" data-index="' + i + '" aria-pressed="' + (i === 0) + '">' +
          '<span class="mix-cover">' + coverHtml(mix) + '</span>' +
          '<span class="mix-card-text"><span class="mix-card-name">' + esc(mix.name) + '</span>' +
          '<span class="mix-card-meta">' + esc([mix.length, mix.tags[0], mix.date].filter(Boolean).join(', ')) + '</span></span>' +
          '<span class="mix-card-play" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' +
          '</button></li>';
      }).join('');
      moreEl.hidden = mixes.length < 2;
      show(0, false);
    }

    function viaFetch() {
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
      return fetch('https://api.mixcloud.com/' + MIXCLOUD_USER + '/cloudcasts/?limit=' + MIX_LIMIT, ctrl ? { signal: ctrl.signal } : {})
        .then(function (r) { if (!r.ok) throw new Error('Mixcloud ' + r.status); return r.json(); })
        .then(function (d) { clearTimeout(timer); return d.data || []; }, function (err) { clearTimeout(timer); throw err; });
    }

    // Older browsers / blocked CORS: Mixcloud also answers as JSONP.
    function viaJsonp() {
      return new Promise(function (resolve, reject) {
        var cb = '__ziza_mixes_' + Date.now();
        var s = document.createElement('script');
        var timer = setTimeout(function () { cleanup(); reject(new Error('timeout')); }, 6000);
        function cleanup() { clearTimeout(timer); try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); }
        window[cb] = function (d) { cleanup(); resolve((d && d.data) || []); };
        s.onerror = function () { cleanup(); reject(new Error('jsonp failed')); };
        s.src = 'https://api.mixcloud.com/' + MIXCLOUD_USER + '/cloudcasts/?limit=' + MIX_LIMIT + '&callback=' + cb;
        document.head.appendChild(s);
      });
    }

    // Render the built-in list immediately, then swap in live data if it arrives.
    render(FALLBACK_MIXES);
    if (window.MIX_SAMPLE) { render(window.MIX_SAMPLE); return; }
    viaFetch()
      .catch(viaJsonp)
      .then(function (list) { if (list && list.length) render(list); })
      .catch(function () { /* keep the built-in list */ });
  })();

  // ===========================================================================
  // Ziza moments: event videos listed live from S3 (through CloudFront)
  // ===========================================================================
  (function initMoments() {
    var section = document.getElementById('moments');
    var grid = document.getElementById('moments-grid');
    if (!section || !grid) return;
    if (!MEDIA_URL) { section.hidden = true; document.querySelectorAll('a[href$="#moments"]').forEach(function (a) { a.hidden = true; }); return; }
    var base = MEDIA_URL.replace(/\/$/, '');
    var VIDEO = /\.(mp4|m4v|webm|mov)$/i, IMAGE = /\.(jpe?g|png|webp)$/i;

    function stem(key) { return key.slice(MEDIA_PREFIX.length).replace(/\.[^.]+$/, '').toLowerCase(); }
    function title(key) {
      return key.slice(MEDIA_PREFIX.length).replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
        .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    function url(key) { return base + '/' + key.split('/').map(encodeURIComponent).join('/'); }
    function type(key) { var ext = key.split('.').pop().toLowerCase(); return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4'; }

    function showNote() {
      grid.classList.add('is-single');
      grid.innerHTML = '<p class="moments-note">New clips are on the way. Catch the latest on <a class="text-link" href="https://www.instagram.com/iamdjziza/" rel="noopener" target="_blank">Instagram @iamdjziza</a>.</p>';
    }

    function render(objects) {
      var videos = objects.filter(function (o) { return VIDEO.test(o.key); });
      if (!videos.length) { showNote(); return; }
      var images = objects.filter(function (o) { return IMAGE.test(o.key); });
      var byStem = {};
      images.forEach(function (o) { byStem[stem(o.key)] = o.key; });
      videos.sort(function (a, b) { return b.modified - a.modified; });

      grid.classList.toggle('is-single', videos.length === 1);
      grid.innerHTML = videos.map(function (v) {
        // Thumbnail: same name as the video; if there's exactly one video and one image, pair them.
        var poster = byStem[stem(v.key)] || (videos.length === 1 && images.length === 1 ? images[0].key : '');
        return '<figure class="moment"><div class="moment-media">' +
          '<video controls playsinline preload="none"' + (poster ? ' poster="' + esc(url(poster)) + '"' : '') + ' aria-label="' + esc(title(v.key)) + '">' +
          '<source src="' + esc(url(v.key)) + '" type="' + type(v.key) + '">' +
          '</video></div><figcaption><span class="moment-title">' + esc(title(v.key)) + '</span></figcaption></figure>';
      }).join('');

      // Only one video plays at a time; match the frame to the thumbnail's shape (e.g. vertical clips)
      grid.querySelectorAll('video').forEach(function (vid) {
        vid.addEventListener('play', function () {
          grid.querySelectorAll('video').forEach(function (other) { if (other !== vid) other.pause(); });
        });
        var p = vid.getAttribute('poster');
        if (p) {
          var img = new Image();
          img.onload = function () { if (img.naturalWidth && img.naturalHeight) vid.parentNode.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight; };
          img.src = p;
        }
      });

      if (location.hash === '#moments') section.scrollIntoView();
    }

    if (window.MOMENTS_SAMPLE) { render(window.MOMENTS_SAMPLE); return; }

    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch(base + '/', ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('media ' + r.status); return r.text(); })
      .then(function (xml) {
        clearTimeout(timer);
        var doc = new DOMParser().parseFromString(xml, 'application/xml');
        var objects = Array.prototype.map.call(doc.getElementsByTagName('Contents'), function (c) {
          var get = function (tag) { var el = c.getElementsByTagName(tag)[0]; return el ? el.textContent : ''; };
          return { key: get('Key'), modified: Date.parse(get('LastModified')) || 0, size: +get('Size') || 0 };
        }).filter(function (o) { return o.key.indexOf(MEDIA_PREFIX) === 0 && o.size > 0; });
        render(objects);
      })
      .catch(function (err) {
        clearTimeout(timer);
        if (window.console) console.warn('Ziza moments: could not load videos', err);
        showNote();
      });
  })();

  // ===========================================================================
  // Forms
  // ===========================================================================
  function setupForm(form, opts) {
    if (!form) return;
    var errorEl = form.querySelector('.form-error');
    var doneEl = form.querySelector('.form-done');
    var hintEl = form.querySelector('.form-hint');
    var button = form.querySelector('button[type="submit"]');
    var buttonText = button.textContent.trim();
    var dateEl = form.querySelector('input[name="date"]');

    if (dateEl) dateEl.min = todayISO();
    if (hintEl) {
      hintEl.textContent = FORM_ENDPOINT
        ? 'Ziza will reply to the email address you enter.'
        : 'This opens your email app with everything filled in, ready to send.';
    }

    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') e.target.setAttribute('aria-invalid', 'false');
      if (!doneEl.hidden && FORM_ENDPOINT) doneEl.hidden = true;
    });

    function showError(html) { errorEl.innerHTML = html; errorEl.hidden = false; }

    function openEmailApp() {
      var msg = opts.email(form.elements);
      window.location.href = 'mailto:' + FALLBACK_TO + '?subject=' + encodeURIComponent(msg.subject) + '&body=' + encodeURIComponent(msg.body);
    }

    function validate() {
      var problems = [];
      var f = form.elements;
      function mark(el, ok) { el.setAttribute('aria-invalid', ok ? 'false' : 'true'); if (!ok) problems.push(el); }
      mark(f.name, val(f.name).length >= 2);
      mark(f.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val(f.email)));
      var iso = normalizeDate(f.date.value);
      var dateOk = !!iso && iso >= todayISO();
      mark(f.date, dateOk);
      if (dateOk) f.date.dataset.iso = iso;
      return { problems: problems, dateIsPast: !!iso && iso < todayISO() };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (button.disabled) return;
      var v = validate();
      if (v.problems.length) {
        showError(v.dateIsPast ? 'That date has already passed. Pick an upcoming event date.' : opts.errorText);
        v.problems[0].focus();
        return;
      }
      errorEl.hidden = true;

      if (!FORM_ENDPOINT) {
        openEmailApp();
        doneEl.innerHTML = '<p class="display done-title">Almost there.</p><p>Your email app should be open with everything filled in. Just hit send. If nothing opened, email <a href="mailto:' + FALLBACK_TO + '">' + FALLBACK_TO + '</a>.</p>';
        doneEl.hidden = false;
        doneEl.focus();
        return;
      }

      var payload = opts.payload(form.elements);
      payload.date = form.elements.date.dataset.iso;
      payload.company = val(form.elements.company);
      payload.elapsed = Date.now() - PAGE_LOADED_AT;

      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.textContent = 'Sending…';

      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) { return { status: res.status, ok: res.ok && data.ok, data: data }; });
        })
        .then(function (r) {
          clearTimeout(timer);
          if (!r.ok) {
            var err = new Error(r.data.error || 'Send failed');
            err.userFacing = r.status === 400 && r.data.error;
            throw err;
          }
          var first = val(form.elements.name).split(/\s+/)[0];
          var replyTo = val(form.elements.email);
          // Clear the form so it's ready to use again
          form.reset();
          if (dateEl) { delete dateEl.dataset.iso; dateEl.min = todayISO(); }
          form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
          doneEl.innerHTML = '<p class="display done-title">Email sent.</p><p>Thanks, ' + esc(first) + '. ' + esc(opts.doneText) + ' Ziza will reply to ' + esc(replyTo) + '.</p>';
          doneEl.hidden = false;
          doneEl.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          doneEl.focus({ preventScroll: true });
          button.disabled = false;
        })
        .catch(function (err) {
          clearTimeout(timer);
          if (err && err.userFacing) {
            showError(esc(err.userFacing));
          } else {
            showError('That didn\u2019t go through. Try again in a moment, or <button type="button" class="link-button">send it from your email app</button> instead.');
            var fb = errorEl.querySelector('.link-button');
            if (fb) fb.addEventListener('click', openEmailApp);
          }
          button.disabled = false;
        })
        .then(function () {
          button.removeAttribute('aria-busy');
          button.textContent = buttonText;
        });
    });
  }

  var ERROR_TEXT = 'Add your name, a valid email and an upcoming event date.';

  setupForm(document.getElementById('booking-form'), {
    errorText: ERROR_TEXT,
    doneText: 'Your booking request is on its way.',
    payload: function (f) {
      return {
        form: 'booking',
        name: val(f.name), email: val(f.email),
        type: f.type.value,
        package: pkgSelect ? pkgSelect.options[pkgSelect.selectedIndex].text : '',
        venue: val(f.venue), guests: val(f.guests),
        details: val(f.details)
      };
    },
    email: function (f) {
      var iso = f.date.dataset.iso || f.date.value;
      return {
        subject: 'Booking request: ' + f.type.value + ' on ' + iso,
        body: [
          'Name: ' + val(f.name),
          'Email: ' + val(f.email),
          'Event date: ' + (iso ? prettyDate(iso) : f.date.value),
          'Event type: ' + f.type.value,
          'Package: ' + (pkgSelect ? pkgSelect.options[pkgSelect.selectedIndex].text : ''),
          'Venue / city: ' + (val(f.venue) || '-'),
          'Guests (approx.): ' + (val(f.guests) || '-'),
          '',
          'About the night:',
          val(f.details) || '(no details yet)'
        ].join('\n')
      };
    }
  });

  setupForm(document.getElementById('brief-form'), {
    errorText: ERROR_TEXT,
    doneText: 'Your creative brief is on its way.',
    payload: function (f) {
      return {
        form: 'brief',
        name: val(f.name), email: val(f.email),
        experience: val(f.experience), background: val(f.background),
        genre1: val(f.genre1), genre2: val(f.genre2), genre3: val(f.genre3),
        songs: val(f.songs), requests: val(f.requests)
      };
    },
    email: function (f) {
      var iso = f.date.dataset.iso || f.date.value;
      var genres = [val(f.genre1), val(f.genre2), val(f.genre3)].filter(Boolean).join(', ');
      function block(t, v) { return t + '\n' + (v || '(left blank)') + '\n'; }
      return {
        subject: 'Creative brief: ' + val(f.name) + ', ' + iso,
        body: [
          'Name: ' + val(f.name),
          'Email: ' + val(f.email),
          'Event date: ' + (iso ? prettyDate(iso) : f.date.value),
          '',
          block('The experience, in one sentence:', val(f.experience)),
          block('Music that moves me:', val(f.background)),
          block('Three genres for inspiration:', genres),
          block('Songs on repeat:', val(f.songs)),
          block('Special requests:', val(f.requests))
        ].join('\n')
      };
    }
  });
})();
