'use client'

import dynamic from 'next/dynamic'

const OnboardingBoard = dynamic(() => import('@/components/team/onboarding-board'), { ssr: false })

export default function TeamOnboardingPage() {
  return <OnboardingBoard />
}
