import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { StorageService } from "./storage.service";

@Injectable()
export class S3StorageService extends StorageService {
  private s3: S3Client;

  constructor() {
    super();

    this.s3 = new S3Client({
      region:
        process.env.AWS_REGION || "",

      credentials: {
        accessKeyId:
          process.env.AWS_ACCESS_KEY_ID ||
          "",

        secretAccessKey:
          process.env.AWS_SECRET_ACCESS_KEY ||
          "",
      },
    });
  }

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

      const key = `${folder}/${Date.now()}-${safeFilename}`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket:
            process.env.AWS_BUCKET || "",

          Key: key,

          Body: buffer,

          ContentType:
            file.mimetype,
        }),
      );

      return key;
    } catch (error) {
      console.error(error);

      throw new InternalServerErrorException(
        "S3 upload failed",
      );
    }
  }

  async delete(
    filePath: string,
  ): Promise<boolean> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket:
            process.env.AWS_BUCKET || "",

          Key: filePath,
        }),
      );

      return true;
    } catch (error) {
      console.error(error);

      return false;
    }
  }
}
