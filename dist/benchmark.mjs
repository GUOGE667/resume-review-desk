import { classifyResume, DEFAULT_ROLES } from './classifier.mjs';

const ratio = (numerator, denominator) => denominator ? numerator / denominator : 0;

export function evaluateBenchmark(cases, roles = DEFAULT_ROLES) {
  const labels = [...roles.map(role => role.id), 'review'];
  const confusion = Object.fromEntries(labels.map(expected => [expected, Object.fromEntries(labels.map(predicted => [predicted, 0]))]));
  const rows = cases.map(item => {
    const result = classifyResume(item.text, roles);
    const predicted = result.suggestion ?? 'review';
    const expected = item.expected ?? 'review';
    if (!(expected in confusion) || !(predicted in confusion[expected])) throw new Error(`未知评测类别：${item.id}`);
    confusion[expected][predicted]++;
    return { id:item.id, scenario:item.scenario, expected, predicted, correct:expected === predicted, reason:result.reason };
  });
  const total = rows.length;
  const correct = rows.filter(row => row.correct).length;
  const auto = rows.filter(row => row.predicted !== 'review');
  const review = rows.filter(row => row.predicted === 'review');
  const expectedReview = rows.filter(row => row.expected === 'review');
  const roleMetrics = roles.map(role => {
    const tp = rows.filter(row => row.expected === role.id && row.predicted === role.id).length;
    const predicted = rows.filter(row => row.predicted === role.id).length;
    const expected = rows.filter(row => row.expected === role.id).length;
    const precision = ratio(tp, predicted);
    const recall = ratio(tp, expected);
    return { id:role.id, name:role.name, support:expected, precision, recall, f1:ratio(2 * precision * recall, precision + recall) };
  });
  return {
    total, correct, exactAccuracy:ratio(correct, total),
    autoCoverage:ratio(auto.length, total),
    autoAccuracy:ratio(auto.filter(row => row.correct).length, auto.length),
    reviewPrecision:ratio(review.filter(row => row.expected === 'review').length, review.length),
    reviewRecall:ratio(expectedReview.filter(row => row.predicted === 'review').length, expectedReview.length),
    macroF1:ratio(roleMetrics.reduce((sum, role) => sum + role.f1, 0), roleMetrics.length),
    roleMetrics, labels, confusion, rows,
  };
}
