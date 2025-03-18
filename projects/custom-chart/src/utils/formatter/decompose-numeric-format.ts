export function decomposeNumericFormat(format: string): {
  fill: string;
  align: string;
  sign: string;
  symbol: string;
  zfill: string;
  width: unknown;
  comma: string;
  precision: string;
  typeFormat: string;
} {
  const d3FormatRegex =
    /(?:([^{])?([<>=^]))?([+\- \()])?([$#])?(0)?(\d+)?([,_])?(\.-?\d+)?([a-z%]{1,2})?/i;
  const match = d3FormatRegex.exec(format) ?? [];

  return {
    fill: match[1] || ' ',
    align: match[2] || '>',
    sign: match[3] || '-',
    symbol: match[4] || '', // added option '(' for negative notation with () //TO-DO implement
    zfill: match[5],
    width: +match[6],
    comma: match[7], // added option _ for thousand separator ' '
    precision: match[8],
    typeFormat: match[9] // z = general formal with comma, y = percentage with comma, w = scientific with comma
  };
}
