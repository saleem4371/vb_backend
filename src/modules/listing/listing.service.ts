import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { VenueParent } from './entities/venue-parent.entity';
import { VenueChild } from './entities/venue-child.entity';
import { VenueChildAmenities } from './entities/venue-child-amenities.entity';
import { VenueGallery } from './entities/venue-gallery.entity';
import { VenueShiftTiming } from './entities/venue-shift-timing.entity';
import { VenueShiftHeader } from './entities/venue-shift-header.entity';
import { VenueGalleryCategory } from './entities/venue-gallery-category.entity';
import { UserRole } from './entities/user-role.entity';
import { UserEntity } from './entities/user.entity';
import { Pricing } from './entities/property_pricing.entity';
import { StorageService } from 'src/common/storage/storage.service';
import { CATEGORY_CONFIG,buildPricingArray } from '../../helpers/pricing.helper';

import { buildVenueShifts } from '../../helpers/shift.helper';

@Injectable()
export class ListingService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(VenueParent)
    private readonly parentRepo: Repository<VenueParent>,

    @InjectRepository(VenueChild)
    private readonly childRepo: Repository<VenueChild>,

    @InjectRepository(VenueChildAmenities)
    private readonly amenitiesRepo: Repository<VenueChildAmenities>,

    @InjectRepository(VenueShiftHeader)
    private readonly shiftHeaderRepo: Repository<VenueShiftHeader>,

    @InjectRepository(VenueGallery)
    private readonly venueGalRepo: Repository<VenueGallery>,

    @InjectRepository(VenueGalleryCategory)
    private readonly venueGalCatRepo: Repository<VenueGalleryCategory>,

    @InjectRepository(VenueShiftTiming)
    private readonly venueTimeRepo: Repository<VenueShiftTiming>,

    @InjectRepository(UserRole)
    private readonly UserRoleRepo: Repository<UserRole>,

    @InjectRepository(UserEntity)
    private readonly UserEntityRepo: Repository<UserEntity>,

    @InjectRepository(Pricing)
    private readonly PricingRepo: Repository<Pricing>,

    private storageService: StorageService,
  ) {}

  /* =========================================================
     MAIN CREATE LISTING API
    ========================================================= */
  async create(data: {
    body: any;
    images: any;
    coverImage: any;
    bannerImage: any;
    user: any;
  }) {
    const userId = data.user?.id;

    console.log(data);
    /* =========================================================
                           User Updte
     ========================================================= */

    const vendorId = await this.generateVendorId();
    await this.UserEntityRepo.update(
      { id: userId },
      {
        vendor_id: vendorId,
      },
    );

    /* =========================================================
                           vendor Create
     ========================================================= */
    const userCat = this.UserRoleRepo.create({
      userId: userId,
      roleId: 2,
      autoRole: Number(0),

      maskData: Number(0),
    });
    await this.UserRoleRepo.save(userCat);
    /* =========================================================
                           Prent VENUES
     ========================================================= */
     // check here parent_venue_id
    // const parentVenue = this.parentRepo.create({
    //   venueName: data.body.title,
    //   venueCompanyName: data.body.title,
    //   parentAutoNo: data.body.title,
    //   venueAddress: data.body.address,
    //   venueState: data.body.state || '',
    //   venueCity: data.body.city,
    //   venuePincode: data.body.pincode || '',
    //   venueCountry: data.body.country,
      
    //   district: '',
    //   rating: 0,
    //   lat: Number(data.body.lat || 0),
    //   lng: Number(data.body.lng || 0),
    //   reviews: 1,
    //   placeId: '',
    //   createdBy: userId,
    //   userRatingsTotal: 1,
    //   publishStatus: '0',
    //   propetyCategory: data.body.category,
    // });
    // const savedVenue = await this.parentRepo.save(parentVenue);
    let savedVenue;
    let Child_count = 1;

if (data.body.parent_venue_id) {
  const existingVenue = await this.parentRepo.findOne({
    where: {
      parent_venue_id: data.body.parent_venue_id,
    },
  });
 Child_count = existingVenue ? Number(existingVenue.child_count): 1;

  if (existingVenue) {
   
    Object.assign(existingVenue, {
      venueAddress: data.body.address,
      venueState: data.body.state || '',
      venueCity: data.body.city,
      venuePincode: data.body.pincode || '',
      venueCountry: data.body.country === 'IN' ? '2' : '3',
      lat: Number(data.body.lat || 0),
      lng: Number(data.body.lng || 0),
      propetyCategory: data.body.category,
      
    });

    savedVenue = await this.parentRepo.save(existingVenue);

    
  }
}

if (!savedVenue) {
  const parentVenue = this.parentRepo.create({
    venueName: data.body.title,
    venueCompanyName: data.body.title,
    parentAutoNo: data.body.title,
    venueAddress: data.body.address,
    venueState: data.body.state || '',
    venueCity: data.body.city,
    venuePincode: data.body.pincode || '',
    venueCountry: data.body.country === 'IN' ? '2' : '3',
    district: '',
    rating: 0,
    lat: Number(data.body.lat || 0),
    lng: Number(data.body.lng || 0),
    reviews: 1,
    placeId: '',
    createdBy: userId,
    userRatingsTotal: 1,
    publishStatus: '0',
    propetyCategory: data.body.category,
    child_count:1
  });

  savedVenue = await this.parentRepo.save(parentVenue);
}

    /* =========================================================
                           CHILD VENUES
    ========================================================= */

    const capacitySetting =
      typeof data.body.capacity_setting === 'string'
        ? JSON.parse(data.body.capacity_setting)
        : data.body.capacity_setting;

    let categoryData = {};
    const pricing = data.body.pricing || {};

    if (data.body.category == 'venue') {
      categoryData = {
        uShape: capacitySetting?.seatingStyles?.ushape?.capacity || 0,
        banquetRound: capacitySetting?.seatingStyles?.banquet?.capacity || 0,
        cocktailRound: capacitySetting?.seatingStyles?.cocktail?.capacity || 0,
        theater: capacitySetting?.seatingStyles?.theatre?.capacity || 0,
        classroom: capacitySetting?.seatingStyles?.classroom?.capacity || 0,
        boardroom: capacitySetting?.seatingStyles?.boardroom?.capacity || 0,
        eShape: capacitySetting?.seatingStyles?.e_shape?.capacity || 0,
        hollowSquare:
          capacitySetting?.seatingStyles?.hollow_square?.capacity || 0,
        perimeterSeating:
          capacitySetting?.seatingStyles?.perimeter_seating?.capacity || 0,
        royalConf: capacitySetting?.seatingStyles?.royal_conf?.capacity || 0,
        tShape: capacitySetting?.seatingStyles?.t_shape?.capacity || 0,
        talkShow: capacitySetting?.seatingStyles?.cabaret?.capacity || 0,
        guestRooms: Number(data.body.capacity_maxGuests || 0),
      };
    } else if (data.body.category == 'farmstay') {
      categoryData = {
        // banquetRound: capacitySetting?.rooms || 0,
        // cocktailRound: capacitySetting?.beds || 0,
        // guestRooms: capacitySetting?.bathrooms || 0,
        checkIn: pricing?.checkIn || '3:00 PM',
        checkOut: pricing?.checkOut || '11:00 AM',
        
      };

      

//FarmStayCapacity

    } else if (data.body.category == 'studio') {
      categoryData = {
        banquetRound: capacitySetting?.sizeSqft || 0,
        cocktailRound: capacitySetting?.maxOccupancy || 0,
        guestRooms : capacitySetting?.maxOccupancy || 0
      };
    } else if (data.body.category == 'workspace') {
      categoryData = {
        guestRooms: capacitySetting?.seatingCapacity || 0,
        banquetRound: capacitySetting?.sizeSqft || 0,
      };
    } else if (data.body.category == 'rental') {
      categoryData = {
        guestRooms: capacitySetting?.maxGuests || 0,
        banquetRound: capacitySetting?.bedrooms || 0,
        cocktailRound: capacitySetting?.bathrooms || 0,
      };
    } else if (data.body.category == 'experience') {
      categoryData = {
        guestRooms: capacitySetting?.maxGuests || 0,
        banquetRound: capacitySetting?.groupSize || 0,
        cocktailRound: capacitySetting?.duration || 0,
      };
    }
    const ChildVenue = this.childRepo.create({
      parentVenueId: savedVenue.parent_venue_id,
      venueCategoryId: data.body.subcategory,
      createdBy: userId,
      // moreInfo: data.body.description,
      childVenueName: data.body.title,
      minGuest: Number(data.body.capacity_minGuests || 0),
     
      totalMeetingSpace: data.body.totalMeetingSpace,
      moreInfo: data.body.description,
      childVenueDetails: data.body.childVenueDetails,
      ...categoryData,
      venueMode: data.body.mode,
      publishStatus: 0,
    });
    const savedChildVenue = await this.childRepo.save(ChildVenue);


    if (data.body.category == 'farmstay') {
     const FarmStayCapacity = typeof data.body.capacity_setting === 'string'
        ? JSON.parse(data.body.capacity_setting)
        : data.body.capacity_setting;

      await this.dataSource.query(
          `INSERT INTO venue_attributes (venue_id, category_id,max_adults,max_kids,
          pets_allowed,room_combined,room_types,property_area,property_area_type,bathroom_facilities,bed_types,created_at,updated_at)
         VALUES (?, ? , ? ,? ,? ,? , ? , ? , ? ,?, ? , NOW() , NOW())`,
          [
            savedChildVenue.child_venue_id,
            2,
            FarmStayCapacity.maxAdults,
            FarmStayCapacity.maxKids,
            FarmStayCapacity.pet_allowed == 'yes' ? 1 : 0,
            FarmStayCapacity.roomCombination == 'yes' ? 1 : 0,
            FarmStayCapacity.propertyArea,
            FarmStayCapacity.propertyAreaUnit,
            JSON.stringify(FarmStayCapacity.roomTypes),
            JSON.stringify(FarmStayCapacity.bathroomFacilities),
            JSON.stringify(FarmStayCapacity.bedTypes)
          ],
      );

    }

     /* =========================================================
                           Tags 
     ========================================================= */
     await this.dataSource.query(
          `INSERT INTO venue_tags (child_venue_id, venue_cat_id)
         VALUES (?, ?)`,
          [savedChildVenue.child_venue_id, data.body.subcategory],
      );

    /* =========================================================
                           Menties
     ========================================================= */
    const amenities = (data.body.amenities || []).map((amenityId) => {
      return this.amenitiesRepo.create({
        amenitiesId: amenityId,

        createdBy: userId,

        childVenueId: savedChildVenue.child_venue_id,
      });
    });
    await this.amenitiesRepo.save(amenities);
    /* =========================================================
                           Gleery Ctgory
     ========================================================= */
    const gcategory = this.venueGalCatRepo.create({
      name: 'additonal images',
      description: 'additonal images Description',
      vendorId: userId,
      childId: savedChildVenue.child_venue_id,
      createdBy: userId,
    });
    const savedgCategoryVenue = await this.venueGalCatRepo.save(gcategory);
    /* =========================================================
                           gllery
     ========================================================= */
    // COVER IMAGE
    if (data.coverImage) {
      const uploadFile = {
        fieldname: 'cover_image',
        originalname: data.coverImage.originalname,
        encoding: '7bit',
        mimetype: data.coverImage.mimetype,
        buffer: data.coverImage.buffer,
        size: data.coverImage.buffer.length,
      };
      const uploaded = await this.storageService.upload(
        uploadFile,
        'venues/cover',
      );
      await this.venueGalRepo.save({
        childVenueId: savedChildVenue.child_venue_id,
        attachment: uploaded,
        name: '',
        categoryId: savedgCategoryVenue.id,
        description: '',
        imageType: '1', // COVER
        fileExtension: 'png',
      });
    }
    // BANNER IMAGE
    if (data.bannerImage) {
      const uploadFile = {
        fieldname: 'banner_image',
        originalname: data.bannerImage.originalname,
        encoding: '7bit',
        mimetype: data.bannerImage.mimetype,
        buffer: data.bannerImage.buffer,
        size: data.bannerImage.buffer.length,
      };

      const uploaded = await this.storageService.upload(
        uploadFile,
        'venues/banner',
      );
      await this.venueGalRepo.save({
        childVenueId: savedChildVenue.child_venue_id,
        attachment: uploaded,
        name: '',
        categoryId: savedgCategoryVenue.id,
        description: '',
        imageType: '2', // BANNER
        fileExtension: 'png',
      });
    }
    // GALLERY IMAGES
    if (data.images?.length) {
      const galleryPayload: any[] = [];

      for (const file of data.images) {
        const uploadFile = {
          fieldname: 'images',
          originalname: file.originalname,
          encoding: '7bit',
          mimetype: file.mimetype,
          buffer: file.buffer,
          size: file.buffer.length,
        };

        const uploaded = await this.storageService.upload(
          uploadFile,
          'venues/gallery',
        );

        galleryPayload.push({
          childVenueId: savedChildVenue.child_venue_id,
          attachment: uploaded,
          name: '',
          categoryId: savedgCategoryVenue.id,
          description: '',
          imageType: '3', // GALLERY
          fileExtension: 'png',
        });
      }

      await this.venueGalRepo.save(galleryPayload);
    }
    /* =========================================================
                          Shift Heder
     ========================================================= */

    const category = data.body.category;
    const config = CATEGORY_CONFIG[category];
    if (config?.type === 'shift') {
      const { shiftHeaders, venueTimes } = buildVenueShifts(
        pricing,
        String(savedChildVenue.child_venue_id),
      );
      await this.shiftHeaderRepo.save(shiftHeaders);
      await this.venueTimeRepo.save(venueTimes);
    } else if (config?.type === 'pricing') {
      const pricingArray = buildPricingArray(
        category,
        pricing,
        String(savedChildVenue.child_venue_id),
      );
      await this.PricingRepo.save(pricingArray);
    }
    /* =========================================================
                           shift Timing
     ========================================================= */


 /* =========================================================
                        Settings
     ========================================================= */

     const sd = data.body?.pricing?.deposit;
     if(sd)
     {
              this.dataSource.query(
          `
        INSERT INTO venue_child_settings
        (
          child_id,
          group,
          key,
          value
        )

        VALUES (?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
        value = VALUES(value)
        `,
          [savedChildVenue.child_venue_id, 'deposits','secAmt', sd ],
        );
     }
const yourPlans = await this.dataSource.query(
  `SELECT id
   FROM plans
   WHERE max_venue = ? 
     AND recomended = 1 
     AND status = 1`,
  [Child_count],
);

for (const plan of yourPlans) {
  await this.dataSource.query(
    `INSERT INTO vendor_options (
      parent_id,
      option_type,
      option_key,
      created_at
    ) VALUES (?, ?, ?, NOW())`,
    [
      savedVenue.parent_venue_id,
      'plans',
      plan.id,
    ],
  );
}

    return {
      success: true,
      data,
    };
  }

  private async generateVendorId(): Promise<string> {
    const lastVendor = await this.UserEntityRepo.findOne({
      where: {
        vendor_id: Not(IsNull()),
      },
      order: {
        id: 'DESC',
      },
      select: ['vendor_id'],
    });

    const next = lastVendor?.vendor_id
      ? parseInt(lastVendor.vendor_id.replace('V', ''), 10) + 1
      : 1;

    return `V${next.toString().padStart(5, '0')}`;
  }  
  

  async create_parent(id: any, body: any, image: any, Country: any) {
let uploaded = '';
    if (image) {
      const uploadFile = {
        fieldname: 'logo',
       originalname: image.originalname || image.filename,
        encoding: '7bit',
        mimetype: image.mimetype,
        buffer: image.buffer,
      };
      uploaded = await this.storageService.upload(
        uploadFile,
        'venues/parent/logo',
      );
    }

    const parentVenue = this.parentRepo.create({
      venueName: body.property_name,
      venueCompanyName: body.property_name,
      logo: uploaded,
      child_count: body.child_venue_count,
      conatct_person: body.contact_person,
      email: body.email || '',
      phone: body.phone,
      property_size: body.property_size || '',//size_unit
      build_year: body.built_year,
      opertaion_year: body.operating_since,
      aboutVenues: body.description,
      propetyCategory: body.category,
      venueCountry: Country,
      createdBy: id
    });
    const savedVenue = await this.parentRepo.save(parentVenue);
    return savedVenue.parent_venue_id;
  }

