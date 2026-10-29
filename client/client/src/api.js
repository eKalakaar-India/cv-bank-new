
const API_URL = import.meta.env.VITE_API_URL;

const j = async r => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || r.statusText);
  return r.json();
};

const send = (method, url, body) =>
  fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(j);

export const api = {
  listReqs: () => fetch(`${API_URL}/requirements`).then(j),
  createReq: b => send('POST', `${API_URL}/requirements`, b),
  updateReq: (id, b) => send('PUT', `${API_URL}/requirements/${id}`, b),
  deleteReq: id => send('DELETE', `${API_URL}/requirements/${id}`),
  sync: id => send('POST', `${API_URL}/requirements/${id}/sync`),
  progress: id => fetch(`${API_URL}/requirements/${id}/progress`).then(j),
  resumes: (id, params) => fetch(`${API_URL}/requirements/${id}/resumes?${new URLSearchParams(params)}`).then(j),
};