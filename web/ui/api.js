/** Browser networking: local backend and Vercel use the same relative API contract. */
export function createApi({getBase,getToken}) {
return async function api(path,data,method) {
  const response = await fetch(getBase() + path, {
    method: method || (data === undefined ? 'GET' : 'POST'),
    headers: {'content-type':'application/json',...(getToken() ? {authorization:'Bearer '+getToken()} : {})},
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {const error=Error(result.error || 'Ошибка сервера');error.status=response.status;throw error;}
  return result;
}
}
