export type ExchangeCode = string;

export interface Exchange {
    code        : ExchangeCode;
    label       : string;
    countryIso2 : string;
    currency    : string;
    mic         : string;
}

export const EXCHANGES: Exchange[] = [

    // ── Afrique ───────────────────────────────────────────────────────────────
    { code: "ZSE",   label: "Bourse du Zimbabwe",                  countryIso2: "ZW", currency: "ZWL", mic: "XZIM" },
    { code: "XZIM",  label: "Zimbabwe Stock Exchange",             countryIso2: "ZW", currency: "ZWL", mic: "XZIM" },
    { code: "VFEX",  label: "Victoria Falls Stock Exchange",       countryIso2: "ZW", currency: "ZWL", mic: "VFEX" },
    { code: "XBOT",  label: "Bourse du Botswana",                  countryIso2: "BW", currency: "BWP", mic: "XBOT" },
    { code: "EGX",   label: "Bourse d'Égypte",                     countryIso2: "EG", currency: "EGP", mic: "NILX" },
    { code: "GSE",   label: "Ghana Stock Exchange",                countryIso2: "GH", currency: "GHS", mic: "XGHA" },
    { code: "JSE",   label: "Bourse de Johannesburg",              countryIso2: "ZA", currency: "ZAR", mic: "XJSE" },
    { code: "XNAI",  label: "Nairobi Securities Exchange",         countryIso2: "KE", currency: "KES", mic: "XNAI" },
    { code: "LUSE",  label: "Lusaka Stock Exchange",               countryIso2: "ZM", currency: "ZMW", mic: "XLUS" },
    { code: "BC",    label: "Bourse de Casablanca",                countryIso2: "MA", currency: "MAD", mic: "XCAS" },
    { code: "SEM",   label: "Stock Exchange of Mauritius",         countryIso2: "MU", currency: "MUR", mic: "XMAU" },
    { code: "MSE",   label: "Malawi Stock Exchange",               countryIso2: "MW", currency: "MWK", mic: "XMSW" },
    { code: "XNSA",  label: "Nigerian Stock Exchange",             countryIso2: "NG", currency: "NGN", mic: "XNSA" },
    { code: "RSE",   label: "Rwanda Stock Exchange",               countryIso2: "RW", currency: "RWF", mic: "RSEX" },
    { code: "DSE",   label: "Dar es Salaam Stock Exchange",        countryIso2: "TZ", currency: "TZS", mic: "XDAR" },
    { code: "USE",   label: "Uganda Securities Exchange",          countryIso2: "UG", currency: "UGX", mic: "XUGA" },

    // ── Amériques ─────────────────────────────────────────────────────────────
    { code: "BA",    label: "Bourse de Buenos Aires",              countryIso2: "AR", currency: "ARS", mic: "XBUE" },
    { code: "SA",    label: "Bourse de São Paulo (B3)",            countryIso2: "BR", currency: "BRL", mic: "BVMF" },
    { code: "NEO",   label: "NEO Exchange",                        countryIso2: "CA", currency: "CAD", mic: "NEOE" },
    { code: "TO",    label: "Toronto Stock Exchange",              countryIso2: "CA", currency: "CAD", mic: "XTSE" },
    { code: "V",     label: "TSX Venture Exchange",                countryIso2: "CA", currency: "CAD", mic: "XTSX" },
    { code: "SN",    label: "Bourse de Santiago",                  countryIso2: "CL", currency: "CLP", mic: "XSGO" },
    { code: "LIM",   label: "Bolsa de Valores de Lima",            countryIso2: "PE", currency: "PEN", mic: "XLIM" },
    { code: "MX",    label: "Bourse mexicaine",                    countryIso2: "MX", currency: "MXN", mic: "XMEX" },
    { code: "US",    label: "USA Stocks (NASDAQ / NYSE)",          countryIso2: "US", currency: "USD", mic: "XNAS" },

    // ── Asie-Pacifique ────────────────────────────────────────────────────────
    { code: "AU",    label: "Australian Securities Exchange",      countryIso2: "AU", currency: "AUD", mic: "XASX" },
    { code: "SHG",   label: "Bourse de Shanghai",                  countryIso2: "CN", currency: "CNY", mic: "XSHG" },
    { code: "SHE",   label: "Bourse de Shenzhen",                  countryIso2: "CN", currency: "CNY", mic: "XSHE" },
    { code: "HK",    label: "Bourse de Hong Kong",                 countryIso2: "HK", currency: "HKD", mic: "XHKG" },
    { code: "JK",    label: "Bourse de Jakarta",                   countryIso2: "ID", currency: "IDR", mic: "XIDX" },
    { code: "IN",    label: "Bourse de Mumbai (BSE / NSE)",        countryIso2: "IN", currency: "INR", mic: "XBOM" },
    { code: "KO",    label: "Korea Stock Exchange",                countryIso2: "KR", currency: "KRW", mic: "XKRX" },
    { code: "KQ",    label: "KOSDAQ",                              countryIso2: "KR", currency: "KRW", mic: "XKOS" },
    { code: "KLSE",  label: "Bursa Malaysia",                      countryIso2: "MY", currency: "MYR", mic: "XKLS" },
    { code: "KAR",   label: "Pakistan Stock Exchange",             countryIso2: "PK", currency: "PKR", mic: "XKAR" },
    { code: "PSE",   label: "Philippine Stock Exchange",           countryIso2: "PH", currency: "PHP", mic: "XPHS" },
    { code: "SG",    label: "Singapore Exchange",                  countryIso2: "SG", currency: "SGD", mic: "XSES" },
    { code: "CM",    label: "Colombo Stock Exchange",              countryIso2: "LK", currency: "LKR", mic: "XCOL" },
    { code: "TW",    label: "Taiwan Stock Exchange",               countryIso2: "TW", currency: "TWD", mic: "XTAI" },
    { code: "TWO",   label: "Taiwan OTC Exchange",                 countryIso2: "TW", currency: "TWD", mic: "ROCO" },
    { code: "BK",    label: "Stock Exchange of Thailand",          countryIso2: "TH", currency: "THB", mic: "XBKK" },
    { code: "VN",    label: "Vietnam Stocks (HOSE / HNX)",         countryIso2: "VN", currency: "VND", mic: "XSTC" },

    // ── Europe ────────────────────────────────────────────────────────────────
    { code: "VI",    label: "Wiener Börse",                        countryIso2: "AT", currency: "EUR", mic: "XWBO" },
    { code: "BR",    label: "Euronext Bruxelles",                  countryIso2: "BE", currency: "EUR", mic: "XBRU" },
    { code: "PR",    label: "Prague Stock Exchange",               countryIso2: "CZ", currency: "CZK", mic: "XPRA" },
    { code: "CO",    label: "Nasdaq Copenhagen",                   countryIso2: "DK", currency: "DKK", mic: "XCSE" },
    { code: "HE",    label: "Nasdaq Helsinki",                     countryIso2: "FI", currency: "EUR", mic: "XHEL" },
    { code: "PA",    label: "Euronext Paris",                      countryIso2: "FR", currency: "EUR", mic: "XPAR" },
    { code: "BE",    label: "Bourse de Berlin",                    countryIso2: "DE", currency: "EUR", mic: "XBER" },
    { code: "DU",    label: "Bourse de Düsseldorf",                countryIso2: "DE", currency: "EUR", mic: "XDUS" },
    { code: "F",     label: "Bourse de Francfort",                 countryIso2: "DE", currency: "EUR", mic: "XFRA" },
    { code: "HA",    label: "Bourse de Hanovre",                   countryIso2: "DE", currency: "EUR", mic: "XHAN" },
    { code: "HM",    label: "Bourse de Hambourg",                  countryIso2: "DE", currency: "EUR", mic: "XHAM" },
    { code: "MU",    label: "Bourse de Munich",                    countryIso2: "DE", currency: "EUR", mic: "XMUN" },
    { code: "STU",   label: "Bourse de Stuttgart",                 countryIso2: "DE", currency: "EUR", mic: "XSTU" },
    { code: "XETRA", label: "XETRA",                               countryIso2: "DE", currency: "EUR", mic: "XETR" },
    { code: "AT",    label: "Athens Exchange",                     countryIso2: "GR", currency: "EUR", mic: "ASEX" },
    { code: "BUD",   label: "Budapest Stock Exchange",             countryIso2: "HU", currency: "HUF", mic: "XBUD" },
    { code: "IR",    label: "Euronext Dublin",                     countryIso2: "IE", currency: "EUR", mic: "XDUB" },
    { code: "TA",    label: "Tel Aviv Stock Exchange",             countryIso2: "IL", currency: "ILS", mic: "XTAE" },
    { code: "MI",    label: "Borsa Italiana",                      countryIso2: "IT", currency: "EUR", mic: "XMIL" },
    { code: "LS",    label: "Euronext Lisbonne",                   countryIso2: "PT", currency: "EUR", mic: "XLIS" },
    { code: "LU",    label: "Bourse de Luxembourg",                countryIso2: "LU", currency: "EUR", mic: "XLUX" },
    { code: "AS",    label: "Euronext Amsterdam",                  countryIso2: "NL", currency: "EUR", mic: "XAMS" },
    { code: "OL",    label: "Oslo Børs",                           countryIso2: "NO", currency: "NOK", mic: "XOSL" },
    { code: "WAR",   label: "Warsaw Stock Exchange",               countryIso2: "PL", currency: "PLN", mic: "XWAR" },
    { code: "RO",    label: "Bourse de Bucarest",                  countryIso2: "RO", currency: "RON", mic: "XBSE" },
    { code: "LSE",   label: "London Stock Exchange",               countryIso2: "GB", currency: "GBP", mic: "XLON" },
    { code: "MC",    label: "Bolsa de Madrid",                     countryIso2: "ES", currency: "EUR", mic: "BMEX" },
    { code: "ST",    label: "Nasdaq Stockholm",                    countryIso2: "SE", currency: "SEK", mic: "XSTO" },
    { code: "SW",    label: "SIX Swiss Exchange",                  countryIso2: "CH", currency: "CHF", mic: "XSWX" },
    { code: "ZSE",   label: "Zagreb Stock Exchange",               countryIso2: "HR", currency: "EUR", mic: "XZAG" },

    // ── Marchés virtuels ──────────────────────────────────────────────────────
    { code: "CC",     label: "Cryptomonnaies",                     countryIso2: "",   currency: "USD", mic: "CRYP"  },
    { code: "FOREX",  label: "Marché des changes (Forex)",         countryIso2: "",   currency: "",    mic: "CDSL"  },
    { code: "GBOND",  label: "Obligations d'État",                 countryIso2: "",   currency: "",    mic: ""      },
    { code: "MONEY",  label: "Marché monétaire",                   countryIso2: "",   currency: "",    mic: ""      },
    { code: "EUFUND", label: "Fonds européens",                    countryIso2: "",   currency: "EUR", mic: ""      },
    { code: "INDX",   label: "Indices",                            countryIso2: "",   currency: "",    mic: ""      },

];

/** Lookup O(1) : code → Exchange */
export const EXCHANGE_BY_CODE: Record<ExchangeCode, Exchange> =
    Object.fromEntries(EXCHANGES.map(e => [e.code, e]));