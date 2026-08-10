import { apiFetch, ensureValidToken } from './api';

export async function uploadFileToStorage(
  file: File,
  kind: string = 'product-avatar',
): Promise<string> {
  const token = await ensureValidToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api';

  // Strategy A: Direct multipart upload to API server (bypasses browser CORS on R2/S3!)
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);

    const res = await fetch(`${baseUrl}/uploads/file`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.publicUrl) {
        return data.publicUrl;
      }
    }
  } catch (directErr) {
    console.warn('Direct upload fallback:', directErr);
  }

  // Strategy B: Presigned S3/R2 URL upload
  const presign = await apiFetch<{ uploadUrl: string; publicUrl: string }>('/uploads/presign', {
    method: 'POST',
    body: JSON.stringify({
      contentType: file.type || 'image/png',
      filename: file.name,
      kind,
    }),
  });

  if (presign.ok && presign.data) {
    try {
      const putRes = await fetch(presign.data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'image/png' },
      });
      if (putRes.ok) {
        return presign.data.publicUrl;
      }
    } catch (corsErr) {
      console.warn('Presigned PUT error:', corsErr);
    }
  }

  throw new Error('Image upload failed. Please try again.');
}
