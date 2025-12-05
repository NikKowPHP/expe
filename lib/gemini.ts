import { getAllKeys } from '@/lib/utils/gemini-key-provider';
import { withRetry } from '@/lib/utils/withRetry';

const BASE_URL = 'https://generativelanguage.googleapis.com';

interface GeminiConfig {
  apiKey?: string;
}

interface GenerateContentOptions {
  model?: string;
  systemInstruction?: string;
  responseSchema?: unknown; // For structured output if we decide to use it
  generationConfig?: unknown;
}

export class GeminiClient {
  private explicitKey?: string;

  constructor(config?: GeminiConfig) {
    this.explicitKey = config?.apiKey;
  }

  private getKeys(): string[] {
    if (this.explicitKey) {
      return [this.explicitKey];
    }
    return getAllKeys();
  }

  /**
   * Uploads a file using the resumable upload protocol.
   * Returns the uploaded file metadata including uri.
   */
  async uploadFile(buffer: Buffer, mimeType: string, displayName: string = 'Upload'): Promise<{ uri: string; name: string }> {
    const keys = this.getKeys();
    let lastError: Error | undefined;

    for (const apiKey of keys) {
      try {
        return await withRetry(async () => {
          const numBytes = buffer.length;

          // Step 1: Start resumable upload
          const startUploadUrl = `${BASE_URL}/upload/v1beta/files?key=${apiKey}`;
          const startHeaders = {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': numBytes.toString(),
            'X-Goog-Upload-Header-Content-Type': mimeType,
            'Content-Type': 'application/json',
          };

          const startRes = await fetch(startUploadUrl, {
            method: 'POST',
            headers: startHeaders,
            body: JSON.stringify({ file: { display_name: displayName } }),
          });

          if (!startRes.ok) {
            const text = await startRes.text();
            throw new Error(`Failed to initiate upload: ${startRes.status} ${startRes.statusText} - ${text}`);
          }

          const uploadUrl = startRes.headers.get('x-goog-upload-url');
          if (!uploadUrl) {
            throw new Error('Failed to get upload URL from Gemini');
          }

          // Step 2: Upload the actual bytes
          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Length': numBytes.toString(),
              'X-Goog-Upload-Offset': '0',
              'X-Goog-Upload-Command': 'upload, finalize',
            },
            body: new Blob([buffer as unknown as BlobPart]),
          });

          if (!uploadRes.ok) {
            const text = await uploadRes.text();
            throw new Error(`Failed to upload file bytes: ${uploadRes.status} ${uploadRes.statusText} - ${text}`);
          }

          const fileInfo = await uploadRes.json();
          return fileInfo.file;
        });
      } catch (error) {
        lastError = error as Error;
        console.warn(`Upload failed with key ending in ...${apiKey.slice(-4)}. Trying next key.`);
        continue;
      }
    }
    throw lastError || new Error('Upload failed with all available keys');
  }

  /**
   * Generates content from text and optional file.
   */
  async generateContent(
    prompt: string,
    file?: { uri: string; mimeType: string },
    options: GenerateContentOptions = {}
  ): Promise<string> {
    const keys = this.getKeys();
    let lastError: Error | undefined;

    for (const apiKey of keys) {
      try {
        return await withRetry(async () => {
          const model = options.model;
          const url = `${BASE_URL}/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const parts: Record<string, unknown>[] = [];
          
          // Add file if present
          if (file) {
            parts.push({
              file_data: {
                mime_type: file.mimeType,
                file_uri: file.uri,
              },
            });
          }

          // Add prompt
          parts.push({ text: prompt });

          const body: Record<string, unknown> = {
            contents: [
              {
                parts: parts,
              },
            ],
            generationConfig: options.generationConfig || {},
          };

          // Add system instruction if present
          if (options.systemInstruction) {
            body.system_instruction = {
              parts: [{ text: options.systemInstruction }],
            };
          }

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(`Gemini API error: ${res.status} ${res.statusText} - ${text}`);
          }

          const data = await res.json();
          
          // Extract text from response
          // Response structure: candidates[0].content.parts[0].text
          if (data.candidates && data.candidates.length > 0 && data.candidates[0].content && data.candidates[0].content.parts.length > 0) {
            return data.candidates[0].content.parts[0].text;
          }

          return '';
        });
      } catch (error) {
        lastError = error as Error;
        console.warn(`Generate content failed with key ending in ...${apiKey.slice(-4)}. Trying next key.`);
        continue;
      }
    }
    throw lastError || new Error('Generate content failed with all available keys');
  }
}
