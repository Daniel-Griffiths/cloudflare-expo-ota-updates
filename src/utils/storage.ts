import { lookup } from "mrmime";

export class R2Storage {
  /**
   * Creates a new R2Storage instance
   *
   * @param bucket - Cloudflare R2 bucket instance
   * @param publicUrl - Public URL for accessing stored files
   */
  constructor(private bucket: R2Bucket, private publicUrl: string) {}

  /**
   * Uploads a file to R2 bucket with automatic content type detection
   *
   * @param filePath - Path where the file will be stored in the bucket
   * @param fileBuffer - File contents as ArrayBuffer
   * @returns Public URL of the uploaded file
   */
  async uploadFile(filePath: string, fileBuffer: ArrayBuffer): Promise<string> {
    await this.bucket.put(filePath, fileBuffer, {
      httpMetadata: {
        contentType: this.getContentType(filePath),
      },
    });

    return this.getFileUrl(filePath);
  }

  /**
   * Generates the public URL for a file in the bucket
   *
   * @param filePath - Path to the file in the bucket
   * @returns Full public URL to access the file
   */
  getFileUrl(filePath: string): string {
    return `${this.publicUrl}/${filePath}`;
  }

  /**
   * Downloads a file from R2 bucket
   *
   * @param filePath - Path to the file in the bucket
   * @returns File contents as ArrayBuffer, or null if file doesn't exist
   */
  async downloadFile(filePath: string): Promise<ArrayBuffer | null> {
    const object = await this.bucket.get(filePath);

    if (!object) {
      return null;
    }

    return object.arrayBuffer();
  }

  /**
   * Recursively deletes all files in a folder (prefix)
   *
   * @param folderPath - Path to the folder to delete
   */
  async deleteFolder(folderPath: string): Promise<void> {
    const prefix = folderPath.endsWith("/") ? folderPath : `${folderPath}/`;
    const listed = await this.bucket.list({ prefix });

    const deletePromises = listed.objects.map((obj) =>
      this.bucket.delete(obj.key)
    );

    await Promise.all(deletePromises);

    // paginate if there are more objects
    if (listed.truncated) {
      await this.deleteFolder(folderPath);
    }
  }

  /**
   * Determines the MIME type for a file based on its extension
   *
   * @param filePath - Path or filename to detect content type for
   * @returns MIME type string (e.g., "image/png", "application/json")
   */
  getContentType(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

    // Special case for Hermes bytecode (not in standard MIME database)
    if (ext === "hbc") {
      return "application/javascript";
    }

    return lookup(ext) || "application/octet-stream";
  }
}
