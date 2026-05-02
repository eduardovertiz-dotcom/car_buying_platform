import type { Provider } from "./index";

export const facturaProvider: Provider = async () => {
  return { ok: false, error: "not_provided" };
};
