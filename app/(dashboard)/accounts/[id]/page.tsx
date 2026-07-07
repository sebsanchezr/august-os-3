'use client'

import dynamic from 'next/dynamic'

const AccountHQ = dynamic(() => import('@/components/accounts/account-hq'), { ssr: false })

export default function AccountDetailPage({ params }: { params: { id: string } }) {
  return <AccountHQ accountId={params.id} />
}
