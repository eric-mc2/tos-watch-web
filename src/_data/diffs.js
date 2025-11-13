import { isSummaryPath, downloadData } from './_common.js';

let cache = null; // Persists during build runtime.

/**
 * Retrieves the LLM diff summary
 */
async function diffSummaries() {
  if (cache) return cache;
  cache = await downloadData(isSummaryPath);
  return cache;
}

/**
 * Tabular diff summary representation
 */
async function diffRows() { 
  const data = await diffSummaries();
  const rows = data.map(d => {
    const rating = d.content.legally_substantive.rating + d.content.practically_substantive.rating;
    const passfail = rating === 0 ? "✅" : rating === 1 ? "⚠️"  : "‼️";
    return {...d.metadata, passfail};
  });
  return rows;
}

export default async function() {
  const summaries = await diffSummaries();
  return {diffSummaries: summaries,
          diffRows: await diffRows(),
  }
};