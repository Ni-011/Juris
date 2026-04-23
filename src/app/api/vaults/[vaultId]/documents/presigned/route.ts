import { NextResponse } from "next/server";
import { generateUploadUrl } from "@/lib/supabase-storage";

interface RouteParams {
    params: Promise<{ vaultId: string }>;
}

export async function POST(req: Request, { params }: RouteParams) {
    try {
        const { vaultId } = await params;
        const { files } = await req.json();

        const urls = [];
        for (const f of files) {
            const { storagePath, uploadUrl } = await generateUploadUrl(
                f.fileName,
                vaultId
            );
            urls.push({
                fileName: f.fileName,
                storagePath,
                uploadUrl,
            });
        }

        return NextResponse.json({ urls });
    } catch (error: any) {
        console.error("[Documents] Presigned URL error:", error.message);
        return NextResponse.json(
            { error: "Failed to generate upload URLs" },
            { status: 500 }
        );
    }
}
