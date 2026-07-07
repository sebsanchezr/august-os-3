'use client'

import dynamic from 'next/dynamic'

// Standalone printable report page — opens in a new tab, print → Save as PDF
const PrintReport = dynamic(() => import('@/components/accounts/print-report'), { ssr: false })

export default function ReportPrintPage({ params }: { params: { id: string } }) {
  return <PrintReport accountId={params.id} />
}
