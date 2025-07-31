import './globals.css'
import './fonts.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'var(--font-roboto-flex)' }}>{children}</body>
    </html>
  )
}
