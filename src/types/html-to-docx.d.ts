declare module 'html-to-docx' {
  export default function HTMLToDocx(
    html: string,
    headerHTML?: string | null,
    options?: any,
    footerHTML?: string | null
  ): Promise<Blob>;
}
