/* Site forms (volunteer + lead forms on Get Involved, meal request on Home + Programs) — shared validation + submit.
   Drives every <form data-vol-form>. Rules live in the markup:
     data-check="text|email|phone|choice"   what to check (choice = a fieldset of radios/checkboxes)
     data-required                          must be filled in / at least one chosen
     data-msg-required / data-msg-invalid   plain-language error messages
   Thank-you message: elements with data-fill="first:<id>" (first word), "text:<id>",
   or "choice:<fieldset id>" (data-label of the chosen options, joined with "and").

   SEND_TO_GOOGLE = false (default): demo mode. Nothing leaves the page; a valid
   form just shows the thank-you message. Safe for showing the mock to the client.
   SEND_TO_GOOGLE = true: posts to each form's Google Form action URL.
     - Normal forms post their named inputs (entry.* names) as-is.
     - data-compose="per-position" (lead form): for each ticked checkbox, posts
       "Name: … / Phone: … / Email: …" into that position's data-entry answer,
       matching how the Google Form expects people to answer.
   Google doesn't let a page read its response, so success is assumed if the
   request goes out; check the form's Responses tab to confirm. */
(function () {
  var SEND_TO_GOOGLE = false;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function initForm(form) {
    var card = form.parentNode;
    var done = card.querySelector('[data-vol-done]');
    var summary = form.querySelector('[data-vol-errors]');
    var summaryList = form.querySelector('[data-vol-error-list]');
    var submitBtn = form.querySelector('[type="submit"]');
    var submitText = submitBtn.textContent;
    var fields = Array.prototype.slice.call(form.querySelectorAll('[data-check]'));
    var submitted = false;

    function options(fs) { return Array.prototype.slice.call(fs.querySelectorAll('input')); }
    function chosen(fs) { return options(fs).filter(function (i) { return i.checked; }); }
    function focusTarget(el) { return el.tagName === 'FIELDSET' ? options(el)[0] : el; }

    function test(el) {
      var required = el.hasAttribute('data-required');
      if (el.dataset.check === 'choice') {
        return required && !chosen(el).length ? el.dataset.msgRequired : '';
      }
      var v = el.value.trim();
      if (!v) return required ? el.dataset.msgRequired : '';
      if (el.dataset.check === 'email' && !EMAIL_RE.test(v)) return el.dataset.msgInvalid;
      if (el.dataset.check === 'phone') {
        var digits = v.replace(/\D/g, '').length;
        if (digits < 10 || digits > 11) return el.dataset.msgInvalid;
      }
      return '';
    }

    function show(el, msg) {
      form.querySelector('[data-err-for="' + el.id + '"]').textContent = msg;
      if (msg) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }

    function validate() {
      var errors = [];
      fields.forEach(function (el) {
        var msg = test(el);
        show(el, msg);
        if (msg) errors.push({ el: el, msg: msg });
      });
      return errors;
    }

    function showSummary(errors) {
      summaryList.innerHTML = '';
      errors.forEach(function (e) {
        var target = focusTarget(e.el);
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + (target.id || e.el.id);
        a.textContent = e.msg;
        a.addEventListener('click', function (ev) { ev.preventDefault(); target.focus(); });
        li.appendChild(a);
        summaryList.appendChild(li);
      });
      summary.hidden = false;
      summary.focus();
    }

    // After the first submit attempt, re-check fields as they change so
    // errors disappear as soon as they're fixed.
    fields.forEach(function (el) {
      var isChoice = el.dataset.check === 'choice';
      (isChoice ? options(el) : [el]).forEach(function (t) {
        t.addEventListener(isChoice ? 'change' : 'blur', function () {
          if (!submitted) return;
          show(el, test(el));
          if (fields.every(function (f) { return !test(f); })) summary.hidden = true;
        });
      });
    });

    function fill() {
      Array.prototype.forEach.call(done.querySelectorAll('[data-fill]'), function (out) {
        var spec = out.dataset.fill.split(':');
        var src = document.getElementById(spec[1]);
        var text;
        if (spec[0] === 'choice') {
          var labels = chosen(src).map(function (i) { return i.dataset.label || i.value; });
          text = labels.length > 1 ? labels.slice(0, -1).join(', ') + ' and ' + labels[labels.length - 1] : labels[0];
        } else {
          text = src.value.trim();
          if (spec[0] === 'first') text = text.split(/\s+/)[0];
        }
        out.textContent = text;
      });
    }

    function finish() {
      fill();
      form.hidden = true;
      done.hidden = false;
      done.focus();
    }

    function payload() {
      if (form.dataset.compose !== 'per-position') return new FormData(form);
      var lines = fields
        .filter(function (el) { return el.dataset.composeLabel; })
        .map(function (el) { return el.dataset.composeLabel + ': ' + el.value.trim(); })
        .join('\n');
      var data = new FormData();
      form.querySelectorAll('input[type="checkbox"]:checked').forEach(function (box) {
        data.append(box.dataset.entry, lines);
      });
      return data;
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      submitted = true;
      var errors = validate();
      if (errors.length) { showSummary(errors); return; }
      summary.hidden = true;

      if (!SEND_TO_GOOGLE) { finish(); return; }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      fetch(form.action, { method: 'POST', mode: 'no-cors', body: payload() })
        .then(finish)
        .catch(function () {
          summaryList.innerHTML = '<li>Sorry, something went wrong sending this. Please try again, or contact us.</li>';
          summary.hidden = false;
          summary.focus();
        })
        .then(function () { submitBtn.disabled = false; submitBtn.textContent = submitText; });
    });

    done.querySelector('[data-vol-again]').addEventListener('click', function () {
      form.reset();
      submitted = false;
      fields.forEach(function (el) { show(el, ''); });
      summary.hidden = true;
      done.hidden = true;
      form.hidden = false;
      focusTarget(fields[0]).focus();
    });
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-vol-form]'), initForm);
})();
