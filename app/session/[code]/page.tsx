import { SessionView } from '@/components/session-view'
import { normalizeCode } from '@/lib/code'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  return <SessionView code={normalizeCode(code)} />
}
