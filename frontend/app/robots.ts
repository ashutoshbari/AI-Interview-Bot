import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/interview/', '/report/', '/verify/', '/api/'],
    },
    sitemap: 'https://frontend-nine-tau-65.vercel.app/sitemap.xml',
  };
}
