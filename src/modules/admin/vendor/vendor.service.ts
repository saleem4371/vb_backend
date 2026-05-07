import { Injectable, UnauthorizedException ,BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class VendorService {
 constructor(
    private dataSource: DataSource
  ) {}

   async GetAmenities() {
    const amenities = await this.dataSource.query(
      `SELECT amenities.id , name, category FROM amenities JOIN amenities_categories ON amenities_categories.id = amenities.amenities_category_id;`
    );

    return amenities;
  }

}
