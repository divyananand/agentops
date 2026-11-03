// small helpers every page uses, so numbers and times look the same everywhere

// 0 -> "0 ms", 850 -> "850 ms", 2491 -> "2.5 s"
export function formatMs(ms: number) {
  const n = Number(ms);
  if (n < 1000) return n + " ms";
  return (n / 1000).toFixed(1) + " s";
}

// postgres can send money as text, so Number() first. 4 decimals keeps tiny costs visible
export function formatCost(cost: number | string) {
  return "$" + Number(cost).toFixed(4);
}

// "just now", "5m ago", "3h ago", "2d ago". the exact time goes in a tooltip instead
export function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  return days + "d ago";
}

export function fullTime(iso: string) {
  return new Date(iso).toLocaleString();
}
