/** "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" -> "7xKX…gAsU" */
export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
