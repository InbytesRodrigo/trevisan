function readableTextColor(hex) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}

export function themeColor(value, backgroundVariable, textVariable) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return {};
  return { [backgroundVariable]: value, [textVariable]: readableTextColor(value) };
}
