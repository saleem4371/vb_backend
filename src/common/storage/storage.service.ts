export abstract class StorageService {
  abstract upload(
    file: any,
    folder: string,
  ): Promise<string>;

  abstract delete(
    filePath: string,
  ): Promise<boolean>;
}