import { Injectable } from '@nestjs/common';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import { StorageService } from 'src/common/storage/storage.service';

@Injectable()
export class ParentListingService {
  constructor(
    private dataSource: DataSource,
    private storageService: StorageService,
  ) {}

  async getParent(userId: any) {
    const result = await this.dataSource.query(
      `
    SELECT * 
    FROM venue_parent pv  
    WHERE pv.created_by = ?
    `,
      [userId],
    );

    // dynamic category list
    const categories = [
      ...new Set(result.map((item) => `${item.propety_category}s`)),
    ];

    // grouped result by category
    const groupedResult = result.reduce((acc, item) => {
      const key = `${item.propety_category}s`;

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(item);

      return acc;
    }, {});

    

    return {
      category: categories,
      result: groupedResult,
    };
  }
  // SERVICE

 async saveParent(
  body: any,
  uploadedFiles: any,
  videoFile: any,
  parentId: string,
) {
  try {
    const {
      venue_company_name,
      tagline,
      youtubeUrl,
      social,
      hours,
      categories,
    } = body;

    /* ─────────────────────────────
       PARSE JSON DATA
    ───────────────────────────── */

    const parsedSocial =
      typeof social === 'string'
        ? JSON.parse(social)
        : social || {};

    const parsedHours =
      typeof hours === 'string'
        ? JSON.parse(hours)
        : hours || {};

    let parsedCategories: any[] = [];

    try {
      parsedCategories =
        typeof categories === 'string'
          ? JSON.parse(categories)
          : categories || [];
    } catch {
      parsedCategories = [];
    }

    /* ─────────────────────────────
       GET EXISTING DATA
    ───────────────────────────── */

    const existingVenue = await this.dataSource.query(
      `
      SELECT
        banner_image,
        video_url,
        venue_settings
      FROM venue_parent
      WHERE parent_venue_id = ?
      `,
      [parentId],
    );

    const oldData = existingVenue?.[0] || {};

    /* ─────────────────────────────
       KEEP OLD MEDIA IF NO NEW UPLOAD
    ───────────────────────────── */

    let bannerImageUrl =
      oldData.banner_image || '';

    let videoUrl =
      oldData.video_url || '';

    const imageUrls: string[] = [];

    /* ─────────────────────────────
       BANNER IMAGE UPLOAD
    ───────────────────────────── */

    if (uploadedFiles && uploadedFiles.buffer) {

      /* delete old image */

      if (oldData.banner_image) {
        try {

          const oldKey =
            oldData.banner_image.includes('.amazonaws.com/')
              ? oldData.banner_image.split('.amazonaws.com/')[1]
              : oldData.banner_image;

          if (oldKey) {
            await this.storageService.delete(oldKey);
          }

        } catch (e) {
          console.log('OLD IMAGE DELETE ERROR =>', e);
        }
      }

      /* upload new image */

      bannerImageUrl =
        await this.storageService.upload(
          uploadedFiles,
          'venue/banner',
        );
    }

    /* ─────────────────────────────
       VIDEO UPLOAD
    ───────────────────────────── */

    if (videoFile && videoFile.buffer) {

      /* delete old video */

      if (oldData.video_url) {
        try {

          const oldKey =
            oldData.video_url.includes('.amazonaws.com/')
              ? oldData.video_url.split('.amazonaws.com/')[1]
              : oldData.video_url;

          if (oldKey) {
            await this.storageService.delete(oldKey);
          }

        } catch (e) {
          console.log('OLD VIDEO DELETE ERROR =>', e);
        }
      }

      /* upload new video */

      videoUrl =
        await this.storageService.upload(
          videoFile,
          'venue/video',
        );
    }

    /* ─────────────────────────────
       CATEGORY DATA
    ───────────────────────────── */

    const categoryData: any[] = [];

    for (let i = 0; i < parsedCategories.length; i++) {

      const cat = parsedCategories[i];

      let parsedStats: any[] = [];

      try {

        parsedStats =
          typeof body[`categories[${i}][stats]`] === 'string'
            ? JSON.parse(body[`categories[${i}][stats]`])
            : [];

      } catch {
        parsedStats = [];
      }

      parsedStats = parsedStats.map((s: any) => ({
        label: s.label || '',
        value: s.value || 0,
        iconBg: s.iconBg || '',
        iconColor: s.iconColor || '',
      }));

      categoryData.push({
        name: cat?.name || cat || '',

        bannerType:
          body[`categories[${i}][bannerType]`] || 'image',

        bannerText:
          body[`categories[${i}][bannerText]`] || '',

        about:
          body[`categories[${i}][about]`] || '',

        stats: parsedStats,
      });
    }

    /* ─────────────────────────────
       SETTINGS JSON
    ───────────────────────────── */

    const venueSettings = {
      social: parsedSocial,
      hours: parsedHours,
      categories: categoryData,
      bannerImage: bannerImageUrl,
      galleryImages: imageUrls,
    };


    /* ─────────────────────────────
       FIRST CATEGORY
    ───────────────────────────── */

    const firstCategory =
      categoryData?.[0] || {};

    /* ─────────────────────────────
       UPDATE DB
    ───────────────────────────── */

    await this.dataSource.query(
      `
      UPDATE venue_parent SET

        venue_company_name = ?,
        banner_content = ?,
        youtube_url = ?,

        about_venues = ?,
        banner_section = ?,

        facebook_url = ?,
        instagram_url = ?,
        twitter_url = ?,
        website_url = ?,
        new_youtube= ?,

        banner_image = ?,
        video_url = ?,

        displayMediaType = ?,

        excellence = ?,
        hosted = ?,
        clients = ?,
        capacity = ?,

        venue_settings = ?,

        updated_at = NOW()

      WHERE parent_venue_id = ?
      `,
      [
        venue_company_name || null,
        tagline || null,
        youtubeUrl || null,

        firstCategory.about || null,
        firstCategory.bannerText || null,

        parsedSocial.facebook || null,
        parsedSocial.instagram || null,
        parsedSocial.twitter || null,
        parsedSocial.website || null,
        parsedSocial.youtube || null,

        bannerImageUrl || null,
        videoUrl || null,

        body.displayMediaType,

        body.reviews,
        body.ratings,
        body.clients,
        body.hosted,

        JSON.stringify(venueSettings),

        parentId,
      ],
    );

    return {
      success: true,
      message: 'Parent updated successfully',

      bannerImageUrl,
      videoUrl,

      venueSettings,
    };

  } catch (error) {

    console.log(
      'SAVE PARENT ERROR =>',
      error,
    );

    throw error;
  }
}
}
