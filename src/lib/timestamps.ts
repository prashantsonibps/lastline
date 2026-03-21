export function parseTimestampToSeconds(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Timestamp is required.");
  }

  const normalized = trimmed.replace(/\s+/g, "");
  const parts = normalized.split(":");

  if (parts.some((part) => part.length === 0 || Number.isNaN(Number(part)))) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  const numbers = parts.map((part) => Number(part));

  if (numbers.some((part) => part < 0)) {
    throw new Error(`Invalid timestamp: ${value}`);
  }

  if (numbers.length === 1) {
    return numbers[0];
  }

  if (numbers.length === 2) {
    const [minutes, seconds] = numbers;
    return minutes * 60 + seconds;
  }

  if (numbers.length === 3) {
    const [hours, minutes, seconds] = numbers;
    return hours * 3600 + minutes * 60 + seconds;
  }

  throw new Error(`Invalid timestamp: ${value}`);
}

