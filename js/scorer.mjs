// Scores one customer with the exported glmnet model: the same recipe steps
// (blank total_charges -> 0 at tenure 0, dummy coding, centring and scaling)
// followed by the logistic link. Checked against R on every hold-out row.
export function scoreOne(model, rec) {
  let eta = model.intercept;
  const contrib = {};
  for (const c of model.columns) {
    let v;
    if (c.level !== null) {
      v = rec[c.source] === c.level ? 1 : 0;
    } else {
      v = rec[c.source];
      if (c.source === 'total_charges' && (v === null || v === undefined || v === '') &&
          Number(rec.tenure) === 0) v = 0;
      v = Number(v);
    }
    const term = c.beta * (v - c.mean) / c.sd;
    eta += term;
    contrib[c.source] = (contrib[c.source] ?? 0) + term;
  }
  const prob = 1 / (1 + Math.exp(-eta));
  const { low, high } = model.risk_bands;
  const band = prob < low ? 'low' : prob < high ? 'medium' : 'high';
  return { prob, band, eta, contrib };
}
