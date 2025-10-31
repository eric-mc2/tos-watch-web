import diffs  from './diffs.js';

/**
 * Summarizes metadata about all local data files.
 */
export default async function() {
  const data = await diffs();
  return data.map(summarizeDatafile);
}

/**
 * Summarizes data
 */
function summarizeDatafile(data) {
  const rating = data.legally_substantive.rating + data.practically_substantive.rating;
  const passfail = rating === 0 ? "✅" : rating === 1 ? "⚠️"  : "‼️";
  return {...data.metadata, passfail};
}
