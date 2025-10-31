import diffs  from './diffs.js';

/**
 * Summarizes diff metadata
 */
export default async function() {
  const data = await diffs();
  return data.map(summarizeDatafile);
}

function summarizeDatafile(data) {
  const rating = data.legally_substantive.rating + data.practically_substantive.rating;
  const passfail = rating === 0 ? "✅" : rating === 1 ? "⚠️"  : "‼️";
  return {...data.metadata, passfail};
}
