export type Transfer = {
  signal: AbortSignal;
  onProgress?: (bytes: number, total: number) => void;
};
export type StoredFile = { id: string; name: string };
export type StorageOutput = { name: string; blob: Blob; mimeType: string };
/** Providers own authorization and transport; processing never depends on storage. */
export interface StorageProvider {
  readonly connected: boolean;
  prepare(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): void;
  choose(
    kind: "pdf" | "image",
    signal: AbortSignal,
  ): Promise<StoredFile | null>;
  download(
    file: StoredFile,
    kind: "pdf" | "image",
    transfer: Transfer,
  ): Promise<File>;
  save(output: StorageOutput, transfer: Transfer): Promise<StoredFile>;
}
