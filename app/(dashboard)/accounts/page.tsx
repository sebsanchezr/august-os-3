'use client'

import dynamic from 'next/dynamic'

const AccountsGrid = dynamic(() => import('@/components/accounts/accounts-grid'), { ssr: false })

export default function AccountsPage() {
  return <AccountsGrid />
}
