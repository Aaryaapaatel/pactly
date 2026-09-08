import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pactly.example.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/policy", "/settings", "/api"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
