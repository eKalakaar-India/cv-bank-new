const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractText(buffer, mimeType) {
  if (mimeType === 'application/pdf') return (await pdfParse(buffer)).text;
  if (mimeType.includes('wordprocessingml')) return (await mammoth.extractRawText({ buffer })).value;
  return buffer.toString('utf8');
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?,?\\s+';
const RANGE = new RegExp(
  `(?:${MON})?((?:19|20)\\d{2})\\s*(?:-|–|—|to)\\s*(?:(?:${MON})?((?:19|20)\\d{2})|(present|current|till date|now|ongoing))`, 'gi');

// "5+ years of experience" style statements
function statedYears(text) {
  let max = 0;
  for (const m of text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?)/gi)) {
    const around = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60).toLowerCase();
    if (around.includes('experience')) max = Math.max(max, parseFloat(m[1]));
  }
  return Math.min(max, 45);
}

function monthsUnion(iv) {
  iv.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [s, e] = iv[0] || [0, 0];
  for (const [a, b] of iv.slice(1)) {
    if (a <= e) e = Math.max(e, b);
    else { total += e - s; s = a; e = b; }
  }
  return total + (e - s);
}

// Fallback: merge "Jan 2018 - Present" style date ranges
function rangeYears(text) {
  const now = new Date();
  const nowM = now.getFullYear() * 12 + now.getMonth();
  const mi = s => (s ? MONTHS.indexOf(s.toLowerCase()) : 0);
  const iv = [];
  for (const m of text.matchAll(RANGE)) {
    const s = +m[2] * 12 + mi(m[1]);
    const e = m[5] ? nowM : +m[4] * 12 + mi(m[3]);
    if (e >= s && e <= nowM + 1 && e - s <= 480) iv.push([s, e]);
  }
  return monthsUnion(iv) / 12;
}

function guessName(text, fileName) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6);
  const ok = l => /^[A-Za-z][A-Za-z .'-]{2,40}$/.test(l) && l.split(/\s+/).length <= 4
    && !/resume|curriculum|vitae|\bcv\b|profile|summary|objective/i.test(l);
  return lines.find(ok) || fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
}

function parseResume(text, fileName) {
  const stated = statedYears(text);
  return {
    name: guessName(text, fileName),
    email: (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0],
    phone: (text.match(/\+?\d[\d\s().-]{8,15}\d/) || [''])[0].trim(),
    experienceYears: stated > 0 ? stated : Math.round(rangeYears(text) * 10) / 10,
  };
}

module.exports = { extractText, parseResume };