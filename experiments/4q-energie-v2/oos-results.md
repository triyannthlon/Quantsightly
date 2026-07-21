# Étude Énergie v2 — robustesse hors-échantillon

## 1. Sous-périodes — médiane ΔSharpe réel net 25 bps (n pays)
La question clé : le gain survit-il HORS du choc 2021-2022 ? (colonnes « live 11-20 » et « pré-2021 »)

| config | Max | backfill 95-10 | live 11-20 | pré-2021 | live 11-26 | choc 21-26 |
|---|---|---|---|---|---|---|
| ramp/prorata T_E20 w15 (centre plateau) | +0.048 (21) | +0.000 (16) | -0.013 (21) | -0.012 (21) | +0.061 (21) | +0.222 (21) |
| ramp/prorata T_E20 w20 | +0.055 (21) | +0.000 (16) | -0.019 (21) | -0.013 (21) | +0.078 (21) | +0.283 (21) |
| ramp/prorata T_E20 w25 | +0.079 (21) | +0.000 (16) | -0.024 (21) | -0.016 (21) | +0.097 (21) | +0.324 (21) |
| ramp/prorata T_E20 w30 (ext.) | +0.082 (21) | +0.000 (16) | -0.029 (21) | -0.018 (21) | +0.109 (21) | +0.361 (21) |
| ramp/prorata T_E20 w35 (ext.) | +0.086 (21) | +0.000 (16) | -0.034 (21) | -0.023 (21) | +0.121 (21) | +0.376 (21) |
| ramp/prorata T_E0 w20 | +0.060 (21) | +0.000 (16) | -0.044 (21) | -0.024 (21) | +0.082 (21) | +0.342 (21) |
| ramp/boombloc T_E20 w20 | +0.057 (21) | +0.000 (16) | -0.019 (21) | -0.013 (21) | +0.076 (21) | +0.278 (21) |
| step/prorata T_E40 w15 (coin) | +0.075 (21) | +0.000 (16) | -0.011 (21) | -0.008 (21) | +0.100 (21) | +0.277 (21) |

## 1bis. Décomposition temporelle fine — ramp/prorata T_E20 w20 (net 25 bps)
Part du MONDE en boom inflationniste (gate) + médiane ΔSharpe par tranche : où l'énergie paie-t-elle ?

| tranche | 95-00 | 01-05 | 06-10 | 11-15 | 16-20 | 21-26 |
|---|---|---|---|---|---|---|
| MONDE boom (gate actif) | 0% | 0% | 0% | 7% | 27% | 65% |
| médiane ΔSharpe (n) | +0.000 (6) | +0.000 (12) | +0.000 (16) | +0.000 (21) | -0.053 (21) | +0.283 (21) |

## 2. Leave-one-country-out — médiane ΔSharpe Max (net 25 bps)
Chaque pays retiré tour à tour ; on reporte la médiane MIN et MAX sur les 21 retraits (robuste si MIN > 0).

| config | médiane pleine | LOO min | LOO max | pays le plus influent |
|---|---|---|---|---|
| ramp/prorata T_E20 w15 (centre plateau) | +0.048 | +0.047 | +0.048 | GB (-0.001) |
| ramp/prorata T_E20 w20 | +0.055 | +0.055 | +0.060 | GB (-0.005) |
| ramp/prorata T_E20 w25 | +0.079 | +0.073 | +0.081 | GB (+0.006) |
| ramp/prorata T_E20 w30 (ext.) | +0.082 | +0.079 | +0.083 | GB (+0.001) |
| ramp/prorata T_E20 w35 (ext.) | +0.086 | +0.080 | +0.087 | GB (+0.001) |
| ramp/prorata T_E0 w20 | +0.060 | +0.058 | +0.063 | GB (-0.005) |

## 3. Dispersion par pays — ramp/prorata T_E20 w20 (Max, net 25 bps)
| pays | ΔSharpe | ΔCAGR | ΔMDD | contrib Énergie (brut, Max) | part active |
|---|---|---|---|---|---|
| DE | +0.054 | +0.21 | +0.0 | 8.8% | 14% |
| AU | +0.076 | +0.36 | +4.6 | 10.2% | 16% |
| BR | +0.066 | +0.45 | +2.5 | 10.9% | 19% |
| CA | +0.052 | +0.23 | +0.0 | 11.6% | 11% |
| CN | +0.048 | +0.38 | +0.0 | 9.4% | 21% |
| KR | +0.074 | +0.26 | +0.0 | 12.5% | 16% |
| ES | +0.066 | +0.32 | +0.0 | 10.5% | 17% |
| US | +0.044 | +0.22 | +0.4 | 10.8% | 11% |
| FR | +0.074 | +0.34 | +0.0 | 11.5% | 15% |
| HK | +0.025 | +0.25 | +0.0 | 11.3% | 11% |
| IN | +0.044 | +0.32 | +0.0 | 11.7% | 16% |
| ID | +0.078 | +0.60 | +0.0 | 11.5% | 25% |
| IT | +0.093 | +0.50 | +0.0 | 9.7% | 26% |
| JP | +0.054 | +0.23 | +0.0 | 12.5% | 11% |
| MX | +0.043 | +0.29 | +0.0 | 8.9% | 18% |
| NO | +0.031 | +0.21 | +0.0 | 9.6% | 15% |
| GB | -0.005 | -0.05 | +0.0 | 1.8% | 11% |
| SG | +0.080 | +0.36 | +0.0 | 9.7% | 25% |
| SE | +0.055 | +0.29 | -0.1 | 11.1% | 13% |
| CH | +0.072 | +0.34 | +1.4 | 11.2% | 14% |
| TW | +0.077 | +0.29 | +0.0 | 10.7% | 25% |

**ramp/prorata T_E20 w20** : médiane ΔSharpe +0.055, pire-décile 0.010, % améliorés 95 %, pires pays GB -0.005, HK 0.025, NO 0.031