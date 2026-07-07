'use client'

import dynamic from 'next/dynamic'

const ApprovalsQueue = dynamic(() => import('@/components/accounts/approvals-queue'), { ssr: false })

export default function ApprovalsPage() {
  return <ApprovalsQueue />
}
