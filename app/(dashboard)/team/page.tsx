'use client'

import dynamic from 'next/dynamic'

const TeamGrid = dynamic(() => import('@/components/team/team-grid'), { ssr: false })

export default function TeamPage() {
  return <TeamGrid />
}
