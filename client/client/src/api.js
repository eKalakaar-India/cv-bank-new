const j = async r => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
  return r.json();
};
const send = (method, url, body) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(j);

export const api = {
  listReqs: () => fetch('https://cv-bank-new.vercel.app/api/requirements').then(j),
  createReq: b => send('POST', 'https://cv-bank-new.vercel.app/api/requirements', b),
  updateReq: (id, b) => send('PUT', `https://cv-bank-new.vercel.app/api/requirements/${id}`, b),
  deleteReq: id => send('DELETE', `https://cv-bank-new.vercel.app/api/requirements/${id}`),
  sync: id => send('POST', `https://cv-bank-new.vercel.app/api/requirements/${id}/sync`),
  progress: id => fetch(`https://cv-bank-new.vercel.app/api/requirements/${id}/progress`).then(j),
  resumes: (id, params) => fetch(`https://cv-bank-new.vercel.app/api/requirements/${id}/resumes?${new URLSearchParams(params)}`).then(j),
};