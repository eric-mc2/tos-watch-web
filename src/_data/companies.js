import getDiffs from "./diffs.js";


async function companyRows() {
  const data = await getDiffs();
  const grouped = Object.groupBy(data.diffRows, ({company}) => company);
  return grouped;
};

async function companySummaries() {
  const data = await getDiffs();
  const grouped = Object.groupBy(data.diffSummaries, ({metadata}) => metadata.company);
  const summarized = Object.entries(grouped).map(([company, items]) => ({
    company,
    ...summary(items, "RECENT")
  }));
  return summarized;
}

function summary(items, mode) {
  if (mode === "RECENT") {
    const maxDate = items
      .map(x => x.metadata.date)
      .reduce((acc, val, idx) => acc.val > val ? acc : {val, idx}, {val: "1970-01-01", idx:-1});
    const dataKey = items[maxDate.idx].metadata.dataKey;
    const rate = items[maxDate.idx].content.legally_substantive.rating + 
                  items[maxDate.idx].content.practically_substantive.rating;
    const rating = rate === 0 ? "✅" : rate === 1 ? "⚠️"  : "‼️";
    const date = maxDate.val;
    
    return {rating, date, dataKey};
  
  } else if (mode === "WORST") {
    const maxRate = items
      .map(x => x.content.practically_substantive.rating + x.content.legally_substantive.rating)
      .reduce((acc, val, idx) => acc.val > val ? acc : {val, idx}, {val: 0, idx:-1});
    const dataKey = items[maxRate.idx].metadata.dataKey;
    const date = items[maxRate.idx].metadata.date;
    const rating = maxRate.val === 0 ? "✅" : maxRate.val === 1 ? "⚠️"  : "‼️";
    
    return {rating, date, dataKey};
  }
}

export default async function() {
  return {companySummaries: await companySummaries(),
          companyRows: await companyRows()};
};