const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const shortTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const exactDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function parsedTime(value: string) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? Date.now() : time;
}

function ageParts(value: string, now: number) {
  const difference = Math.max(0, now - parsedTime(value));
  return {
    minutes: Math.floor(difference / MINUTE),
    hours: Math.floor(difference / HOUR),
    days: Math.floor(difference / DAY),
  };
}

function isYesterday(value: string, now: number) {
  const date = new Date(parsedTime(value));
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  );
}

function shortTime(value: string) {
  return shortTimeFormatter.format(new Date(parsedTime(value)));
}

export function formatCreatedAtGroup(value: string, now: number) {
  const { minutes, hours, days } = ageParts(value, now);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 14) return `${days}d ago`;
  return `${days} days ago`;
}

export function formatAddedAt(value: string, now: number) {
  const { minutes, hours, days } = ageParts(value, now);
  if (minutes < 1) return "Added just now";
  if (minutes < 60) return `Added ${minutes}m ago`;
  if (hours < 24) return `Added ${hours}h ago`;
  if (isYesterday(value, now)) {
    return `Added yesterday, ${shortTime(value)}`;
  }
  if (days < 14) return `Added ${days}d ago`;
  return `Added ${days} days ago`;
}

export function formatExactAddedAt(value: string) {
  return `Added ${exactDateTimeFormatter.format(new Date(parsedTime(value)))}`;
}
