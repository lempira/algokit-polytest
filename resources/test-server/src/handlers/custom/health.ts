import { http, HttpResponse } from 'msw';

export const healthHandlers = [
  http.get('http://mock/health', () => {
    return HttpResponse.json({ status: 'ok' }, { status: 200 });
  }),
];