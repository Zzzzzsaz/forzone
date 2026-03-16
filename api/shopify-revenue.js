const DEFAULT_API_VERSION = '2025-10';

function json(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function normalizeDomain(value){
  return String(value || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

function nextDate(date){
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

async function fetchShopifyRevenue({shopDomain, accessToken, apiVersion, date}){
  const version = apiVersion || DEFAULT_API_VERSION;
  const endpoint = `https://${shopDomain}/admin/api/${version}/graphql.json`;
  const start = `${date}T00:00:00Z`;
  const end = `${nextDate(date)}T00:00:00Z`;
  const queryString = `created_at:>=${start} created_at:<${end}`;
  const gql = `
    query RevenueForDay($first: Int!, $after: String, $query: String!) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, query: $query) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          cancelledAt
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let after = null;
  let revenueGross = 0;
  let orderCount = 0;
  let currency = 'PLN';

  while(hasNextPage){
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({
        query: gql,
        variables: {
          first: 100,
          after,
          query: queryString
        }
      })
    });

    const payload = await response.json();
    if(!response.ok){
      throw new Error(payload?.errors?.[0]?.message || 'Shopify API zwrocilo blad');
    }
    if(payload?.errors?.length){
      throw new Error(payload.errors[0]?.message || 'Shopify GraphQL zwrocilo blad');
    }

    const orders = payload?.data?.orders?.nodes || [];
    for(const order of orders){
      if(order?.cancelledAt) continue;
      const amount = Number(order?.currentTotalPriceSet?.shopMoney?.amount || 0);
      if(Number.isFinite(amount)) revenueGross += amount;
      if(order?.currentTotalPriceSet?.shopMoney?.currencyCode) currency = order.currentTotalPriceSet.shopMoney.currencyCode;
      orderCount += 1;
    }

    hasNextPage = !!payload?.data?.orders?.pageInfo?.hasNextPage;
    after = payload?.data?.orders?.pageInfo?.endCursor || null;
  }

  return {
    revenueGross: Number(revenueGross.toFixed(2)),
    orderCount,
    currency
  };
}

module.exports = async (req, res) => {
  if(req.method !== 'POST'){
    res.setHeader('Allow', 'POST');
    return json(res, 405, {error: 'Method not allowed'});
  }

  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const shopDomain = normalizeDomain(body.shopDomain);
    const accessToken = String(body.accessToken || '').trim();
    const apiVersion = String(body.apiVersion || DEFAULT_API_VERSION).trim() || DEFAULT_API_VERSION;
    const date = String(body.date || '').trim();

    if(!shopDomain || !accessToken || !/^\d{4}-\d{2}-\d{2}$/.test(date)){
      return json(res, 400, {error: 'Brakuje domeny, tokena lub poprawnej daty'});
    }

    const result = await fetchShopifyRevenue({shopDomain, accessToken, apiVersion, date});
    return json(res, 200, result);
  }catch(error){
    return json(res, 500, {error: error?.message || 'Nie udalo sie pobrac danych z Shopify'});
  }
};
