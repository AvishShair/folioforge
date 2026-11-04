import { tools } from "@/lib/domain";
export default function sitemap() {
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  return base
    ? ["", "/privacy", ...tools.map((t) => t.route)].map((route) => ({
        url: `${base}${route}`,
      }))
    : [];
}
