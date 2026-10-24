/* ==========================================================================
   Hookah By Hov — motion
   Everything in here is decoration. The page reads and books exactly the same
   without it, and all of it stands down for anyone who prefers reduced motion.
   Only transform and opacity are animated, and nothing runs off-screen.
   ========================================================================== */

(function () {
  'use strict';

  const $  = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => reducedQuery.matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const EASE = 'cubic-bezier(.16,1,.3,1)';

  /* ======================================================================
     Scroll reveals
     ====================================================================== */

  /* Once an element has arrived its reveal classes come off, so its own hover
     transitions aren't stuck with the slow, delayed reveal timing. */
  function settle(el) {
    el.addEventListener('transitionend', function done(e) {
      if (e.target !== el || e.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', done);
      el.classList.remove('reveal', 'reveal-zoom', 'is-in');
    });
  }

  if ('IntersectionObserver' in window && !reduced()) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-in');
        if (!el.classList.contains('reveal-lines')) settle(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    $$('.reveal').forEach(el => io.observe(el));
  } else {
    $$('.reveal').forEach(el => el.classList.add('is-in'));
  }

  /* ======================================================================
     One scroll listener, one frame of work per scroll
     ====================================================================== */

  const onScrollFrame = [];
  let scrollQueued = false;

  function runScrollFrame() {
    scrollQueued = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    onScrollFrame.forEach(fn => fn(y, vh));
  }
  function queueScrollFrame() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(runScrollFrame);
  }
  window.addEventListener('scroll', queueScrollFrame, { passive: true });
  window.addEventListener('resize', queueScrollFrame);

  /* ======================================================================
     Hero — parallax, tilting badge, rising smoke
     ====================================================================== */

  const hero = $('.hero');
  const heroCopy = $('#hero-copy');
  const heroStage = $('#hero-stage');
  const badge = $('#hero-badge');
  const smokeCanvas = $('#hero-smoke');

  if (hero && !reduced()) {
    /* As the hero scrolls away the copy lifts and fades while the badge
       drifts back slower — a little depth, Apple-style. */
    let heroH = hero.offsetHeight;
    let parked = false;
    window.addEventListener('resize', () => { heroH = hero.offsetHeight; });

    onScrollFrame.push(y => {
      if (y > heroH) {
        if (!parked) {
          heroCopy.style.opacity = '0';
          parked = true;
        }
        return;
      }
      parked = false;
      const p = clamp(y / heroH, 0, 1);
      heroCopy.style.transform = `translate3d(0, ${(-p * 90).toFixed(1)}px, 0)`;
      heroCopy.style.opacity = String(clamp(1 - p * 1.5, 0, 1).toFixed(3));
      heroStage.style.transform = `translate3d(0, ${(p * 70).toFixed(1)}px, 0) scale(${(1 - p * 0.1).toFixed(4)})`;
    });

    const smoke = smokeCanvas && smokeCanvas.getContext ? createSmoke(smokeCanvas) : null;

    /* Pointer position → target tilt. The badge eases toward it every frame,
       which is what makes it feel weighty rather than twitchy. */
    let targetX = 0, targetY = 0, rotX = 0, rotY = 0;
    if (finePointer) {
      hero.addEventListener('pointermove', e => {
        targetX = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
        targetY = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1);
        if (smoke) smoke.gust(e.movementX || 0);
      });
      hero.addEventListener('pointerleave', () => { targetX = 0; targetY = 0; });
    }

    let running = false;
    let last = 0;
    const t0 = performance.now();

    function loop(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const k = 1 - Math.pow(0.002, dt);
      rotX += (targetY * -11 - rotX) * k;
      rotY += (targetX * 15 - rotY) * k;
      const float = Math.sin((now - t0) / 1000 * 1.05) * 9;
      badge.style.transform =
        `translate3d(0, ${float.toFixed(2)}px, 0) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
      badge.style.setProperty('--sx', (38 + rotY * 2.4).toFixed(1) + '%');
      badge.style.setProperty('--sy', (26 - rotX * 2.4).toFixed(1) + '%');
      if (smoke) smoke.frame(dt);
      requestAnimationFrame(loop);
    }

    let heroVisible = true;
    function setRunning() {
      const on = heroVisible && !document.hidden;
      if (on === running) return;
      running = on;
      if (on) { last = performance.now(); requestAnimationFrame(loop); }
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        heroVisible = entry.isIntersecting;
        setRunning();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', setRunning);
    setRunning();
  }

  /* Soft, gold-tinted smoke drawn with one pre-blurred sprite. Cheap enough
     to run at full frame rate on a phone. */
  function createSmoke(canvas) {
    const ctx = canvas.getContext('2d');
    const small = window.matchMedia('(max-width: 720px)').matches;
    const COUNT = small ? 24 : 40;
    const parts = [];
    let w = 0, h = 0, wind = 0;

    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 128;
    const sctx = sprite.getContext('2d');
    const grad = sctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(248,232,190,0.55)');
    grad.addColorStop(0.35, 'rgba(226,196,124,0.24)');
    grad.addColorStop(0.7, 'rgba(193,145,47,0.07)');
    grad.addColorStop(1, 'rgba(193,145,47,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);

    function resize() {
      /* layout size, not the parallax-scaled box */
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      /* Smoke is all soft edges, so device pixels buy nothing here. */
      canvas.width = Math.round(w);
      canvas.height = Math.round(h);
    }

    function reset(p, scatter) {
      p.x = w * (0.5 + (Math.random() - 0.5) * 0.2);
      p.y = h * (0.62 + Math.random() * 0.1);
      p.vx = (Math.random() - 0.5) * 16;
      p.vy = -(18 + Math.random() * 30);
      p.size = (small ? 40 : 60) + Math.random() * 70;
      p.ttl = 6 + Math.random() * 6;
      p.age = scatter ? Math.random() * p.ttl : 0;
      p.phase = Math.random() * Math.PI * 2;
      p.sway = 10 + Math.random() * 26;
      p.alpha = 0.3 + Math.random() * 0.45;
      p.drift = 0;
    }

    resize();
    for (let i = 0; i < COUNT; i++) { const p = {}; reset(p, true); parts.push(p); }
    window.addEventListener('resize', resize);

    return {
      gust(dx) { wind = clamp(wind + dx * 0.5, -70, 70); },
      frame(dt) {
        wind *= Math.pow(0.3, dt);
        ctx.clearRect(0, 0, w, h);
        for (const p of parts) {
          p.age += dt;
          if (p.age >= p.ttl) reset(p, false);
          const life = p.age / p.ttl;
          p.drift += wind * dt * life;
          const x = p.x + p.vx * p.age + Math.sin(p.age * 0.8 + p.phase) * p.sway * life + p.drift;
          const y = p.y + p.vy * p.age;
          const s = p.size * (1 + life * 2.6);
          ctx.globalAlpha = Math.sin(Math.PI * life) * p.alpha;
          ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
      }
    };
  }

  /* ======================================================================
     Manifesto — each word lights up as you read down the page
     ====================================================================== */

  const scrub = $('[data-scrub]');
  if (scrub) {
    const words = [];
    (function wrap(node) {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const span = document.createElement('span');
            span.className = 'w';
            span.textContent = part;
            words.push(span);
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          wrap(child);
        }
      });
    })(scrub);

    if (reduced()) {
      words.forEach(w => w.classList.add('is-lit'));
    } else {
      let lit = 0;
      onScrollFrame.push((y, vh) => {
        const r = scrub.getBoundingClientRect();
        if (r.bottom < -vh * 0.2 || r.top > vh * 1.2) return;
        /* 0 as the paragraph's top enters the lower part of the screen,
           1 once its last line reaches the middle */
        const start = vh * 0.88;
        const end = vh * 0.5 - r.height;
        const p = clamp((start - r.top) / (start - end), 0, 1);
        const n = Math.round(p * words.length);
        if (n === lit) return;
        const [a, b] = n > lit ? [lit, n] : [n, lit];
        for (let i = a; i < b; i++) words[i].classList.toggle('is-lit', i < n);
        lit = n;
      });
    }
  }

  /* ======================================================================
     Counters — numbers roll up when their tile comes into view
     ====================================================================== */

  const counters = $$('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduced()) {
    const countIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        countIO.unobserve(entry.target);
        const el = entry.target;
        const to = Number(el.dataset.count);
        const start = performance.now();
        const dur = 1500;
        (function tick(now) {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(2, -10 * t);
          el.textContent = String(Math.round(to * (t === 1 ? 1 : eased)));
          if (t < 1) requestAnimationFrame(tick);
        })(start);
      });
    }, { threshold: 0.6 });
    counters.forEach(el => { el.textContent = '0'; countIO.observe(el); });
  }

  /* ======================================================================
     Spotlight — a soft glow follows the pointer across cards
     ====================================================================== */

  if (finePointer) {
    $$('.spot').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      });
    });
  }

  /* ======================================================================
     Rotating word in the closing call to action
     ====================================================================== */

  const rotator = $('.rotator');
  if (rotator && !reduced()) {
    const items = $$('span', rotator);
    let index = 0;
    let rotatorVisible = false;

    rotator.classList.add('is-ready');
    const fit = () => { rotator.style.width = items[index].offsetWidth + 'px'; };
    fit();
    window.addEventListener('resize', fit);
    /* Webfonts can land after first paint and change the word widths. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { rotatorVisible = entry.isIntersecting; }).observe(rotator);
    }

    setInterval(() => {
      if (!rotatorVisible || document.hidden) return;
      const current = items[index];
      index = (index + 1) % items.length;
      const next = items[index];
      current.classList.remove('is-on');
      current.classList.add('is-out');
      next.classList.remove('is-out');
      next.classList.add('is-on');
      fit();
      setTimeout(() => current.classList.remove('is-out'), 800);
    }, 2400);
  }

  /* ======================================================================
     Smooth <details> — FAQ answers, flavor request, promo code
     ====================================================================== */

  function smoothDetails(details) {
    const summary = details.querySelector('summary');
    const body = summary && summary.nextElementSibling;
    if (!body) return;
    let anim = null;

    function cleanup() {
      body.style.overflow = '';
      anim = null;
    }

    summary.addEventListener('click', e => {
      if (reduced() || !body.animate) return;
      e.preventDefault();

      /* Start from wherever a running animation has got to. */
      const from = body.getBoundingClientRect().height;
      if (anim) anim.cancel();
      body.style.overflow = 'hidden';

      const closing = details.open && !details.classList.contains('is-closing');
      if (closing) {
        details.classList.add('is-closing');
        anim = body.animate(
          [{ height: from + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
          { duration: 420, easing: EASE }
        );
        anim.onfinish = () => {
          details.open = false;
          details.classList.remove('is-closing');
          cleanup();
        };
      } else {
        details.classList.remove('is-closing');
        details.open = true;
        const to = body.scrollHeight;
        anim = body.animate(
          [{ height: from + 'px', opacity: from ? 1 : 0 }, { height: to + 'px', opacity: 1 }],
          { duration: 560, easing: EASE }
        );
        anim.onfinish = cleanup;
      }
    });
  }
  $$('details[data-smooth]').forEach(smoothDetails);

  /* ======================================================================
     Nav — highlight the section you're reading
     ====================================================================== */

  /* Checked against the middle of the screen every scroll frame, so the
     highlight also clears when you're between the linked sections. */
  const spyLinks = $$('.nav a[href^="#"]')
    .map(a => ({ a, target: $(a.getAttribute('href')) }))
    .filter(l => l.target);
  if (spyLinks.length) {
    let current = null;
    onScrollFrame.push((y, vh) => {
      const mid = vh * 0.45;
      let hit = null;
      for (const l of spyLinks) {
        const r = l.target.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) hit = l.a;
      }
      if (hit === current) return;
      current = hit;
      spyLinks.forEach(l => l.a.classList.toggle('is-active', l.a === hit));
    });
  }

  /* ======================================================================
     Celebration — a little burst of gold when a booking goes through
     ====================================================================== */

  function burst(origin) {
    if (reduced() || !origin || !document.body.animate) return;
    const r = origin.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const layer = document.createElement('div');
    layer.className = 'burst';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    for (let i = 0; i < 30; i++) {
      const dot = document.createElement('i');
      const size = 4 + Math.random() * 6;
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 120;
      dot.style.width = dot.style.height = size + 'px';
      dot.style.left = (cx - size / 2) + 'px';
      dot.style.top = (cy - size / 2) + 'px';
      layer.appendChild(dot);
      dot.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 50}px) scale(.2)`, opacity: 0 }
      ], { duration: 1000 + Math.random() * 600, delay: 380, easing: EASE, fill: 'backwards' });
    }
    setTimeout(() => layer.remove(), 2200);
  }

  window.HBH_MOTION = { burst };

  /* first paint */
  runScrollFrame();
})();
