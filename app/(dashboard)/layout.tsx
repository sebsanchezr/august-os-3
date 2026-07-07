import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
// Nav is written in a subsequent task — import will resolve once the file exists
import Nav from '@/components/nav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="flex flex-row h-screen overflow-hidden">
      <Nav />
      <main className="flex-1 overflow-y-auto bg-[#08090c]">
        {children}
      </main>
    </div>
  )
}
