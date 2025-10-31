import diffs from './diffs.js';

/**
 * Summarizes by service
 */
export default async function() {
  const data = await diffs();
  const grouped = Object.groupBy(data, ({metadata}) => metadata.company);
  return Object.entries(grouped).map(([company, items]) => ({
    company,
    ...summary(items)
  }));
}

function summary(items) {
  const rate = items
    .map(x => x.legally_substantive.rating + x.practically_substantive.rating)
    .reduce((acc, val) => Math.max(acc, val), 0);
  const rating = rate === 0 ? "✅" : rate === 1 ? "⚠️"  : "‼️";
  const date = items
    .map(x => x.metadata.date)
    .reduce((acc, val) => acc > val ? acc : val, "1970-01-01");
  const dataKey = items.filter(x => x.metadata.date == date)[0].metadata.dataKey;
  return {rating, date, dataKey};
}
