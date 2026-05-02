import type { Provider } from "./index";

const YEAR_CODES: Record<string, number[]> = {
  A: [1980, 2010], B: [1981, 2011], C: [1982, 2012], D: [1983, 2013],
  E: [1984, 2014], F: [1985, 2015], G: [1986, 2016], H: [1987, 2017],
  J: [1988, 2018], K: [1989, 2019], L: [1990, 2020], M: [1991, 2021],
  N: [1992, 2022], P: [1993, 2023], R: [1994, 2024], S: [1995, 2025],
  T: [1996, 2026], V: [1997, 2027], W: [1998, 2028], X: [1999, 2029],
  Y: [2000, 2030],
  "1": [2001], "2": [2002], "3": [2003], "4": [2004], "5": [2005],
  "6": [2006], "7": [2007], "8": [2008], "9": [2009],
};

function decodeYear(code: string): number[] {
  return YEAR_CODES[code.toUpperCase()] ?? [];
}

export const vinProvider: Provider = async ({ vin }) => {
  if (!vin || typeof vin !== "string") {
    return { ok: false, error: "vin_not_provided" };
  }

  if (vin.length !== 17) {
    return { ok: false, error: "invalid_vin_length" };
  }

  const yearCode = vin[9];
  const possibleYears = decodeYear(yearCode);

  return {
    ok: true,
    data: {
      validLength: true,
      yearCode,
      possibleYears,
      inferredYear: possibleYears[possibleYears.length - 1] ?? null,
    },
  };
};