async parent_last_create_id(id: any, type: any) {
  const parent = await this.dataSource.query(
    `
    SELECT parent_venue_id
    FROM venue_parent
    WHERE created_by = ?
      AND (propety_category = ? OR propety_category IS NULL OR propety_category = '')
    ORDER BY parent_venue_id DESC
    LIMIT 1
    `,
    [id, type],
  );

  return parent?.[0]?.parent_venue_id ?? null;
}

async parent_of_category(id: any, type: any) {

  const parent = await this.dataSource.query(
    `
    SELECT *
    FROM venue_parent
    WHERE created_by = ? AND propety_category = ?
    LIMIT 1
    `,
    [id, type],
  );

  return parent;
}

async listing_sub_check(id: any, type: any) {

   const singular = type.endsWith("s")
  ? type.slice(0, -1)
  : type;

    const [categorys] = await this.dataSource.query(
  `SELECT id FROM category WHERE name = ? limit 1`,
  [singular],
); 

  const parent = await this.dataSource.query(
    `
    SELECT *
    FROM user_subscriptions
    WHERE user_id = ? AND category_id = ?
    LIMIT 1
    `,
    [id, categorys.id],
  );

  return parent;
}

async child_of_category(id: any, type: any) {

   const singular = type.endsWith("s")
  ? type.slice(0, -1)
  : type;

    const [categorys] = await this.dataSource.query(
  `SELECT id FROM category WHERE name = ? limit 1`,
  [singular],
); 

  const parent = await this.dataSource.query(
    `
    SELECT *
    FROM venue_child 
    LEFT JOIN venue_parent ON venue_parent.parent_venue_id = venue_child.parent_venue_id
    WHERE venue_child.created_by = ? AND propety_category = ?
    `,
    [id, singular],
  );

  return parent;
}
}

