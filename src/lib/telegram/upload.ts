import { Api, TelegramClient } from 'telegram';
import { FloodWaitError } from 'telegram/errors';
import { generateRandomBytes, readBigIntFromBuffer } from 'telegram/Helpers';

/**
 * Browser-native streaming uploader.
 *
 * GramJS's sendFile/uploadFile rejects a browser `File` ("Cannot use [object File]
 * as file.") and its CustomFile path reads the whole file into memory. This reads
 * the file part-by-part with Blob.slice(), so memory stays at ~workers x 512 KB,
 * and returns an InputFile/InputFileBig handle that sendFile accepts.
 */

const PART_SIZE = 512 * 1024; // Telegram's maximum part size
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024;
const MAX_PART_RETRIES = 5;

export interface BlobUploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  workers?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cancelledError() {
  return new Error('Upload cancelled');
}

export async function uploadBlob(
  client: TelegramClient,
  blob: Blob,
  name: string,
  { onProgress, signal, workers = 4 }: BlobUploadOptions = {}
): Promise<Api.InputFile | Api.InputFileBig> {
  if (!client.connected) await client.connect();
  const size = blob.size;
  if (size === 0) throw new Error(`"${name}" is empty`);

  const fileId = readBigIntFromBuffer(generateRandomBytes(8), true, true);
  const isLarge = size > LARGE_FILE_THRESHOLD;
  const partCount = Math.ceil(size / PART_SIZE);
  let done = 0;
  let nextPart = 0;
  onProgress?.(0);

  const sendPart = async (index: number) => {
    const start = index * PART_SIZE;
    const chunk = blob.slice(start, Math.min(start + PART_SIZE, size));
    const bytes = Buffer.from(new Uint8Array(await chunk.arrayBuffer()));
    for (let attempt = 0; ; attempt += 1) {
      if (signal?.aborted) throw cancelledError();
      try {
        const ok = await client.invoke(
          isLarge
            ? new Api.upload.SaveBigFilePart({
                fileId,
                filePart: index,
                fileTotalParts: partCount,
                bytes,
              })
            : new Api.upload.SaveFilePart({ fileId, filePart: index, bytes })
        );
        if (!ok) throw new Error(`Telegram rejected part ${index + 1}/${partCount}`);
        return;
      } catch (error) {
        if (error instanceof FloodWaitError) {
          await sleep(error.seconds * 1000);
          continue;
        }
        if (attempt >= MAX_PART_RETRIES) throw error;
        await sleep(1000 * 2 ** attempt);
      }
    }
  };

  const worker = async () => {
    while (nextPart < partCount) {
      if (signal?.aborted) throw cancelledError();
      const index = nextPart;
      nextPart += 1;
      await sendPart(index);
      done += 1;
      onProgress?.(done / partCount);
    }
  };

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(workers, partCount)) }, worker)
  );

  return isLarge
    ? new Api.InputFileBig({ id: fileId, parts: partCount, name })
    : new Api.InputFile({ id: fileId, parts: partCount, name, md5Checksum: '' });
}

/** Upload a Blob/File and post it to Saved Messages as a document. */
export async function sendBlobAsDocument(
  client: TelegramClient,
  blob: Blob,
  name: string,
  caption: string,
  options: BlobUploadOptions = {}
): Promise<Api.Message> {
  const inputFile = await uploadBlob(client, blob, name, options);
  if (options.signal?.aborted) throw cancelledError();
  const mimeType = blob.type || 'application/octet-stream';
  const result = await client.invoke(
    new Api.messages.SendMedia({
      peer: 'me',
      media: new Api.InputMediaUploadedDocument({
        file: inputFile,
        mimeType,
        attributes: [new Api.DocumentAttributeFilename({ fileName: name })],
        forceFile: true,
      }),
      message: caption,
      randomId: readBigIntFromBuffer(generateRandomBytes(8), true, true),
    })
  );
  const message = extractMessage(result);
  if (!message) throw new Error(`Upload of "${name}" finished but no message was returned`);
  return message;
}

function extractMessage(result: Api.TypeUpdates): Api.Message | undefined {
  const updates =
    result instanceof Api.Updates || result instanceof Api.UpdatesCombined
      ? result.updates
      : result instanceof Api.UpdateShort
        ? [result.update]
        : [];
  for (const update of updates) {
    if (
      (update instanceof Api.UpdateNewMessage ||
        update instanceof Api.UpdateNewChannelMessage) &&
      update.message instanceof Api.Message
    ) {
      return update.message;
    }
  }
  return undefined;
}
