export const MARKET_PROFILE = (import.meta.env.VITE_MARKET_PROFILE || "US").toUpperCase();

export const isUsOnly = () => MARKET_PROFILE === "US" || !MARKET_PROFILE;
