import { NextResponse } from 'next/server';

import { deleteAdminFileService } from '@/features/admin/service/admin-file.service';
import { adminGuard } from '@/shared/lib/admin-guard';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const { id } = await params;
    const { data, status } = await deleteAdminFileService(id);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
