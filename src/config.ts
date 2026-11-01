export const API_URL = "https://api.mancer.xyz";
export const RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const CHAIN_ID = 4663;
export const FACTORY = "0xa727e7AF47A965afD0341AfCEF7Bc3F86be876b0";
export const WETH = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
export const POLL_MS = 15_000;
export const LOG_WINDOW = 2_000_000;
// First four bytes of keccak256 of the documented read signatures.
// bookOf(uint256) returns (bookToken, tba, opNft); tradersOf returns address[].
export const SELECTORS = {
  bookIdOfToken: "0x08a789d3",
  bookOf: "0x3e6dc868",
  tradersOf: "0xaeac5d23",
  costBasis: "0x8fd861f2",
  unlockAt: "0x3d71a4eb",
  trackedTokens: "0x4c37ef23",
  trackedBalance: "0x8102ef09",
} as const;
// TradeExecuted(uint256 indexed bookId,bytes32 digest,address adapter,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut)
export const TRADE_TOPIC =
  "0xade7cdc6b55c14352cfd2faddd41594a2a59aa77937c603dbfe60e22964c0bd8";
