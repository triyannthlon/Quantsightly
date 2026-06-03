
export const routes = {
                      dashboard: "/home",

                       screener: {
                                    root: `/screener`                  ,
                                   stock: `/screener/asset-stock`      ,
                                     etf: `/screener/asset-etf`        ,
                                  crypto: `/screener/asset-crypto`     ,
                                currency: `/screener/asset-currency`   ,
                                   index: `/screener/asset-index`      ,
                                },


                      items: {
                                root: `/items`,

                                item_1: {
                                          root: `/items/item_1`       ,
                                        page_1: `/items/item_1/page_1`,
                                        page_2: `/items/item_1/page_2`,
                                        page_3: `/items/item_1/page_3`,
                                        page_4: `/items/item_1/page_4`,
                                        page_5: `/items/item_1/page_5`,
                                        },

                            },

                     management: {
                                     root: `/management`,

                                    users: `/management/users`,
                                 settings: `/management/settings`,
                                 },

                      } as const;
