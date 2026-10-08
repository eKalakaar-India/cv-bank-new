const j = async r => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
  return r.json();
};
const send = (method, url, body) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(j);

export const api = {
  listReqs: () => fetch('/api/requirements').then(j),
  createReq: b => send('POST', '/api/requirements', b),
  updateReq: (id, b) => send('PUT', `/api/requirements/${id}`, b),
  deleteReq: id => send('DELETE', `/api/requirements/${id}`),
  sync: id => send('POST', `/api/requirements/${id}/sync`),
  progress: id => fetch(`/api/requirements/${id}/progress`).then(j),
  resumes: (id, params) => fetch(`/api/requirements/${id}/resumes?${new URLSearchParams(params)}`).then(j),
};