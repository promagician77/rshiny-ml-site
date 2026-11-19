import { scoreOne } from './scorer.mjs';

const LABELS = {
  tenure: 'Tenure', contract: 'Contract', monthly_charges: 'Monthly charges',
  total_charges: 'Total charges', payment_method: 'Payment method',
  paperless_billing: 'Paperless billing', internet_service: 'Internet',
  phone_service: 'Phone service', multiple_lines: 'Multiple lines',
  online_security: 'Online security', online_backup: 'Online backup',
  device_protection: 'Device protection', tech_support: 'Tech support',
  streaming_tv: 'Streaming TV', streaming_movies: 'Streaming movies',
  senior_citizen: 'Senior citizen', partner: 'Partner', dependents: 'Dependents',
  female: 'Female',
};
const ADDONS = ['online_security', 'online_backup', 'device_protection', 'tech_support',
                'streaming_tv', 'streaming_movies'];
// A month-to-month fibre customer in their first year: a common high-risk profile.
const START = {
  tenure: 8, contract: 'Month-to-month', monthly_charges: 89.1, total_charges: 712.8,
  payment_method: 'Electronic check', paperless_billing: 1, internet_service: 'Fiber optic',
  phone_service: 1, multiple_lines: 'Yes', online_security: 'No', online_backup: 'No',
  device_protection: 'No', tech_support: 'No', streaming_tv: 'Yes', streaming_movies: 'No',
  senior_citizen: 0, partner: 0, dependents: 0, female: 1,
};

const form = document.getElementById('scorer-form');
const $ = id => document.getElementById(id);

function fill(model) {
  for (const [name, spec] of Object.entries(model.schema)) {
    const el = form.elements[name];
    if (!el) continue;
    if (spec.type === 'factor') {
      el.innerHTML = spec.levels.map(l => `<option value="${l}">${l}</option>`).join('');
    }
    const v = START[name];
    if (el.type === 'checkbox') el.checked = v === 1;
    else el.value = v;
  }
}

function syncDependent() {
  const noNet = form.elements.internet_service.value === 'No';
  for (const name of ADDONS) {
    const el = form.elements[name];
    if (noNet) el.value = 'No internet service';
    else if (el.value === 'No internet service') el.value = 'No';
    el.disabled = noNet;
    [...el.options].forEach(o => { o.disabled = !noNet && o.value === 'No internet service'; });
  }
  const ml = form.elements.multiple_lines;
  const noPhone = !form.elements.phone_service.checked;
  if (noPhone) ml.value = 'No phone service';
  else if (ml.value === 'No phone service') ml.value = 'No';
  ml.disabled = noPhone;
  [...ml.options].forEach(o => { o.disabled = !noPhone && o.value === 'No phone service'; });
}

function readRecord(model) {
  const rec = {};
  const problems = [];
  for (const [name, spec] of Object.entries(model.schema)) {
    if (spec.type === 'id') continue;
    const el = form.elements[name];
    el.removeAttribute('aria-invalid');
    if (spec.type === 'binary') { rec[name] = el.checked ? 1 : 0; continue; }
    if (spec.type === 'factor') { rec[name] = el.value; continue; }
    const raw = el.value.trim();
    if (raw === '') { rec[name] = null; continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < spec.min || n > spec.max) {
      problems.push(`${LABELS[name]} must be a number from ${spec.min} to ${spec.max.toLocaleString('en-US')}.`);
      el.setAttribute('aria-invalid', 'true');
    }
    rec[name] = n;
  }
  for (const name of ['tenure', 'monthly_charges']) {
    if (rec[name] === null) {
      problems.push(`${LABELS[name]} can't be blank.`);
      form.elements[name].setAttribute('aria-invalid', 'true');
    }
  }
  if (rec.total_charges === null && rec.tenure !== 0) {
    problems.push('Total charges can be blank only when tenure is 0.');
    form.elements.total_charges.setAttribute('aria-invalid', 'true');
  }
  return { rec, problems };
}

function render(model) {
  syncDependent();
  const { rec, problems } = readRecord(model);
  const err = $('r-error');
  if (problems.length) {
    err.hidden = false;
    err.textContent = problems.join(' ');
    $('r-prob').textContent = '–';
    $('r-band').textContent = '';
    $('r-drivers').innerHTML = '';
    return;
  }
  err.hidden = true;
  const s = scoreOne(model, rec);
  $('r-prob').textContent = `${(100 * s.prob).toFixed(1)}%`;
  const band = $('r-band');
  band.dataset.band = s.band;
  band.textContent = `${s.band[0].toUpperCase()}${s.band.slice(1)} risk`;
  const top = Object.entries(s.contrib).filter(([, v]) => Math.abs(v) > 1e-9)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6);
  const maxAbs = Math.max(...top.map(([, v]) => Math.abs(v)), 1e-9);
  $('r-drivers').innerHTML = top.map(([k, v]) => `
    <li><span>${LABELS[k]} ${v > 0 ? 'raises' : 'lowers'} risk</span>
      <span class="val">${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)} log-odds</span>
      <span class="bar ${v > 0 ? 'up' : 'down'}" style="width:${(100 * Math.abs(v) / maxAbs).toFixed(1)}%"></span></li>`).join('');
}

const model = await (await fetch('data/model.json')).json();
fill(model);
form.addEventListener('input', () => render(model));
form.addEventListener('change', () => render(model));
render(model);
