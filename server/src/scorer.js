const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const label = e => e.split('|')[0].trim();

// Whole-term match, safe for "C++", "Node.js", ".NET", "C#"
function has(text, entry) {
  return entry.split('|').map(s => s.trim()).filter(Boolean)
    .some(term => new RegExp(`(?<![A-Za-z0-9])${esc(term)}(?![A-Za-z0-9])`, 'i').test(text));
}

function categorize(rawText, req, experienceYears) {
  const text = rawText.replace(/\s+/g, ' ');
  const must = req.mustHave || [];
  const nice = req.niceToHave || [];
  const mMust = must.filter(e => has(text, e));
  const miss = must.filter(e => !has(text, e));
  const mNice = nice.filter(e => has(text, e));

  const mustRatio = must.length ? mMust.length / must.length : 1;
  const niceRatio = nice.length ? mNice.length / nice.length : 1;
  const expRatio = req.minExperience > 0 ? Math.min(experienceYears / req.minExperience, 1) : 1;
  const score = Math.round(mustRatio * 55 + niceRatio * 20 + expRatio * 25);

  let category = 'Not a Match';
  if (mustRatio === 1 && expRatio === 1) category = 'Shortlisted';
  else if (mustRatio >= 0.6 && expRatio >= 0.7) category = 'Potential';

  return {
    score, category,
    matchedMust: mMust.map(label), missingMust: miss.map(label), matchedNice: mNice.map(label),
  };
}

module.exports = { categorize };