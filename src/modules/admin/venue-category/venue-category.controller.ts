import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Query,
  Req,
  BadRequestException,
} from "@nestjs/common";

import type {
  FastifyRequest,
} from "fastify";

import { VenueCategoryService } from "./venue-category.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";

@Controller("admin/category")
export class VenueCategoryController {
  constructor(private readonly categoryService: VenueCategoryService) {}

  // ✅ CREATE
 @Post("categoryInsertApi")
async create(@Req() req: FastifyRequest) {
  try {
    console.log("START CREATE");

    const parts = req.parts();

    const body: any = {};
    let icon: any = null;
    let image: any = null;

    for await (const part of parts) {
      console.log(
        "PART:",
        part.type,
        part.fieldname,
      );

      if (part.type === "file") {
        console.log(
          "FILE:",
          part.filename,
        );

        if (!part.filename) {
          continue;
        }

        const buffer =
          await part.toBuffer();

        console.log(
          "BUFFER SIZE:",
          buffer.length,
        );

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (
          part.fieldname === "icon"
        ) {
          icon = fileData;
        }

        if (
          part.fieldname === "image"
        ) {
          image = fileData;
        }
      }

      if (part.type === "field") {
        body[part.fieldname] =
          String(part.value);

        console.log(
          "FIELD:",
          part.fieldname,
          part.value,
        );
      }
    }

    console.log("BODY:", body);
    console.log(
      "ICON:",
      !!icon,
    );
    console.log(
      "IMAGE:",
      !!image,
    );

    return await this.categoryService.create(
      body,
      icon,
      image,
    );
  } catch (error: any) {
    console.error(
      "CONTROLLER ERROR:",
      error,
    );

    throw error;
  }
}

  // ✅ GET ALL
  @Get('categoryApi')
findAll(@Query() query: any) {
  return this.categoryService.findAll(query);
}

@Get('category')
  get_category(@Req() req) {
    return this.categoryService.category();
  }


  // ✅ GET BY ID
  @Get(":id")
  findOne(@Param("id") id: number) {
    return this.categoryService.findOne(Number(id));
  }

  // ✅ UPDATE
   @Put("categoryUpdateApi/:id")
  async update(
    @Param("id") id: string,
  @Req() req: FastifyRequest,
  ) {
    try {
    const parts = req.parts();

    const body: any = {};

    let icon: any = null;

    let image: any = null;

    for await (const part of parts) {
      /*
      |--------------------------------------------------------------------------
      | FILES
      |--------------------------------------------------------------------------
      */

      if (part.type === "file") {
        // Skip empty upload
        if (!part.filename) {
          continue;
        }

        const buffer =
          await part.toBuffer();

        // Skip empty buffer
        if (
          !buffer ||
          buffer.length === 0
        ) {
          continue;
        }

        const fileData = {
          buffer,
          filename: part.filename,
          mimetype: part.mimetype,
        };

        if (
          part.fieldname === "icon"
        ) {
          icon = fileData;
        }

        if (
          part.fieldname === "image"
        ) {
          image = fileData;
        }
      }

      /*
      |--------------------------------------------------------------------------
      | FIELDS
      |--------------------------------------------------------------------------
      */

      if (part.type === "field") {
        body[part.fieldname] =
          String(part.value);
      }
    }

    return await this.categoryService.update(
      id,
      body,
      icon,
      image,
    );
  } catch (error) {
    console.error(error);

    throw new BadRequestException(
      'uploaded filed',
    );
  }
  }

  // ✅ DELETE
  @Delete("deleteCategoryApi/:id")
  remove(@Param("id") id: string) {
    return this.categoryService.remove(Number(id));
  }
}
