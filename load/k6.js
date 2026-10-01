import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';
const password = 'Demo1234!';

const cacheHits = new Counter('semantic_cache_hits');
const generated = new Counter('semantic_cache_generated');
const eventsAccepted = new Counter('events_accepted');
const productsQueued = new Counter('products_queued');

const eventTypes = ['VIEW', 'CLICK', 'LIKE', 'CART', 'PURCHASE'];
const categories = ['outer', 'electronics', 'living', 'shoes', 'accessory'];
const limits = [3, 5, 10];

const similarQuestions = [
  '비 오는 날 입을 가벼운 자켓 추천해줘',
  '비오는 날 가벼운 재킷 추천',
  '비 오는 날 가벼운 자켓 추천',
];

const freshQuestions = [
  '저소음 기계식 키보드 추천',
  '홈카페 드립 세트 뭐가 좋아',
  '출퇴근용 노이즈캔슬링 헤드폰',
  '가벼운 캠핑 체어 추천해줘',
  '업무용 14인치 노트북 추천',
];

const shopperAccounts = [
  { email: 'demo@pickflow.dev', displayName: '데모 유저' },
  { email: 'load1@pickflow.dev', displayName: '부하 유저 1' },
  { email: 'load2@pickflow.dev', displayName: '부하 유저 2' },
  { email: 'load3@pickflow.dev', displayName: '부하 유저 3' },
  { email: 'load4@pickflow.dev', displayName: '부하 유저 4' },
];

export const options = {
  scenarios: {
    events: {
      executor: 'constant-vus',
      vus: 15,
      duration: '45s',
      exec: 'trackEvents',
    },
    assistant: {
      executor: 'constant-vus',
      vus: 10,
      duration: '45s',
      exec: 'askQuestions',
    },
    catalog: {
      executor: 'constant-arrival-rate',
      rate: 2,
      timeUnit: '1s',
      duration: '20s',
      preAllocatedVUs: 4,
      exec: 'publishProduct',
      startTime: '1s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.95'],
  },
};

function jsonHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function accessToken(email, displayName, secret) {
  let res = http.post(
    `${baseUrl}/api/v1/auth/login`,
    JSON.stringify({ email, password: secret }),
    { headers: jsonHeaders() },
  );
  if (res.status !== 200) {
    res = http.post(
      `${baseUrl}/api/v1/auth/register`,
      JSON.stringify({ email, password: secret, displayName }),
      { headers: jsonHeaders() },
    );
  }
  const token = res.json('data.accessToken');
  if (!token) throw new Error(`계정 준비 실패 ${email} status=${res.status} body=${res.body}`);
  return token;
}

export function setup() {
  const healthRes = http.get(`${baseUrl}/api/v1/health`);
  const health = healthRes.json('data');
  if (healthRes.status !== 200 || !health || health.aiProvider !== 'fake' || health.loadTest !== true) {
    throw new Error('npm run start:load 로 서버를 띄우세요. 부하 테스트는 Fake AI와 LOAD_TEST=true 에서만 실행됩니다.');
  }

  const shoppers = shopperAccounts.map((account) => accessToken(account.email, account.displayName, password));
  const adminToken = accessToken('admin@pickflow.dev', 'Pick Flow Admin', 'Admin1234!');

  const productsRes = http.get(`${baseUrl}/api/v1/products?limit=20`);
  const items = productsRes.json('data.items') || [];
  const productIds = items.map((item) => item.id).filter(Boolean);
  if (productsRes.status !== 200 || productIds.length === 0) {
    throw new Error('상품이 없습니다. npm run seed 를 먼저 실행하세요.');
  }

  return { shoppers, adminToken, productIds, runId: Date.now().toString(36) };
}

export function trackEvents(data) {
  const token = data.shoppers[(__VU + __ITER) % data.shoppers.length];
  const productId = data.productIds[(__VU * 3 + __ITER) % data.productIds.length];
  const type = eventTypes[(__VU + __ITER) % eventTypes.length];
  const limit = limits[__ITER % limits.length];
  const headers = jsonHeaders(token);

  const eventRes = http.post(
    `${baseUrl}/api/v1/events`,
    JSON.stringify({
      productId,
      type,
      clientEventId: `k6-${type}-${__VU}-${__ITER}-${Date.now()}`,
    }),
    { headers },
  );
  if (check(eventRes, { 'event accepted': (res) => res.status === 202 })) {
    eventsAccepted.add(1, { type });
  }

  const recRes = http.get(`${baseUrl}/api/v1/recommendations?limit=${limit}`, { headers });
  check(recRes, { 'recommendations ok': (res) => res.status === 200 });
  sleep(0.15);
}

export function askQuestions(data) {
  const token = data.shoppers[__VU % data.shoppers.length];
  const fresh = __ITER % 3 === 0;
  const pool = fresh ? freshQuestions : similarQuestions;
  const question = pool[(__VU + __ITER) % pool.length];
  const askRes = http.post(
    `${baseUrl}/api/v1/assistant/ask`,
    JSON.stringify({ question }),
    { headers: jsonHeaders(token) },
  );
  if (check(askRes, { 'assistant ok': (res) => res.status === 200 })) {
    const match = askRes.json('data.match');
    if (match === 'generated') generated.add(1);
    else cacheHits.add(1);
  }
  sleep(0.2);
}

export function publishProduct(data) {
  const category = categories[(__VU + __ITER) % categories.length];
  const sku = `K6-${data.runId}-${__VU}-${__ITER}`;
  const res = http.post(
    `${baseUrl}/api/v1/products`,
    JSON.stringify({
      sku,
      name: `부하 테스트 ${category} ${__ITER}`,
      description: `${category} 카테고리의 부하 테스트용 상품. 임베딩 큐로 들어간다.`,
      category,
      price: 10000 + __ITER * 100,
      tags: ['k6', category],
    }),
    { headers: jsonHeaders(data.adminToken) },
  );
  if (check(res, { 'product queued': (response) => response.status === 201 || response.status === 200 })) {
    productsQueued.add(1, { category });
  }
  sleep(0.05);
}
