import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
  ),
  title: "Popcorn - Sync any video with friends, live",
  description: "Watch YouTube videos in real-time sync with friends. Synchronized playback, live chat, and screen sharing.",
  applicationName: "Popcorn",
  keywords: ["watch party", "watch together", "sync video", "youtube sync", "popcorn", "movie night"],
  authors: [{ name: "Popcorn" }],
  icons: {
    icon: [
      { url: "/popcorn.png", sizes: "512x512", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/popcorn.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Popcorn - Sync any video with friends, live",
    description: "Watch YouTube videos in real-time sync with friends. Synchronized playback, live chat, and screen sharing.",
    siteName: "Popcorn",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Popcorn - Sync any video with friends, live",
      },
      {
        url: "/popcorn.png",
        width: 512,
        height: 512,
        type: "image/png",
        alt: "Popcorn Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Popcorn - Sync any video with friends, live",
    description: "Watch YouTube videos in real-time sync with friends. Synchronized playback, live chat, and screen sharing.",
    images: ["/og-image.png"],
  },
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('popcorn-theme');
                  var isDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches) || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

