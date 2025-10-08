import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { errorManager } from '@/lib/error-system'
import { unauthorized, internalError, badRequest } from '@/lib/http'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return unauthorized()
  }

  const userRole = (session.user as typeof session.user & { role?: string }).role

  if (userRole !== 'ADMIN') {
    return unauthorized('Forbidden');
  }

  try {
    const { from, to } = await request.json()

    if (!from || !to) {
      return badRequest('From and to dates are required')
    }

    const fromDate = new Date(from)
    const toDate = new Date(to)

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return badRequest('Invalid date format')
    }

    const stats = await errorManager.getErrorStats({
      from: fromDate,
      to: toDate,
    })

    return NextResponse.json(stats)
  } catch (error: any) {
    return internalError(error.message || 'Failed to get error statistics')
  }
}