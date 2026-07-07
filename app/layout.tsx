import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'August OS',
  description: 'August Marketing — Business Operating System',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png', sizes: '64x64', type: 'image/png' },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#08090c] text-[#e4e6f0] antialiased">{children}</body>
    </html>
  )
}
