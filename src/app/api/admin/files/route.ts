import { NextRequest, NextResponse } from 'next/server';

import {
  listAdminFilesService,
  uploadAdminFileService,
} from '@/features/admin/service/admin-file.service';
import { AdminListQuerySchema } from '@/features/admin/validations/admin.validation';
import { adminGuard } from '@/shared/lib/admin-guard';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const params = req.nextUrl.searchParams;
    const query = AdminListQuerySchema.safeParse({
      page: params.get('page') ?? undefined,
      pageSize: params.get('pageSize') ?? undefined,
    });
    if (!query.success) return NextResponse.json({ error: 'VALIDATION_ERROR' }, { status: 400 });

    const { data, status } = await listAdminFilesService(query.data);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

/**
 * Upload. Multipart rather than JSON, so `validateBody` does not apply — the file is pulled off
 * the form and the service does the checking, since size and type are the validation here and
 * neither is expressible as a Zod body schema.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await adminGuard.requireAdmin();
    if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'NO_FILE' }, { status: 400 });
    }

    const { data, status } = await uploadAdminFileService(session.userId, file);
    return NextResponse.json(data, { status });
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
