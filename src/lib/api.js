import axios from 'axios';
import { readSession } from './session';
import { showSuccess, successForResponse } from './operation-feedback';
export const api = axios.create({ baseURL: '/api', timeout: 15000 });
api.interceptors.request.use(config => {
  const session = readSession();
  if (session && !config.publicRequest) config.headers.Authorization = `Bearer ${session.accessToken}`;
  return config;
});
api.interceptors.response.use(response => {
  const feedback = successForResponse(response);
  // Let the form close or navigate before opening the global result dialog.
  if (feedback) setTimeout(() => showSuccess(feedback), 0);
  return response;
}, error => {
  if (error.response?.status === 401 && !error.config?.publicRequest) window.dispatchEvent(new Event('auth:expired'));
  return Promise.reject(error);
});
export function errorMessage(error) {
  if (!error.response) return 'No pudimos conectar con el servicio. Revisa tu conexión e intenta nuevamente.';
  if (error.response.status === 429) return 'Has realizado varios intentos. Espera un minuto antes de volver a intentar.';
  if (error.response.status >= 500) return 'El servicio no está disponible en este momento. Intenta más tarde.';
  return error.response.data?.description || 'No se pudo completar la solicitud.';
}
