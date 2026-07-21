'use client'

import dynamic from 'next/dynamic'

const TeamProfile = dynamic(() => import('@/components/team/team-profile'), { ssr: false })

export default function TeamMemberPage({ params }: { params: { id: string } }) {
  return <TeamProfile memberId={params.id} />
}
