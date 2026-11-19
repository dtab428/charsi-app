export type TradePost = {
  id: string;
  title: string;
  author: string;
  permalink: string;
  created: number;
  pictures: string[];
  selftext: string;
};

const PICTURE = /^https:\/\/(?:i\.imgur\.com|imgur\.com|i\.redd\.it|preview\.redd\.it|external-preview\.redd\.it)\//i;
const cache: { at: number; posts: TradePost[] } = { at: 0, posts: [] };

function picturesOf(record: Record<string, unknown>): string[] {
  const found = new Set<string>();
  const text = typeof record.selftext === "string" ? record.selftext : "";
  for (const match of text.matchAll(/https:\/\/(?:i\.imgur\.com|imgur\.com|i\.redd\.it)\/[^\s)>\]]+/gi)) {
    const href = match[0].replace(/[.,]$/, "");
    if (PICTURE.test(href)) found.add(href);
  }
  const preview = record.preview as { images?: { source?: { url?: string } }[] } | undefined;
  for (const image of preview?.images ?? []) {
    const href = image.source?.url?.replace(/&amp;/g, "&");
    if (href && PICTURE.test(href)) found.add(href);
  }
  return [...found].slice(0, 6);
}

export async function recentTrades(): Promise<TradePost[]> {
  if (Date.now() - cache.at < 10 * 60 * 1000 && cache.posts.length > 0) return cache.posts;
  const response = await fetch("https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=pkmntcgtrades&limit=24&sort=desc", {
    signal: AbortSignal.timeout(12_000),
    headers: { accept: "application/json", "user-agent": "charsi/1.0" },
  });
  if (!response.ok) throw new Error(`reddit ${response.status}`);
  const payload = (await response.json()) as { data?: Record<string, unknown>[] };
  const posts = (payload.data ?? [])
    .map((record) => {
      const id = typeof record.id === "string" ? record.id : "";
      const title = typeof record.title === "string" ? record.title.slice(0, 300) : "";
      const permalink = typeof record.permalink === "string" ? record.permalink : "";
      if (!id || !title || !permalink.startsWith("/r/")) return null;
      return {
        id,
        title,
        author: typeof record.author === "string" ? record.author.slice(0, 40) : "",
        permalink: `https://www.reddit.com${permalink}`,
        created: typeof record.created_utc === "number" ? record.created_utc : 0,
        pictures: picturesOf(record),
        selftext: typeof record.selftext === "string" ? record.selftext.slice(0, 500) : "",
      };
    })
    .filter((post): post is TradePost => post != null);
  cache.at = Date.now();
  cache.posts = posts;
  return posts;
}
