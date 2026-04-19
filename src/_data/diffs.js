import path from 'path';
import { isSummaryPath, isDiffPath, downloadJsonData, parseBlobPath } from './_common.js';

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
  
  // Get summaries first to determine which diffs we need
  const summaries = await diffSummaries();
  
  // Build a set of company/policy/timestamp combinations from summaries by parsing filepaths
  const summaryKeys = new Set(
    summaries.map(s => {
      const parts = parseBlobPath(s.metadata.filepath);
      // For summary files, timestamp is in the path as a separate segment
      const timestamp = parts.timestamp;
      return `${parts.company}/${parts.policy}/${timestamp}`;
    })
  );
  
  // Filter function that only downloads diffs with corresponding summaries
  const isSummarizedDiff = (filepath) => {
    if (!isDiffPath(filepath)) return false;
    
    try {
      const parts = parseBlobPath(filepath);
      // For diff files, timestamp is in the filename (without .json extension)
      const timestamp = path.parse(parts.filename).name;
      const key = `${parts.company}/${parts.policy}/${timestamp}`;
      
      return summaryKeys.has(key);
    } catch (error) {
      return false;
    }
  };
  
  diffCache = await downloadJsonData(isSummarizedDiff);
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