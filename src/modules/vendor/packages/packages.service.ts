import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

import { PackageCategory } from './entity/package-category.entity';

//categoryRepository

@Injectable()
export class PackagesService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
    @InjectRepository(PackageCategory)
    private readonly packageCat: Repository<PackageCategory>,
  ) {}

  async package_category(user_id: any, id: any) {
    const category = await this.dataSource.query(
      `SELECT * FROM package_items_category WHERE created_by = ? AND  types = ? `,
      [user_id, 0],
    );

    // const addon_category = await this.dataSource.query(
    //   `SELECT * FROM package_items_category WHERE created_by = ? AND  types = ? `,
    //   [user_id, 1],
    // );

   const items = await this.packageCat.find({
      where: {
        created_by: id,
        types: 0,
      },
      relations: {
        package_item: true,
      },
    });

      const addon_category = await this.packageCat.find({
      where: {
        created_by: id,
        types: 1,
      },
      relations: {
        package_item: true,
      },
    });



    return {
      category: category,
      addon_category: addon_category,
      items: items,
    };
  }

  async create_category(user_id: any, body: any) {
    if (body.id) {
      await this.dataSource.query(
        `
      UPDATE package_items_category
      SET
        item_category = ?,
        updated_at = NOW()
      WHERE id = ?
        AND created_by = ?
      `,
        [body.name, body.id, user_id],
      );

      return { message: 'Category updated' };
    }

    await this.dataSource.query(
      `
    INSERT INTO package_items_category
    (
      item_category,
      created_by,
      types,
      updated_at,
      created_at
    )
    VALUES (?, ?, ?, NOW(), NOW())
    `,
      [body.name, user_id, body.type],
    );

    return { message: 'Category created' };
  }
  async updateCategoryPublish(body: any) {
    await this.dataSource.query(
      `
      UPDATE package_items_category
      SET
        cat_publish = ?,
        updated_at = NOW()
      WHERE id = ?
      `,
      [body.status, body.id],
    );
  }

  async create_items(body: any, files: any, id: any) {
  let attachment = '';

  if (files?.length) {
    attachment = await this.storageService.upload(
      files[0],
      'venue/package',
    );
  }
const itemId = Number(body.id);
  if (!itemId) {
    await this.dataSource.query(
      `INSERT INTO package_items_list
      (
        cat_id,
        item_name,
        item_price,
        item_price_1,
        created_by,
        image,
        food_pre,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        body.cat_id,
        body.name,
        body.price,
        0,
        id,
        attachment,
        body.foodType,
      ],
    );
  } else {
    // Keep old image if no new image uploaded
    if (attachment) {
      await this.dataSource.query(
        `UPDATE package_items_list
         SET
           cat_id = ?,
           item_name = ?,
           item_price = ?,
           image = ?,
           food_pre = ?,
           updated_at = NOW()
         WHERE id = ? AND created_by = ?`,
        [
          body.cat_id,
          body.name,
          body.price,
          attachment,
          body.foodType,
          body.id,
          id,
        ],
      );
    } else {
      await this.dataSource.query(
        `UPDATE package_items_list
         SET
           cat_id = ?,
           item_name = ?,
           item_price = ?,
           food_pre = ?,
           updated_at = NOW()
         WHERE id = ? AND created_by = ?`,
        [
          body.cat_id,
          body.name,
          body.price,
          body.foodType,
          body.id,
          id,
        ],
      );
    }
  }
}

async delete_items(id: any) {
  const [item] = await this.dataSource.query(
    `SELECT image
     FROM package_items_list
     WHERE id = ?`,
    [id],
  );

  if (item?.image) {
    await this.storageService.delete(item.image);
  }

  await this.dataSource.query(
    `DELETE FROM package_items_list
     WHERE id = ?`,
    [id],
  );

  return true;
}


}
