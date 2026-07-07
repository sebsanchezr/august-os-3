'use client'

import dynamic from 'next/dynamic'

const IssuesBoard = dynamic(() => import('@/components/accounts/issues-board'), { ssr: false })

export default function IssuesPage() {
  return <IssuesBoard />
}
