const baseUrl = process.env.SMOKE_TEST_BASE_URL
  ?? process.env.SERVER_BASE_URL
  ?? 'http://localhost:8787';

const endpoints = {
  session: new URL('/api/session', baseUrl),
  analyze: new URL('/api/analyze', baseUrl),
  metrics: new URL('/api/ai/metrics', baseUrl),
};

const expectStatus = async (label, request, expectedStatus) => {
  const response = await request();
  if (response.status !== expectedStatus) {
    const bodyText = await response.text();
    throw new Error(
      `${label} esperado ${expectedStatus}, recebeu ${response.status}. Corpo: ${bodyText}`,
    );
  }
  console.log(`✔ ${label} -> ${response.status}`);
};

try {
  await expectStatus('GET /api/session', () => fetch(endpoints.session), 200);
  await expectStatus(
    'POST /api/analyze (sem auth)',
    () =>
      fetch(endpoints.analyze, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }),
    401,
  );
  await expectStatus('GET /api/ai/metrics', () => fetch(endpoints.metrics), 200);

  console.log('Smoke test finalizado com sucesso.');
} catch (error) {
  console.error('Smoke test falhou.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
