import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_TITLE,
  SEO_SITE_NAME,
  getDefaultOgImageUrl,
  getJsonLdWebSite,
  getSeoSiteOrigin,
} from '@/lib/seo';
import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  const siteUrl = `${getSeoSiteOrigin()}/`;
  const ogImage = getDefaultOgImageUrl();
  const jsonLd = JSON.stringify(getJsonLdWebSite());

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>{SEO_DEFAULT_TITLE}</title>
        <meta name="description" content={SEO_DEFAULT_DESCRIPTION} />
        <meta name="application-name" content={SEO_SITE_NAME} />
        <meta name="theme-color" content="#06020e" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SEO_SITE_NAME} />
        <meta property="og:title" content={SEO_DEFAULT_TITLE} />
        <meta property="og:description" content={SEO_DEFAULT_DESCRIPTION} />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content="en_US" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={SEO_DEFAULT_TITLE} />
        <meta name="twitter:description" content={SEO_DEFAULT_DESCRIPTION} />
        <meta name="twitter:image" content={ogImage} />

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

/** Match `runit.bgDeep` everywhere — app is dark; avoids a light or mismatched strip behind the web tab bar. */
const responsiveBackground = `
html, body {
  background-color: #06020e;
}
`;
