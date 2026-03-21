export function formatTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return [hours, minutes, remainingSeconds].map((value, index) => String(value).padStart(index === 0 ? 1 : 2, "0")).join(":");
  }

  return `${String(minutes).padStart(1, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function normalizeTimestampToSeconds(input: string) {
  const value = input.trim();

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  if (!/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(value)) {
    throw new Error("Timestamp must look like ss, mm:ss, or hh:mm:ss.");
  }

  const parts = value.split(":").map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) {
    throw new Error("Timestamp contains invalid numbers.");
  }

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    if (seconds >= 60) {
      throw new Error("Seconds must be below 60 for mm:ss timestamps.");
    }

    return minutes * 60 + seconds;
  }

  const [hours, minutes, seconds] = parts;
  if (minutes >= 60 || seconds >= 60) {
    throw new Error("Minutes and seconds must be below 60 for hh:mm:ss timestamps.");
  }

  return hours * 3600 + minutes * 60 + seconds;
}
