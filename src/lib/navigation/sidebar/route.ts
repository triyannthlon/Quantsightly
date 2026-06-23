export const routes = {
  dashboard: "/home",

  screener: {
    root: `/screener`,
    stock: `/screener/asset-stock`,
    etf: `/screener/asset-etf`,
    crypto: `/screener/asset-crypto`,
    currency: `/screener/asset-currency`,
    index: `/screener/asset-index`,
    bond: `/screener/asset-bond`,
  },
} as const;
