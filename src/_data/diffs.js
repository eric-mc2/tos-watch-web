import { isSummaryPath, isDiffPath, downloadJsonData } from './_common.js';

let summaryCache = null; // Persists during build runtime.
let diffCache = null; // Persists during build runtime.

/**
 * Retrieves the LLM diff summary
 */
async function diffSummaries() {
  if (summaryCache) return summaryCache;
  summaryCache = await downloadJsonData(isSummaryPath);
  return summaryCache;
}

/**
 * Retrieves the diff
 */
async function diffActuals() {
  if (diffCache) return diffCache;
  diffCache = await downloadJsonData(isDiffPath);
  return diffCache;
}

/**
 * Tabular diff summary representation
 */
async function diffRows() { 
  const data = await diffSummaries();
  const rows = data.map(d => {
    const rating = Number(d.content.practically_substantive.rating);
    const passfail = rating === 0 ? "✅" : rating === 1 ? "⚠️"  : "‼️";
    return {...d.metadata, passfail};
  });
  return rows;
}

export default async function() {
  return {diffSummaries: await diffSummaries(),
          diffActuals: await diffActuals(),
          diffRows: await diffRows(),
  }
};