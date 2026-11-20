/** Split a brand name before its 2nd capital ("FastDemo" -> "Fast" + "Demo") for the two-tone wordmark; no 2nd capital = one part. */
export function splitBrandName(name: string): [string, string] {
  const i = name.slice(1).search(/[A-Z]/) + 1;
  return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ''];
}
