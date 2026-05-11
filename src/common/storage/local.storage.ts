import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import * as fs from "fs";

import * as path from "path";

import { StorageService } from "./storage.service";

@Injectable()
export class LocalStorageService extends StorageService {
  async upload(
    file: any,
    folder: string,
  ): Promise<string> {
    try {
      const buffer = file.buffer;

      if (
        !buffer ||
        !Buffer.isBuffer(buffer)
      ) {
        throw new Error(
          "Invalid file buffer",
        );
      }

      const safeFilename =
  (
    file.originalname ||
    file.filename ||
    "image.jpg"
  ).replace(
    /[^a-zA-Z0-9.-]/g,
    "_",
  );
      const finalName = `${Date.now()}-${safeFilename}`;

      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        folder,
      );

      await fs.promises.mkdir(
        uploadDir,
        {
          recursive: true,
        },
      );

      const filePath = path.join(
        uploadDir,
        finalName,
      );

      await fs.promises.writeFile(
        filePath,
        buffer,
      );

      return `uploads/${folder}/${finalName}`;
    } catch (error) {
      console.error(error);

      throw new InternalServerErrorException(
        "File upload failed",
      );
    }
  }

  async delete(
    filePath: string,
  ): Promise<boolean> {
    try {
      const fullPath = path.join(
        process.cwd(),
        filePath,
      );

      if (
        fs.existsSync(fullPath)
      ) {
        await fs.promises.unlink(
          fullPath,
        );
      }

      return true;
    } catch (error) {
      console.error(error);

      return false;
    }
  }
}