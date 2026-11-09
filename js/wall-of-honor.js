/* Wall of Honor — donor wall rotation.
   Without JS every name is visible. With JS the names are shown in groups that
   cross-fade slowly; auto-advance stops when the visitor pauses, hovers or
   focuses the wall, opens "See all donors", has OS reduced-motion on, or uses
   the site's own "Pause animations" toggle (html[data-motion-paused]). */
(function () {
  var wall = document.querySelector('[data-woh-wall]');
  if (!wall) return;

  var list = wall.querySelector('[data-woh-names]');
  var items = Array.prototype.slice.call(list.children);
  var status = wall.querySelector('[data-woh-status]');
  var controls = wall.querySelector('[data-woh-controls]');
  var btnPrev = wall.querySelector('[data-woh-prev]');
  var btnNext = wall.querySelector('[data-woh-next]');
  var btnPause = wall.querySelector('[data-woh-pause]');
  var pauseLabel = wall.querySelector('[data-woh-pause-label]');
  var btnAll = wall.querySelector('[data-woh-all]');
  var root = document.documentElement;
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  var INTERVAL = 9000; // ms per group: long enough to read every name
  var ROWS = 4;
  var page = 0, perPage = items.length, pages = 1;
  var userPaused = false, hovering = false, focused = false, showAll = false;
  var timer = null;

  function cols() {
    return getComputedStyle(list).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
  }
  function motionBlocked() {
    return reduceMQ.matches || root.hasAttribute('data-motion-paused') || root.getAttribute('data-motion') === 'off';
  }
  function autoOn() {
    return pages > 1 && !showAll && !userPaused && !hovering && !focused && !motionBlocked() && !document.hidden;
  }

  function render() {
    items.forEach(function (li, i) {
      li.hidden = !showAll && Math.floor(i / perPage) !== page;
    });
    if (showAll) {
      status.textContent = 'Showing all ' + items.length + ' donors';
    } else {
      var first = page * perPage + 1;
      var last = Math.min(items.length, first + perPage - 1);
      status.textContent = 'Showing ' + first + '–' + last + ' of ' + items.length;
    }
  }

  function go(to, announce) {
    page = (to + pages) % pages;
    status.setAttribute('aria-live', announce ? 'polite' : 'off');
    if (reduceMQ.matches) { render(); return; }
    list.classList.add('is-fading');
    setTimeout(function () { render(); list.classList.remove('is-fading'); }, 450);
  }

  function schedule() {
    clearTimeout(timer);
    if (autoOn()) timer = setTimeout(function () { go(page + 1, false); schedule(); }, INTERVAL);
    var stopped = userPaused || motionBlocked();
    btnPause.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
    pauseLabel.textContent = stopped ? 'Play' : 'Pause';
  }

  // Hold the list at the height of its tallest group, so a short last group
  // doesn't make the panel shrink and the controls jump while it rotates.
  function lockHeight() {
    list.style.minHeight = '';
    if (showAll || pages <= 1) return;
    var keep = page, tallest = 0;
    for (var p = 0; p < pages; p++) {
      page = p; render();
      tallest = Math.max(tallest, list.offsetHeight);
    }
    page = keep; render();
    list.style.minHeight = tallest + 'px';
  }

  function layout() {
    var c = cols();
    var newPer = c === 1 ? 6 : c * ROWS; // phones: 6 names per group, one column
    if (newPer !== perPage) {
      var firstVisible = page * perPage;
      perPage = newPer;
      pages = Math.max(1, Math.ceil(items.length / perPage));
      page = Math.min(pages - 1, Math.floor(firstVisible / perPage));
      controls.hidden = pages <= 1;
    }
    lockHeight(); // re-measure on every resize: name wrapping changes with width
    schedule();
  }

  btnPrev.addEventListener('click', function () { go(page - 1, true); schedule(); });
  btnNext.addEventListener('click', function () { go(page + 1, true); schedule(); });
  btnPause.addEventListener('click', function () {
    if (motionBlocked() && !userPaused) {
      // site-wide pause or reduced motion is on: Play steps forward once instead
      go(page + 1, true);
    } else {
      userPaused = !userPaused;
    }
    schedule();
  });
  btnAll.addEventListener('click', function () {
    showAll = !showAll;
    wall.classList.toggle('is-all', showAll);
    btnAll.setAttribute('aria-expanded', showAll ? 'true' : 'false');
    btnAll.textContent = showAll ? 'Show fewer' : 'See all donors';
    status.setAttribute('aria-live', 'polite');
    lockHeight();
    render();
    schedule();
  });

  wall.addEventListener('mouseenter', function () { hovering = true; schedule(); });
  wall.addEventListener('mouseleave', function () { hovering = false; schedule(); });
  wall.addEventListener('focusin', function () { focused = true; schedule(); });
  wall.addEventListener('focusout', function (e) {
    if (!wall.contains(e.relatedTarget)) { focused = false; schedule(); }
  });
  document.addEventListener('visibilitychange', schedule);
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', schedule);
  new MutationObserver(schedule).observe(root, { attributes: true, attributeFilter: ['data-motion-paused', 'data-motion'] });

  var resizeT;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(layout, 150); });

  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockHeight);
})();
